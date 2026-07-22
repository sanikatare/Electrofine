import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

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
 * DELETE /api/pickups/[id]/images/[imageId]
 * Deletes the asset from Cloudinary first, then removes the DB record.
 * If the Cloudinary deletion fails, the DB record is left intact so the
 * two stores don't drift out of sync silently.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
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

  const image = await prisma.pickupImage.findUnique({
    where: { id: params.imageId },
  });
  if (!image || image.pickupRequestId !== params.id) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const cloudinaryResult = await cloudinary.uploader.destroy(image.publicId, {
      resource_type: "image",
    });

    if (cloudinaryResult.result !== "ok" && cloudinaryResult.result !== "not found") {
      return NextResponse.json(
        { error: `Cloudinary deletion failed: ${cloudinaryResult.result}` },
        { status: 502 }
      );
    }

    await prisma.pickupImage.delete({ where: { id: params.imageId } });

    return NextResponse.json(
      { message: "Image deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/pickups/[id]/images/[imageId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
