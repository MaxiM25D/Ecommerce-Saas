import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const agent = request.agent(app);
const betaAgent = request.agent(app);
const slugs = ["billing-alpha", "billing-beta"];
const emails = ["owner@billing-alpha.test", "owner@billing-beta.test"];
let alphaTenantId = "";
let betaTenantId = "";

before(async () => {
  await database.tenant.deleteMany({ where: { slug: { in: slugs } } });
  await database.user.deleteMany({ where: { email: { in: emails } } });
  for (const [index, currentAgent] of [agent, betaAgent].entries()) {
    const response = await currentAgent.post("/api/auth/register").send({ email: emails[index], password: "StrongPass123!", firstName: "Billing", lastName: "Owner", storeName: `Billing ${index}`, storeSlug: slugs[index] });
    assert.equal(response.status, 201);
  }
  alphaTenantId = (await database.tenant.findUniqueOrThrow({ where: { slug: slugs[0] } })).id;
  betaTenantId = (await database.tenant.findUniqueOrThrow({ where: { slug: slugs[1] } })).id;
});

after(async () => {
  await database.tenant.deleteMany({ where: { slug: { in: slugs } } });
  await database.user.deleteMany({ where: { email: { in: emails } } });
  await database.$disconnect();
});

test("onboarding inicia una prueba STARTER y expone solo los dos planes", async () => {
  const overview = await agent.get("/api/billing/overview");
  assert.equal(overview.status, 200);
  assert.equal(overview.body.subscription.plan.code, "STARTER");
  assert.equal(overview.body.subscription.status, "TRIALING");
  assert.ok(new Date(overview.body.subscription.trialEndsAt) > new Date());
  assert.deepEqual(overview.body.plans.map(({ code }: { code: string }) => code), ["STARTER", "PRO"]);
  assert.equal(overview.body.billingConfigured, false);
});

test("el historial de facturas permanece aislado por tenant", async () => {
  const plan = await database.plan.findUniqueOrThrow({ where: { code: "STARTER" } });
  for (const [tenantId, providerInvoiceId] of [[alphaTenantId, "invoice-alpha"], [betaTenantId, "invoice-beta"]]) {
    await database.billingInvoice.create({ data: { tenantId, provider: "MERCADO_PAGO", providerInvoiceId, status: "PAID", planCode: plan.code, planName: plan.name, amountInCents: plan.priceInCents, currency: plan.currency, paidAt: new Date() } });
  }
  const overview = await agent.get("/api/billing/overview");
  assert.deepEqual(overview.body.invoices.map(({ providerInvoiceId }: { providerInvoiceId: string }) => providerInvoiceId), ["invoice-alpha"]);
});

test("OWNER programa y revierte la cancelación sin cancelar ventas inmediatamente", async () => {
  const canceled = await agent.post("/api/billing/cancel").send({ immediately: false });
  assert.equal(canceled.status, 200);
  assert.equal(canceled.body.subscription.cancelAtPeriodEnd, true);
  assert.equal(canceled.body.subscription.status, "TRIALING");
  const resumed = await agent.post("/api/billing/resume");
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.subscription.cancelAtPeriodEnd, false);
});

test("checkout automático avisa claramente cuando faltan credenciales de InfinityShop", async () => {
  const response = await agent.post("/api/billing/checkout").send({ planCode: "PRO" });
  assert.equal(response.status, 503);
});
