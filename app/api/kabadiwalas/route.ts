import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  kabadiwalaCreateSchema,
  kabadiwalaQuerySchema,
} from "@/lib/validations/kabadiwala.schema";

const kabadiwalaSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  vehicleNumber: true,
  serviceArea: true,
  availability: true,
  rating: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.KabadiwalaSelect;

/**
 * GET /api/kabadiwalas
 * Admin only — paginated, searchable, filterable list.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = kabadiwalaQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { search, availability, serviceArea, isActive, page, limit } = parsed.data;

  const where: Prisma.KabadiwalaWhereInput = {
    ...(availability && { availability }),
    ...(serviceArea && { serviceArea: { contains: serviceArea } }),
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ],
    }),
  };

  try {
    const [data, total] = await Promise.all([
      prisma.kabadiwala.findMany({
        where,
        select: kabadiwalaSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kabadiwala.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/kabadiwalas error:", error);
    return NextResponse.json(
      { error: "Failed to fetch kabadiwalas" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kabadiwalas
 * Public — self-registration (also usable by Admin to onboard a kabadiwala).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = kabadiwalaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { password, ...rest } = parsed.data;

  try {
    const kabadiwala = await prisma.kabadiwala.create({
      data: {
        ...rest,
        passwordHash: password ? await bcrypt.hash(password, 10) : null,
      },
      select: kabadiwalaSelect,
    });

    return NextResponse.json({ data: kabadiwala }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A kabadiwala with this phone or email already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/kabadiwalas error:", error);
    return NextResponse.json(
      { error: "Failed to create kabadiwala" },
      { status: 500 }
    );
  }
}
