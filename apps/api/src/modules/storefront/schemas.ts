import { z } from "zod";

export const checkoutSchema = z
  .object({
    customer: z.object({
      email: z.email().trim().toLowerCase().max(254),
      firstName: z.string().trim().min(2).max(80),
      lastName: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(6).max(30),
      shippingAddress: z.string().trim().min(8).max(500),
      notes: z.string().trim().max(1000).nullable().optional(),
    }).strict(),
    items: z.array(z.object({
      productId: z.string().trim().min(1).max(64),
      quantity: z.number().int().min(1).max(999),
    }).strict()).min(1).max(50),
    paymentMethod: z.literal("BANK_TRANSFER").default("BANK_TRANSFER"),
  })
  .strict()
  .refine(
    ({ items }) => new Set(items.map(({ productId }) => productId)).size === items.length,
    "No envíes el mismo producto más de una vez",
  );
