import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

import { Router } from "express";
import { z } from "zod";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { dispatchTenantNotification } from "../../services/notifications.js";
import {
  getAuthContext,
  requireRoles,
  requireSession,
} from "../auth/session.js";
import { assertPlanFeature, type PlanFeatureCode } from "../saas/features.js";
import { requireWritableSubscription } from "../saas/limits.js";

export const growthRouter = Router();
const canManage = requireRoles("OWNER", "ADMIN");
const idSchema = z.string().trim().min(1).max(64);
const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,}$/);
const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(30)
      .regex(/^[A-Z0-9_-]+$/),
    name: z.string().trim().min(2).max(100),
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: z.number().int().positive().max(2_000_000_000),
    minimumInCents: z.number().int().min(0).max(2_000_000_000).default(0),
    maximumUses: z
      .number()
      .int()
      .positive()
      .max(1_000_000)
      .nullable()
      .optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(
    ({ type, value }) => type !== "PERCENTAGE" || value <= 100,
    "El porcentaje no puede superar 100",
  );
const variantSchema = z
  .object({
    productId: idSchema,
    sku: z.string().trim().toUpperCase().min(2).max(64),
    name: z.string().trim().min(1).max(120),
    options: z.record(z.string(), z.string().trim().min(1).max(80)),
    priceInCents: z.number().int().min(0).max(2_000_000_000),
    bankTransferPriceInCents: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    cashPriceInCents: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    stock: z.number().int().min(0).max(2_000_000_000),
    weightInGrams: z.number().int().positive().max(10_000_000).nullable().optional(),
    widthInMm: z.number().int().positive().max(1_000_000).nullable().optional(),
    heightInMm: z.number().int().positive().max(1_000_000).nullable().optional(),
    lengthInMm: z.number().int().positive().max(1_000_000).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(({ priceInCents, bankTransferPriceInCents }) => bankTransferPriceInCents === null || bankTransferPriceInCents === undefined || bankTransferPriceInCents <= priceInCents, { message: "El precio por transferencia no puede superar al precio de lista", path: ["bankTransferPriceInCents"] })
  .refine(({ priceInCents, cashPriceInCents }) => cashPriceInCents === null || cashPriceInCents === undefined || cashPriceInCents <= priceInCents, { message: "El precio en efectivo no puede superar al precio de lista", path: ["cashPriceInCents"] });
const shippingZoneSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    postalPrefixes: z
      .array(z.string().trim().toUpperCase().min(1).max(12))
      .max(100)
      .default([]),
    countryCode: z.string().trim().toUpperCase().length(2).default("AR"),
    provinces: z.array(z.string().trim().min(2).max(100)).max(50).default([]),
    cities: z.array(z.string().trim().min(2).max(100)).max(200).default([]),
    postalRanges: z.array(z.object({
      from: z.string().trim().toUpperCase().min(4).max(12),
      to: z.string().trim().toUpperCase().min(4).max(12).nullable().optional(),
    }).strict()).max(100).optional(),
    active: z.boolean().default(true),
  })
  .strict();
const shippingMethodBaseSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    priceInCents: z.number().int().min(0).max(2_000_000_000),
    pricingType: z.enum(["FIXED", "FREE", "TO_AGREE", "WEIGHT_TABLE", "ORDER_TOTAL_TABLE"]).default("FIXED"),
    rateRules: z.array(z.object({
      from: z.number().int().min(0).max(2_000_000_000),
      to: z.number().int().positive().max(2_000_000_000).nullable().optional(),
      priceInCents: z.number().int().min(0).max(2_000_000_000),
    }).strict()).max(50).optional(),
    minimumOrderInCents: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    maximumOrderInCents: z.number().int().positive().max(2_000_000_000).nullable().optional(),
    minimumWeightInGrams: z.number().int().min(0).max(10_000_000).nullable().optional(),
    maximumWeightInGrams: z.number().int().positive().max(10_000_000).nullable().optional(),
    excludedProductIds: z.array(idSchema).max(500).default([]),
    excludedCategoryIds: z.array(idSchema).max(200).default([]),
    preparationDaysMin: z.number().int().min(0).max(365).default(0),
    preparationDaysMax: z.number().int().min(0).max(365).default(0),
    estimatedDays: z.number().int().positive().max(365).nullable().optional(),
    estimatedDaysMin: z.number().int().positive().max(365).nullable().optional(),
    estimatedDaysMax: z.number().int().positive().max(365).nullable().optional(),
    freeShippingThresholdInCents: z.number().int().positive().max(2_000_000_000).nullable().optional(),
    carrierCode: z.enum(["CORREO_ARGENTINO", "ANDREANI", "OCA", "VIA_CARGO", "CUSTOM"]).nullable().optional(),
    carrierName: z.string().trim().max(100).nullable().optional(),
    trackingUrlTemplate: z.url().trim().max(2048).refine((value) => new URL(value).protocol === "https:", "Usá una URL HTTPS").nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();
