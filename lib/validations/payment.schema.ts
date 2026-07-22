import { z } from "zod";

export const paymentMethodEnum = z.enum([
  "CASH",
  "UPI",
  "CARD",
  "WALLET",
  "BANK_TRANSFER",
]);

export const paymentStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);

export const paymentCreateSchema = z.object({
  pickupRequestId: z.string().cuid("Invalid pickup request id"),
  customerId: z.string().cuid("Invalid customer id"),
  amount: z.number().positive("Amount must be greater than 0"),
  method: paymentMethodEnum,
  status: paymentStatusEnum.optional().default("PENDING"),
  transactionRef: z.string().trim().max(100).optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
});

export const paymentUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  method: paymentMethodEnum.optional(),
  status: paymentStatusEnum.optional(),
  transactionRef: z.string().trim().max(100).optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
});

export const paymentQuerySchema = z.object({
  status: paymentStatusEnum.optional(),
  method: paymentMethodEnum.optional(),
  customerId: z.string().cuid().optional(),
  pickupRequestId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
