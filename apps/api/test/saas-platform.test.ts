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
  const response = await agent.post("/api/auth/register").send({ email, password, firstName: "SaaS", lastName: "Test", storeName: `Tienda ${slug}`, storeSlug: slug });
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

after(async () => { await cleanup(); await database.$disconnect(); });

test("solo SUPERADMIN accede al panel global y existen STARTER y PRO", async () => {
  assert.equal((await ownerAgent.get("/api/platform/overview")).status, 403);
  assert.equal((await superAgent.get("/api/platform/overview")).status, 200);
  const plans = await superAgent.get("/api/platform/plans");
  assert.deepEqual(plans.body.plans.map(({ code }: { code: string }) => code), ["STARTER", "PRO"]);
  assert.deepEqual(plans.body.plans.map(({ priceInCents }: { priceInCents: number }) => priceInCents), [5_000_000, 7_000_000]);
});

test("STARTER limita 150 productos y un colaborador; PRO amplía capacidad", async () => {
  const invitation = await ownerAgent.post("/api/admin/team").send({ email: memberEmail, role: "STAFF" });
  assert.equal(invitation.status, 201);
  const invitationToken = new URL(invitation.body.invitationUrl).searchParams.get("token");
  assert.ok(invitationToken);
  assert.equal((await memberAgent.post("/api/auth/invitations/accept").send({ token: invitationToken, password })).status, 200);
  assert.equal((await ownerAgent.post("/api/admin/team").send({ email: "second-collaborator@example.com", role: "STAFF" })).status, 409);

  await database.product.createMany({
    data: Array.from({ length: 150 }, (_, index) => ({ tenantId: ownerTenantId, sku: `LIMIT-${index}`, slug: `limit-${index}`, name: `Producto límite ${index}`, priceInCents: 1000, stock: 1 })),
  });
  assert.equal((await ownerAgent.post("/api/admin/products").send({ sku: "LIMIT-EXTRA", slug: "limit-extra", name: "Producto extra", priceInCents: 1000, stock: 1 })).status, 409);

  const upgrade = await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ planCode: "PRO" });
  assert.equal(upgrade.status, 200);
  assert.equal(upgrade.body.subscription.plan.code, "PRO");
  assert.equal((await ownerAgent.post("/api/admin/products").send({ sku: "LIMIT-EXTRA", slug: "limit-extra", name: "Producto extra", priceInCents: 1000, stock: 1 })).status, 201);
  assert.equal((await ownerAgent.post("/api/admin/team").send({ email: "second-collaborator@example.com", role: "STAFF" })).status, 201);
});

test("OWNER administra roles y STAFF conserva solo lectura", async () => {
  assert.equal((await ownerAgent.patch(`/api/admin/team/${memberUserId}`).send({ role: "ADMIN" })).status, 200);
  await ownerAgent.patch(`/api/admin/team/${memberUserId}`).send({ role: "STAFF" });
  assert.equal((await memberAgent.post("/api/auth/select-tenant").send({ tenantSlug: ownerSlug })).status, 200);
  assert.equal((await memberAgent.get("/api/admin/products")).status, 200);
  assert.equal((await memberAgent.post("/api/admin/categories").send({ name: "Prohibida", slug: "prohibida" })).status, 403);
});

test("pagos vencidos bloquean mutaciones y tenants suspendidos dejan de operar", async () => {
  assert.equal((await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ status: "PAST_DUE" })).status, 200);
  assert.equal((await ownerAgent.post("/api/admin/categories").send({ name: "Bloqueada", slug: "bloqueada" })).status, 402);
  await superAgent.patch(`/api/platform/tenants/${ownerTenantId}/subscription`).send({ status: "ACTIVE" });
  assert.equal((await superAgent.patch(`/api/platform/tenants/${ownerTenantId}`).send({ status: "SUSPENDED" })).status, 200);
  assert.equal((await request(app).get(`/api/storefront/${ownerSlug}`)).status, 404);
  assert.equal((await ownerAgent.get("/api/admin/dashboard")).status, 403);
  assert.equal((await superAgent.patch(`/api/platform/tenants/${ownerTenantId}`).send({ status: "ACTIVE" })).status, 200);
});
