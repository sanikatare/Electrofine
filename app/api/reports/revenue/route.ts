import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/reports/csv";

type RevenueRow = { period: string; revenue: number };

function formatPeriod(date: Date, period: "monthly" | "yearly"): string {
  if (period === "yearly") {
    return `${date.getFullYear()}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * GET /api/reports/revenue?period=monthly|yearly&from=&to=&format=json|csv
 * Admin only. Groups COMPLETED payment amounts by month or year.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get("period") === "yearly" ? "yearly" : "monthly";
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear() - 1, 0, 1);
  const toDate = to ? new Date(to) : new Date();

  try {
    const payments = await prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: fromDate, lte: toDate },
      },
      select: { paidAt: true, amount: true },
    });

    const revenueByPeriod = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const key = formatPeriod(payment.paidAt, period);
      revenueByPeriod.set(
        key,
        (revenueByPeriod.get(key) ?? 0) + Number(payment.amount ?? 0)
      );
    }

    const data: RevenueRow[] = [...revenueByPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, revenue]) => ({ period, revenue }));

    if (format === "csv") {
      const csv = toCsv(data, [
        { key: "period", label: period === "yearly" ? "Year" : "Month" },
        { key: "revenue", label: "Revenue" },
      ]);
      return csvResponse(csv, `revenue-report-${period}.csv`);
    }

    return NextResponse.json({ data, period });
  } catch (error) {
    console.error("GET /api/reports/revenue error:", error);
    return NextResponse.json({ error: "Failed to generate revenue report" }, { status: 500 });
  }
}
