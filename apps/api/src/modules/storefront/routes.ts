import { randomBytes, randomUUID } from "node:crypto";

import { Router } from "express";
import multer from "multer";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { tenantSlug } from "../auth/schemas.js";
import { assertSubscriptionWritable } from "../saas/limits.js";
import {
  abandonedCartSchema,
  analyticsEventSchema,
  checkoutSchema,
} from "./schemas.js";
import { createCheckoutPreference } from "../../services/mercado-pago.js";
import {
  releaseReservedOrder,
  requirePublicOrder,
} from "../../services/orders.js";
import {
  deleteStoredReceipt,
  uploadReceiptFile,
} from "../../services/storage.js";
import { hashOpaqueToken } from "../../services/secret-vault.js";
import { dispatchTenantNotification } from "../../services/notifications.js";

export const storefrontRouter = Router();

const productSelection = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  description: true,
  images: true,
  priceInCents: true,
  stock: true,
  brand: true,
  tags: true,
  featured: true,
  variants: {
    where: { active: true },
    orderBy: { name: "asc" as const },
    select: {
      id: true,
      sku: true,
      name: true,
      options: true,
      priceInCents: true,
      stock: true,
    },
  },
  category: { select: { id: true, name: true, slug: true } },
} as const;
const publicSettingsSelection = {
  description: true,
  logoUrl: true,
  bannerUrl: true,
  primaryColor: true,
  secondaryColor: true,
  fontFamily: true,
  borderRadius: true,
  announcement: true,
  showPoweredBy: true,
  contactEmail: true,
  whatsapp: true,
  currency: true,
  bankTransferEnabled: true,
} as const;

storefrontRouter.get("/resolve-domain/:hostname", async (request, response) => {
  const hostname = String(request.params.hostname)
    .trim()
    .toLowerCase()
    .split(":")[0];
  const domain = await database.customDomain.findFirst({
    where: { hostname, status: "VERIFIED", tenant: { status: "ACTIVE" } },
    select: { tenant: { select: { slug: true } } },
  });
  if (!domain) throw new HttpError(404, "Dominio no registrado");
  response.json({ slug: domain.tenant.slug });
});

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(file.mimetype))
      return callback(
        new HttpError(400, "El comprobante debe ser PDF, JPG, PNG o WEBP"),
      );
    callback(null, true);
  },
});

storefrontRouter.get("/:slug", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const store = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      name: true,
      slug: true,
      settings: { select: publicSettingsSelection },
      mercadoPagoConnection: { select: { tenantId: true } },
      shippingZones: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          postalPrefixes: true,
          methods: {
            where: { active: true },
            select: {
              id: true,
              name: true,
              priceInCents: true,
              estimatedDays: true,
            },
            orderBy: { priceInCents: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
      categories: {
        where: { products: { some: { active: true } } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: { where: { active: true } } } },
        },
      },
      products: {
        where: { active: true },
        orderBy: [
          { featured: "desc" },
          { featuredOrder: "asc" },
          { createdAt: "desc" },
        ],
        select: productSelection,
      },
    },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");
  await database.analyticsEvent.create({
    data: {
      tenantId: (await database.tenant.findUnique({
        where: { slug },
        select: { id: true },
      }))!.id,
      type: "STOREFRONT_VIEW",
      sessionId: request.get("x-store-session")?.slice(0, 100),
    },
  });
  const { mercadoPagoConnection, ...publicStore } = store;
  response.json({
    store: {
      ...publicStore,
      paymentMethods: {
        bankTransfer: Boolean(store.settings?.bankTransferEnabled),
        mercadoPago: Boolean(
          mercadoPagoConnection && store.settings?.currency === "ARS",
        ),
      },
    },
  });
});

