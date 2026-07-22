import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/pickups/[id]/cancel
 * Cancels a pickup request. Allowed by the owning Customer or an Admin,
 * only while the request is still PENDING or ASSIGNED.
 * Wrapped in a transaction so the status change and the resulting
 * notification are written atomically.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.pickupRequest.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }

  const isOwner =
    session.user.userType === "CUSTOMER" && session.user.id === existing.customerId;
  const isAdmin = session.user.userType === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return NextResponse.json(
      { error: `Pickup request is already ${existing.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  try {
    const [cancelled] = await prisma.$transaction([
      prisma.pickupRequest.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
      }),
      prisma.notification.create({
        data: {
          type: "PICKUP_UPDATE",
          channel: "IN_APP",
          title: "Pickup Request Cancelled",
          message: `Pickup request ${params.id} has been cancelled.`,
          customerId: existing.customerId,
          kabadiwalaId: existing.kabadiwalaId,
          pickupRequestId: existing.id,
        },
      }),
    ]);

    return NextResponse.json({ data: cancelled });
  } catch (error) {
    console.error("PATCH /api/pickups/[id]/cancel error:", error);
    return NextResponse.json(
      { error: "Failed to cancel pickup request" },
      { status: 500 }
    );
  }
}
