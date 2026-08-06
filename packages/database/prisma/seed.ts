import { createDatabaseClient } from "../src/client.js";

const database = createDatabaseClient();
const seedSlugs = ["lunek", "norte-demo"];

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

  const [lunekOwner, norteOwner] = await Promise.all([
    database.user.upsert({
      where: { email: "owner@lunek.test" },
      update: { firstName: "Maxi", lastName: "LUNEK" },
      create: {
        email: "owner@lunek.test",
        passwordHash: "seed-only-not-a-real-password-hash",
        firstName: "Maxi",
        lastName: "LUNEK",
      },
    }),
    database.user.upsert({
      where: { email: "owner@norte.test" },
      update: { firstName: "Ana", lastName: "Norte" },
      create: {
        email: "owner@norte.test",
        passwordHash: "seed-only-not-a-real-password-hash",
        firstName: "Ana",
        lastName: "Norte",
      },
    }),
  ]);

  const lunek = await database.tenant.create({
    data: {
      name: "LUNEK",
      slug: "lunek",
      memberships: { create: { userId: lunekOwner.id, role: "OWNER" } },
    },
  });
  const lunekCategory = await database.category.create({
    data: { tenantId: lunek.id, name: "Cinturones", slug: "cinturones" },
  });
  const lunekProduct = await database.product.create({
    data: {
      tenantId: lunek.id,
      categoryId: lunekCategory.id,
      sku: "LUN-CIN-001",
      slug: "cinturon-toro",
      name: "Cinturón Toro",
      priceInCents: 4500000,
      stock: 12,
    },
  });
  const lunekCustomer = await database.customer.create({
    data: {
      tenantId: lunek.id,
      email: "cliente@example.com",
      firstName: "Cliente",
      lastName: "LUNEK",
    },
  });
  const lunekCart = await database.cart.create({
    data: { tenantId: lunek.id, customerId: lunekCustomer.id },
  });
  await database.cartItem.create({
    data: {
      tenantId: lunek.id,
      cartId: lunekCart.id,
      productId: lunekProduct.id,
      quantity: 1,
      unitPriceInCents: lunekProduct.priceInCents,
    },
  });
  const lunekOrder = await database.order.create({
    data: {
      tenantId: lunek.id,
      customerId: lunekCustomer.id,
      number: 1,
      customerEmail: lunekCustomer.email,
      customerName: `${lunekCustomer.firstName} ${lunekCustomer.lastName}`,
      subtotalInCents: lunekProduct.priceInCents,
      totalInCents: lunekProduct.priceInCents,
    },
  });
  await database.orderItem.create({
    data: {
      tenantId: lunek.id,
      orderId: lunekOrder.id,
      productId: lunekProduct.id,
      sku: lunekProduct.sku,
      productName: lunekProduct.name,
      quantity: 1,
      unitPriceInCents: lunekProduct.priceInCents,
      subtotalInCents: lunekProduct.priceInCents,
    },
  });

  const norte = await database.tenant.create({
    data: {
      name: "Tienda Norte",
      slug: "norte-demo",
      memberships: { create: { userId: norteOwner.id, role: "OWNER" } },
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

  console.log("Seed creado: LUNEK y Tienda Norte, con datos aislados por tenant.");
}

try {
  await seed();
} finally {
  await database.$disconnect();
}
