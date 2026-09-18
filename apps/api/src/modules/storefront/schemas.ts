import { z } from "zod";

export const storefrontProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  search: z.string().trim().max(100).optional().default(""),
  category: z.string().trim().max(100).optional().default(""),
  brand: z.string().trim().max(100).optional().default(""),
  tag: z.string().trim().max(100).optional().default(""),
  minPrice: z.coerce.number().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(100_000_000).optional(),
  sort: z
    .enum(["featured", "recent", "price_asc", "price_desc", "name"])
    .default("featured"),
});

export const customerRegisterSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    password: z.string().min(10).max(72),
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    phone: z.string().trim().min(6).max(30).optional(),
  })
  .strict();

export const customerLoginSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    password: z.string().min(10).max(72),
  })
  .strict();

export const customerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const checkoutSchema = z
  .object({
    customer: z
      .object({
        email: z.email().trim().toLowerCase().max(254),
        firstName: z.string().trim().min(2).max(80),
        lastName: z.string().trim().min(2).max(80),
        phone: z.string().trim().min(6).max(30),
        shippingAddress: z.string().trim().min(8).max(500).nullable().optional(),
        street: z.string().trim().min(2).max(120).nullable().optional(),
        streetNumber: z.string().trim().min(1).max(20).nullable().optional(),
        apartment: z.string().trim().max(60).nullable().optional(),
        city: z.string().trim().min(2).max(100).nullable().optional(),
        province: z.string().trim().min(2).max(100).nullable().optional(),
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
    fulfillmentType: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
    pickupLocationId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasStructuredAddress = Boolean(
      input.customer.street &&
      input.customer.streetNumber &&
      input.customer.city &&
      input.customer.province,
    );
    if (input.fulfillmentType === "DELIVERY" && !input.customer.shippingAddress && !hasStructuredAddress) {
      context.addIssue({ code: "custom", path: ["customer", "street"], message: "Completá calle, número, localidad y provincia" });
    }
    if (input.fulfillmentType === "DELIVERY" && !input.customer.postalCode) {
      context.addIssue({ code: "custom", path: ["customer", "postalCode"], message: "Ingresá el código postal" });
    }
    if (input.fulfillmentType === "DELIVERY" && input.customer.postalCode && !/^(?:[A-Z]\d{4}[A-Z]{3}|\d{4})$/i.test(input.customer.postalCode.replace(/\s+/g, ""))) {
      context.addIssue({ code: "custom", path: ["customer", "postalCode"], message: "Ingresá un código postal argentino válido (por ejemplo 1425 o C1425ABC)" });
    }
    if (input.fulfillmentType === "PICKUP" && !input.pickupLocationId) {
      context.addIssue({ code: "custom", path: ["pickupLocationId"], message: "Elegí un punto de retiro" });
    }
    if (input.fulfillmentType === "PICKUP" && input.shippingMethodId) {
      context.addIssue({ code: "custom", path: ["shippingMethodId"], message: "El retiro no utiliza un método de envío" });
    }
  })
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
