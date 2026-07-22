import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const dashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * GET /api/admin/dashboard
 * Admin only. Returns the six overview cards in one round trip.
 *
 * Optional ?from=&to= (ISO dates) scope the time-bound metrics
 * (revenue, completed pickups, collected waste) to a date range;
 * customer/kabadiwala totals and pending pickups are always "as of now".
 *
 * All six aggregates are issued as a single `$transaction` array so they
 * execute concurrently against one DB connection and reflect one
 * consistent snapshot, rather than N sequential round trips.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = dashboardQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { from, to } = parsed.data;

  const dateFilter =
    from || to
      ? {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        }
      : undefined;

  try {
    const [
      totalCustomers,
      totalKabadiwalas,
      revenueAgg,
      completedPickups,
      pendingPickups,
      collectedWasteAgg,
    ] = await prisma.$transaction([
      prisma.customer.count({ where: { isActive: true } }),

      prisma.kabadiwala.count({ where: { isActive: true } }),

      prisma.payment.aggregate({
        where: {
          status: "COMPLETED",
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _sum: { amount: true },
      }),

      prisma.pickupRequest.count({
        where: {
          status: "COMPLETED",
          ...(dateFilter && { completedAt: dateFilter }),
        },
      }),

      prisma.pickupRequest.count({
        where: { status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] } },
      }),

      prisma.pickupRequest.aggregate({
        where: {
          status: "COMPLETED",
          ...(dateFilter && { completedAt: dateFilter }),
        },
        _sum: { totalWeight: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        customers: totalCustomers,
        kabadiwalas: totalKabadiwalas,
        revenue: Number(revenueAgg._sum.amount ?? 0),
        completedPickups,
        pendingPickups,
        collectedWasteKg: Number(collectedWasteAgg._sum.totalWeight ?? 0),
      },
      range: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
