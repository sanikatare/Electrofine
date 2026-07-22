import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type MonthRow = { month: string; total: bigint | number };

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
    const [revenueRows, pickupRows, categoryGroups, categories, topKabadiwalas] =
      await Promise.all([
        prisma.$queryRaw<MonthRow[]>`
          SELECT DATE_FORMAT(paidAt, '%Y-%m') AS month, SUM(amount) AS total
          FROM payments
          WHERE status = 'COMPLETED' AND paidAt >= ${twelveMonthsAgo}
          GROUP BY month ORDER BY month ASC
        `,
        prisma.$queryRaw<MonthRow[]>`
          SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS total
          FROM pickup_requests
          WHERE createdAt >= ${twelveMonthsAgo}
          GROUP BY month ORDER BY month ASC
        `,
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
