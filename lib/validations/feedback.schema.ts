import { z } from "zod";

export const feedbackCreateSchema = z.object({
  pickupRequestId: z.string().cuid("Invalid pickup request id"),
  customerId: z.string().cuid("Invalid customer id"),
  kabadiwalaId: z.string().cuid("Invalid kabadiwala id").optional().nullable(),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export const feedbackUpdateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export const feedbackQuerySchema = z.object({
  customerId: z.string().cuid().optional(),
  kabadiwalaId: z.string().cuid().optional(),
  pickupRequestId: z.string().cuid().optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>;
export type FeedbackUpdateInput = z.infer<typeof feedbackUpdateSchema>;
export type FeedbackQueryInput = z.infer<typeof feedbackQuerySchema>;
