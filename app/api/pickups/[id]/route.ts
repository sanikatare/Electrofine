import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { pickupUpdateSchema } from "@/lib/validations/pickup.schema";

const pickupInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  kabadiwala: { select: { id: true, name: true, phone: true, availability: true } },
  address: true,
  items: { include: { category: { select: { id: true, name: true } } } },
  payment: true,
  feedback: true,
} satisfies Prisma.PickupRequestInclude;

async function resolveUnitPrice(
  tx: Prisma.TransactionClient,
  categoryId: string,
  now: Date
): Promise<number> {
  const pricing = await tx.pricing.findFirst({
    where: {
      categoryId,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!pricing) throw new Error(`NO_ACTIVE_PRICING:${categoryId}`);
  return Number(pricing.pricePerKg);
}

function canAccessPickup(
  session: Awaited<ReturnType<typeof auth>>,
  pickup: { customerId: string; kabadiwalaId: string | null }
) {
  if (!session?.user) return false;
  if (session.user.userType === "ADMIN") return true;
  if (session.user.userType === "CUSTOMER") return session.user.id === pickup.customerId;
  if (session.user.userType === "KABADIWALA")
    return session.user.id === pickup.kabadiwalaId;
  return false;
}

/**
 * GET /api/pickups/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pickup = await prisma.pickupRequest.findUnique({
    where: { id: params.id },
    include: pickupInclude,
  });
  if (!pickup) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }
  if (!canAccessPickup(session, pickup)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: pickup });
}

/**
 * PUT /api/pickups/[id]
 * Updates request fields; if `items` is provided, replaces all items and
 * recomputes totals atomically within a transaction.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.pickupRequest.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }
  if (!canAccessPickup(session, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return NextResponse.json(
      { error: `Cannot update a ${existing.status.toLowerCase()} pickup request` },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = pickupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Customers/Kabadiwalas cannot arbitrarily reassign or force-complete
  if (session.user.userType !== "ADMIN") {
    delete input.kabadiwalaId;
    if (session.user.userType === "CUSTOMER") delete input.status;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const { items, ...fields } = input;

      if (items && items.length > 0) {
        const now = new Date();
        const resolvedItems = await Promise.all(
          items.map(async (item) => {
            const unitPrice =
              item.unitPrice ?? (await resolveUnitPrice(tx, item.categoryId, now));
            const subtotal = Number((unitPrice * item.weight).toFixed(2));
            return {
              categoryId: item.categoryId,
              description: item.description ?? null,
              weight: item.weight,
              unitPrice,
              subtotal,
            };
          })
        );

        const totalWeight = resolvedItems.reduce((s, i) => s + i.weight, 0);
        const totalAmount = Number(
          resolvedItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2)
        );

        // Replace items: delete old, insert new, update totals
        await tx.pickupItem.deleteMany({ where: { pickupRequestId: params.id } });

        return tx.pickupRequest.update({
          where: { id: params.id },
          data: {
            ...fields,
            totalWeight,
            totalAmount,
            items: { create: resolvedItems },
          },
          include: pickupInclude,
        });
      }

      return tx.pickupRequest.update({
        where: { id: params.id },
        data: fields,
        include: pickupInclude,
      });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NO_ACTIVE_PRICING")) {
      const categoryId = error.message.split(":")[1];
      return NextResponse.json(
        { error: `No active pricing configured for category ${categoryId}` },
        { status: 422 }
      );
    }
    console.error("PUT /api/pickups/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update pickup request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pickups/[id]
 * Admin only — hard delete. Explicitly removes dependent rows inside a
 * transaction for defense-in-depth alongside DB-level cascade rules.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.pickupRequest.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction([
      prisma.notification.updateMany({
        where: { pickupRequestId: params.id },
        data: { pickupRequestId: null },
      }),
      prisma.feedback.deleteMany({ where: { pickupRequestId: params.id } }),
      prisma.payment.deleteMany({ where: { pickupRequestId: params.id } }),
      prisma.pickupItem.deleteMany({ where: { pickupRequestId: params.id } }),
      prisma.pickupRequest.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json(
      { message: "Pickup request deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/pickups/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete pickup request" },
      { status: 500 }
    );
  }
}
