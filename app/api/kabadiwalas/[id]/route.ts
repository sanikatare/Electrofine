export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { kabadiwalaUpdateSchema } from "@/lib/validations/kabadiwala.schema";

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

function canAccess(
  session: Awaited<ReturnType<typeof auth>>,
  kabadiwalaId: string
) {
  if (!session?.user) return false;
  if (session.user.userType === "ADMIN") return true;
  return session.user.userType === "KABADIWALA" && session.user.id === kabadiwalaId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!canAccess(session, params.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kabadiwala = await prisma.kabadiwala.findUnique({
    where: { id: params.id },
    select: kabadiwalaSelect,
  });
  if (!kabadiwala) {
    return NextResponse.json({ error: "Kabadiwala not found" }, { status: 404 });
  }

  return NextResponse.json({ data: kabadiwala });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!canAccess(session, params.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = kabadiwalaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { password, ...rest } = parsed.data;
  if (rest.isActive !== undefined && session?.user.userType !== "ADMIN") {
    delete rest.isActive;
  }

  try {
    const existing = await prisma.kabadiwala.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Kabadiwala not found" }, { status: 404 });
    }

    const kabadiwala = await prisma.kabadiwala.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      },
      select: kabadiwalaSelect,
    });

    return NextResponse.json({ data: kabadiwala });
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
    console.error("PUT /api/kabadiwalas/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update kabadiwala" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.kabadiwala.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Kabadiwala not found" }, { status: 404 });
  }

  try {
    await prisma.kabadiwala.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json(
      { message: "Kabadiwala deactivated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/kabadiwalas/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete kabadiwala" },
      { status: 500 }
    );
  }
}
