import { z } from "zod";

export const checkoutSchema = z
  .object({
    customer: z
      .object({
        email: z.email().trim().toLowerCase().max(254),
        firstName: z.string().trim().min(2).max(80),
        lastName: z.string().trim().min(2).max(80),
        phone: z.string().trim().min(6).max(30),
        shippingAddress: z.string().trim().min(8).max(500),
        postalCode: z.string().trim().min(2).max(12).nullable().optional(),
        notes: z.string().trim().max(1000).nullable().optional(),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(64),
            variantId: z.string().trim().min(1).max(64).nullable().optional(),
            quantity: z.number().int().min(1).max(999),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    paymentMethod: z
      .enum(["BANK_TRANSFER", "MERCADO_PAGO"])
      .default("BANK_TRANSFER"),
    couponCode: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(30)
      .nullable()
      .optional(),
    shippingMethodId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict()
  .refine(
    ({ items }) =>
      new Set(
        items.map(
          ({ productId, variantId }) => `${productId}:${variantId ?? "base"}`,
        ),
      ).size === items.length,
    "No envíes el mismo producto más de una vez",
  );

export const analyticsEventSchema = z
  .object({
    type: z.enum([
      "STOREFRONT_VIEW",
      "PRODUCT_VIEW",
      "ADD_TO_CART",
      "CHECKOUT_STARTED",
    ]),
    productId: z.string().trim().min(1).max(64).nullable().optional(),
    sessionId: z.string().trim().min(8).max(100).nullable().optional(),
  })
  .strict();

export const abandonedCartSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    items: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(64),
            variantId: z.string().trim().min(1).max(64).nullable().optional(),
            quantity: z.number().int().min(1).max(999),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