storefrontRouter.get(
  "/:slug/products/:productSlug",
  async (request, response) => {
    const slug = tenantSlug.parse(request.params.slug);
    const productSlug = tenantSlug.parse(request.params.productSlug);
    const store = await database.tenant.findFirst({
      where: { slug, status: "ACTIVE" },
      select: {
        name: true,
        slug: true,
        settings: { select: publicSettingsSelection },
        mercadoPagoConnection: { select: { tenantId: true } },
        shippingZones: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            postalPrefixes: true,
            methods: {
              where: { active: true },
              select: {
                id: true,
                name: true,
                priceInCents: true,
                estimatedDays: true,
              },
              orderBy: { priceInCents: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!store) throw new HttpError(404, "Tienda no encontrada");

    const product = await database.product.findFirst({
      where: { tenant: { slug }, slug: productSlug, active: true },
      select: productSelection,
    });

    if (!product) throw new HttpError(404, "Producto no encontrado");
    const tenantId = (await database.tenant.findUnique({
      where: { slug },
      select: { id: true },
    }))!.id;
    await database.analyticsEvent.create({
      data: {
        tenantId,
        type: "PRODUCT_VIEW",
        productId: product.id,
        sessionId: request.get("x-store-session")?.slice(0, 100),
      },
    });
    const { mercadoPagoConnection, ...publicStore } = store;
    response.json({
      store: {
        ...publicStore,
        paymentMethods: {
          bankTransfer: Boolean(store.settings?.bankTransferEnabled),
          mercadoPago: Boolean(
            mercadoPagoConnection && store.settings?.currency === "ARS",
          ),
        },
      },
      product,
    });
  },
);

storefrontRouter.post("/:slug/events", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const input = analyticsEventSchema.parse(request.body);
  const tenant = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!tenant) throw new HttpError(404, "Tienda no encontrada");
  if (
    input.productId &&
    !(await database.product.findFirst({
      where: { id: input.productId, tenantId: tenant.id, active: true },
    }))
  )
    throw new HttpError(400, "Producto inválido");
  await database.analyticsEvent.create({
    data: { tenantId: tenant.id, ...input },
  });
  response.status(204).send();
});

storefrontRouter.get("/:slug/coupons/:code", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const code = String(request.params.code).trim().toUpperCase();
  const subtotal = Number(request.query.subtotal ?? 0);
  const now = new Date();
  const coupon = await database.coupon.findFirst({
    where: {
      tenant: { slug, status: "ACTIVE" },
      code,
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
  });
  if (
    !coupon ||
    (coupon.maximumUses !== null && coupon.usedCount >= coupon.maximumUses) ||
    subtotal < coupon.minimumInCents
  )
    throw new HttpError(404, "Cupón no disponible");
  const discountInCents =
    coupon.type === "PERCENTAGE"
      ? Math.floor((subtotal * coupon.value) / 100)
      : Math.min(subtotal, coupon.value);
  response.json({
    coupon: { code: coupon.code, name: coupon.name, discountInCents },
  });
});

storefrontRouter.post("/:slug/carts", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const input = abandonedCartSchema.parse(request.body);
  const tenant = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    include: { subscription: { include: { plan: true } } },
  });
  if (!tenant) throw new HttpError(404, "Tienda no encontrada");
  if (!tenant.subscription?.plan.features.includes("ABANDONED_CART_RECOVERY"))
    return void response.status(204).send();
  const products = await database.product.findMany({
    where: {
      tenantId: tenant.id,
      id: { in: input.items.map(({ productId }) => productId) },
      active: true,
    },
    select: { id: true, priceInCents: true },
  });
  if (
    products.length !==
    new Set(input.items.map(({ productId }) => productId)).size
  )
    throw new HttpError(400, "El carrito contiene productos inválidos");
  const prices = new Map(
    products.map((product) => [product.id, product.priceInCents]),
  );
  const cart = await database.cart.create({
    data: {
      tenantId: tenant.id,
      status: "ABANDONED",
      recoveryEmail: input.email,
      recoveryTokenHash: randomBytes(32).toString("hex"),
      abandonedAt: new Date(),
      items: {
        create: input.items.map((item) => ({
          tenantId: tenant.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceInCents: prices.get(item.productId)!,
        })),
      },
    },
    select: { id: true },
  });
  response.status(201).json({ cart });
});

