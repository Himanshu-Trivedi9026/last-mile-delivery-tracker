import { z } from "zod";

/**
 * All tracking statuses supported by the application.
 *
 * Normal delivery flow:
 * pending -> confirmed -> assigned -> picked_up -> in_transit ->
 * out_for_delivery -> delivered
 *
 * Exception / administrative states:
 * failed -> rescheduled
 * cancelled
 *
 * The API performs role-aware workflow validation after
 * schema validation.
 */
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

  /**
   * Required when an order is being rescheduled.
   *
   * Format:
   * YYYY-MM-DD
   *
   * This matches the `orders.rescheduled_date` PostgreSQL
   * DATE column.
   */
  rescheduled_date: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Rescheduled date must be in YYYY-MM-DD format"
    )
    .optional(),
});

export type CreateTrackingEventInput = z.infer<
  typeof createTrackingEventSchema
>;
