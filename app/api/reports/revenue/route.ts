import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/reports/csv";

type RevenueRow = { period: string; revenue: number };

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

  const dateFormat = period === "yearly" ? "%Y" : "%Y-%m";
  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear() - 1, 0, 1);
  const toDate = to ? new Date(to) : new Date();

  try {
    const rows = await prisma.$queryRaw<RevenueRow[]>`
      SELECT DATE_FORMAT(paidAt, ${dateFormat}) AS period, SUM(amount) AS revenue
      FROM payments
      WHERE status = 'COMPLETED' AND paidAt >= ${fromDate} AND paidAt <= ${toDate}
      GROUP BY period
      ORDER BY period ASC
    `;

    const data: RevenueRow[] = rows.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue ?? 0),
    }));

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