const validShippingRange = ({ estimatedDaysMin, estimatedDaysMax }: { estimatedDaysMin?: number | null; estimatedDaysMax?: number | null }) => !estimatedDaysMin || !estimatedDaysMax || estimatedDaysMin <= estimatedDaysMax;
const shippingMethodSchema = shippingMethodBaseSchema
  .refine(({ estimatedDaysMin, estimatedDaysMax }) => !estimatedDaysMin || !estimatedDaysMax || estimatedDaysMin <= estimatedDaysMax, {
    message: "El plazo mínimo no puede superar al máximo",
    path: ["estimatedDaysMax"],
  })
  .refine(({ preparationDaysMin, preparationDaysMax }) => preparationDaysMin <= preparationDaysMax, { message: "La preparación mínima no puede superar a la máxima", path: ["preparationDaysMax"] })
  .refine(({ minimumOrderInCents, maximumOrderInCents }) => minimumOrderInCents === null || minimumOrderInCents === undefined || maximumOrderInCents === null || maximumOrderInCents === undefined || minimumOrderInCents <= maximumOrderInCents, { message: "El monto mínimo no puede superar al máximo", path: ["maximumOrderInCents"] })
  .refine(({ minimumWeightInGrams, maximumWeightInGrams }) => minimumWeightInGrams === null || minimumWeightInGrams === undefined || maximumWeightInGrams === null || maximumWeightInGrams === undefined || minimumWeightInGrams <= maximumWeightInGrams, { message: "El peso mínimo no puede superar al máximo", path: ["maximumWeightInGrams"] })
  .refine(({ pricingType, rateRules }) => !["WEIGHT_TABLE", "ORDER_TOTAL_TABLE"].includes(pricingType) || Boolean(rateRules?.length), { message: "Agregá al menos un tramo de tarifa", path: ["rateRules"] })
  .refine(({ rateRules }) => !rateRules?.some(({ from, to }) => to !== null && to !== undefined && from > to), { message: "El inicio de un tramo no puede superar su final", path: ["rateRules"] })
  .refine(({ rateRules }) => {
    if (!rateRules?.length) return true;
    const sorted = [...rateRules].sort((left, right) => left.from - right.from);
    return sorted.every((rule, index) => index === 0 || sorted[index - 1]!.to === null || sorted[index - 1]!.to === undefined || rule.from > sorted[index - 1]!.to!);
  }, { message: "Los tramos de tarifa no pueden superponerse", path: ["rateRules"] });
const updateShippingMethodSchema = shippingMethodBaseSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Enviá al menos un campo",
).refine(validShippingRange, { message: "El plazo mínimo no puede superar al máximo", path: ["estimatedDaysMax"] });
const updateShippingZoneSchema = shippingZoneSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Enviá al menos un campo",
);
const assistedShippingSetupSchema = z
  .object({
    originPostalCode: z.string().trim().toUpperCase().regex(
      /^(?:[A-Z]?\d{4}(?:[A-Z]{3})?)$/,
      "Ingresá un código postal de 4 dígitos o un CPA válido",
    ),
    localPriceInCents: z.number().int().min(0).max(2_000_000_000),
    nationwidePriceInCents: z.number().int().min(0).max(2_000_000_000),
    localDaysMin: z.number().int().positive().max(365),
    localDaysMax: z.number().int().positive().max(365),
    nationwideDaysMin: z.number().int().positive().max(365),
    nationwideDaysMax: z.number().int().positive().max(365),
  })
  .strict()
  .refine(({ localDaysMin, localDaysMax }) => localDaysMin <= localDaysMax, {
    message: "El plazo local mínimo no puede superar al máximo",
    path: ["localDaysMax"],
  })
  .refine(
    ({ nationwideDaysMin, nationwideDaysMax }) => nationwideDaysMin <= nationwideDaysMax,
    {
      message: "El plazo nacional mínimo no puede superar al máximo",
      path: ["nationwideDaysMax"],
    },
  );