storefrontRouter.post("/:slug/orders", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const input = checkoutSchema.parse(request.body);
  const publicToken = randomBytes(32).toString("base64url");

  const createOrder = () =>
    database.$transaction(
      async (transaction) => {
        const tenant = await transaction.tenant.findFirst({
          where: { slug, status: "ACTIVE" },
          select: {
            id: true,
            settings: true,
            mercadoPagoConnection: { select: { tenantId: true } },
          },
        });
        if (!tenant) throw new HttpError(404, "Tienda no encontrada");

        if (
          input.paymentMethod === "BANK_TRANSFER" &&
          !(
            tenant.settings?.bankTransferEnabled &&
            tenant.settings.bankAlias &&
            tenant.settings.bankHolder
          )
        )
          throw new HttpError(
            409,
            "La transferencia bancaria no está disponible en esta tienda",
          );
        if (
          input.paymentMethod === "MERCADO_PAGO" &&
          !tenant.mercadoPagoConnection
        ) {
          throw new HttpError(
            409,
            "Mercado Pago no está disponible en esta tienda",
          );
        }
        if (
          input.paymentMethod === "MERCADO_PAGO" &&
          tenant.settings?.currency !== "ARS"
        ) {
          throw new HttpError(
            409,
            "Mercado Pago está disponible solamente para pedidos en ARS",
          );
        }

        await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;

        const subscription = await transaction.subscription.findUnique({
          where: { tenantId: tenant.id },
          include: { plan: true },
        });
        if (!subscription)
          throw new HttpError(409, "La tienda no tiene un plan asignado");
        assertSubscriptionWritable(
          subscription.status,
          subscription.trialEndsAt,
        );
        const productIds = input.items.map(({ productId }) => productId);
        const products = await transaction.product.findMany({
          where: { tenantId: tenant.id, id: { in: productIds }, active: true },
          select: {
            id: true,
            sku: true,
            name: true,
            priceInCents: true,
            stock: true,
          },
        });
        if (products.length !== new Set(productIds).size) {
          throw new HttpError(
            409,
            "Uno o más productos ya no están disponibles",
          );
        }

        const variantIds = input.items.flatMap(({ variantId }) =>
          variantId ? [variantId] : [],
        );
        const variants = variantIds.length
          ? await transaction.productVariant.findMany({
              where: {
                tenantId: tenant.id,
                id: { in: variantIds },
                active: true,
              },
              select: {
                id: true,
                productId: true,
                sku: true,
                name: true,
                priceInCents: true,
                stock: true,
              },
            })
          : [];
        if (variants.length !== new Set(variantIds).size)
          throw new HttpError(
            409,
            "Una o más variantes ya no están disponibles",
          );

        const productById = new Map(
          products.map((product) => [product.id, product]),
        );
        const variantById = new Map(
          variants.map((variant) => [variant.id, variant]),
        );
        const lines = input.items.map((item) => {
          const product = productById.get(item.productId)!;
          const variant = item.variantId
            ? variantById.get(item.variantId)
            : undefined;
          if (variant && variant.productId !== product.id)
            throw new HttpError(409, "La variante no pertenece al producto");
          const availableStock = variant?.stock ?? product.stock;
          const priceInCents = variant?.priceInCents ?? product.priceInCents;
          if (availableStock < item.quantity) {
            throw new HttpError(
              409,
              `No hay stock suficiente de ${product.name}`,
            );
          }
          return {
            product,
            variant,
            sku: variant?.sku ?? product.sku,
            priceInCents,
            quantity: item.quantity,
            subtotalInCents: priceInCents * item.quantity,
          };
        });

        for (const line of lines) {
          const updated = line.variant
            ? await transaction.productVariant.updateMany({
                where: {
                  id: line.variant.id,
                  tenantId: tenant.id,
                  active: true,
                  stock: { gte: line.quantity },
                },
                data: { stock: { decrement: line.quantity } },
              })
            : await transaction.product.updateMany({
                where: {
                  id: line.product.id,
                  tenantId: tenant.id,
                  active: true,
                  stock: { gte: line.quantity },
                },
                data: { stock: { decrement: line.quantity } },
              });
          if (updated.count !== 1)
            throw new HttpError(409, `Cambió el stock de ${line.product.name}`);
        }

        const lastOrder = await transaction.order.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const customer = await transaction.customer.upsert({
          where: {
            tenantId_email: {
              tenantId: tenant.id,
              email: input.customer.email,
            },
          },
          update: {
            firstName: input.customer.firstName,
            lastName: input.customer.lastName,
            phone: input.customer.phone,
          },
          create: {
            tenantId: tenant.id,
            email: input.customer.email,
            firstName: input.customer.firstName,
            lastName: input.customer.lastName,
            phone: input.customer.phone,
          },
        });
        const subtotalInCents = lines.reduce(
          (total, line) => total + line.subtotalInCents,
          0,
        );
        const now = new Date();
        const coupon = input.couponCode
          ? await transaction.coupon.findFirst({
              where: {
                tenantId: tenant.id,
                code: input.couponCode,
                active: true,
                OR: [{ startsAt: null }, { startsAt: { lte: now } }],
                AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
              },
            })
          : null;
        if (
          input.couponCode &&
          (!coupon ||
            subtotalInCents < coupon.minimumInCents ||
            (coupon.maximumUses !== null &&
              coupon.usedCount >= coupon.maximumUses))
        )
          throw new HttpError(409, "El cupón ya no está disponible");
        const discountInCents = coupon
          ? coupon.type === "PERCENTAGE"
            ? Math.floor((subtotalInCents * coupon.value) / 100)
            : Math.min(subtotalInCents, coupon.value)
          : 0;
        const shipping = input.shippingMethodId
          ? await transaction.shippingMethod.findFirst({
              where: {
                id: input.shippingMethodId,
                tenantId: tenant.id,
                active: true,
                zone: { active: true },
              },
              include: { zone: true },
            })
          : null;
        if (input.shippingMethodId && !shipping)
          throw new HttpError(409, "El método de envío ya no está disponible");
        if (
          shipping &&
          shipping.zone.postalPrefixes.length &&
          (!input.customer.postalCode ||
            !shipping.zone.postalPrefixes.some((prefix) =>
              input.customer.postalCode!.toUpperCase().startsWith(prefix),
            ))
        )
          throw new HttpError(
            409,
            "El método de envío no cubre ese código postal",
          );
        const shippingInCents = shipping?.priceInCents ?? 0;
        const totalInCents = Math.max(
          0,
          subtotalInCents - discountInCents + shippingInCents,
        );
        if (coupon)
          await transaction.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        const reservationMinutes =
          input.paymentMethod === "BANK_TRANSFER"
            ? (tenant.settings?.bankReservationHours ?? 24) * 60
            : 30;
    const order = await transaction.order.create({
          data: {
            tenantId: tenant.id,
            customerId: customer.id,
            number: (lastOrder?.number ?? 0) + 1,
            paymentMethod: input.paymentMethod,
            publicTokenHash: hashOpaqueToken(publicToken),
            stockStatus: "RESERVED",
            stockExpiresAt: new Date(
              Date.now() + reservationMinutes * 60 * 1000,
            ),
            customerEmail: customer.email,
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerPhone: customer.phone,
            shippingAddress: input.customer.shippingAddress,
            notes: input.customer.notes ?? null,
            currency: tenant.settings?.currency ?? "ARS",
            subtotalInCents,
            discountInCents,
            couponCode: coupon?.code,
            shippingInCents,
            shippingMethod: shipping?.name,
            shippingPostalCode: input.customer.postalCode,
            totalInCents,
          },
      select: {
            id: true,
            number: true,
            status: true,
            paymentStatus: true,
            totalInCents: true,
            currency: true,
      },
    });
    await transaction.cart.updateMany({ where: { tenantId: tenant.id, recoveryEmail: customer.email, status: "ABANDONED" }, data: { status: "CONVERTED", recoveredAt: new Date() } });
        await transaction.orderItem.createMany({
          data: lines.map((line) => ({
            tenantId: tenant.id,
            orderId: order.id,
            productId: line.product.id,
            variantId: line.variant?.id,
            sku: line.sku,
            productName: line.product.name,
            variantName: line.variant?.name,
            quantity: line.quantity,
            unitPriceInCents: line.priceInCents,
            subtotalInCents: line.subtotalInCents,
          })),
        });
        await transaction.paymentAttempt.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            provider: input.paymentMethod,
            idempotencyKey: randomUUID(),
            amountInCents: totalInCents,
            currency: tenant.settings?.currency ?? "ARS",
          },
        });
        await transaction.orderStatusHistory.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            status: "PENDING",
            note: "Pedido creado y stock reservado",
          },
        });

        return {
          tenantId: tenant.id,
          order,
          payment:
            input.paymentMethod === "BANK_TRANSFER"
              ? {
                  method: "BANK_TRANSFER" as const,
                  bankName: tenant.settings?.bankName ?? null,
                  alias: tenant.settings?.bankAlias ?? null,
                  holder: tenant.settings?.bankHolder ?? null,
                  cvu: tenant.settings?.bankCvu ?? null,
                  cuit: tenant.settings?.bankCuit ?? null,
                  reservationHours: tenant.settings?.bankReservationHours ?? 24,
                }
              : { method: "MERCADO_PAGO" as const },
        };
      },
      { isolationLevel: "Serializable" },
    );

  let result: Awaited<ReturnType<typeof createOrder>> | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await createOrder();
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2034" || attempt === 2)
        throw error;
    }
  }

  if (!result) throw new HttpError(500, "No se pudo crear el pedido");
  await dispatchTenantNotification({
    tenantId: result.tenantId,
    event: "ORDER_CREATED",
    recipient: input.customer.email,
    actionUrl: `/tienda/${slug}/pedido/${result.order.id}`,
  });
  const mercadoPago =
    result.payment.method === "MERCADO_PAGO"
      ? await createCheckoutPreference(result.order.id, result.tenantId)
      : null;
  response.status(201).json({
    order: result.order,
    orderToken: publicToken,
    payment: mercadoPago
      ? { method: "MERCADO_PAGO", ...mercadoPago }
      : result.payment,
  });
});

