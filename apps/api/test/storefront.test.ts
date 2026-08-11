import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const alphaSlug = "storefront-alpha";
const betaSlug = "storefront-beta";
const suspendedSlug = "storefront-suspended";

async function cleanup(): Promise<void> {
  await database.tenant.deleteMany({
    where: { slug: { in: [alphaSlug, betaSlug, suspendedSlug] } },
  });
}

before(async () => {
  await cleanup();

  const alpha = await database.tenant.create({
    data: {
      name: "Tienda pública Alpha",
      slug: alphaSlug,
      settings: { create: { description: "Catálogo Alpha", currency: "ARS" } },
      categories: { create: { name: "Ropa", slug: "ropa" } },
    },
    include: { categories: true },
  });
  const beta = await database.tenant.create({
    data: {
      name: "Tienda pública Beta",
      slug: betaSlug,
      categories: { create: { name: "Hogar", slug: "hogar" } },
    },
    include: { categories: true },
  });

  await database.tenant.create({
    data: { name: "Tienda suspendida", slug: suspendedSlug, status: "SUSPENDED" },
  });
  await database.product.createMany({
    data: [
      {
        tenantId: alpha.id,
        categoryId: alpha.categories[0]!.id,
        sku: "ALPHA-PUBLIC",
        slug: "campera-publica",
        name: "Campera pública",
        priceInCents: 125000,
        stock: 4,
        active: true,
      },
      {
        tenantId: alpha.id,
        categoryId: alpha.categories[0]!.id,
        sku: "ALPHA-HIDDEN",
        slug: "campera-oculta",
        name: "Campera oculta",
        priceInCents: 90000,
        stock: 2,
        active: false,
      },
      {
        tenantId: beta.id,
        categoryId: beta.categories[0]!.id,
        sku: "BETA-PUBLIC",
        slug: "lampara-publica",
        name: "Lámpara pública",
        priceInCents: 45000,
        stock: 3,
        active: true,
      },
    ],
  });
});

after(async () => {
  await cleanup();
  await database.$disconnect();
});

test("el catálogo público solo expone productos activos de su tienda", async () => {
  const response = await request(app).get(`/api/storefront/${alphaSlug}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.store.slug, alphaSlug);
  assert.deepEqual(
    response.body.store.products.map(({ slug }: { slug: string }) => slug),
    ["campera-publica"],
  );
  assert.equal(response.body.store.categories[0]._count.products, 1);
});

test("el detalle no permite consultar productos ocultos ni de otra tienda", async () => {
  assert.equal(
    (await request(app).get(`/api/storefront/${alphaSlug}/products/campera-publica`)).status,
    200,
  );
  assert.equal(
    (await request(app).get(`/api/storefront/${alphaSlug}/products/campera-oculta`)).status,
    404,
  );
  assert.equal(
    (await request(app).get(`/api/storefront/${alphaSlug}/products/lampara-publica`)).status,
    404,
  );
});

test("las tiendas suspendidas no tienen storefront público", async () => {
  assert.equal((await request(app).get(`/api/storefront/${suspendedSlug}`)).status, 404);
});
