import { z } from "zod";

export const createOrderSchema = z.object({
  pickupAddress: z
    .string()
    .trim()
    .min(
      5,
      "Pickup address must be at least 5 characters"
    )
    .max(
      500,
      "Pickup address must not exceed 500 characters"
    ),

  deliveryAddress: z
    .string()
    .trim()
    .min(
      5,
      "Delivery address must be at least 5 characters"
    )
    .max(
      500,
      "Delivery address must not exceed 500 characters"
    ),

  packageWeight: z
    .number()
    .positive(
      "Package weight must be greater than 0"
    )
    .max(
      1000,
      "Package weight must not exceed 1000 kg"
    ),

  packageType: z
    .string()
    .trim()
    .min(
      2,
      "Package type must be at least 2 characters"
    )
    .max(
      100,
      "Package type must not exceed 100 characters"
    ),

  packageLength: z
    .number()
    .positive(
      "Package length must be greater than 0"
    )
    .max(
      1000,
      "Package length must not exceed 1000 cm"
    ),

  packageWidth: z
    .number()
    .positive(
      "Package width must be greater than 0"
    )
    .max(
      1000,
      "Package width must not exceed 1000 cm"
    ),

  packageHeight: z
    .number()
    .positive(
      "Package height must be greater than 0"
    )
    .max(
      1000,
      "Package height must not exceed 1000 cm"
    ),

  orderType: z.enum(["B2B", "B2C"]),

  deliveryType: z
    .enum(["standard", "express"])
    .default("standard"),

  paymentMethod: z.enum([
    "prepaid",
    "cod",
  ]),

  orderAmount: z
    .number()
    .nonnegative(
      "Order amount cannot be negative"
    ),

  expectedDeliveryDate: z
    .string()
    .date()
    .optional(),
});

export type CreateOrderInput =
  z.infer<typeof createOrderSchema>;