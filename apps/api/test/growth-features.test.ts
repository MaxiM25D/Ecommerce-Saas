import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const slug = "growth-alpha";
const otherSlug = "growth-beta";
const email = "owner@growth-alpha.test";
const otherEmail = "owner@growth-beta.test";
const password = "StrongPass123!";
const agent = request.agent(app);
const otherAgent = request.agent(app);
let tenantId = "";
let productId = "";
let variantId = "";
let couponId = "";
let shippingMethodId = "";

async function cleanup() {
  const tenants = await database.tenant.findMany({
    where: { slug: { in: [slug, otherSlug] } },
    select: { id: true },
  });
  const tenantIds = tenants.map(({ id }) => id);
  if (tenantIds.length) {
    await database.orderItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await database.cartItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await database.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await database.cart.deleteMany({ where: { tenantId: { in: tenantIds } } });
  }
  await database.tenant.deleteMany({
    where: { slug: { in: [slug, otherSlug] } },
  });
  await database.user.deleteMany({
    where: { email: { in: [email, otherEmail] } },
  });
}

before(async () => {
  await cleanup();
  for (const [client, ownerEmail, storeSlug] of [
    [agent, email, slug],
    [otherAgent, otherEmail, otherSlug],
  ] as const) {
    const registered = await client
      .post("/api/auth/register")
      .send({
        email: ownerEmail,
        password,
        firstName: "Growth",
        lastName: "Owner",
        storeName: storeSlug,
        storeSlug,
      });
    assert.equal(registered.status, 201);
  }
  tenantId = (await database.tenant.findUniqueOrThrow({ where: { slug } })).id;
});

after(async () => {
  await cleanup();
  await database.$disconnect();
});

test("STARTER no puede crear herramientas reservadas para PRO", async () => {
  const response = await agent
    .post("/api/admin/growth/coupons")
    .send({
      code: "NO",
      name: "No permitido",
      type: "PERCENTAGE",
      value: 10,
      active: true,
    });
  assert.equal(response.status, 403);
});

test("PRO administra variantes, cupones y envíos sin aceptar tenantId", async () => {
  await database.subscription.update({
    where: { tenantId },
    data: { planId: "plan_pro", status: "ACTIVE" },
  });
  await agent
    .patch("/api/admin/store")
    .send({
      bankTransferEnabled: true,
      bankAlias: "GROWTH.TEST",
      bankHolder: "Growth Test",
    })
    .expect(200);
  const product = await agent
    .post("/api/admin/products")
    .send({
      sku: "GROWTH-BASE",
      slug: "remera-growth",
      name: "Remera Growth",
      priceInCents: 100000,
      stock: 0,
      images: [],
      active: true,
    });
  assert.equal(product.status, 201);
  productId = product.body.product.id;
  const variant = await agent
    .post("/api/admin/growth/variants")
    .send({
      tenantId: "forged",
      productId,
      sku: "GROWTH-M",
      name: "Negra / M",
      options: { color: "Negro", talle: "M" },
      priceInCents: 120000,
      stock: 5,
      active: true,
    });
  assert.equal(variant.status, 400);
  const validVariant = await agent
    .post("/api/admin/growth/variants")
    .send({
      productId,
      sku: "GROWTH-M",
      name: "Negra / M",
      options: { color: "Negro", talle: "M" },
      priceInCents: 120000,
      stock: 5,
      active: true,
    });
  assert.equal(validVariant.status, 201);
  variantId = validVariant.body.variant.id;
  const coupon = await agent
    .post("/api/admin/growth/coupons")
    .send({
      code: "PILOTO10",
      name: "Piloto",
      type: "PERCENTAGE",
      value: 10,
      minimumInCents: 0,
      maximumUses: 5,
      active: true,
    });
  assert.equal(coupon.status, 201);
  couponId = coupon.body.coupon.id;
  const zone = await agent
    .post("/api/admin/growth/shipping-zones")
    .send({ name: "Argentina", postalPrefixes: [], active: true });
  assert.equal(zone.status, 201);
  const method = await agent
    .post(`/api/admin/growth/shipping-zones/${zone.body.zone.id}/methods`)
    .send({
      name: "Correo",
      priceInCents: 15000,
      estimatedDays: 3,
      active: true,
    });
  assert.equal(method.status, 201);
  shippingMethodId = method.body.method.id;
  assert.equal(
    (await otherAgent.delete(`/api/admin/growth/coupons/${couponId}`)).status,
    404,
  );
});

test("checkout usa snapshots de variante, cupón y envío y descuenta stock", async () => {
  const catalog = await request(app).get(`/api/storefront/${slug}`);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.store.products[0].variants[0].id, variantId);
  assert.equal(
    catalog.body.store.shippingZones[0].methods[0].id,
    shippingMethodId,
  );
  const checkout = await request(app)
    .post(`/api/storefront/${slug}/orders`)
    .send({
      customer: {
        email: "buyer@growth.test",
        firstName: "Buyer",
        lastName: "Growth",
        phone: "1122334455",
        shippingAddress: "Calle Growth 123",
        postalCode: "1000",
      },
      items: [{ productId, variantId, quantity: 2 }],
      paymentMethod: "BANK_TRANSFER",
      couponCode: "PILOTO10",
      shippingMethodId,
    });
  assert.equal(checkout.status, 201);
  assert.equal(checkout.body.order.totalInCents, 231000);
  const order = await database.order.findUniqueOrThrow({
    where: { id: checkout.body.order.id },
    include: { items: true },
  });
  assert.equal(order.subtotalInCents, 240000);
  assert.equal(order.discountInCents, 24000);
  assert.equal(order.shippingInCents, 15000);
  assert.equal(order.items[0]!.variantName, "Negra / M");
  assert.equal(
    (
      await database.productVariant.findUniqueOrThrow({
        where: { id: variantId },
      })
    ).stock,
    3,
  );
  assert.equal(
    (await database.coupon.findUniqueOrThrow({ where: { id: couponId } }))
      .usedCount,
    1,
  );
});

test("dominios verificados resuelven el tenant y analytics quedan aislados", async () => {
  const domain = await agent
    .post("/api/admin/growth/domains")
    .send({ hostname: "growth-shop.example" });
  assert.equal(domain.status, 201);
  await database.customDomain.update({
    where: { id: domain.body.domain.id },
    data: { status: "VERIFIED", verifiedAt: new Date() },
  });
  const resolved = await request(app).get(
    "/api/storefront/resolve-domain/growth-shop.example",
  );
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.slug, slug);
  await request(app)
    .post(`/api/storefront/${slug}/events`)
    .send({ type: "ADD_TO_CART", productId, sessionId: "session-growth" })
    .expect(204);
  const overview = await agent.get("/api/admin/growth/overview");
  assert.equal(overview.status, 200);
  assert.ok(overview.body.analytics.events.ADD_TO_CART >= 1);
  const otherOverview = await otherAgent.get("/api/admin/growth/overview");
  assert.equal(otherOverview.status, 200);
  assert.equal(otherOverview.body.analytics.events.ADD_TO_CART, undefined);
});
