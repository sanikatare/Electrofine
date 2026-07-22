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
 * DELETE /api/notifications/[id]
 * The recipient (customer/kabadiwala) or an admin may delete a notification.
 */
export async function DELETE(
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

  try {
    await prisma.notification.delete({ where: { id: params.id } });
    return NextResponse.json(
      { message: "Notification deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
