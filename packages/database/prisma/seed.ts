import { createDatabaseClient } from "../src/client.js";

const database = createDatabaseClient();
const seedSlugs = ["lunek", "infinityshop-seed", "norte-demo"];

async function clearPreviousSeed(): Promise<void> {
  const tenants = await database.tenant.findMany({
    where: { slug: { in: seedSlugs } },
    select: { id: true },
  });
  const tenantIds = tenants.map(({ id }) => id);

  if (tenantIds.length === 0) return;

  const tenantFilter = { tenantId: { in: tenantIds } };

  await database.$transaction([
    database.orderItem.deleteMany({ where: tenantFilter }),
    database.cartItem.deleteMany({ where: tenantFilter }),
    database.order.deleteMany({ where: tenantFilter }),
    database.cart.deleteMany({ where: tenantFilter }),
    database.product.deleteMany({ where: tenantFilter }),
    database.category.deleteMany({ where: tenantFilter }),
    database.customer.deleteMany({ where: tenantFilter }),
    database.membership.deleteMany({ where: tenantFilter }),
    database.tenant.deleteMany({ where: { id: { in: tenantIds } } }),
  ]);
}

async function seed(): Promise<void> {
  await clearPreviousSeed();

  const [infinityShopOwner, norteOwner] = await Promise.all([
    database.user.upsert({
      where: { email: "owner@infinityshop.test" },
      update: { firstName: "Maxi", lastName: "InfinityShop", emailVerifiedAt: new Date() },
      create: {
        email: "owner@infinityshop.test",
        passwordHash: "seed-only-not-a-real-password-hash",
        firstName: "Maxi",
        lastName: "InfinityShop",
        emailVerifiedAt: new Date(),
      },
    }),
    database.user.upsert({
      where: { email: "owner@norte.test" },
      update: { firstName: "Ana", lastName: "Norte", emailVerifiedAt: new Date() },
      create: {
        email: "owner@norte.test",
        passwordHash: "seed-only-not-a-real-password-hash",
        firstName: "Ana",
        lastName: "Norte",
        emailVerifiedAt: new Date(),
      },
    }),
  ]);

  const infinityShop = await database.tenant.create({
    data: {
      name: "InfinityShop",
      slug: "infinityshop-seed",
      memberships: { create: { userId: infinityShopOwner.id, role: "OWNER" } },
      subscription: { create: { planId: "plan_starter", status: "ACTIVE", currentPeriodFrom: new Date() } },
    },
  });
  const infinityShopCategory = await database.category.create({
    data: { tenantId: infinityShop.id, name: "Cinturones", slug: "cinturones" },
  });
  const infinityShopProduct = await database.product.create({
    data: {
      tenantId: infinityShop.id,
      categoryId: infinityShopCategory.id,
      sku: "INF-CIN-001",
      slug: "cinturon-toro",
      name: "Cinturón Toro",
      priceInCents: 4500000,
      stock: 12,
    },
  });
  const infinityShopCustomer = await database.customer.create({
    data: {
      tenantId: infinityShop.id,
      email: "cliente@example.com",
      firstName: "Cliente",
      lastName: "InfinityShop",
    },
  });
  const infinityShopCart = await database.cart.create({
    data: { tenantId: infinityShop.id, customerId: infinityShopCustomer.id },
  });
  await database.cartItem.create({
    data: {
      tenantId: infinityShop.id,
      cartId: infinityShopCart.id,
      productId: infinityShopProduct.id,
      quantity: 1,
      unitPriceInCents: infinityShopProduct.priceInCents,
    },
  });
  const infinityShopOrder = await database.order.create({
    data: {
      tenantId: infinityShop.id,
      customerId: infinityShopCustomer.id,
      number: 1,
      customerEmail: infinityShopCustomer.email,
      customerName: `${infinityShopCustomer.firstName} ${infinityShopCustomer.lastName}`,
      subtotalInCents: infinityShopProduct.priceInCents,
      totalInCents: infinityShopProduct.priceInCents,
    },
  });
  await database.orderItem.create({
    data: {
      tenantId: infinityShop.id,
      orderId: infinityShopOrder.id,
      productId: infinityShopProduct.id,
      sku: infinityShopProduct.sku,
      productName: infinityShopProduct.name,
      quantity: 1,
      unitPriceInCents: infinityShopProduct.priceInCents,
      subtotalInCents: infinityShopProduct.priceInCents,
    },
  });

  const norte = await database.tenant.create({
    data: {
      name: "Tienda Norte",
      slug: "norte-demo",
      memberships: { create: { userId: norteOwner.id, role: "OWNER" } },
      subscription: { create: { planId: "plan_starter", status: "ACTIVE", currentPeriodFrom: new Date() } },
    },
  });
  const norteCategory = await database.category.create({
    data: { tenantId: norte.id, name: "Accesorios", slug: "accesorios" },
  });
  const norteProduct = await database.product.create({
    data: {
      tenantId: norte.id,
      categoryId: norteCategory.id,
      sku: "NOR-ACC-001",
      slug: "bolso-norte",
      name: "Bolso Norte",
      priceInCents: 3200000,
      stock: 8,
    },
  });
  const norteCustomer = await database.customer.create({
    data: {
      tenantId: norte.id,
      email: "cliente@example.com",
      firstName: "Cliente",
      lastName: "Norte",
    },
  });
  const norteCart = await database.cart.create({
    data: { tenantId: norte.id, customerId: norteCustomer.id },
  });
  await database.cartItem.create({
    data: {
      tenantId: norte.id,
      cartId: norteCart.id,
      productId: norteProduct.id,
      quantity: 2,
      unitPriceInCents: norteProduct.priceInCents,
    },
  });
  const norteOrder = await database.order.create({
    data: {
      tenantId: norte.id,
      customerId: norteCustomer.id,
      number: 1,
      customerEmail: norteCustomer.email,
      customerName: `${norteCustomer.firstName} ${norteCustomer.lastName}`,
      subtotalInCents: norteProduct.priceInCents,
      totalInCents: norteProduct.priceInCents,
    },
  });
  await database.orderItem.create({
    data: {
      tenantId: norte.id,
      orderId: norteOrder.id,
      productId: norteProduct.id,
      sku: norteProduct.sku,
      productName: norteProduct.name,
      quantity: 1,
      unitPriceInCents: norteProduct.priceInCents,
      subtotalInCents: norteProduct.priceInCents,
    },
  });

  console.log("Seed creado: InfinityShop y Tienda Norte, con datos aislados por tenant.");
}

try {
  await seed();
} finally {
  await database.$disconnect();
}
