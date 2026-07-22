"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-center">
        <h2 className="text-lg font-semibold">Application Error</h2>
        <p className="max-w-sm text-sm text-gray-500">
          Something went wrong loading ElectroFine. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
