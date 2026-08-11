import { Router } from "express";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { getAuthContext, requireRoles, requireSession } from "../auth/session.js";
import { assertSubscriptionWritable, getSubscriptionContext, monthStart, requireWritableSubscription } from "../saas/limits.js";
import {
  addMemberSchema,
  createCategorySchema,
  createProductSchema,
  resourceIdSchema,
  updateCategorySchema,
  updateProductSchema,
  updateOrderSchema,
  updateMemberSchema,
  updateStoreSchema,
} from "./schemas.js";

export const adminRouter = Router();
const canManage = requireRoles("OWNER", "ADMIN");
const canManageTeam = requireRoles("OWNER");

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
    include: { items: { orderBy: { createdAt: "asc" } } },
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
      include: { items: { select: { productId: true, quantity: true } } },
    });
    if (!current) throw new HttpError(404, "Pedido no encontrado");

    if (input.status && input.status !== current.status && !orderTransitions[current.status]!.includes(input.status)) {
      throw new HttpError(409, `No se puede cambiar un pedido de ${current.status} a ${input.status}`);
    }
    if (input.paymentStatus && input.paymentStatus !== current.paymentStatus && !paymentTransitions[current.paymentStatus]!.includes(input.paymentStatus)) {
      throw new HttpError(409, `No se puede cambiar el pago de ${current.paymentStatus} a ${input.paymentStatus}`);
    }

    if (input.status === "CANCELLED" && current.status !== "CANCELLED") {
      for (const item of current.items) {
        if (item.productId) {
          await transaction.product.updateMany({
            where: { id: item.productId, tenantId: tenant.id },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }

    return transaction.order.update({
      where: { id },
      data: input,
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
  });

  response.json({ order });
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
  const members = await database.membership.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  response.json({ members });
});

adminRouter.post("/team", canManageTeam, async (request, response) => {
  const { tenant } = getAuthContext(request);
  const input = addMemberSchema.parse(request.body);
  const member = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;
    const subscription = await transaction.subscription.findUnique({ where: { tenantId: tenant.id }, include: { plan: true } });
    if (!subscription) throw new HttpError(409, "La tienda no tiene un plan asignado");
    const memberCount = await transaction.membership.count({ where: { tenantId: tenant.id } });
    if (memberCount >= subscription.plan.maxMembers) {
      throw new HttpError(409, `Alcanzaste el límite de ${subscription.plan.maxMembers} miembros del plan ${subscription.plan.name}`);
    }
    const user = await transaction.user.findUnique({ where: { email: input.email } });
    if (!user) throw new HttpError(404, "No existe un usuario registrado con ese email");
    const existing = await transaction.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    if (existing) throw new HttpError(409, "El usuario ya pertenece a esta tienda");
    return transaction.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: input.role },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  });
  response.status(201).json({ member });
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
