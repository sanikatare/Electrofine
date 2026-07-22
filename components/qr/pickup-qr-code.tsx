"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PickupQrCodeProps {
  pickupId: string;
  className?: string;
}

/**
 * Fetches and displays the QR code for a pickup request (scanning it opens
 * the public /track/[id] page) with a download button.
 */
export function PickupQrCode({ pickupId, className }: PickupQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/pickups/${pickupId}/qr?format=dataurl`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load QR code");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setDataUrl(json.data.dataUrl);
        setTrackingUrl(json.data.trackingUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [pickupId]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `pickup-${pickupId}-qr.png`;
    link.click();
  };

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-3 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && !dataUrl && (
          <div className="flex h-40 w-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {dataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code for pickup request ${pickupId}`}
            width={160}
            height={160}
            className="rounded-md border"
          />
        )}

        {trackingUrl && (
          <p className="max-w-[200px] truncate text-center text-xs text-muted-foreground">
            {trackingUrl}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!dataUrl}
        >
          <Download className="mr-2 h-4 w-4" />
          Download QR
        </Button>
      </CardContent>
    </Card>
  );
}