storefrontRouter.get("/:slug/orders/:orderId", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const tenant = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!tenant) throw new HttpError(404, "Tienda no encontrada");
  const order = await requirePublicOrder(
    tenant.id,
    String(request.params.orderId),
    request.get("x-order-token"),
  );
  response.json({
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      stockExpiresAt: order.stockExpiresAt,
      receipt: order.paymentReceipt
        ? {
            originalName: order.paymentReceipt.originalName,
            updatedAt: order.paymentReceipt.updatedAt,
          }
        : null,
      shipment: order.shipment
        ? {
            carrier: order.shipment.carrier,
            trackingCode: order.shipment.trackingCode,
            trackingUrl: order.shipment.trackingUrl,
            estimatedDelivery: order.shipment.estimatedDelivery,
            shippedAt: order.shipment.shippedAt,
            deliveredAt: order.shipment.deliveredAt,
          }
        : null,
      statusHistory: order.statusHistory.map(({ status, note, createdAt }) => ({
        status,
        note,
        createdAt,
      })),
    },
  });
});

storefrontRouter.post(
  "/:slug/orders/:orderId/mercadopago",
  async (request, response) => {
    const slug = tenantSlug.parse(request.params.slug);
    const tenant = await database.tenant.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true },
    });
    if (!tenant) throw new HttpError(404, "Tienda no encontrada");
    const order = await requirePublicOrder(
      tenant.id,
      String(request.params.orderId),
      request.get("x-order-token"),
    );
    if (order.paymentMethod !== "MERCADO_PAGO")
      throw new HttpError(400, "El pedido usa otro medio de pago");
    response.json({
      payment: await createCheckoutPreference(order.id, tenant.id),
    });
  },
);

