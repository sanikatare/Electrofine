"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads current URL search params and returns a setter that merges updates
 * into the URL (removing keys whose value is null/undefined/""), preserving
 * everything else. Used by FilterBar and Pagination so filters/page state
 * survive refresh and are shareable via URL.
 */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams]
  );

  const setParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });

      // Any filter change resets pagination back to page 1
      if (!("page" in updates)) {
        next.delete("page");
      }

      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return { params, setParams };
}
