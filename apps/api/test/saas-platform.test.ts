import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const password = "StrongPass123!";
const superEmail = "super@saas-platform.test";
const ownerEmail = "owner@saas-platform.test";
const memberEmail = "member@saas-platform.test";
const superSlug = "saas-platform-super";
const ownerSlug = "saas-platform-owner";
const memberSlug = "saas-platform-member";
const superAgent = request.agent(app);
const ownerAgent = request.agent(app);
const memberAgent = request.agent(app);
let ownerTenantId = "";
let memberUserId = "";

async function cleanup(): Promise<void> {
  await database.tenant.deleteMany({ where: { slug: { in: [superSlug, ownerSlug, memberSlug] } } });
  await database.user.deleteMany({ where: { email: { in: [superEmail, ownerEmail, memberEmail] } } });
}

async function register(agent: ReturnType<typeof request.agent>, email: string, slug: string) {
  const response = await agent.post("/api/auth/register").send({
    email, password, firstName: "SaaS", lastName: "Test", storeName: `Tienda ${slug}`, storeSlug: slug,
  });
  assert.equal(response.status, 201);
}

before(async () => {
  await cleanup();
  await register(superAgent, superEmail, superSlug);
  await register(ownerAgent, ownerEmail, ownerSlug);
  await register(memberAgent, memberEmail, memberSlug);
  const [superUser, ownerTenant, memberUser] = await Promise.all([
    database.user.findUniqueOrThrow({ where: { email: superEmail } }),
    database.tenant.findUniqueOrThrow({ where: { slug: ownerSlug } }),
    database.user.findUniqueOrThrow({ where: { email: memberEmail } }),
  ]);
  await database.user.update({ where: { id: superUser.id }, data: { platformRole: "SUPERADMIN" } });
  ownerTenantId = ownerTenant.id;
  memberUserId = memberUser.id;
});

after(async () => {
  await cleanup();
  await database.$disconnect();
});

test("solo SUPERADMIN accede al panel global", async () => {
  assert.equal((await ownerAgent.get("/api/platform/overview")).status, 403);
  const overview = await superAgent.get("/api/platform/overview");
  assert.equal(overview.status, 200);
  assert.ok(overview.body.tenants >= 3);
  const plans = await superAgent.get("/api/platform/plans");
  assert.deepEqual(plans.body.plans.map(({ code }: { code: string }) => code), ["FREE", "STARTER", "PRO"]);
});

test("el plan FREE aplica límites y el upgrade habilita capacidad", async () => {
  const teamLimit = await ownerAgent.post("/api/admin/team").send({ email: memberEmail, role: "STAFF" });
  assert.equal(teamLimit.status, 409);

  const tenant = await database.tenant.findUniqueOrThrow({ where: { id: ownerTenantId } });
  await database.product.createMany({
    data: Array.from({ length: 20 }, (_, index) => ({
      tenantId: tenant.id,
      sku: `LIMIT-${index}`,
      slug: `limit-${index}`,
      name: `Producto límite ${index}`,
      priceInCents: 1000,
      stock: 1,
    })),
  });
  const productLimit = await ownerAgent.post("/api/admin/products").send({
    sku: "LIMIT-EXTRA", slug: "limit-extra", name: "Producto extra", priceInCents: 1000, stock: 1,
  });
  assert.equal(productLimit.status, 409);

  const upgrade = await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ planCode: "STARTER" });
  assert.equal(upgrade.status, 200);
  assert.equal(upgrade.body.subscription.plan.code, "STARTER");
  assert.equal((await ownerAgent.post("/api/admin/team").send({ email: memberEmail, role: "STAFF" })).status, 201);
  assert.equal((await ownerAgent.post("/api/admin/products").send({ sku: "LIMIT-EXTRA", slug: "limit-extra", name: "Producto extra", priceInCents: 1000, stock: 1 })).status, 201);
});

test("OWNER administra roles y STAFF conserva solo lectura", async () => {
  const updated = await ownerAgent.patch(`/api/admin/team/${memberUserId}`).send({ role: "ADMIN" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.member.role, "ADMIN");
  await ownerAgent.patch(`/api/admin/team/${memberUserId}`).send({ role: "STAFF" });
  assert.equal((await memberAgent.post("/api/auth/select-tenant").send({ tenantSlug: ownerSlug })).status, 200);
  assert.equal((await memberAgent.get("/api/admin/products")).status, 200);
  assert.equal((await memberAgent.post("/api/admin/categories").send({ name: "Prohibida", slug: "prohibida" })).status, 403);
});

test("suscripciones vencidas bloquean mutaciones y tenants suspendidos dejan de operar", async () => {
  await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ planCode: "FREE" });
  await database.order.createMany({
    data: Array.from({ length: 50 }, (_, index) => ({
      tenantId: ownerTenantId,
      number: index + 1,
      customerEmail: `limit-${index}@example.com`,
      customerName: "Límite Mensual",
      subtotalInCents: 1000,
      totalInCents: 1000,
    })),
  });
  const product = await database.product.findFirstOrThrow({ where: { tenantId: ownerTenantId } });
  const orderLimit = await request(app).post(`/api/storefront/${ownerSlug}/orders`).send({
    customer: {
      email: "pedido-extra@example.com",
      firstName: "Pedido",
      lastName: "Extra",
      phone: "11111111",
      shippingAddress: "Dirección de prueba número 123",
    },
    items: [{ productId: product.id, quantity: 1 }],
  });
  assert.equal(orderLimit.status, 409);

  assert.equal((await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ status: "PAST_DUE" })).status, 200);
  assert.equal((await ownerAgent.post("/api/admin/categories").send({ name: "Bloqueada", slug: "bloqueada" })).status, 402);
  await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ status: "ACTIVE" });

  assert.equal((await superAgent.patch(`/api/platform/tenants/${ownerTenantId}`).send({ status: "SUSPENDED" })).status, 200);
  assert.equal((await request(app).get(`/api/storefront/${ownerSlug}`)).status, 404);
  assert.equal((await ownerAgent.get("/api/admin/dashboard")).status, 403);
  assert.equal((await superAgent.patch(`/api/platform/tenants/${ownerTenantId}`).send({ status: "ACTIVE" })).status, 200);
});