const deliveryPoliciesSchema = z.object({
  shippingPolicy: z.string().trim().max(3000).nullable().optional(),
  returnPolicy: z.string().trim().max(3000).nullable().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, "Enviá al menos una política");
const mapsUrlSchema = z.url().trim().max(2048).refine((value) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && (
    host === "maps.app.goo.gl"
    || host === "goo.gl"
    || host === "google.com"
    || host.endsWith(".google.com")
    || /^(?:(?:www|maps)\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host)
  );
}, "Ingresá un enlace HTTPS válido de Google Maps");
const pickupLocationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(240),
    city: z.string().trim().min(2).max(100),
    province: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().max(12).nullable().optional(),
    mapsUrl: mapsUrlSchema.nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    openingHours: z.string().trim().max(500).nullable().optional(),
    instructions: z.string().trim().max(1000).nullable().optional(),
    preparationMinutes: z.number().int().min(0).max(10080).default(120),
    active: z.boolean().default(true),
  })
  .strict();
const updatePickupLocationSchema = pickupLocationSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Enviá al menos un campo",
);
const shippingOriginSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(240),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().toUpperCase().regex(/^(?:[A-Z]?\d{4}(?:[A-Z]{3})?)$/, "Ingresá un CP o CPA válido"),
  countryCode: z.string().trim().toUpperCase().length(2).default("AR"),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
}).strict();
const updateShippingOriginSchema = shippingOriginSchema.partial().refine((input) => Object.keys(input).length > 0, "Enviá al menos un campo");
const notificationRuleSchema = z
  .object({
    event: z.enum([
      "ORDER_CREATED",
      "ORDER_PAID",
      "ORDER_SHIPPED",
      "ORDER_READY_FOR_PICKUP",
      "CART_ABANDONED",
    ]),
    active: z.boolean().default(true),
    subject: z.string().trim().min(2).max(160),
    message: z.string().trim().min(2).max(4000),
  })
  .strict();

growthRouter.use(requireSession);
growthRouter.use((request, response, next) => {
  if (["POST", "PATCH", "DELETE"].includes(request.method))
    return void requireWritableSubscription(request, response, next);
  next();
});

async function requireFeature(
  request: Parameters<typeof getAuthContext>[0],
  feature: PlanFeatureCode,
): Promise<void> {
  const { tenant } = getAuthContext(request);
  const subscription = await database.subscription.findUnique({
    where: { tenantId: tenant.id },
    include: { plan: true },
  });
  if (!subscription)
    throw new HttpError(409, "La tienda no tiene un plan asignado");
  assertPlanFeature(subscription.plan.features, feature);
}

