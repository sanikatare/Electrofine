import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const MONTHS_OF_HISTORY = 6;

/**
 * GET /api/customer/dashboard
 * Customer only — returns their own summary in one response:
 * total/pending/completed pickup counts, a monthly pickup-count
 * breakdown for the last 6 months, and the 5 most recent pickups.
 *
 * All queries run concurrently via `prisma.$transaction` for a single
 * consistent snapshot instead of sequential round trips.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customerId = session.user.id;

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - (MONTHS_OF_HISTORY - 1));
  sinceDate.setDate(1);
  sinceDate.setHours(0, 0, 0, 0);

  try {
    const [
      totalPickups,
      pendingPickups,
      completedPickups,
      monthlyRows,
      recentActivity,
    ] = await prisma.$transaction([
      prisma.pickupRequest.count({ where: { customerId } }),

      prisma.pickupRequest.count({
        where: {
          customerId,
          status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
        },
      }),

      prisma.pickupRequest.count({
        where: { customerId, status: "COMPLETED" },
      }),

      // Grouped monthly counts via raw aggregation (Prisma's groupBy can't
      // truncate dates to month natively) — parameterized to avoid injection.
      prisma.$queryRaw<
        { month: string; count: bigint }[]
      >`SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
        FROM pickup_requests
        WHERE customerId = ${customerId} AND createdAt >= ${sinceDate}
        GROUP BY month
        ORDER BY month ASC`,

      prisma.pickupRequest.findMany({
        where: { customerId },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          totalWeight: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
          kabadiwala: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    // Fill in months with zero pickups so the series has no gaps
    const monthlyMap = new Map(
      monthlyRows.map((r) => [r.month, Number(r.count)])
    );
    const monthlyPickups: { month: string; count: number }[] = [];
    const cursor = new Date(sinceDate);
    for (let i = 0; i < MONTHS_OF_HISTORY; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      monthlyPickups.push({ month: key, count: monthlyMap.get(key) ?? 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return NextResponse.json({
      data: {
        totalPickups,
        pendingPickups,
        completedPickups,
        monthlyPickups,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("GET /api/customer/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
