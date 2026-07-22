import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const feedbackUpdateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional().nullable(),
});

const feedbackInclude = {
  customer: { select: { id: true, name: true } },
  kabadiwala: { select: { id: true, name: true } },
} satisfies Prisma.FeedbackInclude;

/**
 * Recomputes a Kabadiwala's average rating from all APPROVED feedback.
 * Intended to be called inside an existing transaction.
 */
async function recalculateKabadiwalaRating(
  tx: Prisma.TransactionClient,
  kabadiwalaId: string
) {
  const aggregate = await tx.feedback.aggregate({
    where: { kabadiwalaId, moderationStatus: "APPROVED" },
    _avg: { rating: true },
  });

  await tx.kabadiwala.update({
    where: { id: kabadiwalaId },
    data: { rating: aggregate._avg.rating ?? 0 },
  });
}

/**
 * GET /api/feedback/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feedback = await prisma.feedback.findUnique({
    where: { id: params.id },
    include: feedbackInclude,
  });
  if (!feedback) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const isOwnerCustomer =
    session.user.userType === "CUSTOMER" && session.user.id === feedback.customerId;
  const isRatedKabadiwala =
    session.user.userType === "KABADIWALA" &&
    session.user.id === feedback.kabadiwalaId &&
    feedback.moderationStatus === "APPROVED";
  const isAdmin = session.user.userType === "ADMIN";

  if (!isAdmin && !isOwnerCustomer && !isRatedKabadiwala) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: feedback });
}

/**
 * PUT /api/feedback/[id]
 * The submitting customer may edit their feedback only while it is still
 * PENDING moderation (editing after approval/rejection is disallowed to
 * preserve moderation integrity).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.feedback.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }
  if (existing.customerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.moderationStatus !== "PENDING") {
    return NextResponse.json(
      { error: "Feedback can no longer be edited once it has been moderated" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.feedback.update({
      where: { id: params.id },
      data: parsed.data,
      include: feedbackInclude,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PUT /api/feedback/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update feedback" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feedback/[id]
 * Admin only. If the feedback being removed was APPROVED, the kabadiwala's
 * average rating is recalculated atomically in the same transaction.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.feedback.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.feedback.delete({ where: { id: params.id } });
      if (existing.moderationStatus === "APPROVED" && existing.kabadiwalaId) {
        await recalculateKabadiwalaRating(tx, existing.kabadiwalaId);
      }
    });

    return NextResponse.json(
      { message: "Feedback deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/feedback/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete feedback" },
      { status: 500 }
    );
  }
}
