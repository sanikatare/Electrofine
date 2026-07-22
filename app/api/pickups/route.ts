import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  pickupCreateSchema,
  pickupQuerySchema,
} from "@/lib/validations/pickup.schema";

const pickupInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  kabadiwala: { select: { id: true, name: true, phone: true, availability: true } },
  address: true,
  items: { include: { category: { select: { id: true, name: true } } } },
} satisfies Prisma.PickupRequestInclude;

/**
 * Resolves the current per-kg price for a category from the Pricing table
 * (most recent active price whose effective window covers "now").
 */
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

  if (!pricing) {
    throw new Error(`NO_ACTIVE_PRICING:${categoryId}`);
  }
  return Number(pricing.pricePerKg);
}

/**
 * GET /api/pickups
 * Role-scoped list: ADMIN sees all, CUSTOMER sees own, KABADIWALA sees assigned.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = pickupQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { search, status, customerId, kabadiwalaId, page, limit } = parsed.data;

  const where: Prisma.PickupRequestWhereInput = {
    ...(status && { status }),
  };

  if (session.user.userType === "CUSTOMER") {
    where.customerId = session.user.id;
  } else if (session.user.userType === "KABADIWALA") {
    where.kabadiwalaId = session.user.id;
  } else {
    // ADMIN may filter by any customer/kabadiwala
    if (customerId) where.customerId = customerId;
    if (kabadiwalaId) where.kabadiwalaId = kabadiwalaId;
  }

  if (search) {
    where.OR = [
      { notes: { contains: search } },
      { customer: { is: { name: { contains: search } } } },
      { customer: { is: { phone: { contains: search } } } },
    ];
  }

  try {
    const [data, total] = await Promise.all([
      prisma.pickupRequest.findMany({
        where,
        include: pickupInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pickupRequest.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/pickups error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pickup requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pickups
 * Creates a PickupRequest with its PickupItems inside a single transaction,
 * resolving live per-category pricing and computing totals atomically.
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

  const parsed = pickupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Customers may only create pickups for themselves
  if (session.user.userType === "CUSTOMER" && input.customerId !== session.user.id) {
    return NextResponse.json(
      { error: "Cannot create a pickup request for another customer" },
      { status: 403 }
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Ensure the address belongs to the customer
      const address = await tx.address.findFirst({
        where: { id: input.addressId, customerId: input.customerId },
      });
      if (!address) {
        throw new Error("ADDRESS_NOT_FOUND");
      }

      const now = new Date();
      const resolvedItems = await Promise.all(
        input.items.map(async (item) => {
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

      const totalWeight = resolvedItems.reduce((sum, i) => sum + i.weight, 0);
      const totalAmount = Number(
        resolvedItems.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2)
      );

      return tx.pickupRequest.create({
        data: {
          customerId: input.customerId,
          addressId: input.addressId,
          kabadiwalaId: input.kabadiwalaId ?? null,
          scheduledDate: input.scheduledDate,
          notes: input.notes ?? null,
          totalWeight,
          totalAmount,
          items: { create: resolvedItems },
        },
        include: pickupInclude,
      });
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_NOT_FOUND") {
      return NextResponse.json(
        { error: "Address does not belong to this customer" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.startsWith("NO_ACTIVE_PRICING")) {
      const categoryId = error.message.split(":")[1];
      return NextResponse.json(
        { error: `No active pricing configured for category ${categoryId}` },
        { status: 422 }
      );
    }
    console.error("POST /api/pickups error:", error);
    return NextResponse.json(
      { error: "Failed to create pickup request" },
      { status: 500 }
    );
  }
}
