import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";
import { processPendingNotifications } from "../src/services/notifications.js";

const slug = "checkout-orders-test";
const otherSlug = "checkout-orders-other";
const email = "owner@checkout-orders.test";
const otherEmail = "other@checkout-orders.test";
const password = "StrongPass123!";
const ownerAgent = request.agent(app);
const otherAgent = request.agent(app);
let productId = "";
let orderId = "";
let orderToken = "";
let shippingMethodId = "";

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
  await database.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
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
  const zone = await database.shippingZone.create({
    data: { tenantId: tenant.id, name: "Todo el país", postalPrefixes: [] },
  });
  const method = await database.shippingMethod.create({
    data: {
      tenantId: tenant.id,
      shippingZoneId: zone.id,
      name: "Envío estándar",
      priceInCents: 0,
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
    },
  });
  shippingMethodId = method.id;
  await ownerAgent.patch("/api/admin/store").send({
    bankName: "Banco Demo",
    bankAlias: "INFINITY.DEMO",
    bankHolder: "InfinityShop Demo",
    bankTransferEnabled: true,
  });
});

after(async () => {
  await cleanup();
  await database.$disconnect();
});

test("checkout copia precios y productos y descuenta stock", async () => {
  const response = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer: {
      email: "comprador@checkout.test",
      firstName: "María",
      lastName: "Cliente",
      phone: "+54 9 11 1234 5678",
      street: "Av. Siempre Viva",
      streetNumber: "742",
      apartment: "2° B",
      city: "Springfield",
      province: "Buenos Aires",
      postalCode: "1000",
      notes: "Entregar por la tarde",
    },
    items: [{ productId, quantity: 2 }],
    paymentMethod: "BANK_TRANSFER",
    shippingMethodId,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.order.totalInCents, 246800);
  assert.equal(response.body.payment.alias, "INFINITY.DEMO");
  orderId = response.body.order.id;
  orderToken = response.body.orderToken;

  const [product, order] = await Promise.all([
    database.product.findUniqueOrThrow({ where: { id: productId } }),
    database.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } }),
  ]);
  assert.equal(product.stock, 3);
  assert.equal(order.items[0]!.productName, "Producto Checkout");
  assert.equal(order.items[0]!.unitPriceInCents, 123400);
  assert.equal(order.shippingAddress, "Av. Siempre Viva 742, 2° B, Springfield, Buenos Aires");
  const notification = await database.notificationLog.findFirstOrThrow({ where: { tenantId: order.tenantId, event: "ORDER_CREATED", recipient: "comprador@checkout.test" } });
  assert.equal(notification.status, "PENDING");
  assert.equal(notification.attempts, 0);
  await processPendingNotifications();
  const deliveredNotification = await database.notificationLog.findUniqueOrThrow({ where: { id: notification.id } });
  assert.equal(deliveredNotification.status, "SENT");
  assert.equal(deliveredNotification.attempts, 1);

  await database.product.update({ where: { id: productId }, data: { priceInCents: 999900 } });
  const snapshot = await database.orderItem.findFirstOrThrow({ where: { orderId } });
  assert.equal(snapshot.unitPriceInCents, 123400);
});

test("el seguimiento público requiere el token secreto del pedido", async () => {
  assert.equal((await request(app).get(`/api/storefront/${slug}/orders/${orderId}`)).status, 404);
  const allowed = await request(app)
    .get(`/api/storefront/${slug}/orders/${orderId}`)
    .set("x-order-token", orderToken);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.order.id, orderId);
});

test("stock insuficiente revierte el pedido completo", async () => {
  const response = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer: {
      email: "otro@example.com",
      firstName: "Otro",
      lastName: "Cliente",
      phone: "11111111",
      shippingAddress: "Dirección de prueba número 123",
      postalCode: "1000",
    },
    items: [{ productId, quantity: 99 }],
    shippingMethodId,
  });

  assert.equal(response.status, 409);
  assert.equal((await database.product.findUniqueOrThrow({ where: { id: productId } })).stock, 3);
  assert.equal(await database.order.count({ where: { customerEmail: "otro@example.com" } }), 0);
});

