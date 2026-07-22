import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  generatePickupQrBuffer,
  generatePickupQrDataUrl,
  getTrackingUrl,
} from "@/lib/qr/generate-qr";

function canAccessPickup(
  session: Awaited<ReturnType<typeof auth>>,
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
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pickup = await prisma.pickupRequest.findUnique({
    where: { id: params.id },
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
      const dataUrl = await generatePickupQrDataUrl(params.id);
      return NextResponse.json({
        data: { dataUrl, trackingUrl: getTrackingUrl(params.id) },
      });
    }

    const buffer = await generatePickupQrBuffer(params.id);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="pickup-${params.id}-qr.png"`,
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
