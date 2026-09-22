import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/reports/csv";

type WasteRow = { period: string; weightKg: number };

function formatPeriod(date: Date, period: "monthly" | "yearly"): string {
  if (period === "yearly") {
    return `${date.getFullYear()}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear() - 1, 0, 1);
  const toDate = to ? new Date(to) : new Date();

  try {
    const pickups = await prisma.pickupRequest.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: fromDate, lte: toDate },
      },
      select: { completedAt: true, totalWeight: true },
    });

    const weightByPeriod = new Map<string, number>();
    for (const pickup of pickups) {
      if (!pickup.completedAt) continue;
      const key = formatPeriod(pickup.completedAt, period);
      weightByPeriod.set(
        key,
        (weightByPeriod.get(key) ?? 0) + Number(pickup.totalWeight ?? 0)
      );
    }

    const data: WasteRow[] = [...weightByPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, weightKg]) => ({ period, weightKg }));

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
