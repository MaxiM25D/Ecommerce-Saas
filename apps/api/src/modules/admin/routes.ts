import { Router } from "express";
import multer from "multer";

import { environment } from "../../config.js";
import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { getAuthContext, requireRoles, requireSession } from "../auth/session.js";
import { assertSubscriptionWritable, getSubscriptionContext, monthStart, requireWritableSubscription } from "../saas/limits.js";
import {
  addMemberSchema,
  createCategorySchema,
  createProductSchema,
  customerListQuerySchema,
  dispatchOrderSchema,
  resourceIdSchema,
  updateCategorySchema,
  updateProductSchema,
  updateOrderSchema,
  updateMemberSchema,
  updateStoreSchema,
} from "./schemas.js";
import { getStoredReceiptAccess, uploadProductFiles } from "../../services/storage.js";
import { sendShipmentEmail, sendTeamInvitationEmail } from "../../services/mail.js";
import { createAccountToken, developmentUrl, expiresInHours } from "../../services/account-tokens.js";

export const adminRouter = Router();
const canManage = requireRoles("OWNER", "ADMIN");
const canManageTeam = requireRoles("OWNER");
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_request, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(file.mimetype)) return callback(new HttpError(400, "Usá imágenes JPG, PNG, WEBP o AVIF"));
    callback(null, true);
  },
});

adminRouter.use(requireSession);
adminRouter.use((request, response, next) => {
  if (["POST", "PATCH", "DELETE"].includes(request.method)) {
    void requireWritableSubscription(request, response, next);
    return;
  }
  next();
});

adminRouter.get("/dashboard", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const [categories, products, activeProducts, customers, orders, approvedRevenue, recentOrders] =
    await Promise.all([
      database.category.count({ where: { tenantId: tenant.id } }),
      database.product.count({ where: { tenantId: tenant.id } }),
      database.product.count({ where: { tenantId: tenant.id, active: true } }),
      database.customer.count({ where: { tenantId: tenant.id } }),
      database.order.count({ where: { tenantId: tenant.id } }),
      database.order.aggregate({
        where: { tenantId: tenant.id, paymentStatus: "APPROVED" },
        _sum: { totalInCents: true },
      }),
      database.order.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          number: true,
          customerName: true,
          totalInCents: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
    ]);

  response.json({
    metrics: {
      categories,
      products,
      activeProducts,
      customers,
      orders,
      approvedRevenueInCents: approvedRevenue._sum.totalInCents ?? 0,
    },
    recentOrders,
  });
});

adminRouter.get("/categories", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const categories = await database.category.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  response.json({ categories });
});

adminRouter.post("/categories", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = createCategorySchema.parse(request.body);

  try {
    const category = await database.category.create({ data: { ...input, tenantId: tenant.id } });
    response.status(201).json({ category });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new HttpError(409, "Ya existe una categoría con ese slug");
    }
    throw error;
  }
});

adminRouter.patch("/categories/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const input = updateCategorySchema.parse(request.body);
  const existing = await database.category.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new HttpError(404, "Categoría no encontrada");

  try {
    const category = await database.category.update({ where: { id }, data: input });
    response.json({ category });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new HttpError(409, "Ya existe una categoría con ese slug");
    }
    throw error;
  }
});

adminRouter.delete("/categories/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const existing = await database.category.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new HttpError(404, "Categoría no encontrada");

  try {
    await database.category.delete({ where: { id } });
    response.status(204).send();
  } catch (error) {
    if ((error as { code?: string }).code === "P2003") {
      throw new HttpError(409, "No podés eliminar una categoría que contiene productos");
    }
    throw error;
  }
});

adminRouter.get("/products", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const products = await database.product.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  response.json({ products });
});

adminRouter.post("/uploads/products", canManage, productImageUpload.array("images", 8), async (request, response) => {
  const { tenant } = getAuthContext(request);
  const files = request.files as Express.Multer.File[] | undefined;
  if (!files?.length) throw new HttpError(400, "Seleccioná al menos una imagen");
  const images = await uploadProductFiles(files, tenant.id);
  response.status(201).json({ images });
});

async function ensureCategoryBelongsToTenant(
  tenantId: string,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const category = await database.category.findFirst({ where: { id: categoryId, tenantId } });
  if (!category) throw new HttpError(400, "La categoría no pertenece a la tienda activa");
}

