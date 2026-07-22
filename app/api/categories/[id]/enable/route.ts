import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/categories/[id]/enable
 * Admin only — sets isActive = true.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.category.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (existing.isActive) {
    return NextResponse.json({ data: existing }, { status: 200 });
  }

  try {
    const category = await prisma.category.update({
      where: { id: params.id },
      data: { isActive: true },
    });
    return NextResponse.json({ data: category });
  } catch (error) {
    console.error("PATCH /api/categories/[id]/enable error:", error);
    return NextResponse.json(
      { error: "Failed to enable category" },
      { status: 500 }
    );
  }
}
