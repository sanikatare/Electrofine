import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cloudinary } from "@/lib/cloudinary";
import {
  validateImageBatch,
  MAX_IMAGES_PER_PICKUP,
} from "@/lib/validations/pickup-image.validation";

// Cloudinary's SDK needs Node APIs (streams/https) — must not run on Edge.
export const runtime = "nodejs";

/**
 * NOTE: assumes a `PickupImage` model exists (see schema note above) and
 * that `PickupRequest` has a corresponding `images PickupImage[]` relation.
 */

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

function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * POST /api/pickups/[id]/images
 * multipart/form-data with one or more "files" fields.
 * Allowed: the pickup's customer, its assigned kabadiwala, or an admin.
 * Enforces JPEG/PNG/WEBP, 5MB max per file, and a 5-image cap per pickup.
 */
export async function POST(
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body" },
      { status: 400 }
    );
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  const existingCount = await prisma.pickupImage.count({
    where: { pickupRequestId: params.id },
  });

  const validation = validateImageBatch(files, existingCount);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const uploaded = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await uploadBufferToCloudinary(
          buffer,
          `ecokabadi/pickups/${params.id}`
        );
        return prisma.pickupImage.create({
          data: {
            pickupRequestId: params.id,
            url: result.secure_url,
            publicId: result.public_id,
            uploadedById: session.user.id,
            uploadedByType: session.user.userType,
          },
        });
      })
    );

    return NextResponse.json(
      {
        data: uploaded,
        remainingSlots: MAX_IMAGES_PER_PICKUP - (existingCount + uploaded.length),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pickups/[id]/images error:", error);
    return NextResponse.json(
      { error: "Failed to upload image(s)" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pickups/[id]/images
 * Lists images attached to a pickup request.
 */
export async function GET(
  _request: NextRequest,
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

  const images = await prisma.pickupImage.findMany({
    where: { pickupRequestId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: images });
}