adminRouter.post("/products", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = createProductSchema.parse(request.body);
  await ensureCategoryBelongsToTenant(tenant.id, input.categoryId);

  try {
    const product = await database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;
      const subscription = await transaction.subscription.findUnique({
        where: { tenantId: tenant.id },
        include: { plan: true },
      });
      if (!subscription) throw new HttpError(409, "La tienda no tiene un plan asignado");
      assertSubscriptionWritable(subscription.status);
      const productCount = await transaction.product.count({ where: { tenantId: tenant.id } });
      if (productCount >= subscription.plan.maxProducts) {
        throw new HttpError(409, `Alcanzaste el límite de ${subscription.plan.maxProducts} productos del plan ${subscription.plan.name}`);
      }
      return transaction.product.create({
        data: { ...input, categoryId: input.categoryId ?? null, tenantId: tenant.id },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
    });
    response.status(201).json({ product });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new HttpError(409, "El SKU o slug ya existe en esta tienda");
    }
    throw error;
  }
});

adminRouter.patch("/products/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const input = updateProductSchema.parse(request.body);
  const existing = await database.product.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new HttpError(404, "Producto no encontrado");
  await ensureCategoryBelongsToTenant(tenant.id, input.categoryId);

  try {
    const product = await database.product.update({
      where: { id },
      data: input,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    response.json({ product });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new HttpError(409, "El SKU o slug ya existe en esta tienda");
    }
    throw error;
  }
});

adminRouter.delete("/products/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const existing = await database.product.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new HttpError(404, "Producto no encontrado");

  try {
    await database.product.delete({ where: { id } });
    response.status(204).send();
  } catch (error) {
    if ((error as { code?: string }).code === "P2003") {
      throw new HttpError(409, "El producto tiene movimientos asociados; desactivalo en su lugar");
    }
    throw error;
  }
});

adminRouter.get("/customers", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const { search, page, pageSize } = customerListQuerySchema.parse(request.query);
  const where = {
    tenantId: tenant.id,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, customers] = await Promise.all([
    database.customer.count({ where }),
    database.customer.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const totals = customers.length
    ? await database.order.groupBy({
        by: ["customerId"],
        where: {
          tenantId: tenant.id,
          customerId: { in: customers.map(({ id }) => id) },
          paymentStatus: "APPROVED",
        },
        _sum: { totalInCents: true },
      })
    : [];
  const totalByCustomer = new Map(
    totals.map(({ customerId, _sum }) => [customerId, _sum.totalInCents ?? 0]),
  );

  response.json({
    customers: customers.map((customer) => ({
      ...customer,
      approvedSpentInCents: totalByCustomer.get(customer.id) ?? 0,
    })),
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

adminRouter.get("/customers/:id", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const customer = await database.customer.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      orders: {
        orderBy: [{ createdAt: "desc" }, { number: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          totalInCents: true,
          currency: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!customer) throw new HttpError(404, "Cliente no encontrado");

  const approvedOrders = customer.orders.filter(({ paymentStatus }) => paymentStatus === "APPROVED");
  response.json({
    customer: {
      ...customer,
      stats: {
        orders: customer.orders.length,
        approvedOrders: approvedOrders.length,
        approvedSpentInCents: approvedOrders.reduce((total, order) => total + order.totalInCents, 0),
      },
    },
  });
});

adminRouter.get("/orders", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const orders = await database.order.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      customerName: true,
      customerEmail: true,
      totalInCents: true,
      currency: true,
      createdAt: true,
      paymentReceipt: { select: { originalName: true, updatedAt: true } },
      _count: { select: { items: true } },
    },
  });
  response.json({ orders });
});

adminRouter.get("/orders/:id", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const order = await database.order.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      paymentReceipt: { select: { id: true, originalName: true, mimeType: true, sizeInBytes: true, updatedAt: true } },
      shipment: true,
      statusHistory: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, note: true, createdAt: true } },
    },
  });
  if (!order) throw new HttpError(404, "Pedido no encontrado");
  response.json({ order });
});

const orderTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
const paymentTransitions: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["REFUNDED"],
  REJECTED: ["PENDING"],
  CANCELLED: [],
  REFUNDED: [],
};

