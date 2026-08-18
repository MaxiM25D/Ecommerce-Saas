import { randomBytes, randomUUID } from "node:crypto";

import { Router } from "express";
import multer from "multer";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { tenantSlug } from "../auth/schemas.js";
import { assertSubscriptionWritable } from "../saas/limits.js";
import { checkoutSchema } from "./schemas.js";
import { createCheckoutPreference } from "../../services/mercado-pago.js";
import { releaseReservedOrder, requirePublicOrder } from "../../services/orders.js";
import { deleteStoredReceipt, uploadReceiptFile } from "../../services/storage.js";
import { hashOpaqueToken } from "../../services/secret-vault.js";

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
  category: { select: { id: true, name: true, slug: true } },
} as const;
const publicSettingsSelection = {
  description: true,
  logoUrl: true,
  bannerUrl: true,
  primaryColor: true,
  contactEmail: true,
  whatsapp: true,
  currency: true,
  bankTransferEnabled: true,
} as const;

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) return callback(new HttpError(400, "El comprobante debe ser PDF, JPG, PNG o WEBP"));
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
        orderBy: [{ featured: "desc" }, { featuredOrder: "asc" }, { createdAt: "desc" }],
        select: productSelection,
      },
    },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");
  const { mercadoPagoConnection, ...publicStore } = store;
  response.json({
    store: {
      ...publicStore,
      paymentMethods: {
        bankTransfer: Boolean(store.settings?.bankTransferEnabled),
        mercadoPago: Boolean(mercadoPagoConnection && store.settings?.currency === "ARS"),
      },
    },
  });
});

storefrontRouter.get("/:slug/products/:productSlug", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const productSlug = tenantSlug.parse(request.params.productSlug);
  const store = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      name: true,
      slug: true,
      settings: { select: publicSettingsSelection },
      mercadoPagoConnection: { select: { tenantId: true } },
    },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");

  const product = await database.product.findFirst({
    where: { tenant: { slug }, slug: productSlug, active: true },
    select: productSelection,
  });

  if (!product) throw new HttpError(404, "Producto no encontrado");
  const { mercadoPagoConnection, ...publicStore } = store;
  response.json({
    store: {
      ...publicStore,
      paymentMethods: {
        bankTransfer: Boolean(store.settings?.bankTransferEnabled),
        mercadoPago: Boolean(mercadoPagoConnection && store.settings?.currency === "ARS"),
      },
    },
    product,
  });
});

storefrontRouter.post("/:slug/orders", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const input = checkoutSchema.parse(request.body);
  const publicToken = randomBytes(32).toString("base64url");

  const createOrder = () => database.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true, settings: true, mercadoPagoConnection: { select: { tenantId: true } } },
    });
    if (!tenant) throw new HttpError(404, "Tienda no encontrada");

    if (input.paymentMethod === "BANK_TRANSFER" && !(
      tenant.settings?.bankTransferEnabled && tenant.settings.bankAlias && tenant.settings.bankHolder
    )) throw new HttpError(409, "La transferencia bancaria no está disponible en esta tienda");
    if (input.paymentMethod === "MERCADO_PAGO" && !tenant.mercadoPagoConnection) {
      throw new HttpError(409, "Mercado Pago no está disponible en esta tienda");
    }
    if (input.paymentMethod === "MERCADO_PAGO" && tenant.settings?.currency !== "ARS") {
      throw new HttpError(409, "Mercado Pago está disponible solamente para pedidos en ARS");
    }

    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;

    const subscription = await transaction.subscription.findUnique({
      where: { tenantId: tenant.id },
      include: { plan: true },
    });
    if (!subscription) throw new HttpError(409, "La tienda no tiene un plan asignado");
    assertSubscriptionWritable(subscription.status, subscription.trialEndsAt);
    const productIds = input.items.map(({ productId }) => productId);
    const products = await transaction.product.findMany({
      where: { tenantId: tenant.id, id: { in: productIds }, active: true },
      select: { id: true, sku: true, name: true, priceInCents: true, stock: true },
    });
    if (products.length !== input.items.length) {
      throw new HttpError(409, "Uno o más productos ya no están disponibles");
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const lines = input.items.map((item) => {
      const product = productById.get(item.productId)!;
      if (product.stock < item.quantity) {
        throw new HttpError(409, `No hay stock suficiente de ${product.name}`);
      }
      return {
        product,
        quantity: item.quantity,
        subtotalInCents: product.priceInCents * item.quantity,
      };
    });

    for (const line of lines) {
      const updated = await transaction.product.updateMany({
        where: {
          id: line.product.id,
          tenantId: tenant.id,
          active: true,
          stock: { gte: line.quantity },
        },
        data: { stock: { decrement: line.quantity } },
      });
      if (updated.count !== 1) throw new HttpError(409, `Cambió el stock de ${line.product.name}`);
    }

    const lastOrder = await transaction.order.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const customer = await transaction.customer.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: input.customer.email } },
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
    const totalInCents = lines.reduce((total, line) => total + line.subtotalInCents, 0);
    const reservationMinutes = input.paymentMethod === "BANK_TRANSFER"
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
        stockExpiresAt: new Date(Date.now() + reservationMinutes * 60 * 1000),
        customerEmail: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerPhone: customer.phone,
        shippingAddress: input.customer.shippingAddress,
        notes: input.customer.notes ?? null,
        currency: tenant.settings?.currency ?? "ARS",
        subtotalInCents: totalInCents,
        totalInCents,
      },
      select: { id: true, number: true, status: true, paymentStatus: true, totalInCents: true, currency: true },
    });
    await transaction.orderItem.createMany({
      data: lines.map((line) => ({
        tenantId: tenant.id,
        orderId: order.id,
        productId: line.product.id,
        sku: line.product.sku,
        productName: line.product.name,
        quantity: line.quantity,
        unitPriceInCents: line.product.priceInCents,
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
      data: { tenantId: tenant.id, orderId: order.id, status: "PENDING", note: "Pedido creado y stock reservado" },
    });

    return {
      tenantId: tenant.id,
      order,
      payment: input.paymentMethod === "BANK_TRANSFER" ? {
        method: "BANK_TRANSFER" as const,
        bankName: tenant.settings?.bankName ?? null,
        alias: tenant.settings?.bankAlias ?? null,
        holder: tenant.settings?.bankHolder ?? null,
        cvu: tenant.settings?.bankCvu ?? null,
        cuit: tenant.settings?.bankCuit ?? null,
        reservationHours: tenant.settings?.bankReservationHours ?? 24,
      } : { method: "MERCADO_PAGO" as const },
    };
  }, { isolationLevel: "Serializable" });

  let result: Awaited<ReturnType<typeof createOrder>> | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await createOrder();
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2034" || attempt === 2) throw error;
    }
  }

  if (!result) throw new HttpError(500, "No se pudo crear el pedido");
  const mercadoPago = result.payment.method === "MERCADO_PAGO"
    ? await createCheckoutPreference(result.order.id, result.tenantId)
    : null;
  response.status(201).json({
    order: result.order,
    orderToken: publicToken,
    payment: mercadoPago ? { method: "MERCADO_PAGO", ...mercadoPago } : result.payment,
  });
});

