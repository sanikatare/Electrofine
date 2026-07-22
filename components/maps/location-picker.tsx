"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMapsScript } from "@/hooks/use-google-maps-script";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

interface LocationPickerProps {
  /** Initial map center / marker position. Defaults to a fallback city center. */
  defaultCenter?: { lat: number; lng: number };
  /** Called whenever the user selects a new location (click or drag). */
  onLocationSelect: (location: PickedLocation) => void;
  /** Map height in pixels. Defaults to 360. */
  height?: number;
  className?: string;
}

const FALLBACK_CENTER = { lat: 18.5204, lng: 73.8567 }; // Pune, as a sane default

/**
 * Renders an interactive Google Map. The customer clicks anywhere on the
 * map (or drags the marker) to select their pickup location. Coordinates
 * are reported to the parent via onLocationSelect so the parent can persist
 * them (e.g. into Address.latitude / Address.longitude) via its own API call.
 */
export function LocationPicker({
  defaultCenter = FALLBACK_CENTER,
  onLocationSelect,
  height = 360,
  className,
}: LocationPickerProps) {
  const { isLoaded, error } = useGoogleMapsScript();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [address, setAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();

    const marker = new window.google.maps.Marker({
      position: defaultCenter,
      map,
      draggable: true,
    });
    markerRef.current = marker;

    const emitSelection = (position: google.maps.LatLng) => {
      const latitude = position.lat();
      const longitude = position.lng();

      geocoderRef.current?.geocode(
        { location: { lat: latitude, lng: longitude } },
        (results, status) => {
          const formattedAddress =
            status === "OK" && results?.[0] ? results[0].formatted_address : undefined;
          setAddress(formattedAddress);
          onLocationSelect({ latitude, longitude, formattedAddress });
        }
      );
    };

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      marker.setPosition(e.latLng);
      emitSelection(e.latLng);
    });

    marker.addListener("dragend", () => {
      const position = marker.getPosition();
      if (position) emitSelection(position);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

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
        aria-label="Select your pickup location on the map"
      />
      {!isLoaded && (
        <p className="mt-2 text-sm text-muted-foreground">Loading map…</p>
      )}
      {address && (
        <p className="mt-2 text-sm text-muted-foreground">
          Selected: <span className="font-medium">{address}</span>
        </p>
      )}
    </div>
  );
}
