import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const notificationTypeEnum = z.enum([
  "PICKUP_UPDATE",
  "PAYMENT",
  "PROMOTION",
  "SYSTEM",
  "FEEDBACK",
]);
const notificationChannelEnum = z.enum(["EMAIL", "SMS", "PUSH", "IN_APP"]);

const notificationCreateSchema = z
  .object({
    type: notificationTypeEnum,
    channel: notificationChannelEnum.optional().default("IN_APP"),
    title: z.string().trim().min(1).max(150),
    message: z.string().trim().min(1).max(1000),
    customerId: z.string().cuid().optional().nullable(),
    kabadiwalaId: z.string().cuid().optional().nullable(),
    pickupRequestId: z.string().cuid().optional().nullable(),
  })
  .refine((v) => !!v.customerId !== !!v.kabadiwalaId, {
    message: "Provide exactly one of customerId or kabadiwalaId as recipient",
  });

const notificationQuerySchema = z.object({
  customerId: z.string().cuid().optional(),
  kabadiwalaId: z.string().cuid().optional(),
  type: notificationTypeEnum.optional(),
  isRead: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * GET /api/notifications
 * ADMIN sees all (with filters). CUSTOMER/KABADIWALA see only their own.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = notificationQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { customerId, kabadiwalaId, type, isRead, page, limit } = parsed.data;

  const where: Prisma.NotificationWhereInput = {
    ...(type && { type }),
    ...(isRead !== undefined && { isRead }),
  };

  if (session.user.userType === "CUSTOMER") {
    where.customerId = session.user.id;
  } else if (session.user.userType === "KABADIWALA") {
    where.kabadiwalaId = session.user.id;
  } else {
    if (customerId) where.customerId = customerId;
    if (kabadiwalaId) where.kabadiwalaId = kabadiwalaId;
  }

  try {
    const [data, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return NextResponse.json({
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Admin only — sends a manual notification to a customer or kabadiwala.
 * (System-triggered notifications, e.g. on pickup cancellation, are
 * created directly by their originating routes.)
 */
export async function POST(request: NextRequest) {
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

  const parsed = notificationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    if (input.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: input.customerId },
      });
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
    }
    if (input.kabadiwalaId) {
      const kabadiwala = await prisma.kabadiwala.findUnique({
        where: { id: input.kabadiwalaId },
      });
      if (!kabadiwala) {
        return NextResponse.json({ error: "Kabadiwala not found" }, { status: 404 });
      }
    }

    const notification = await prisma.notification.create({
      data: {
        type: input.type,
        channel: input.channel,
        title: input.title,
        message: input.message,
        customerId: input.customerId ?? null,
        kabadiwalaId: input.kabadiwalaId ?? null,
        pickupRequestId: input.pickupRequestId ?? null,
      },
    });

    return NextResponse.json({ data: notification }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
