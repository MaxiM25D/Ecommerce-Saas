import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const slug = "checkout-orders-test";
const otherSlug = "checkout-orders-other";
const email = "owner@checkout-orders.test";
const otherEmail = "other@checkout-orders.test";
const password = "StrongPass123!";
const ownerAgent = request.agent(app);
const otherAgent = request.agent(app);
let productId = "";
let orderId = "";

async function cleanup(): Promise<void> {
  const tenants = await database.tenant.findMany({
    where: { slug: { in: [slug, otherSlug] } },
    select: { id: true },
  });
  await database.orderItem.deleteMany({
    where: { tenantId: { in: tenants.map(({ id }) => id) } },
  });
  await database.tenant.deleteMany({ where: { slug: { in: [slug, otherSlug] } } });
  await database.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
}

before(async () => {
  await cleanup();
  for (const [agent, ownerEmail, storeSlug] of [
    [ownerAgent, email, slug],
    [otherAgent, otherEmail, otherSlug],
  ] as const) {
    const registration = await agent.post("/api/auth/register").send({
      email: ownerEmail,
      password,
      firstName: "Owner",
      lastName: "Checkout",
      storeName: `Tienda ${storeSlug}`,
      storeSlug,
    });
    assert.equal(registration.status, 201);
  }

  const tenant = await database.tenant.findUniqueOrThrow({ where: { slug } });
  const category = await database.category.create({
    data: { tenantId: tenant.id, name: "Checkout", slug: "checkout" },
  });
  const product = await database.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      sku: "CHECKOUT-001",
      slug: "producto-checkout",
      name: "Producto Checkout",
      priceInCents: 123400,
      stock: 5,
      active: true,
    },
  });
  productId = product.id;
  await ownerAgent.patch("/api/admin/store").send({
    bankName: "Banco Demo",
    bankAlias: "INFINITY.DEMO",
    bankHolder: "InfinityShop Demo",
  });
});

after(async () => {
  await cleanup();
  await database.$disconnect();
});

test("checkout copia precios y productos y descuenta stock", async () => {
  const response = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer: {
      email: "comprador@example.com",
      firstName: "María",
      lastName: "Cliente",
      phone: "+54 9 11 1234 5678",
      shippingAddress: "Av. Siempre Viva 742, Buenos Aires",
      notes: "Entregar por la tarde",
    },
    items: [{ productId, quantity: 2 }],
    paymentMethod: "BANK_TRANSFER",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.order.totalInCents, 246800);
  assert.equal(response.body.payment.alias, "INFINITY.DEMO");
  orderId = response.body.order.id;

  const [product, order] = await Promise.all([
    database.product.findUniqueOrThrow({ where: { id: productId } }),
    database.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } }),
  ]);
  assert.equal(product.stock, 3);
  assert.equal(order.items[0]!.productName, "Producto Checkout");
  assert.equal(order.items[0]!.unitPriceInCents, 123400);
  assert.equal(order.shippingAddress, "Av. Siempre Viva 742, Buenos Aires");

  await database.product.update({ where: { id: productId }, data: { priceInCents: 999900 } });
  const snapshot = await database.orderItem.findFirstOrThrow({ where: { orderId } });
  assert.equal(snapshot.unitPriceInCents, 123400);
});

test("stock insuficiente revierte el pedido completo", async () => {
  const response = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer: {
      email: "otro@example.com",
      firstName: "Otro",
      lastName: "Cliente",
      phone: "11111111",
      shippingAddress: "Dirección de prueba número 123",
    },
    items: [{ productId, quantity: 99 }],
  });

  assert.equal(response.status, 409);
  assert.equal((await database.product.findUniqueOrThrow({ where: { id: productId } })).stock, 3);
  assert.equal(await database.order.count({ where: { customerEmail: "otro@example.com" } }), 0);
});

test("el panel administra estados y una cancelación repone stock una sola vez", async () => {
  assert.equal((await otherAgent.get(`/api/admin/orders/${orderId}`)).status, 404);
  assert.equal((await ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ status: "DELIVERED" })).status, 409);

  const confirmed = await ownerAgent.patch(`/api/admin/orders/${orderId}`).send({
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.order.status, "CONFIRMED");
  assert.equal(confirmed.body.order.paymentStatus, "APPROVED");

  const cancellations = await Promise.all([
    ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ status: "CANCELLED" }),
    ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ status: "CANCELLED" }),
  ]);
  assert.ok(cancellations.every(({ status }) => status === 200));
  assert.equal((await database.product.findUniqueOrThrow({ where: { id: productId } })).stock, 5);
});
