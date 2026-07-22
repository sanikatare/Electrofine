"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: typeof google;
    __electrofineMapsCallback?: () => void;
  }
}

const SCRIPT_ID = "electrofine-google-maps-script";
let scriptLoadingPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      resolve();
      return;
    }

    window.__electrofineMapsCallback = () => resolve();

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__electrofineMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Loads the Google Maps JS SDK once (shared across all components on the
 * page) and reports load/error state.
 *
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to be set.
 */
export function useGoogleMapsScript() {
  const [isLoaded, setIsLoaded] = useState(
    typeof window !== "undefined" && !!window.google?.maps
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured");
      return;
    }

    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isLoaded, error };
}