growthRouter.get("/overview", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    subscription,
    domains,
    coupons,
    variants,
    shippingZones,
    shippingOrigins,
    pickupLocations,
    storeSettings,
    notificationRules,
    abandonedCarts,
    eventGroups,
    orders,
    revenue,
    topProducts,
    products,
  ] = await Promise.all([
    database.subscription.findUnique({
      where: { tenantId: tenant.id },
      include: { plan: true },
    }),
    database.customDomain.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
    database.coupon.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
    database.productVariant.findMany({
      where: { tenantId: tenant.id },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    database.shippingZone.findMany({
      where: { tenantId: tenant.id },
      include: { methods: { orderBy: { priceInCents: "asc" } } },
      orderBy: { name: "asc" },
    }),
    database.shippingOrigin.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    database.pickupLocation.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    database.storeSettings.findUnique({
      where: { tenantId: tenant.id },
      select: { shippingPolicy: true, returnPolicy: true },
    }),
    database.notificationRule.findMany({
      where: { tenantId: tenant.id },
      orderBy: { event: "asc" },
    }),
    database.cart.findMany({
      where: { tenantId: tenant.id, status: "ABANDONED" },
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    database.analyticsEvent.groupBy({
      by: ["type"],
      where: { tenantId: tenant.id, createdAt: { gte: since } },
      _count: true,
    }),
    database.order.count({
      where: { tenantId: tenant.id, createdAt: { gte: since } },
    }),
    database.order.aggregate({
      where: {
        tenantId: tenant.id,
        paymentStatus: "APPROVED",
        createdAt: { gte: since },
      },
      _sum: { totalInCents: true },
    }),
    database.orderItem.groupBy({
      by: ["productName"],
      where: {
        tenantId: tenant.id,
        order: { paymentStatus: "APPROVED", createdAt: { gte: since } },
      },
      _sum: { quantity: true, subtotalInCents: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    database.product.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const features = subscription?.plan.features ?? [];
  response.json({
    features,
    domains: features.includes("CUSTOM_DOMAIN") ? domains : [],
    coupons: features.includes("COUPONS_PROMOTIONS") ? coupons : [],
    variants: features.includes("PRODUCT_VARIANTS") ? variants : [],
    shippingZones,
    shippingOrigins,
    pickupLocations,
    deliveryPolicies: {
      shippingPolicy: storeSettings?.shippingPolicy ?? null,
      returnPolicy: storeSettings?.returnPolicy ?? null,
    },
    notificationRules: features.includes("AUTOMATIONS")
      ? notificationRules
      : [],
    abandonedCarts: features.includes("ABANDONED_CART_RECOVERY")
      ? abandonedCarts
      : [],
    products,
    analytics: {
      periodDays: 30,
      events: Object.fromEntries(
        eventGroups.map(({ type, _count }) => [type, _count]),
      ),
      orders,
      revenueInCents: revenue._sum.totalInCents ?? 0,
      topProducts: features.includes("ADVANCED_ANALYTICS") ? topProducts : [],
    },
  });
});

growthRouter.post("/domains", canManage, async (request, response) => {
  await requireFeature(request, "CUSTOM_DOMAIN");
  const { tenant } = getAuthContext(request);
  const hostname = hostnameSchema.parse(request.body?.hostname);
  const domain = await database.customDomain
    .create({
      data: {
        tenantId: tenant.id,
        hostname,
        verificationToken: randomBytes(24).toString("hex"),
      },
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002")
        throw new HttpError(409, "Ese dominio ya está registrado");
      throw error;
    });
  response
    .status(201)
    .json({
      domain,
      dnsRecord: {
        type: "TXT",
        name: `_infinityshop.${hostname}`,
        value: domain.verificationToken,
      },
    });
});

growthRouter.post(
  "/domains/:id/verify",
  canManage,
  async (request, response) => {
    await requireFeature(request, "CUSTOM_DOMAIN");
    const { tenant } = getAuthContext(request);
    const id = idSchema.parse(request.params.id);
    const domain = await database.customDomain.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!domain) throw new HttpError(404, "Dominio no encontrado");
    let verified = false;
    let failureReason: string | null = null;
    try {
      const records = await resolveTxt(`_infinityshop.${domain.hostname}`);
      verified = records.flat().includes(domain.verificationToken);
      if (!verified)
        failureReason = "El registro TXT todavía no contiene el token esperado";
    } catch {
      failureReason = "No se encontró el registro TXT de verificación";
    }
    const updated = await database.customDomain.update({
      where: { id },
      data: {
        status: verified ? "VERIFIED" : "FAILED",
        verifiedAt: verified ? new Date() : null,
        lastCheckedAt: new Date(),
        failureReason,
      },
    });
    response.status(verified ? 200 : 409).json({ domain: updated });
  },
);

growthRouter.patch("/shipping-zones/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const input = updateShippingZoneSchema.parse(request.body);
  const updated = await database.shippingZone.updateMany({ where: { id, tenantId: tenant.id }, data: input });
  if (!updated.count) throw new HttpError(404, "Zona no encontrada");
  response.json({ zone: await database.shippingZone.findFirstOrThrow({ where: { id, tenantId: tenant.id } }) });
});

growthRouter.patch("/shipping-methods/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const input = updateShippingMethodSchema.parse(request.body);
  const current = await database.shippingMethod.findFirst({ where: { id, tenantId: tenant.id } });
  if (!current) throw new HttpError(404, "Método no encontrado");
  shippingMethodSchema.parse({
    name: input.name ?? current.name,
    priceInCents: input.priceInCents ?? current.priceInCents,
    pricingType: input.pricingType ?? current.pricingType,
    rateRules: input.rateRules === undefined ? current.rateRules ?? undefined : input.rateRules,
    minimumOrderInCents: input.minimumOrderInCents === undefined ? current.minimumOrderInCents : input.minimumOrderInCents,
    maximumOrderInCents: input.maximumOrderInCents === undefined ? current.maximumOrderInCents : input.maximumOrderInCents,
    minimumWeightInGrams: input.minimumWeightInGrams === undefined ? current.minimumWeightInGrams : input.minimumWeightInGrams,
    maximumWeightInGrams: input.maximumWeightInGrams === undefined ? current.maximumWeightInGrams : input.maximumWeightInGrams,
    excludedProductIds: input.excludedProductIds ?? current.excludedProductIds,
    excludedCategoryIds: input.excludedCategoryIds ?? current.excludedCategoryIds,
    preparationDaysMin: input.preparationDaysMin ?? current.preparationDaysMin,
    preparationDaysMax: input.preparationDaysMax ?? current.preparationDaysMax,
    estimatedDays: input.estimatedDays === undefined ? current.estimatedDays : input.estimatedDays,
    estimatedDaysMin: input.estimatedDaysMin === undefined ? current.estimatedDaysMin : input.estimatedDaysMin,
    estimatedDaysMax: input.estimatedDaysMax === undefined ? current.estimatedDaysMax : input.estimatedDaysMax,
    freeShippingThresholdInCents: input.freeShippingThresholdInCents === undefined ? current.freeShippingThresholdInCents : input.freeShippingThresholdInCents,
    carrierCode: input.carrierCode === undefined ? current.carrierCode : input.carrierCode,
    carrierName: input.carrierName === undefined ? current.carrierName : input.carrierName,
    trackingUrlTemplate: input.trackingUrlTemplate === undefined ? current.trackingUrlTemplate : input.trackingUrlTemplate,
    active: input.active ?? current.active,
  });
  const updated = await database.shippingMethod.updateMany({ where: { id, tenantId: tenant.id }, data: input });
  if (!updated.count) throw new HttpError(409, "No se pudo actualizar el método");
  response.json({ method: await database.shippingMethod.findFirstOrThrow({ where: { id, tenantId: tenant.id } }) });
});

growthRouter.patch("/delivery-policies", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = deliveryPoliciesSchema.parse(request.body);
  const settings = await database.storeSettings.upsert({
    where: { tenantId: tenant.id },
    update: input,
    create: { tenantId: tenant.id, ...input },
    select: { shippingPolicy: true, returnPolicy: true },
  });
  response.json({ policies: settings });
});

growthRouter.delete("/domains/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const deleted = await database.customDomain.deleteMany({
    where: { id, tenantId: tenant.id },
  });
  if (!deleted.count) throw new HttpError(404, "Dominio no encontrado");
  response.status(204).send();
});

