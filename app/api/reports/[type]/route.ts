import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toCsv, csvResponse, type CsvColumn } from "@/lib/reports/csv";

const VALID_TYPES = [
  "pickups",
  "customers",
  "kabadiwalas",
  "payments",
  "category-collection",
] as const;
type ReportType = (typeof VALID_TYPES)[number];

interface DateRange {
  from?: Date;
  to?: Date;
}

function parseDateRange(request: NextRequest): DateRange {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

/**
 * GET /api/reports/[type]
 * Admin only. type ∈ pickups | customers | kabadiwalas | payments | category-collection
 * Optional ?from=&to= (ISO dates) scope date-bound reports.
 * Returns a downloadable CSV file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = params.type as ReportType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid report type. Expected one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const { from, to } = parseDateRange(request);
  const dateFilter = from || to ? { ...(from && { gte: from }), ...(to && { lte: to }) } : undefined;

  try {
    switch (type) {
      case "pickups": {
        const rows = await prisma.pickupRequest.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            status: true,
            scheduledDate: true,
            completedAt: true,
            totalWeight: true,
            totalAmount: true,
            createdAt: true,
            customer: { select: { name: true, phone: true } },
            kabadiwala: { select: { name: true } },
            address: { select: { city: true, pincode: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const columns: CsvColumn<(typeof rows)[number]>[] = [
          { key: "id", label: "Pickup ID" },
          { key: "status", label: "Status" },
          { key: "customerName", label: "Customer", accessor: (r) => r.customer.name },
          { key: "customerPhone", label: "Phone", accessor: (r) => r.customer.phone },
          { key: "kabadiwala", label: "Kabadiwala", accessor: (r) => r.kabadiwala?.name ?? "" },
          { key: "city", label: "City", accessor: (r) => r.address.city },
          { key: "pincode", label: "Pincode", accessor: (r) => r.address.pincode },
          { key: "scheduledDate", label: "Scheduled Date", accessor: (r) => r.scheduledDate },
          { key: "completedAt", label: "Completed At", accessor: (r) => r.completedAt },
          { key: "totalWeight", label: "Weight (kg)" },
          { key: "totalAmount", label: "Amount" },
          { key: "createdAt", label: "Created At" },
        ];
        return csvResponse(toCsv(rows, columns), "pickup-requests.csv");
      }

      case "customers": {
        const rows = await prisma.customer.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
            _count: { select: { pickupRequests: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const columns: CsvColumn<(typeof rows)[number]>[] = [
          { key: "id", label: "Customer ID" },
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "isActive", label: "Active" },
          { key: "totalPickups", label: "Total Pickups", accessor: (r) => r._count.pickupRequests },
          { key: "createdAt", label: "Joined" },
        ];
        return csvResponse(toCsv(rows, columns), "customers.csv");
      }

      case "kabadiwalas": {
        const rows = await prisma.kabadiwala.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            name: true,
            phone: true,
            serviceArea: true,
            availability: true,
            rating: true,
            isActive: true,
            createdAt: true,
            _count: { select: { pickupRequests: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const columns: CsvColumn<(typeof rows)[number]>[] = [
          { key: "id", label: "Kabadiwala ID" },
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "serviceArea", label: "Service Area" },
          { key: "availability", label: "Availability" },
          { key: "rating", label: "Rating" },
          { key: "isActive", label: "Active" },
          { key: "totalPickups", label: "Total Pickups", accessor: (r) => r._count.pickupRequests },
          { key: "createdAt", label: "Joined" },
        ];
        return csvResponse(toCsv(rows, columns), "kabadiwalas.csv");
      }

      case "payments": {
        const rows = await prisma.payment.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            transactionRef: true,
            paidAt: true,
            createdAt: true,
            customer: { select: { name: true, phone: true } },
            pickupRequest: { select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const columns: CsvColumn<(typeof rows)[number]>[] = [
          { key: "id", label: "Payment ID" },
          { key: "pickupId", label: "Pickup ID", accessor: (r) => r.pickupRequest.id },
          { key: "customerName", label: "Customer", accessor: (r) => r.customer.name },
          { key: "customerPhone", label: "Phone", accessor: (r) => r.customer.phone },
          { key: "amount", label: "Amount" },
          { key: "method", label: "Method" },
          { key: "status", label: "Status" },
          { key: "transactionRef", label: "Transaction Ref" },
          { key: "paidAt", label: "Paid At" },
          { key: "createdAt", label: "Created At" },
        ];
        return csvResponse(toCsv(rows, columns), "payments.csv");
      }

      case "category-collection": {
        const items = await prisma.pickupItem.groupBy({
          by: ["categoryId"],
          _sum: { weight: true, subtotal: true },
          _count: { _all: true },
          where: dateFilter ? { pickupRequest: { createdAt: dateFilter } } : undefined,
        });

        const categories = await prisma.category.findMany({
          where: { id: { in: items.map((i) => i.categoryId) } },
          select: { id: true, name: true },
        });
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

        const rows = items.map((i) => ({
          categoryId: i.categoryId,
          categoryName: categoryMap.get(i.categoryId) ?? "Unknown",
          totalItems: i._count._all,
          totalWeightKg: Number(i._sum.weight ?? 0),
          totalValue: Number(i._sum.subtotal ?? 0),
        }));

        const columns: CsvColumn<(typeof rows)[number]>[] = [
          { key: "categoryName", label: "Category" },
          { key: "totalItems", label: "Total Items" },
          { key: "totalWeightKg", label: "Total Weight (kg)" },
          { key: "totalValue", label: "Total Value" },
        ];
        return csvResponse(toCsv(rows, columns), "category-wise-collection.csv");
      }
    }
  } catch (error) {
    console.error(`GET /api/reports/${type} error:`, error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