adminRouter.patch("/orders/:id", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const input = updateOrderSchema.parse(request.body);

  const order = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} AND "tenantId" = ${tenant.id} FOR UPDATE`;
    const current = await transaction.order.findFirst({
      where: { id, tenantId: tenant.id },
      include: { items: { select: { productId: true, quantity: true } }, paymentReceipt: true },
    });
    if (!current) throw new HttpError(404, "Pedido no encontrado");

    if (input.status && input.status !== current.status && !orderTransitions[current.status]!.includes(input.status)) {
      throw new HttpError(409, `No se puede cambiar un pedido de ${current.status} a ${input.status}`);
    }
    if (input.paymentStatus && input.paymentStatus !== current.paymentStatus && !paymentTransitions[current.paymentStatus]!.includes(input.paymentStatus)) {
      throw new HttpError(409, `No se puede cambiar el pago de ${current.paymentStatus} a ${input.paymentStatus}`);
    }
    if (input.paymentStatus && current.paymentMethod === "MERCADO_PAGO") {
      throw new HttpError(409, "Los pagos de Mercado Pago se actualizan únicamente mediante su webhook firmado");
    }
    if (input.paymentStatus === "APPROVED" && current.paymentMethod === "BANK_TRANSFER" && !current.paymentReceipt) {
      throw new HttpError(409, "El cliente todavía no adjuntó un comprobante");
    }
    if (input.paymentStatus === "APPROVED" && current.stockExpiresAt && current.stockExpiresAt <= new Date()) {
      throw new HttpError(409, "La reserva del pedido ya venció");
    }
    if (input.status === "SHIPPED") {
      throw new HttpError(409, "Completá los datos de despacho para marcar el envío");
    }

    const refundBeforeShipment = input.paymentStatus === "REFUNDED" && ["PENDING", "CONFIRMED", "PREPARING"].includes(current.status);
    const releaseStock = (
      (input.status === "CANCELLED" && current.status !== "CANCELLED") || refundBeforeShipment
    ) && current.stockStatus !== "RELEASED";
    if (releaseStock) {
      for (const item of current.items) {
        if (item.productId) {
          await transaction.product.updateMany({
            where: { id: item.productId, tenantId: tenant.id },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }

    const nextStatus = refundBeforeShipment
      ? "CANCELLED"
      : input.paymentStatus === "APPROVED" && current.status === "PENDING"
        ? "CONFIRMED"
        : input.status;
    const data = {
      ...input,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(input.paymentStatus === "APPROVED" ? { stockStatus: "COMMITTED" as const, stockExpiresAt: null } : {}),
      ...(releaseStock ? { stockStatus: "RELEASED" as const, stockExpiresAt: null } : {}),
    };

    const updated = await transaction.order.update({
      where: { id },
      data,
      include: {
        items: { orderBy: { createdAt: "asc" } },
        paymentReceipt: { select: { id: true, originalName: true, mimeType: true, sizeInBytes: true, updatedAt: true } },
        shipment: true,
        statusHistory: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, note: true, createdAt: true } },
      },
    });
    if (nextStatus === "DELIVERED") {
      await transaction.shipment.updateMany({
        where: { orderId: id, tenantId: tenant.id },
        data: { deliveredAt: new Date() },
      });
    }
    if (nextStatus && nextStatus !== current.status) {
      await transaction.orderStatusHistory.create({
        data: { tenantId: tenant.id, orderId: id, status: nextStatus, changedByUserId: getAuthContext(request).user.id },
      });
      return transaction.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          paymentReceipt: { select: { id: true, originalName: true, mimeType: true, sizeInBytes: true, updatedAt: true } },
          shipment: true,
          statusHistory: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, note: true, createdAt: true } },
        },
      });
    }
    return updated;
  });

  response.json({ order });
});

adminRouter.get("/orders/:id/receipt", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const receipt = await database.paymentReceipt.findFirst({ where: { orderId: id, tenantId: tenant.id } });
  if (!receipt) throw new HttpError(404, "El pedido no tiene comprobante");
  const access = getStoredReceiptAccess(receipt);
  if (access.kind === "redirect") {
    response.redirect(access.url);
    return;
  }
  response.setHeader("Content-Type", receipt.mimeType);
  response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(receipt.originalName)}`);
  access.stream.on("error", () => response.destroy()).pipe(response);
});