growthRouter.post("/coupons", canManage, async (request, response) => {
  await requireFeature(request, "COUPONS_PROMOTIONS");
  const { tenant } = getAuthContext(request);
  const input = couponSchema.parse(request.body);
  const coupon = await database.coupon
    .create({ data: { ...input, tenantId: tenant.id } })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002")
        throw new HttpError(409, "Ya existe ese cupón");
      throw error;
    });
  response.status(201).json({ coupon });
});

growthRouter.patch("/coupons/:id", canManage, async (request, response) => {
  await requireFeature(request, "COUPONS_PROMOTIONS");
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const input = couponSchema.partial().parse(request.body);
  if (
    !(await database.coupon.findFirst({ where: { id, tenantId: tenant.id } }))
  )
    throw new HttpError(404, "Cupón no encontrado");
  response.json({
    coupon: await database.coupon.update({ where: { id }, data: input }),
  });
});

growthRouter.delete("/coupons/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const deleted = await database.coupon.deleteMany({
    where: { id, tenantId: tenant.id },
  });
  if (!deleted.count) throw new HttpError(404, "Cupón no encontrado");
  response.status(204).send();
});

growthRouter.post("/variants", canManage, async (request, response) => {
  await requireFeature(request, "PRODUCT_VARIANTS");
  const { tenant } = getAuthContext(request);
  const input = variantSchema.parse(request.body);
  if (
    !(await database.product.findFirst({
      where: { id: input.productId, tenantId: tenant.id },
    }))
  )
    throw new HttpError(404, "Producto no encontrado");
  const variant = await database.productVariant
    .create({ data: { ...input, tenantId: tenant.id } })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002")
        throw new HttpError(409, "Ya existe ese SKU");
      throw error;
    });
  response.status(201).json({ variant });
});

