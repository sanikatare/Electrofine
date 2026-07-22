import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const moderateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * Recomputes a Kabadiwala's average rating from all APPROVED feedback.
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
 * PATCH /api/feedback/[id]/moderate
 * Admin only. Sets moderationStatus (APPROVED/REJECTED) with an optional
 * moderation note, and — inside the same transaction — recalculates the
 * rated Kabadiwala's average rating so it always reflects only approved
 * reviews.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = moderateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, note } = parsed.data;

  const existing = await prisma.feedback.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const feedback = await tx.feedback.update({
        where: { id: params.id },
        data: {
          moderationStatus: status,
          moderationNote: note ?? null,
          moderatedAt: new Date(),
        },
      });

      if (existing.kabadiwalaId) {
        await recalculateKabadiwalaRating(tx, existing.kabadiwalaId);
      }

      return feedback;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/feedback/[id]/moderate error:", error);
    return NextResponse.json(
      { error: "Failed to moderate feedback" },
      { status: 500 }
    );
  }
}
