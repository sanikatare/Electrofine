import QRCode from "qrcode";

/**
 * Builds the public tracking URL for a pickup request.
 * Requires NEXT_PUBLIC_APP_URL to be set (e.g. https://electrofine.com).
 */
export function getTrackingUrl(pickupId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/track/${pickupId}`;
}

/**
 * Generates a QR code (as a data URL) that encodes the tracking URL for
 * a given pickup request. Suitable for <img src={dataUrl} />.
 */
export async function generatePickupQrDataUrl(pickupId: string): Promise<string> {
  const url = getTrackingUrl(pickupId);
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 320,
    color: { dark: "#0f3d21", light: "#ffffff" },
  });
}

/**
 * Generates a QR code as a PNG Buffer — used when serving the QR directly
 * as an image response (e.g. for download / printing).
 */
export async function generatePickupQrBuffer(pickupId: string): Promise<Buffer> {
  const url = getTrackingUrl(pickupId);
  return QRCode.toBuffer(url, { type: "png", margin: 1, width: 320 });
}
