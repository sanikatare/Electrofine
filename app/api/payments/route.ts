import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

/**
 * Client-facing method/status vocabulary, restricted to what's supported:
 * Cash / UPI / Bank and Pending / Paid / Failed.
 * "PAID" maps to the Prisma enum value COMPLETED under the hood.
 */
const clientMethodEnum = z.enum(["CASH", "UPI", "BANK_TRANSFER"]);
const clientStatusEnum = z.enum(["PENDING", "PAID", "FAILED"]);

function toDbStatus(status: "PENDING" | "PAID" | "FAILED") {
  return status === "PAID" ? "COMPLETED" : status;
}
function toClientStatus(status: string) {
  return status === "COMPLETED" ? "PAID" : status;
}
function serializePayment<T extends { status: string }>(payment: T) {
  return { ...payment, status: toClientStatus(payment.status) };
}

const paymentCreateSchema = z.object({
  pickupRequestId: z.string().cuid("Invalid pickup request id"),
  amount: z.number().positive("Amount must be greater than 0"),
  method: clientMethodEnum,
  status: clientStatusEnum.optional().default("PENDING"),
  transactionRef: z.string().trim().max(100).optional().nullable(),
});

const paymentQuerySchema = z.object({
  status: clientStatusEnum.optional(),
  method: clientMethodEnum.optional(),
  customerId: z.string().cuid().optional(),
  pickupRequestId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const paymentInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  pickupRequest: { select: { id: true, status: true, totalAmount: true } },
} satisfies Prisma.PaymentInclude;

/**
 * GET /api/payments
 * ADMIN sees all (with filters); CUSTOMER sees only their own payments.
 * KABADIWALA has no direct payment relation and is forbidden.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.userType === "KABADIWALA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = paymentQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, method, customerId, pickupRequestId, page, limit } = parsed.data;

  const where: Prisma.PaymentWhereInput = {
    ...(status && { status: toDbStatus(status) }),
    ...(method && { method }),
    ...(pickupRequestId && { pickupRequestId }),
  };

  if (session.user.userType === "CUSTOMER") {
    where.customerId = session.user.id;
  } else if (customerId) {
    where.customerId = customerId;
  }

  try {
    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      data: data.map(serializePayment),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments
 * ADMIN or the owning CUSTOMER. Validates the pickup request exists,
 * belongs to the customer, has no existing payment, and that the amount
 * matches the pickup's totalAmount (when set).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.userType === "KABADIWALA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paymentCreateSchema.safeParse(body);
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
      include: { payment: true },
    });
    if (!pickup) {
      return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
    }
    if (
      session.user.userType === "CUSTOMER" &&
      pickup.customerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pickup.payment) {
      return NextResponse.json(
        { error: "This pickup request already has a payment" },
        { status: 409 }
      );
    }
    if (
      pickup.totalAmount !== null &&
      Math.abs(Number(pickup.totalAmount) - input.amount) > 0.01
    ) {
      return NextResponse.json(
        {
          error: `Amount does not match pickup total (${pickup.totalAmount})`,
        },
        { status: 400 }
      );
    }

    const dbStatus = toDbStatus(input.status);
    const payment = await prisma.payment.create({
      data: {
        pickupRequestId: input.pickupRequestId,
        customerId: pickup.customerId,
        amount: input.amount,
        method: input.method,
        status: dbStatus,
        transactionRef: input.transactionRef ?? null,
        paidAt: dbStatus === "COMPLETED" ? new Date() : null,
      },
      include: paymentInclude,
    });

    return NextResponse.json(
      { data: serializePayment(payment) },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A payment for this pickup request already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
