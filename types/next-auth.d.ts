import type { DefaultSession } from "next-auth";

type AppRole = "ADMIN" | "STAFF" | "CUSTOMER" | "KABADIWALA";
type AppUserType = "ADMIN" | "CUSTOMER" | "KABADIWALA";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      userType: AppUserType;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: AppRole;
    userType: AppUserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    userType: AppUserType;
  }
}
