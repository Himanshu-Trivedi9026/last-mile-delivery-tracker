import { z } from "zod";

export const trackingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "rescheduled",
  "cancelled",
]);

export const createTrackingEventSchema = z.object({
  status: trackingStatusSchema,

  description: z
    .string()
    .trim()
    .max(500, "Description must not exceed 500 characters")
    .optional(),

  location: z
    .string()
    .trim()
    .max(300, "Location must not exceed 300 characters")
    .optional(),
});

export type CreateTrackingEventInput = z.infer<
  typeof createTrackingEventSchema
>;
