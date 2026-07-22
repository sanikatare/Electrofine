import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

/**
 * NOTE: assumes `minimumWeight` (Float) and `bonusAmount` (Decimal(10,2))
 * columns exist on the Pricing model — see schema note above.
 */

const pricingCreateSchema = z.object({
  categoryId: z.string().cuid("Invalid category id"),
  pricePerKg: z.number().positive("Price per KG must be greater than 0"),
  minimumWeight: z.number().nonnegative().optional().default(0),
  bonusAmount: z.number().nonnegative().optional().default(0),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const pricingQuerySchema = z.object({
  categoryId: z.string().cuid().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const pricingInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.PricingInclude;

/**
 * GET /api/pricing
 * Public read — filter by category/isActive, paginated.
 */
export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = pricingQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { categoryId, isActive, page, limit } = parsed.data;

  const where: Prisma.PricingWhereInput = {
    ...(categoryId && { categoryId }),
    ...(isActive !== undefined && { isActive }),
  };

  try {
    const [data, total] = await Promise.all([
      prisma.pricing.findMany({
        where,
        include: pricingInclude,
        orderBy: { effectiveFrom: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pricing.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/pricing error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing records" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pricing
 * Admin only. When creating a new active price for a category, any
 * currently-active price for that same category is closed out
 * (effectiveTo = now, isActive = false) atomically, so only one active
 * price per category exists at a time.
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

  const parsed = pricingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const now = new Date();

  try {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx) => {
      if (input.isActive) {
        await tx.pricing.updateMany({
          where: { categoryId: input.categoryId, isActive: true, effectiveTo: null },
          data: { isActive: false, effectiveTo: now },
        });
      }

      return tx.pricing.create({
        data: {
          categoryId: input.categoryId,
          pricePerKg: input.pricePerKg,
          minimumWeight: input.minimumWeight,
          bonusAmount: input.bonusAmount,
          effectiveFrom: input.effectiveFrom ?? now,
          effectiveTo: input.effectiveTo ?? null,
          isActive: input.isActive,
        },
        include: pricingInclude,
      });
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pricing error:", error);
    return NextResponse.json(
      { error: "Failed to create pricing record" },
      { status: 500 }
    );
  }
}
