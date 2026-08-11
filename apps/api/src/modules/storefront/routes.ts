import { Router } from "express";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { tenantSlug } from "../auth/schemas.js";
import { assertSubscriptionWritable, monthStart } from "../saas/limits.js";
import { checkoutSchema } from "./schemas.js";

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
} as const;

storefrontRouter.get("/:slug", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const store = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      name: true,
      slug: true,
      settings: { select: publicSettingsSelection },
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
        orderBy: { createdAt: "desc" },
        select: productSelection,
      },
    },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");
  response.json({ store });
});

storefrontRouter.get("/:slug/products/:productSlug", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const productSlug = tenantSlug.parse(request.params.productSlug);
  const store = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { name: true, slug: true, settings: { select: publicSettingsSelection } },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");

  const product = await database.product.findFirst({
    where: { tenant: { slug }, slug: productSlug, active: true },
    select: productSelection,
  });

  if (!product) throw new HttpError(404, "Producto no encontrado");
  response.json({ store, product });
});

storefrontRouter.post("/:slug/orders", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const input = checkoutSchema.parse(request.body);

  const createOrder = () => database.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true, settings: true },
    });
    if (!tenant) throw new HttpError(404, "Tienda no encontrada");

    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;

    const subscription = await transaction.subscription.findUnique({
      where: { tenantId: tenant.id },
      include: { plan: true },
    });
    if (!subscription) throw new HttpError(409, "La tienda no tiene un plan asignado");
    assertSubscriptionWritable(subscription.status);
    const monthlyOrders = await transaction.order.count({
      where: { tenantId: tenant.id, createdAt: { gte: monthStart() } },
    });
    if (monthlyOrders >= subscription.plan.maxOrdersPerMonth) {
      throw new HttpError(409, `La tienda alcanzó el límite mensual de ${subscription.plan.maxOrdersPerMonth} pedidos`);
    }

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
    const order = await transaction.order.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        number: (lastOrder?.number ?? 0) + 1,
        paymentMethod: input.paymentMethod,
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

    return {
      order,
      payment: {
        method: "BANK_TRANSFER" as const,
        bankName: tenant.settings?.bankName ?? null,
        alias: tenant.settings?.bankAlias ?? null,
        holder: tenant.settings?.bankHolder ?? null,
      },
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

  response.status(201).json(result);
});
