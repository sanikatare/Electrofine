import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/categories/[id]/disable
 * Admin only — sets isActive = false (soft disable; preferred over delete
 * when the category is already referenced by pickup items/pricing history).
 */
export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const session = await auth();
  if (!session?.user || session.user.userType !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (!existing.isActive) {
    return NextResponse.json({ data: existing }, { status: 200 });
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ data: category });
  } catch (error) {
    console.error("PATCH /api/categories/[id]/disable error:", error);
    return NextResponse.json(
      { error: "Failed to disable category" },
      { status: 500 }
    );
  }
}
