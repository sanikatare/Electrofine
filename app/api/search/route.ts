import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const RESULT_LIMIT = 5;

/**
 * GET /api/search?q=term
 * ADMIN: searches across all five entities.
 * CUSTOMER: searches their own pickup requests + public categories only.
 * KABADIWALA: searches their assigned pickup requests + public categories only.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({
      data: { customers: [], kabadiwalas: [], pickups: [], categories: [], payments: [] },
    });
  }

  const isAdmin = session.user.userType === "ADMIN";

  try {
    const categoriesPromise = prisma.category.findMany({
      where: { name: { contains: q } },
      select: { id: true, name: true },
      take: RESULT_LIMIT,
    });

    if (!isAdmin) {
      const pickupWhere =
        session.user.userType === "CUSTOMER"
          ? { customerId: session.user.id }
          : { kabadiwalaId: session.user.id };

      const [pickups, categories] = await Promise.all([
        prisma.pickupRequest.findMany({
          where: {
            ...pickupWhere,
            OR: [{ id: q }, { notes: { contains: q } }],
          },
          select: { id: true, status: true, scheduledDate: true },
          take: RESULT_LIMIT,
        }),
        categoriesPromise,
      ]);

      return NextResponse.json({
        data: { customers: [], kabadiwalas: [], pickups, categories, payments: [] },
      });
    }

    const [customers, kabadiwalas, pickups, categories, payments] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: RESULT_LIMIT,
      }),

      prisma.kabadiwala.findMany({
        where: {
          OR: [{ name: { contains: q } }, { phone: { contains: q } }],
        },
        select: { id: true, name: true, phone: true, serviceArea: true },
        take: RESULT_LIMIT,
      }),

      prisma.pickupRequest.findMany({
        where: { OR: [{ id: q }, { notes: { contains: q } }] },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          customer: { select: { name: true } },
        },
        take: RESULT_LIMIT,
      }),

      categoriesPromise,

      prisma.payment.findMany({
        where: {
          OR: [{ id: q }, { transactionRef: { contains: q } }],
        },
        select: { id: true, amount: true, status: true, transactionRef: true },
        take: RESULT_LIMIT,
      }),
    ]);

    return NextResponse.json({
      data: { customers, kabadiwalas, pickups, categories, payments },
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
