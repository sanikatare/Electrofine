import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type MonthRow = { month: string; total: bigint | number };

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * GET /api/admin/dashboard/charts
 * Admin only. Returns the last 12 months of revenue + pickups, current
 * category-wise collection breakdown, and top 5 kabadiwalas by completed
 * pickups — everything the four dashboard charts need in one call.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  try {
    const [payments, pickups, categoryGroups, categories, topKabadiwalas] =
      await Promise.all([
        prisma.payment.findMany({
          where: {
            status: "COMPLETED",
            paidAt: { gte: twelveMonthsAgo },
          },
          select: { paidAt: true, amount: true },
        }),
        prisma.pickupRequest.findMany({
          where: { createdAt: { gte: twelveMonthsAgo } },
          select: { createdAt: true },
        }),
        prisma.pickupItem.groupBy({
          by: ["categoryId"],
          _sum: { weight: true },
        }),
        prisma.category.findMany({ select: { id: true, name: true } }),
        prisma.kabadiwala.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            rating: true,
            _count: {
              select: { pickupRequests: { where: { status: "COMPLETED" } } },
            },
          },
        }),
      ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const revenueByMonth = new Map<string, number>();
    const pickupsByMonth = new Map<string, number>();

    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const key = monthKey(payment.paidAt);
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(payment.amount ?? 0));
    }

    for (const pickup of pickups) {
      const key = monthKey(pickup.createdAt);
      pickupsByMonth.set(key, (pickupsByMonth.get(key) ?? 0) + 1);
    }

    const revenueRows: MonthRow[] = [...revenueByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    const pickupRows: MonthRow[] = [...pickupsByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    const rankedKabadiwalas = [...topKabadiwalas]
      .sort((a, b) => b._count.pickupRequests - a._count.pickupRequests)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        revenueSeries: revenueRows.map((r) => ({
          month: r.month,
          revenue: Number(r.total ?? 0),
        })),
        pickupsSeries: pickupRows.map((r) => ({
          month: r.month,
          count: Number(r.total ?? 0),
        })),
        categoryCollection: categoryGroups.map((g) => ({
          category: categoryMap.get(g.categoryId) ?? "Unknown",
          weightKg: Number(g._sum.weight ?? 0),
        })),
        kabadiwalaPerformance: rankedKabadiwalas.map((k) => ({
          name: k.name,
          completedPickups: k._count.pickupRequests,
          rating: Number(k.rating ?? 0),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard/charts error:", error);
    return NextResponse.json(
      { error: "Failed to load chart data" },
      { status: 500 }
    );
  }
}
