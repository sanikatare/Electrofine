import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  generatePickupQrBuffer,
  generatePickupQrDataUrl,
  getTrackingUrl,
} from "@/lib/qr/generate-qr";

function canAccessPickup(
  session: { user?: { id: string; userType?: string } } | null,
  pickup: { customerId: string; kabadiwalaId: string | null }
) {
  if (!session?.user) return false;
  if (session.user.userType === "ADMIN") return true;
  if (session.user.userType === "CUSTOMER") return session.user.id === pickup.customerId;
  if (session.user.userType === "KABADIWALA")
    return session.user.id === pickup.kabadiwalaId;
  return false;
}

/**
 * GET /api/pickups/[id]/qr
 * Returns a PNG image by default. Pass ?format=dataurl for a JSON body
 * containing a base64 data URL (useful for <img> rendering client-side)
 * plus the underlying tracking URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pickup = await prisma.pickupRequest.findUnique({
    where: { id: (await params).id },
  });
  if (!pickup) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }
  if (!canAccessPickup(session, pickup)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("format");

  try {
    if (format === "dataurl") {
      const dataUrl = await generatePickupQrDataUrl((await params).id);
      return NextResponse.json({
        data: { dataUrl, trackingUrl: getTrackingUrl((await params).id) },
      });
    }

    const buffer = await generatePickupQrBuffer((await params).id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="pickup-${(await params).id}-qr.png"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/pickups/[id]/qr error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