growthRouter.delete("/variants/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const deleted = await database.productVariant.deleteMany({
    where: { id, tenantId: tenant.id },
  });
  if (!deleted.count) throw new HttpError(404, "Variante no encontrada");
  response.status(204).send();
});

growthRouter.patch("/variants/:id", canManage, async (request, response) => {
  await requireFeature(request, "PRODUCT_VARIANTS");
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const input = variantSchema
    .omit({ productId: true })
    .partial()
    .parse(request.body);
  if (
    !(await database.productVariant.findFirst({
      where: { id, tenantId: tenant.id },
    }))
  )
    throw new HttpError(404, "Variante no encontrada");
  response.json({
    variant: await database.productVariant.update({
      where: { id },
      data: input,
    }),
  });
});

growthRouter.post("/shipping-zones", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = shippingZoneSchema.parse(request.body);
  response
    .status(201)
    .json({
      zone: await database.shippingZone.create({
        data: { ...input, tenantId: tenant.id },
      }),
    });
});

growthRouter.post("/shipping-setup/assisted", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = assistedShippingSetupSchema.parse(request.body);
  const numericPostalCode = input.originPostalCode.match(/\d{4}/)?.[0];
  if (!numericPostalCode)
    throw new HttpError(400, "No pudimos obtener el código postal de origen");

  const created = await database.$transaction(async (transaction) => {
    const reservedNames = ["Entrega local", "Resto del país"];
    const existing = await transaction.shippingZone.findFirst({
      where: { tenantId: tenant.id, name: { in: reservedNames } },
      select: { name: true },
    });
    if (existing)
      throw new HttpError(
        409,
        `Ya existe la zona “${existing.name}”. Editala o eliminála antes de volver a usar el asistente.`,
      );

    const localZone = await transaction.shippingZone.create({
      data: {
        tenantId: tenant.id,
        name: "Entrega local",
        postalPrefixes: [numericPostalCode],
        active: false,
        methods: {
          create: {
            name: "Envío local",
            priceInCents: input.localPriceInCents,
            estimatedDaysMin: input.localDaysMin,
            estimatedDaysMax: input.localDaysMax,
            active: true,
          },
        },
      },
      include: { methods: true },
    });
    const nationwideZone = await transaction.shippingZone.create({
      data: {
        tenantId: tenant.id,
        name: "Resto del país",
        postalPrefixes: [],
        active: false,
        methods: {
          create: {
            name: "Envío nacional",
            priceInCents: input.nationwidePriceInCents,
            estimatedDaysMin: input.nationwideDaysMin,
            estimatedDaysMax: input.nationwideDaysMax,
            active: true,
          },
        },
      },
      include: { methods: true },
    });
    return [localZone, nationwideZone];
  });

  response.status(201).json({ zones: created });
});

growthRouter.post(
  "/shipping-zones/:id/methods",
  canManage,
  async (request, response) => {
    const { tenant } = getAuthContext(request);
    const shippingZoneId = idSchema.parse(request.params.id);
    const input = shippingMethodSchema.parse(request.body);
    if (
      !(await database.shippingZone.findFirst({
        where: { id: shippingZoneId, tenantId: tenant.id },
      }))
    )
      throw new HttpError(404, "Zona no encontrada");
    response
      .status(201)
      .json({
        method: await database.shippingMethod.create({
          data: { ...input, tenantId: tenant.id, shippingZoneId },
        }),
      });
  },
);

growthRouter.delete(
  "/shipping-zones/:id",
  canManage,
  async (request, response) => {
    const { tenant } = getAuthContext(request);
    const id = idSchema.parse(request.params.id);
    const deleted = await database.shippingZone.deleteMany({
      where: { id, tenantId: tenant.id },
    });
    if (!deleted.count) throw new HttpError(404, "Zona no encontrada");
    response.status(204).send();
  },
);

growthRouter.delete(
  "/shipping-methods/:id",
  canManage,
  async (request, response) => {
    const { tenant } = getAuthContext(request);
    const id = idSchema.parse(request.params.id);
    const deleted = await database.shippingMethod.deleteMany({
      where: { id, tenantId: tenant.id },
    });
    if (!deleted.count) throw new HttpError(404, "Método no encontrado");
    response.status(204).send();
  },
);

