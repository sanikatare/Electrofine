import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use Edge-safe config only (NO bcrypt/prisma imports in middleware)
const { auth } = NextAuth(authConfig);

/**
 * Maps a protected path prefix to the userType allowed to access it.
 */
const PROTECTED_PREFIXES: { prefix: string; allowed: string }[] = [
  { prefix: "/admin", allowed: "ADMIN" },
  { prefix: "/customer", allowed: "CUSTOMER" },
  { prefix: "/kabadiwala", allowed: "KABADIWALA" },
];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const match = PROTECTED_PREFIXES.find((p) => pathname.startsWith(p.prefix));
  if (!match) {
    return NextResponse.next();
  }

  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const userType = session?.user?.userType;

  // Not authenticated -> redirect to login, preserving destination
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ADMIN role (User table) covers both ADMIN and STAFF sub-roles
  const roleMatches =
    match.allowed === "ADMIN"
      ? userType === "ADMIN"
      : userType === match.allowed;

  // Authenticated but wrong role -> redirect to unauthorized page
  if (!roleMatches) {
    const unauthorizedUrl = new URL("/unauthorized", nextUrl.origin);
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/customer/:path*", "/kabadiwala/:path*"],
};
