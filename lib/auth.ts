import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

/**
 * Login payload contract expected from the client:
 * {
 *   identifier: string   // email (Admin/Customer) or phone (Customer/Kabadiwala)
 *   password:   string
 *   userType:   "ADMIN" | "CUSTOMER" | "KABADIWALA"
 * }
 */
const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  userType: z.enum(["ADMIN", "CUSTOMER", "KABADIWALA"]),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
        userType: { label: "User Type", type: "text" },
      },

      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { identifier, password, userType } = parsed.data;

        switch (userType) {
          case "ADMIN": {
            const admin = await prisma.user.findUnique({
              where: { email: identifier },
            });
            if (!admin || !admin.isActive) return null;

            const valid = await bcrypt.compare(password, admin.passwordHash);
            if (!valid) return null;

            await prisma.user.update({
              where: { id: admin.id },
              data: { lastLoginAt: new Date() },
            });

            return {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              role: admin.role, // ADMIN | STAFF
              userType: "ADMIN" as const,
            };
          }

          case "CUSTOMER": {
            const customer = await prisma.customer.findFirst({
              where: {
                OR: [{ email: identifier }, { phone: identifier }],
              },
            });
            if (!customer || !customer.isActive || !customer.passwordHash) {
              return null;
            }

            const valid = await bcrypt.compare(
              password,
              customer.passwordHash
            );
            if (!valid) return null;

            return {
              id: customer.id,
              name: customer.name,
              email: customer.email ?? customer.phone,
              role: "CUSTOMER" as const,
              userType: "CUSTOMER" as const,
            };
          }

          case "KABADIWALA": {
            const kabadiwala = await prisma.kabadiwala.findFirst({
              where: {
                OR: [{ email: identifier }, { phone: identifier }],
              },
            });
            // NOTE: schema currently has no passwordHash column on
            // Kabadiwala — add one (String?) before enabling this login.
            if (
              !kabadiwala ||
              !kabadiwala.isActive ||
              !("passwordHash" in kabadiwala) ||
              !(kabadiwala as { passwordHash?: string }).passwordHash
            ) {
              return null;
            }

            const valid = await bcrypt.compare(
              password,
              (kabadiwala as { passwordHash: string }).passwordHash
            );
            if (!valid) return null;

            return {
              id: kabadiwala.id,
              name: kabadiwala.name,
              email: kabadiwala.email ?? kabadiwala.phone,
              role: "KABADIWALA" as const,
              userType: "KABADIWALA" as const,
            };
          }

          default:
            return null;
        }
      },
    }),
  ],
});