growthRouter.post("/shipping-origins", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = shippingOriginSchema.parse(request.body);
  const origin = await database.$transaction(async (transaction) => {
    const existingCount = await transaction.shippingOrigin.count({ where: { tenantId: tenant.id } });
    const makeDefault = input.isDefault || existingCount === 0;
    if (makeDefault) await transaction.shippingOrigin.updateMany({ where: { tenantId: tenant.id }, data: { isDefault: false } });
    return transaction.shippingOrigin.create({ data: { ...input, isDefault: makeDefault, tenantId: tenant.id } });
  });
  response.status(201).json({ origin });
});

growthRouter.patch("/shipping-origins/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const input = updateShippingOriginSchema.parse(request.body);
  const existing = await database.shippingOrigin.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new HttpError(404, "Origen de despacho no encontrado");
  const origin = await database.$transaction(async (transaction) => {
    if (input.isDefault) {
      await transaction.shippingOrigin.updateMany({ where: { tenantId: tenant.id, id: { not: id } }, data: { isDefault: false } });
      return transaction.shippingOrigin.update({ where: { id }, data: { ...input, active: true, isDefault: true } });
    }
    const deactivatingDefault = existing.isDefault && input.active === false;
    const updated = await transaction.shippingOrigin.update({ where: { id }, data: deactivatingDefault ? { ...input, isDefault: false } : input });
    if (deactivatingDefault) {
      const fallback = await transaction.shippingOrigin.findFirst({ where: { tenantId: tenant.id, id: { not: id }, active: true }, orderBy: { createdAt: "asc" } });
      if (fallback) await transaction.shippingOrigin.update({ where: { id: fallback.id }, data: { isDefault: true } });
    }
    return updated;
  });
  response.json({ origin });
});

growthRouter.delete("/shipping-origins/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const existing = await database.shippingOrigin.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new HttpError(404, "Origen de despacho no encontrado");
  await database.shippingOrigin.delete({ where: { id } });
  if (existing.isDefault) {
    const fallback = await database.shippingOrigin.findFirst({ where: { tenantId: tenant.id, active: true }, orderBy: { createdAt: "asc" } });
    if (fallback) await database.shippingOrigin.update({ where: { id: fallback.id }, data: { isDefault: true } });
  }
  response.status(204).send();
});

growthRouter.post("/pickup-locations", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = pickupLocationSchema.parse(request.body);
  const location = await database.pickupLocation.create({
    data: { ...input, tenantId: tenant.id },
  });
  response.status(201).json({ location });
});

growthRouter.patch("/pickup-locations/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const input = updatePickupLocationSchema.parse(request.body);
  const updated = await database.pickupLocation.updateMany({
    where: { id, tenantId: tenant.id },
    data: input,
  });
  if (!updated.count) throw new HttpError(404, "Punto de retiro no encontrado");
  response.json({
    location: await database.pickupLocation.findFirstOrThrow({ where: { id, tenantId: tenant.id } }),
  });
});

growthRouter.delete("/pickup-locations/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = idSchema.parse(request.params.id);
  const deleted = await database.pickupLocation.deleteMany({ where: { id, tenantId: tenant.id } });
  if (!deleted.count) throw new HttpError(404, "Punto de retiro no encontrado");
  response.status(204).send();
});

growthRouter.put(
  "/notification-rules/:event",
  canManage,
  async (request, response) => {
    await requireFeature(request, "AUTOMATIONS");
    const { tenant } = getAuthContext(request);
    const input = notificationRuleSchema.parse({
      ...request.body,
      event: request.params.event,
    });
    const rule = await database.notificationRule.upsert({
      where: { tenantId_event: { tenantId: tenant.id, event: input.event } },
      update: input,
      create: { ...input, tenantId: tenant.id },
    });
    response.json({ rule });
  },
);

growthRouter.post(
  "/abandoned-carts/:id/recover",
  canManage,
  async (request, response) => {
    await requireFeature(request, "ABANDONED_CART_RECOVERY");
    const { tenant } = getAuthContext(request);
    const id = idSchema.parse(request.params.id);
    const cart = await database.cart.findFirst({
      where: { id, tenantId: tenant.id, status: "ABANDONED" },
      include: { tenant: { include: { settings: true } } },
    });
    if (!cart?.recoveryEmail)
      throw new HttpError(404, "Carrito recuperable no encontrado");
    await dispatchTenantNotification({
      tenantId: tenant.id,
      event: "CART_ABANDONED",
      recipient: cart.recoveryEmail,
      actionUrl: `/tienda/${cart.tenant.slug}`,
    });
    response.json({ sent: true, queued: true });
  },
);