storefrontRouter.get("/:slug/orders/:orderId", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const tenant = await database.tenant.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true } });
  if (!tenant) throw new HttpError(404, "Tienda no encontrada");
  const order = await requirePublicOrder(tenant.id, String(request.params.orderId), request.get("x-order-token"));
  response.json({
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      stockExpiresAt: order.stockExpiresAt,
      receipt: order.paymentReceipt ? { originalName: order.paymentReceipt.originalName, updatedAt: order.paymentReceipt.updatedAt } : null,
      shipment: order.shipment ? {
        carrier: order.shipment.carrier,
        trackingCode: order.shipment.trackingCode,
        trackingUrl: order.shipment.trackingUrl,
        estimatedDelivery: order.shipment.estimatedDelivery,
        shippedAt: order.shipment.shippedAt,
        deliveredAt: order.shipment.deliveredAt,
      } : null,
      statusHistory: order.statusHistory.map(({ status, note, createdAt }) => ({ status, note, createdAt })),
    },
  });
});

storefrontRouter.post("/:slug/orders/:orderId/mercadopago", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const tenant = await database.tenant.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true } });
  if (!tenant) throw new HttpError(404, "Tienda no encontrada");
  const order = await requirePublicOrder(tenant.id, String(request.params.orderId), request.get("x-order-token"));
  if (order.paymentMethod !== "MERCADO_PAGO") throw new HttpError(400, "El pedido usa otro medio de pago");
  response.json({ payment: await createCheckoutPreference(order.id, tenant.id) });
});

storefrontRouter.post("/:slug/orders/:orderId/receipt", receiptUpload.single("receipt"), async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const tenant = await database.tenant.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true } });
  if (!tenant) throw new HttpError(404, "Tienda no encontrada");
  const order = await requirePublicOrder(tenant.id, String(request.params.orderId), request.get("x-order-token"));
  if (order.paymentMethod !== "BANK_TRANSFER") throw new HttpError(400, "El pedido usa otro medio de pago");
  if (order.stockStatus !== "RESERVED" || order.status !== "PENDING") throw new HttpError(409, "El pedido ya no acepta comprobantes");
  if (order.stockExpiresAt && order.stockExpiresAt <= new Date()) {
    await releaseReservedOrder(tenant.id, order.id, "Reserva de transferencia vencida");
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
    if (order.paymentReceipt) await deleteStoredReceipt(order.paymentReceipt).catch(() => undefined);
    response.json({ receipt });
  } catch (error) {
    await deleteStoredReceipt(stored).catch(() => undefined);
    throw error;
  }
});