storefrontRouter.post(
  "/:slug/orders/:orderId/receipt",
  receiptUpload.single("receipt"),
  async (request, response) => {
    const slug = tenantSlug.parse(request.params.slug);
    const tenant = await database.tenant.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true },
    });
    if (!tenant) throw new HttpError(404, "Tienda no encontrada");
    const order = await requirePublicOrder(
      tenant.id,
      String(request.params.orderId),
      request.get("x-order-token"),
    );
    if (order.paymentMethod !== "BANK_TRANSFER")
      throw new HttpError(400, "El pedido usa otro medio de pago");
    if (order.stockStatus !== "RESERVED" || order.status !== "PENDING")
      throw new HttpError(409, "El pedido ya no acepta comprobantes");
    if (order.stockExpiresAt && order.stockExpiresAt <= new Date()) {
      await releaseReservedOrder(
        tenant.id,
        order.id,
        "Reserva de transferencia vencida",
      );
      throw new HttpError(409, "La reserva del pedido ya venció");
    }
    if (!request.file) throw new HttpError(400, "Adjuntá un comprobante");

    const stored = await uploadReceiptFile(request.file, tenant.id, order.id);
    try {
      const receipt = await database.paymentReceipt.upsert({
        where: { orderId: order.id },
        update: stored,
        create: { ...stored, tenantId: tenant.id, orderId: order.id },
        select: { originalName: true, updatedAt: true },
      });
      if (order.paymentReceipt)
        await deleteStoredReceipt(order.paymentReceipt).catch(() => undefined);
      response.json({ receipt });
    } catch (error) {
      await deleteStoredReceipt(stored).catch(() => undefined);
      throw error;
    }
  },
);
