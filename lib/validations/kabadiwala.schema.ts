import { z } from "zod";

const phoneRegex = /^[6-9]\d{9}$/;
const vehicleRegex = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/i;

export const availabilityEnum = z.enum(["AVAILABLE", "BUSY", "OFFLINE"]);

export const kabadiwalaCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(phoneRegex, "Invalid phone number"),
  email: z.string().trim().email("Invalid email").optional().nullable(),
  password: z.string().min(8).max(72).optional(),
  vehicleNumber: z
    .string()
    .trim()
    .regex(vehicleRegex, "Invalid vehicle number")
    .optional()
    .nullable(),
  serviceArea: z.string().trim().max(150).optional().nullable(),
  availability: availabilityEnum.optional().default("AVAILABLE"),
  rating: z.number().min(0).max(5).optional(),
  isActive: z.boolean().optional().default(true),
});

export const kabadiwalaUpdateSchema = kabadiwalaCreateSchema.partial();

export const kabadiwalaQuerySchema = z.object({
  search: z.string().trim().optional(),
  availability: availabilityEnum.optional(),
  serviceArea: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type KabadiwalaCreateInput = z.infer<typeof kabadiwalaCreateSchema>;
export type KabadiwalaUpdateInput = z.infer<typeof kabadiwalaUpdateSchema>;
export type KabadiwalaQueryInput = z.infer<typeof kabadiwalaQuerySchema>;
