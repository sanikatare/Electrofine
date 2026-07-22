import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth config.
 * Contains no Node-only APIs (bcrypt, Prisma) so it can be safely
 * imported by middleware.ts for route protection.
 * The Credentials provider itself is registered in lib/auth.ts.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },

  providers: [], // populated in lib/auth.ts

  callbacks: {
    /**
     * Persist role/type/entityId onto the JWT at sign-in.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.userType = user.userType;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },

    /**
     * Expose role/type/entityId on the session object.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as
          | "ADMIN"
          | "STAFF"
          | "CUSTOMER"
          | "KABADIWALA";
        session.user.userType = token.userType as
          | "ADMIN"
          | "CUSTOMER"
          | "KABADIWALA";
      }
      return session;
    },

    /**
     * Central route-protection logic, consumed by middleware.ts.
     * Restricts /dashboard, /categories, /kabadiwalas (management)
     * to ADMIN/STAFF; customer & kabadiwala portals to their own roles.
     */
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const role = auth?.user?.userType;

      const adminOnlyRoutes = ["/dashboard", "/categories", "/kabadiwalas-admin"];
      const customerRoutes = ["/account", "/my-pickup-requests"];
      const kabadiwalaRoutes = ["/collector"];

      if (adminOnlyRoutes.some((r) => pathname.startsWith(r))) {
        return isLoggedIn && role === "ADMIN";
      }
      if (customerRoutes.some((r) => pathname.startsWith(r))) {
        return isLoggedIn && role === "CUSTOMER";
      }
      if (kabadiwalaRoutes.some((r) => pathname.startsWith(r))) {
        return isLoggedIn && role === "KABADIWALA";
      }

      return true;
    },
  },
};
