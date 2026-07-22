import type { Metadata } from "next";
import "./globals.css";
import { PageTransition } from "@/components/shared/page-transition";

export const metadata: Metadata = {
  title: "ElectroFine — E-Waste Collection & Kabadiwala Management",
  description:
    "Schedule e-waste pickups, track collectors in real time, and manage recycling operations with ElectroFine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
