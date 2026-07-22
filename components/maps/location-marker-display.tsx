"use client";

import { useEffect, useRef } from "react";
import { useGoogleMapsScript } from "@/hooks/use-google-maps-script";

interface LocationMarkerDisplayProps {
  latitude: number;
  longitude: number;
  /** Optional label shown in the marker's info window (e.g. address line). */
  label?: string;
  height?: number;
  zoom?: number;
  className?: string;
}

/**
 * Renders a non-interactive Google Map centered on a stored coordinate pair
 * (e.g. Address.latitude / Address.longitude) with a single marker.
 * Use this to display an already-selected pickup location.
 */
export function LocationMarkerDisplay({
  latitude,
  longitude,
  label,
  height = 260,
  zoom = 15,
  className,
}: LocationMarkerDisplayProps) {
  const { isLoaded, error } = useGoogleMapsScript();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current) return;

    const position = { lat: latitude, lng: longitude };

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: position,
      zoom,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      draggable: false,
      disableDefaultUI: true,
    });

    const marker = new window.google.maps.Marker({
      position,
      map,
    });

    if (label) {
      const infoWindow = new window.google.maps.InfoWindow({ content: label });
      infoWindow.open({ map, anchor: marker });
    }
  }, [isLoaded, latitude, longitude, zoom, label]);

  if (error) {
    return (
      <div className={className} style={{ height }}>
        <p className="text-sm text-destructive">
          Unable to load the map: {error}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={mapContainerRef}
        style={{ height, width: "100%", borderRadius: "0.5rem" }}
        aria-label={label ?? "Pickup location"}
      />
      {!isLoaded && (
        <p className="mt-2 text-sm text-muted-foreground">Loading map…</p>
      )}
    </div>
  );
}
