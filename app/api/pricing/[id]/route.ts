import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const pricingUpdateSchema = z.object({
  pricePerKg: z.number().positive().optional(),
  minimumWeight: z.number().nonnegative().optional(),
  bonusAmount: z.number().nonnegative().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

const pricingInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.PricingInclude;

/**
 * GET /api/pricing/[id]
 * Public read.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pricing = await prisma.pricing.findUnique({
    where: { id: params.id },
    include: pricingInclude,
  });
  if (!pricing) {
    return NextResponse.json({ error: "Pricing record not found" }, { status: 404 });
  }
  return NextResponse.json({ data: pricing });
}

/**
 * PUT /api/pricing/[id]
 * Admin only. If isActive is being set to true, any other currently-active
 * price for the same category is closed out inside the same transaction.
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

  const parsed = pricingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    const existing = await prisma.pricing.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Pricing record not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isActive === true) {
        await tx.pricing.updateMany({
          where: {
            categoryId: existing.categoryId,
            isActive: true,
            effectiveTo: null,
            id: { not: params.id },
          },
          data: { isActive: false, effectiveTo: new Date() },
        });
      }

      return tx.pricing.update({
        where: { id: params.id },
        data: input,
        include: pricingInclude,
      });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PUT /api/pricing/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update pricing record" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pricing/[id]
 * Admin only. Hard delete — recommended only for erroneous entries;
 * prefer setting isActive=false to preserve historical pricing.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.pricing.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Pricing record not found" }, { status: 404 });
  }

  try {
    await prisma.pricing.delete({ where: { id: params.id } });
    return NextResponse.json(
      { message: "Pricing record deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/pricing/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing record" },
      { status: 500 }
    );
  }
}
