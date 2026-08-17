import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

const email = "security@account-test.local";
const slug = "account-security-test";
const password = "StrongPass123!";
const newPassword = "EvenStronger456!";
const agent = request.agent(app);
const renewedAgent = request.agent(app);
const invitedAgent = request.agent(app);
const invitedEmail = "invited@account-test.local";
let verificationToken = "";

async function cleanup(): Promise<void> {
  await database.tenant.deleteMany({ where: { slug } });
  await database.user.deleteMany({ where: { email: { in: [email, invitedEmail] } } });
}

before(cleanup);
after(async () => { await cleanup(); await database.$disconnect(); });

test("registro emite una verificación hasheada, vencible y de un solo uso", async () => {
  const registration = await agent.post("/api/auth/register").send({ email, password, firstName: "Cuenta", lastName: "Segura", storeName: "Seguridad", storeSlug: slug });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.emailVerified, false);
  verificationToken = new URL(registration.body.verification.verificationUrl).searchParams.get("token") ?? "";
  assert.ok(verificationToken.length >= 32);

  const stored = await database.emailVerificationToken.findFirstOrThrow({ where: { user: { email } } });
  assert.notEqual(stored.tokenHash, verificationToken);
  assert.equal(stored.tokenHash.length, 64);
  assert.equal((await agent.get("/api/auth/me")).body.user.emailVerified, false);

  const verification = await request(app).post("/api/auth/verify-email").send({ token: verificationToken });
  assert.equal(verification.status, 200);
  assert.equal((await agent.get("/api/auth/me")).body.user.emailVerified, true);
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: verificationToken })).status, 400);
});

test("recuperación no revela cuentas y revoca todas las sesiones al cambiar la contraseña", async () => {
  const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "missing@account-test.local" });
  assert.equal(unknown.status, 202);
  assert.equal(unknown.body.resetUrl, undefined);

  const recovery = await request(app).post("/api/auth/forgot-password").send({ email });
  assert.equal(recovery.status, 202);
  const token = new URL(recovery.body.resetUrl).searchParams.get("token");
  assert.ok(token);
  const stored = await database.passwordResetToken.findFirstOrThrow({ where: { user: { email } } });
  assert.notEqual(stored.tokenHash, token);

  assert.equal((await request(app).post("/api/auth/reset-password").send({ token, password: newPassword })).status, 204);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
  assert.equal((await request(app).post("/api/auth/login").send({ email, password, tenantSlug: slug })).status, 401);
  assert.equal((await renewedAgent.post("/api/auth/login").send({ email, password: newPassword, tenantSlug: slug })).status, 200);
  assert.equal((await request(app).post("/api/auth/reset-password").send({ token, password })).status, 400);
});

test("una invitación crea y verifica una cuenta nueva sin exponer el tenantId", async () => {
  const tenant = await database.tenant.findUniqueOrThrow({ where: { slug } });
  const starter = await database.plan.findUniqueOrThrow({ where: { code: "STARTER" } });
  await database.subscription.update({ where: { tenantId: tenant.id }, data: { planId: starter.id } });

  const invitation = await renewedAgent.post("/api/admin/team").send({ email: invitedEmail, role: "STAFF", tenantId: "manipulado" });
  assert.equal(invitation.status, 400);
  const validInvitation = await renewedAgent.post("/api/admin/team").send({ email: invitedEmail, role: "STAFF" });
  assert.equal(validInvitation.status, 201);
  const token = new URL(validInvitation.body.invitationUrl).searchParams.get("token");
  assert.ok(token);

  const accepted = await invitedAgent.post("/api/auth/invitations/accept").send({ token, password, firstName: "Persona", lastName: "Invitada", tenantId: "manipulado" });
  assert.equal(accepted.status, 400);
  assert.equal((await invitedAgent.post("/api/auth/invitations/accept").send({ token, password, firstName: "Persona", lastName: "Invitada" })).status, 200);
  const user = await database.user.findUniqueOrThrow({ where: { email: invitedEmail }, include: { memberships: true } });
  assert.ok(user.emailVerifiedAt);
  assert.equal(user.memberships[0]?.tenantId, tenant.id);
  assert.equal((await invitedAgent.get("/api/auth/me")).body.tenant.slug, slug);
  assert.equal((await request(app).post("/api/auth/invitations/accept").send({ token, password })).status, 400);
});