async function notifyShipment(orderId: string, tenantId: string): Promise<{ sent: boolean; error: string | null }> {
  const claimed = await database.shipment.updateMany({
    where: {
      orderId,
      tenantId,
      OR: [
        { notificationStatus: { in: ["PENDING", "FAILED"] } },
        { notificationStatus: "SENDING", lastNotificationAt: { lte: new Date(Date.now() - 10 * 60 * 1000) } },
      ],
    },
    data: { notificationStatus: "SENDING", lastNotificationAt: new Date(), notificationError: null },
  });
  if (claimed.count !== 1) throw new HttpError(409, "La notificación ya fue enviada o está en proceso");
  const order = await database.order.findFirstOrThrow({
    where: { id: orderId, tenantId },
    include: { shipment: true, tenant: { include: { settings: true } } },
  });
  try {
    await sendShipmentEmail({
      storeName: order.tenant.name,
      fromName: order.tenant.settings?.emailFromName,
      storeSlug: order.tenant.slug,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderNumber: order.number,
      carrier: order.shipment!.carrier,
      trackingCode: order.shipment!.trackingCode,
      trackingUrl: order.shipment!.trackingUrl,
      estimatedDelivery: order.shipment!.estimatedDelivery,
    });
    await database.shipment.update({
      where: { orderId },
      data: { notificationStatus: "SENT", notificationAttempts: { increment: 1 }, notificationError: null, lastNotificationAt: new Date() },
    });
    return { sent: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "No se pudo enviar el correo";
    await database.shipment.update({
      where: { orderId },
      data: { notificationStatus: "FAILED", notificationAttempts: { increment: 1 }, notificationError: message, lastNotificationAt: new Date() },
    });
    return { sent: false, error: message };
  }
}

adminRouter.post("/orders/:id/dispatch", canManage, async (request, response) => {
  const { tenant, user } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const shipmentInput = dispatchOrderSchema.parse(request.body);
  const order = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} AND "tenantId" = ${tenant.id} FOR UPDATE`;
    const current = await transaction.order.findFirst({ where: { id, tenantId: tenant.id } });
    if (!current) throw new HttpError(404, "Pedido no encontrado");
    if (current.status !== "PREPARING" || current.paymentStatus !== "APPROVED") {
      throw new HttpError(409, "Solo se pueden despachar pedidos pagados que estén en preparación");
    }
    await transaction.shipment.upsert({
      where: { orderId: id },
      update: { ...shipmentInput, shippedAt: new Date(), deliveredAt: null, notificationStatus: "PENDING", notificationError: null },
      create: { ...shipmentInput, tenantId: tenant.id, orderId: id, shippedAt: new Date(), notificationStatus: "PENDING" },
    });
    await transaction.order.update({ where: { id }, data: { status: "SHIPPED" } });
    await transaction.orderStatusHistory.create({
      data: { tenantId: tenant.id, orderId: id, status: "SHIPPED", changedByUserId: user.id, note: `Despachado por ${shipmentInput.carrier}` },
    });
    return transaction.order.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" } }, paymentReceipt: true, shipment: true, statusHistory: { orderBy: { createdAt: "asc" } } },
    });
  });
  const notification = await notifyShipment(id, tenant.id);
  response.json({ order: { ...order, shipment: await database.shipment.findUnique({ where: { orderId: id } }) }, notification });
});

adminRouter.post("/orders/:id/shipment-email", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const shipment = await database.shipment.findFirst({ where: { orderId: id, tenantId: tenant.id } });
  if (!shipment) throw new HttpError(404, "El pedido todavía no fue despachado");
  response.json({ notification: await notifyShipment(id, tenant.id), shipment: await database.shipment.findUnique({ where: { orderId: id } }) });
});

adminRouter.get("/subscription", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const [subscription, products, members, monthlyOrders, plans] = await Promise.all([
    getSubscriptionContext(tenant.id),
    database.product.count({ where: { tenantId: tenant.id } }),
    database.membership.count({ where: { tenantId: tenant.id } }),
    database.order.count({ where: { tenantId: tenant.id, createdAt: { gte: monthStart() } } }),
    database.plan.findMany({ where: { active: true }, orderBy: { priceInCents: "asc" } }),
  ]);
  response.json({
    subscription,
    usage: { products, members, monthlyOrders },
    plans,
  });
});

adminRouter.get("/team", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const [members, invitations] = await Promise.all([
    database.membership.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, emailVerifiedAt: true } } },
    }),
    database.teamInvitation.findMany({
      where: { tenantId: tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
  ]);
  response.json({
    members: members.map((member) => ({ ...member, user: { ...member.user, emailVerified: Boolean(member.user.emailVerifiedAt), emailVerifiedAt: undefined } })),
    invitations,
  });
});

adminRouter.post("/team", canManageTeam, async (request, response) => {
  const { tenant, user: inviter } = getAuthContext(request);
  const input = addMemberSchema.parse(request.body);
  const { token, tokenHash } = createAccountToken();
  const invitation = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;
    const subscription = await transaction.subscription.findUnique({ where: { tenantId: tenant.id }, include: { plan: true } });
    if (!subscription) throw new HttpError(409, "La tienda no tiene un plan asignado");
    const memberCount = await transaction.membership.count({ where: { tenantId: tenant.id } });
    const pendingInvitations = await transaction.teamInvitation.count({ where: { tenantId: tenant.id, acceptedAt: null, expiresAt: { gt: new Date() }, email: { not: input.email } } });
    if (memberCount + pendingInvitations >= subscription.plan.maxMembers) {
      throw new HttpError(409, `Alcanzaste el límite de ${subscription.plan.maxMembers} miembros del plan ${subscription.plan.name}`);
    }
    const user = await transaction.user.findUnique({ where: { email: input.email } });
    if (user) {
      const existing = await transaction.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } } });
      if (existing) throw new HttpError(409, "El usuario ya pertenece a esta tienda");
    }
    return transaction.teamInvitation.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
      update: { role: input.role, tokenHash, invitedByUserId: inviter.id, expiresAt: expiresInHours(24 * environment.TEAM_INVITATION_TTL_DAYS), acceptedAt: null },
      create: { tenantId: tenant.id, email: input.email, role: input.role, tokenHash, invitedByUserId: inviter.id, expiresAt: expiresInHours(24 * environment.TEAM_INVITATION_TTL_DAYS) },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
  });
  let emailSent = true;
  try {
    await sendTeamInvitationEmail({ email: invitation.email, tenantName: tenant.name, inviterName: `${inviter.firstName} ${inviter.lastName}`, role: invitation.role, token });
  } catch {
    emailSent = false;
  }
  response.status(201).json({ invitation, emailSent, invitationUrl: developmentUrl("/invitacion", token) });
});

adminRouter.delete("/team/invitations/:id", canManageTeam, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const id = resourceIdSchema.parse(request.params.id);
  const removed = await database.teamInvitation.deleteMany({ where: { id, tenantId: tenant.id, acceptedAt: null } });
  if (removed.count !== 1) throw new HttpError(404, "Invitación no encontrada");
  response.status(204).send();
});

adminRouter.patch("/team/:userId", canManageTeam, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const userId = resourceIdSchema.parse(request.params.userId);
  const input = updateMemberSchema.parse(request.body);
  const existing = await database.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId } } });
  if (!existing) throw new HttpError(404, "Miembro no encontrado");
  if (existing.role === "OWNER") throw new HttpError(409, "No se puede modificar el rol del propietario");
  const member = await database.membership.update({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    data: { role: input.role },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  response.json({ member });
});

adminRouter.delete("/team/:userId", canManageTeam, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const userId = resourceIdSchema.parse(request.params.userId);
  const existing = await database.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId } } });
  if (!existing) throw new HttpError(404, "Miembro no encontrado");
  if (existing.role === "OWNER") throw new HttpError(409, "No se puede eliminar al propietario");
  await database.membership.delete({ where: { tenantId_userId: { tenantId: tenant.id, userId } } });
  await database.authSession.deleteMany({ where: { userId, activeTenantId: tenant.id } });
  response.status(204).send();
});

adminRouter.get("/store", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const store = await database.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    select: { name: true, slug: true, status: true, settings: true },
  });
  response.json({ store });
});

adminRouter.patch("/store", canManage, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = updateStoreSchema.parse(request.body);
  const { name, ...settings } = input;

  const store = await database.$transaction(async (transaction) => {
    if (name) await transaction.tenant.update({ where: { id: tenant.id }, data: { name } });
    if (Object.keys(settings).length > 0) {
      const currentSettings = await transaction.storeSettings.findUnique({ where: { tenantId: tenant.id } });
      const mergedSettings = { ...currentSettings, ...settings };
      if (mergedSettings.bankTransferEnabled && (!mergedSettings.bankAlias || !mergedSettings.bankHolder)) {
        throw new HttpError(400, "Para habilitar transferencias completá alias y titular");
      }
      await transaction.storeSettings.upsert({
        where: { tenantId: tenant.id },
        update: settings,
        create: { ...settings, tenantId: tenant.id },
      });
    }

    return transaction.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      select: { name: true, slug: true, status: true, settings: true },
    });
  });

  response.json({ store });
});
