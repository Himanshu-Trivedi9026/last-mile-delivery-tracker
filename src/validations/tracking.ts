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
   * GPS latitude captured from the delivery agent's device.
   *
   * Valid range:
   * -90 to 90
   */
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .finite()
    .optional()
    .nullable(),

  /**
   * GPS longitude captured from the delivery agent's device.
   *
   * Valid range:
   * -180 to 180
   */
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .finite()
    .optional()
    .nullable(),

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