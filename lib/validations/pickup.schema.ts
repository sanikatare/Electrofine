import { z } from "zod";

export const requestStatusEnum = z.enum([
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const pickupItemSchema = z.object({
  categoryId: z.string().cuid("Invalid category id"),
  description: z.string().trim().max(255).optional().nullable(),
  weight: z.number().positive("Weight must be greater than 0"),
  unitPrice: z.number().nonnegative().optional(), // falls back to live Pricing if omitted
});

export const pickupCreateSchema = z.object({
  customerId: z.string().cuid("Invalid customer id"),
  addressId: z.string().cuid("Invalid address id"),
  kabadiwalaId: z.string().cuid("Invalid kabadiwala id").optional().nullable(),
  scheduledDate: z
    .coerce.date()
    .refine((d) => d.getTime() > Date.now(), "Scheduled date must be in the future"),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(pickupItemSchema)
    .min(1, "At least one pickup item is required"),
});

export const pickupUpdateSchema = z.object({
  addressId: z.string().cuid().optional(),
  kabadiwalaId: z.string().cuid().optional().nullable(),
  status: requestStatusEnum.optional(),
  scheduledDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(pickupItemSchema).min(1).optional(),
});

export const pickupQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: requestStatusEnum.optional(),
  customerId: z.string().cuid().optional(),
  kabadiwalaId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PickupCreateInput = z.infer<typeof pickupCreateSchema>;
export type PickupUpdateInput = z.infer<typeof pickupUpdateSchema>;
export type PickupQueryInput = z.infer<typeof pickupQuerySchema>;