test("el panel administra estados y una cancelación repone stock una sola vez", async () => {
  assert.equal((await otherAgent.get(`/api/admin/orders/${orderId}`)).status, 404);
  assert.equal((await ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ status: "DELIVERED" })).status, 409);
  assert.equal((await ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ paymentStatus: "APPROVED" })).status, 409);

  const order = await database.order.findUniqueOrThrow({ where: { id: orderId } });
  await database.paymentReceipt.create({
    data: {
      tenantId: order.tenantId,
      orderId,
      storageProvider: "LOCAL",
      storageKey: "test/receipt.pdf",
      originalName: "comprobante.pdf",
      mimeType: "application/pdf",
      sizeInBytes: 100,
    },
  });

  const confirmed = await ownerAgent.patch(`/api/admin/orders/${orderId}`).send({
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.order.status, "CONFIRMED");
  assert.equal(confirmed.body.order.paymentStatus, "APPROVED");
  assert.equal(
    await database.notificationLog.count({
      where: {
        tenantId: order.tenantId,
        event: "ORDER_PAID",
        recipient: "comprador@checkout.test",
      },
    }),
    1,
  );

  const cancellations = await Promise.all([
    ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ status: "CANCELLED" }),
    ownerAgent.patch(`/api/admin/orders/${orderId}`).send({ status: "CANCELLED" }),
  ]);
  assert.ok(cancellations.every(({ status }) => status === 200));
  assert.equal((await database.product.findUniqueOrThrow({ where: { id: productId } })).stock, 5);
});

test("el vendedor puede corregir el email y reenviar la confirmación", async () => {
  assert.equal(
    (await otherAgent.patch(`/api/admin/orders/${orderId}/contact-and-resend`).send({ email: "correcto@checkout.test" })).status,
    404,
  );
  assert.equal(
    (await ownerAgent.patch(`/api/admin/orders/${orderId}/contact-and-resend`).send({ email: "correo-invalido" })).status,
    400,
  );
  const corrected = await ownerAgent
    .patch(`/api/admin/orders/${orderId}/contact-and-resend`)
    .send({ email: "correcto@checkout.test" });
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.customerEmail, "correcto@checkout.test");
  assert.equal(corrected.body.notification.status, "PENDING");

  const detail = await ownerAgent.get(`/api/admin/orders/${orderId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.order.customerEmail, "correcto@checkout.test");
  assert.equal(detail.body.order.notificationLogs[0].recipient, "correcto@checkout.test");
  assert.match(detail.body.order.statusHistory.at(-1).note, /Email de contacto corregido/);
});

test("el checkout aplica la zona postal más específica y usa la zona general como respaldo", async () => {
  const tenant = await database.tenant.findUniqueOrThrow({ where: { slug } });
  const specificZone = await database.shippingZone.create({
    data: { tenantId: tenant.id, name: "La Rioja capital", postalPrefixes: ["5300"] },
  });
  const specificMethod = await database.shippingMethod.create({
    data: {
      tenantId: tenant.id,
      shippingZoneId: specificZone.id,
      name: "Entrega regional",
      priceInCents: 250000,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
    },
  });
  const customer = {
    email: "postal@checkout.test",
    firstName: "Zona",
    lastName: "Postal",
    phone: "3804000000",
    street: "Pelagio Luna",
    streetNumber: "100",
    city: "La Rioja",
    province: "La Rioja",
    postalCode: "F5300ABC",
  };

  const rejectedFallback = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer,
    items: [{ productId, quantity: 1 }],
    paymentMethod: "BANK_TRANSFER",
    shippingMethodId,
  });
  assert.equal(rejectedFallback.status, 409);
  assert.match(rejectedFallback.body.message, /código postal/);

  const specific = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer,
    items: [{ productId, quantity: 1 }],
    paymentMethod: "BANK_TRANSFER",
    shippingMethodId: specificMethod.id,
  });
  assert.equal(specific.status, 201);
  assert.equal(
    (await database.order.findUniqueOrThrow({ where: { id: specific.body.order.id } })).shippingInCents,
    250000,
  );

  const fallback = await request(app).post(`/api/storefront/${slug}/orders`).send({
    customer: { ...customer, email: "fallback@checkout.test", postalCode: "9999" },
    items: [{ productId, quantity: 1 }],
    paymentMethod: "BANK_TRANSFER",
    shippingMethodId,
  });
  assert.equal(fallback.status, 201);
  assert.equal(
    (await database.order.findUniqueOrThrow({ where: { id: fallback.body.order.id } })).shippingInCents,
    0,
  );
});
