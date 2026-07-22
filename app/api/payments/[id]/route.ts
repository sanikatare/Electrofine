import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

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

const paymentUpdateSchema = z.object({
  method: clientMethodEnum.optional(),
  status: clientStatusEnum.optional(),
  transactionRef: z.string().trim().max(100).optional().nullable(),
});

const paymentInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  pickupRequest: { select: { id: true, status: true, totalAmount: true } },
} satisfies Prisma.PaymentInclude;

function canAccess(
  session: Awaited<ReturnType<typeof auth>>,
  payment: { customerId: string }
) {
  if (!session?.user) return false;
  if (session.user.userType === "ADMIN") return true;
  return session.user.userType === "CUSTOMER" && session.user.id === payment.customerId;
}

/**
 * GET /api/payments/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: paymentInclude,
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (!canAccess(session, payment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: serializePayment(payment) });
}

/**
 * PUT /api/payments/[id]
 * Admin only — financial records are not customer-editable. Wrapped in a
 * transaction because a status change to PAID must also stamp paidAt
 * atomically with the rest of the update.
 */
export async function PUT(
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

  const parsed = paymentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    const existing = await prisma.payment.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dbStatus = input.status ? toDbStatus(input.status) : undefined;

      return tx.payment.update({
        where: { id: params.id },
        data: {
          ...(input.method && { method: input.method }),
          ...(dbStatus && { status: dbStatus }),
          ...(input.transactionRef !== undefined && {
            transactionRef: input.transactionRef,
          }),
          ...(dbStatus === "COMPLETED" && { paidAt: new Date() }),
          ...(dbStatus === "FAILED" && { paidAt: null }),
        },
        include: paymentInclude,
      });
    });

    return NextResponse.json({ data: serializePayment(updated) });
  } catch (error) {
    console.error("PUT /api/payments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/[id]
 * Admin only. In production, financial records are usually retained
 * (soft-cancelled) rather than hard-deleted — provided here to satisfy
 * the CRUD contract.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  try {
    await prisma.payment.delete({ where: { id: params.id } });
    return NextResponse.json(
      { message: "Payment deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/payments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    );
  }
}
