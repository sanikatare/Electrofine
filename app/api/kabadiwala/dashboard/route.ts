import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/kabadiwala/dashboard
 * Kabadiwala only — returns their own operational summary.
 * All queries run concurrently via `prisma.$transaction` for a single
 * consistent snapshot instead of sequential round trips.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "KABADIWALA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const kabadiwalaId = session.user.id;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  try {
    const [
      todaysPickups,
      completedPickups,
      todaysEarningsAgg,
      monthlyEarningsAgg,
      pickupTimeline,
    ] = await prisma.$transaction([
      // Pickups scheduled for today assigned to this kabadiwala
      prisma.pickupRequest.count({
        where: {
          kabadiwalaId,
          scheduledDate: { gte: todayStart, lt: todayEnd },
        },
      }),

      // Lifetime total of completed pickups for this kabadiwala
      prisma.pickupRequest.count({
        where: { kabadiwalaId, status: "COMPLETED" },
      }),

      // Sum of completed payments for this kabadiwala's pickups, paid today
      prisma.payment.aggregate({
        where: {
          status: "COMPLETED",
          paidAt: { gte: todayStart, lt: todayEnd },
          pickupRequest: { kabadiwalaId },
        },
        _sum: { amount: true },
      }),

      // Sum of completed payments for this kabadiwala's pickups, this month
      prisma.payment.aggregate({
        where: {
          status: "COMPLETED",
          paidAt: { gte: monthStart, lt: monthEnd },
          pickupRequest: { kabadiwalaId },
        },
        _sum: { amount: true },
      }),

      // Recent activity timeline (last 15, most recently updated first)
      prisma.pickupRequest.findMany({
        where: { kabadiwalaId },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          completedAt: true,
          totalWeight: true,
          totalAmount: true,
          updatedAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          address: { select: { line1: true, city: true, pincode: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
      }),
    ]);

    return NextResponse.json({
      data: {
        todaysPickups,
        completedPickups,
        todaysEarnings: Number(todaysEarningsAgg._sum.amount ?? 0),
        monthlyEarnings: Number(monthlyEarningsAgg._sum.amount ?? 0),
        pickupTimeline,
      },
    });
  } catch (error) {
    console.error("GET /api/kabadiwala/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
