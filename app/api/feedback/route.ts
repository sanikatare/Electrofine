import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

/**
 * NOTE: assumes `moderationStatus` (enum: PENDING/APPROVED/REJECTED,
 * default PENDING), `moderationNote` (String?), and `moderatedAt`
 * (DateTime?) columns exist on the Feedback model — see schema note above.
 */

const feedbackCreateSchema = z.object({
  pickupRequestId: z.string().cuid("Invalid pickup request id"),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().trim().max(1000).optional().nullable(),
});

const feedbackQuerySchema = z.object({
  kabadiwalaId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  moderationStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const feedbackInclude = {
  customer: { select: { id: true, name: true } },
  kabadiwala: { select: { id: true, name: true } },
} satisfies Prisma.FeedbackInclude;

/**
 * GET /api/feedback
 * ADMIN sees everything (any moderation status).
 * CUSTOMER sees their own submitted feedback (any status).
 * KABADIWALA sees only APPROVED feedback about themselves.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = feedbackQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { kabadiwalaId, customerId, moderationStatus, minRating, page, limit } =
    parsed.data;

  const where: Prisma.FeedbackWhereInput = {
    ...(minRating && { rating: { gte: minRating } }),
  };

  if (session.user.userType === "ADMIN") {
    if (kabadiwalaId) where.kabadiwalaId = kabadiwalaId;
    if (customerId) where.customerId = customerId;
    if (moderationStatus) where.moderationStatus = moderationStatus;
  } else if (session.user.userType === "CUSTOMER") {
    where.customerId = session.user.id;
  } else if (session.user.userType === "KABADIWALA") {
    where.kabadiwalaId = session.user.id;
    where.moderationStatus = "APPROVED";
  }

  try {
    const [data, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: feedbackInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feedback
 * CUSTOMER only — must own the pickup request, which must be COMPLETED
 * and not already have feedback. New feedback starts moderationStatus
 * PENDING and is not publicly visible until an admin approves it.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    const pickup = await prisma.pickupRequest.findUnique({
      where: { id: input.pickupRequestId },
      include: { feedback: true },
    });
    if (!pickup) {
      return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
    }
    if (pickup.customerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pickup.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Feedback can only be submitted for a completed pickup" },
        { status: 409 }
      );
    }
    if (pickup.feedback) {
      return NextResponse.json(
        { error: "Feedback has already been submitted for this pickup" },
        { status: 409 }
      );
    }
    if (!pickup.kabadiwalaId) {
      return NextResponse.json(
        { error: "This pickup has no assigned kabadiwala to rate" },
        { status: 400 }
      );
    }

    const feedback = await prisma.feedback.create({
      data: {
        pickupRequestId: pickup.id,
        customerId: session.user.id,
        kabadiwalaId: pickup.kabadiwalaId,
        rating: input.rating,
        comment: input.comment ?? null,
        moderationStatus: "PENDING",
      },
      include: feedbackInclude,
    });

    return NextResponse.json({ data: feedback }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Feedback has already been submitted for this pickup" },
        { status: 409 }
      );
    }
    console.error("POST /api/feedback error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
