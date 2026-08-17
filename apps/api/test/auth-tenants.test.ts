import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const alphaEmail = "owner.alpha@auth-test.local";
const betaEmail = "owner.beta@auth-test.local";
const alphaSlug = "alpha-auth-test";
const betaSlug = "beta-auth-test";
const alphaSecondSlug = "alpha-second-store";
const password = "StrongPass123!";

const alphaAgent = request.agent(app);
const betaAgent = request.agent(app);

async function cleanup(): Promise<void> {
  await database.tenant.deleteMany({ where: { slug: { in: [alphaSlug, betaSlug, alphaSecondSlug] } } });
  await database.user.deleteMany({ where: { email: { in: [alphaEmail, betaEmail] } } });
}

before(cleanup);
after(async () => {
  await cleanup();
  await database.$disconnect();
});

test("el onboarding rechaza tenantId enviado por el cliente", async () => {
  const response = await alphaAgent.post("/api/auth/register").send({
    email: alphaEmail,
    password,
    firstName: "Alpha",
    lastName: "Owner",
    storeName: "Tienda Alpha",
    storeSlug: alphaSlug,
    tenantId: "tenant-manipulado",
  });

  assert.equal(response.status, 400);
  assert.equal(await database.user.count({ where: { email: alphaEmail } }), 0);
});

test("el registro crea usuario, tienda, membresía OWNER y sesión", async () => {
  const response = await alphaAgent.post("/api/auth/register").send({
    email: alphaEmail,
    password,
    firstName: "Alpha",
    lastName: "Owner",
    storeName: "Tienda Alpha",
    storeSlug: alphaSlug,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.tenant.slug, alphaSlug);
  assert.equal(response.body.role, "OWNER");
  assert.match(response.headers["set-cookie"]?.[0] ?? "", /infinityshop_session=.*HttpOnly/);

  const membership = await database.membership.findFirstOrThrow({
    where: { user: { email: alphaEmail }, tenant: { slug: alphaSlug } },
  });
  const session = await database.authSession.findFirstOrThrow({
    where: { userId: membership.userId },
  });

  assert.equal(membership.role, "OWNER");
  assert.equal(session.activeTenantId, membership.tenantId);
  assert.equal(session.tokenHash.length, 64);
});

test("una segunda tienda mantiene una sesión independiente", async () => {
  const response = await betaAgent.post("/api/auth/register").send({
    email: betaEmail,
    password,
    firstName: "Beta",
    lastName: "Owner",
    storeName: "Tienda Beta",
    storeSlug: betaSlug,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.tenant.slug, betaSlug);
  assert.equal(response.body.role, "OWNER");
});

test("el contexto ignora tenantId externos y usa el guardado en la sesión", async () => {
  const beta = await database.tenant.findUniqueOrThrow({ where: { slug: betaSlug } });
  const contextResponse = await alphaAgent
    .get("/api/tenants/context")
    .query({ tenantId: beta.id });

  assert.equal(contextResponse.status, 200);
  assert.equal(contextResponse.body.tenant.slug, alphaSlug);

  const switchResponse = await alphaAgent
    .post("/api/auth/select-tenant")
    .send({ tenantSlug: betaSlug });

  assert.equal(switchResponse.status, 403);

  const alphaSession = await database.authSession.findFirstOrThrow({
    where: { user: { email: alphaEmail } },
    include: { activeTenant: true },
  });
  assert.equal(alphaSession.activeTenant.slug, alphaSlug);
});

test("una tienda activa se resuelve públicamente mediante su slug", async () => {
  const response = await request(app).get(`/api/tenants/resolve/${alphaSlug}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    tenant: { name: "Tienda Alpha", slug: alphaSlug },
  });
});

test("logout invalida la sesión y login crea una nueva usando el slug", async () => {
  assert.equal((await alphaAgent.post("/api/auth/logout")).status, 204);
  assert.equal((await alphaAgent.get("/api/auth/me")).status, 401);

  const forbiddenTenant = await alphaAgent.post("/api/auth/login").send({
    email: alphaEmail,
    password,
    tenantSlug: betaSlug,
  });
  assert.equal(forbiddenTenant.status, 403);

  const loginResponse = await alphaAgent.post("/api/auth/login").send({
    email: alphaEmail,
    password,
    tenantSlug: alphaSlug,
  });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.tenant.slug, alphaSlug);

  const meResponse = await alphaAgent.get("/api/auth/me");
  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.tenant.slug, alphaSlug);
  assert.equal(meResponse.body.role, "OWNER");
});

test("crea, lista y recuerda la última tienda sin aceptar tenantId del frontend", async () => {
  const unverified = await alphaAgent.post("/api/auth/tenants").send({ name: "Segunda tienda", slug: alphaSecondSlug });
  assert.equal(unverified.status, 403);
  await database.user.update({ where: { email: alphaEmail }, data: { emailVerifiedAt: new Date() } });

  const manipulated = await alphaAgent.post("/api/auth/tenants").send({ name: "Segunda tienda", slug: alphaSecondSlug, tenantId: "externo" });
  assert.equal(manipulated.status, 400);
  const created = await alphaAgent.post("/api/auth/tenants").send({ name: "Segunda tienda", slug: alphaSecondSlug });
  assert.equal(created.status, 201);
  assert.equal(created.body.role, "OWNER");

  const stores = await alphaAgent.get("/api/auth/tenants");
  assert.equal(stores.status, 200);
  assert.deepEqual(stores.body.tenants.map(({ slug }: { slug: string }) => slug), [alphaSlug, alphaSecondSlug]);
  assert.equal(stores.body.tenants.find(({ current }: { current: boolean }) => current).slug, alphaSecondSlug);

  assert.equal((await alphaAgent.post("/api/auth/select-tenant").send({ tenantSlug: alphaSlug })).status, 200);
  await alphaAgent.post("/api/auth/logout");
  const rememberedAlpha = await alphaAgent.post("/api/auth/login").send({ email: alphaEmail, password });
  assert.equal(rememberedAlpha.body.tenant.slug, alphaSlug);

  assert.equal((await alphaAgent.post("/api/auth/select-tenant").send({ tenantSlug: alphaSecondSlug })).status, 200);
  await alphaAgent.post("/api/auth/logout");
  const rememberedSecond = await alphaAgent.post("/api/auth/login").send({ email: alphaEmail, password });
  assert.equal(rememberedSecond.body.tenant.slug, alphaSecondSlug);

  await database.tenant.update({ where: { slug: alphaSecondSlug }, data: { status: "SUSPENDED" } });
  const automaticFallback = await alphaAgent.get("/api/auth/me");
  assert.equal(automaticFallback.status, 200);
  assert.equal(automaticFallback.body.tenant.slug, alphaSlug);
});
