import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

import { Router } from "express";
import { z } from "zod";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { sendStoreNotification } from "../../services/mail.js";
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
    stock: z.number().int().min(0).max(2_000_000_000),
    active: z.boolean().default(true),
  })
  .strict();
const shippingZoneSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    postalPrefixes: z
      .array(z.string().trim().toUpperCase().min(1).max(12))
      .max(100)
      .default([]),
    active: z.boolean().default(true),
  })
  .strict();
const shippingMethodSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    priceInCents: z.number().int().min(0).max(2_000_000_000),
    estimatedDays: z.number().int().positive().max(365).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();
const notificationRuleSchema = z
  .object({
    event: z.enum([
      "ORDER_CREATED",
      "ORDER_PAID",
      "ORDER_SHIPPED",
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
  response.json({
    features: subscription?.plan.features ?? [],
    domains,
    coupons,
    variants,
    shippingZones,
    notificationRules,
    abandonedCarts,
    products,
    analytics: {
      periodDays: 30,
      events: Object.fromEntries(
        eventGroups.map(({ type, _count }) => [type, _count]),
      ),
      orders,
      revenueInCents: revenue._sum.totalInCents ?? 0,
      topProducts,
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
    const rule = await database.notificationRule.findUnique({
      where: {
        tenantId_event: { tenantId: tenant.id, event: "CART_ABANDONED" },
      },
    });
    const log = await database.notificationLog.create({
      data: {
        tenantId: tenant.id,
        event: "CART_ABANDONED",
        recipient: cart.recoveryEmail,
        status: "SENDING",
      },
    });
    try {
      await sendStoreNotification({
        storeName: cart.tenant.name,
        fromName: cart.tenant.settings?.emailFromName,
        to: cart.recoveryEmail,
        subject: rule?.subject ?? `Tu carrito te espera en ${cart.tenant.name}`,
        message:
          rule?.message ??
          "Guardamos los productos que elegiste. Volvé a la tienda para terminar tu compra.",
        actionUrl: `/tienda/${cart.tenant.slug}`,
      });
      await database.notificationLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch (error) {
      await database.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Error de envío",
        },
      });
      throw error;
    }
    response.json({ sent: true });
  },
);
