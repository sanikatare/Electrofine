import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/reports/csv";

type WasteRow = { period: string; weightKg: number };

/**
 * GET /api/reports/waste-collection?period=monthly|yearly&from=&to=&format=json|csv
 * Admin only. Groups total weight of COMPLETED pickups by month or year.
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
    const rows = await prisma.$queryRaw<WasteRow[]>`
      SELECT DATE_FORMAT(completedAt, ${dateFormat}) AS period, SUM(totalWeight) AS weightKg
      FROM pickup_requests
      WHERE status = 'COMPLETED' AND completedAt >= ${fromDate} AND completedAt <= ${toDate}
      GROUP BY period
      ORDER BY period ASC
    `;

    const data: WasteRow[] = rows.map((r) => ({
      period: r.period,
      weightKg: Number(r.weightKg ?? 0),
    }));

    if (format === "csv") {
      const csv = toCsv(data, [
        { key: "period", label: period === "yearly" ? "Year" : "Month" },
        { key: "weightKg", label: "Weight Collected (kg)" },
      ]);
      return csvResponse(csv, `waste-collection-report-${period}.csv`);
    }

    return NextResponse.json({ data, period });
  } catch (error) {
    console.error("GET /api/reports/waste-collection error:", error);
    return NextResponse.json(
      { error: "Failed to generate waste collection report" },
      { status: 500 }
    );
  }
}
