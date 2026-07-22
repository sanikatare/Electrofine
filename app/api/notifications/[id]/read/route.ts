import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function canAccess(
  session: Awaited<ReturnType<typeof auth>>,
  notification: { customerId: string | null; kabadiwalaId: string | null }
) {
  if (!session?.user) return false;
  if (session.user.userType === "ADMIN") return true;
  if (session.user.userType === "CUSTOMER")
    return session.user.id === notification.customerId;
  if (session.user.userType === "KABADIWALA")
    return session.user.id === notification.kabadiwalaId;
  return false;
}

/**
 * PATCH /api/notifications/[id]/read
 * Marks a single notification as read. Only the recipient or an admin
 * may do this. Idempotent — already-read notifications return 200 as-is.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.notification.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  if (!canAccess(session, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.isRead) {
    return NextResponse.json({ data: existing }, { status: 200 });
  }

  try {
    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/notifications/[id]/read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}
