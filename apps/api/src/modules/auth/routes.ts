import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { database } from "../../database.js";
import { environment } from "../../config.js";
import { HttpError } from "../../errors.js";
import { createAccountToken, developmentUrl, expiresInHours, expiresInMinutes, hashAccountToken } from "../../services/account-tokens.js";
import { sendEmailVerification, sendPasswordResetEmail } from "../../services/mail.js";
import { getAuthContext, createSession, destroySession, requireSession, selectSessionTenant } from "./session.js";
import {
  acceptInvitationSchema,
  createTenantSchema,
  forgotPasswordSchema,
  invitationTokenSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  selectTenantSchema,
  verifyEmailSchema,
} from "./schemas.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

async function issueEmailVerification(user: { id: string; email: string; firstName: string }) {
  const { token, tokenHash } = createAccountToken();
  await database.$transaction([
    database.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    database.emailVerificationToken.create({ data: { userId: user.id, tokenHash, expiresAt: expiresInHours(environment.EMAIL_VERIFICATION_TTL_HOURS) } }),
  ]);
  let emailSent = true;
  try {
    await sendEmailVerification({ email: user.email, firstName: user.firstName, token });
  } catch {
    emailSent = false;
  }
  return { emailSent, verificationUrl: developmentUrl("/verificar-email", token) };
}

authRouter.post("/register", authLimiter, async (request, response) => {
  const input = registerSchema.parse(request.body);
  const [existingUser, existingTenant] = await Promise.all([
    database.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    database.tenant.findUnique({ where: { slug: input.storeSlug }, select: { id: true } }),
  ]);

  if (existingUser) throw new HttpError(409, "Ya existe un usuario con ese email");
  if (existingTenant) throw new HttpError(409, "Ese slug de tienda ya está ocupado");

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const result = await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });
      const tenant = await transaction.tenant.create({
        data: {
          name: input.storeName,
          slug: input.storeSlug,
          memberships: { create: { userId: user.id, role: "OWNER" } },
          subscription: { create: { planId: "plan_free", status: "ACTIVE" } },
        },
      });

      return { user, tenant };
    });

    const verification = await issueEmailVerification(result.user);
    await createSession(response, result.user.id, result.tenant.id);
    response.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        platformRole: result.user.platformRole,
        emailVerified: false,
      },
      tenant: { slug: result.tenant.slug, name: result.tenant.name },
      role: "OWNER",
      verification,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new HttpError(409, "El email o el slug ya están registrados");
    }
    throw error;
  }
});

authRouter.post("/login", authLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await database.user.findUnique({
    where: { email: input.email },
    include: {
      memberships: {
        where: input.tenantSlug ? { tenant: { slug: input.tenantSlug } } : undefined,
        include: { tenant: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Email o contraseña incorrectos");
  }

  const membership = input.tenantSlug
    ? user.memberships.find(({ tenant }) => tenant.status === "ACTIVE")
    : user.memberships.find(({ tenantId, tenant }) => tenantId === user.lastTenantId && tenant.status === "ACTIVE")
      ?? user.memberships.find(({ tenant }) => tenant.status === "ACTIVE");
  if (!membership) throw new HttpError(403, "No tenés acceso a una tienda activa");

  await createSession(response, user.id, membership.tenantId);
  response.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, platformRole: user.platformRole, emailVerified: Boolean(user.emailVerifiedAt) },
    tenant: { slug: membership.tenant.slug, name: membership.tenant.name },
    role: membership.role,
  });
});

authRouter.post("/logout", async (request, response) => {
  await destroySession(request, response);
  response.status(204).send();
});

authRouter.post("/email-verification", authLimiter, requireSession, async (request, response) => {
  const { user } = getAuthContext(request);
  const storedUser = await database.user.findUniqueOrThrow({ where: { id: user.id } });
  if (storedUser.emailVerifiedAt) {
    response.json({ emailVerified: true, emailSent: false });
    return;
  }
  const verification = await issueEmailVerification(storedUser);
  response.status(202).json({ emailVerified: false, ...verification });
});

authRouter.post("/verify-email", authLimiter, async (request, response) => {
  const { token } = verifyEmailSchema.parse(request.body);
  const tokenHash = hashAccountToken(token);
  const verification = await database.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!verification || verification.expiresAt <= new Date()) {
    if (verification) await database.emailVerificationToken.delete({ where: { id: verification.id } });
    throw new HttpError(400, "El enlace de verificación venció o no es válido");
  }
  await database.$transaction([
    database.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date() } }),
    database.emailVerificationToken.deleteMany({ where: { userId: verification.userId } }),
  ]);
  response.json({ emailVerified: true });
});

authRouter.post("/forgot-password", authLimiter, async (request, response) => {
  const { email } = forgotPasswordSchema.parse(request.body);
  const user = await database.user.findUnique({ where: { email } });
  let resetUrl: string | undefined;
  if (user) {
    const { token, tokenHash } = createAccountToken();
    await database.$transaction([
      database.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      database.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: expiresInMinutes(environment.PASSWORD_RESET_TTL_MINUTES) } }),
    ]);
    try {
      await sendPasswordResetEmail({ email: user.email, firstName: user.firstName, token });
    } catch {
      // La respuesta pública no revela si la cuenta o el servicio SMTP existen.
    }
    resetUrl = developmentUrl("/restablecer-clave", token);
  }
  response.status(202).json({
    message: "Si existe una cuenta con ese email, enviamos las instrucciones para recuperar la contraseña.",
    ...(resetUrl ? { resetUrl } : {}),
  });
});

authRouter.post("/reset-password", authLimiter, async (request, response) => {
  const input = resetPasswordSchema.parse(request.body);
  const reset = await database.passwordResetToken.findUnique({ where: { tokenHash: hashAccountToken(input.token) } });
  if (!reset || reset.expiresAt <= new Date()) {
    if (reset) await database.passwordResetToken.delete({ where: { id: reset.id } });
    throw new HttpError(400, "El enlace de recuperación venció o no es válido");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  await database.$transaction([
    database.user.update({ where: { id: reset.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
    database.passwordResetToken.deleteMany({ where: { userId: reset.userId } }),
    database.emailVerificationToken.deleteMany({ where: { userId: reset.userId } }),
    database.authSession.deleteMany({ where: { userId: reset.userId } }),
  ]);
  await destroySession(request, response);
  response.status(204).send();
});

authRouter.get("/invitations/:token", authLimiter, async (request, response) => {
  const { token } = invitationTokenSchema.parse(request.params);
  const invitation = await database.teamInvitation.findUnique({
    where: { tokenHash: hashAccountToken(token) },
    include: { tenant: { select: { name: true, status: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || invitation.tenant.status !== "ACTIVE") {
    throw new HttpError(404, "La invitación venció o no es válida");
  }
  const existingUser = Boolean(await database.user.findUnique({ where: { email: invitation.email }, select: { id: true } }));
  response.json({ invitation: { email: invitation.email, role: invitation.role, tenantName: invitation.tenant.name, expiresAt: invitation.expiresAt, existingUser } });
});

authRouter.post("/invitations/accept", authLimiter, async (request, response) => {
  const input = acceptInvitationSchema.parse(request.body);
  const tokenHash = hashAccountToken(input.token);
  const initialInvitation = await database.teamInvitation.findUnique({ where: { tokenHash } });
  if (!initialInvitation || initialInvitation.acceptedAt || initialInvitation.expiresAt <= new Date()) {
    throw new HttpError(400, "La invitación venció o no es válida");
  }
  const existingUser = await database.user.findUnique({ where: { email: initialInvitation.email } });
  if (existingUser && !(await bcrypt.compare(input.password, existingUser.passwordHash))) {
    throw new HttpError(401, "La contraseña no es correcta para la cuenta invitada");
  }
  if (!existingUser && (!input.firstName || !input.lastName)) {
    throw new HttpError(400, "Completá nombre y apellido para crear tu cuenta");
  }
  const passwordHash = existingUser ? null : await bcrypt.hash(input.password, 12);

  const accepted = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${initialInvitation.tenantId} FOR UPDATE`;
    const invitation = await transaction.teamInvitation.findUnique({
      where: { tokenHash },
      include: { tenant: { include: { subscription: { include: { plan: true } } } } },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new HttpError(400, "La invitación venció o no es válida");
    if (invitation.tenant.status !== "ACTIVE") throw new HttpError(403, "La tienda está suspendida");
    if (!invitation.tenant.subscription || !["TRIALING", "ACTIVE"].includes(invitation.tenant.subscription.status)) {
      throw new HttpError(409, "La suscripción de la tienda no permite incorporar miembros");
    }
    const memberCount = await transaction.membership.count({ where: { tenantId: invitation.tenantId } });
    if (memberCount >= invitation.tenant.subscription.plan.maxMembers) {
      throw new HttpError(409, `La tienda alcanzó el límite de ${invitation.tenant.subscription.plan.maxMembers} miembros`);
    }
    let user = await transaction.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      user = await transaction.user.create({
        data: { email: invitation.email, passwordHash: passwordHash!, firstName: input.firstName!, lastName: input.lastName!, emailVerifiedAt: new Date() },
      });
    } else if (!user.emailVerifiedAt) {
      user = await transaction.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }
    const membership = await transaction.membership.findUnique({ where: { tenantId_userId: { tenantId: invitation.tenantId, userId: user.id } } });
    if (membership) throw new HttpError(409, "La cuenta ya pertenece a esta tienda");
    await transaction.membership.create({ data: { tenantId: invitation.tenantId, userId: user.id, role: invitation.role } });
    await transaction.teamInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    return { user, tenant: invitation.tenant, role: invitation.role };
  });

  await createSession(response, accepted.user.id, accepted.tenant.id);
  response.json({
    user: { id: accepted.user.id, email: accepted.user.email, firstName: accepted.user.firstName, lastName: accepted.user.lastName, platformRole: accepted.user.platformRole, emailVerified: true },
    tenant: { slug: accepted.tenant.slug, name: accepted.tenant.name },
    role: accepted.role,
  });
});

authRouter.get("/me", requireSession, (request, response) => {
  const auth = getAuthContext(request);
  response.json({ user: auth.user, tenant: { slug: auth.tenant.slug, name: auth.tenant.name }, role: auth.role });
});

authRouter.get("/tenants", requireSession, async (request, response) => {
  const auth = getAuthContext(request);
  const memberships = await database.membership.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, createdAt: true, tenant: { select: { name: true, slug: true, status: true } } },
  });
  response.json({
    tenants: memberships.map((membership) => ({
      ...membership.tenant,
      role: membership.role,
      joinedAt: membership.createdAt,
      current: membership.tenant.slug === auth.tenant.slug,
    })),
  });
});

authRouter.post("/tenants", requireSession, async (request, response) => {
  const auth = getAuthContext(request);
  if (!auth.user.emailVerified) throw new HttpError(403, "Verificá tu email antes de crear otra tienda");
  const input = createTenantSchema.parse(request.body);
  try {
    const tenant = await database.$transaction(async (transaction) => {
      const created = await transaction.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          memberships: { create: { userId: auth.user.id, role: "OWNER" } },
          subscription: { create: { planId: "plan_free", status: "ACTIVE" } },
        },
      });
      await transaction.authSession.update({ where: { id: auth.sessionId }, data: { activeTenantId: created.id } });
      await transaction.user.update({ where: { id: auth.user.id }, data: { lastTenantId: created.id } });
      return created;
    });
    response.status(201).json({ tenant: { name: tenant.name, slug: tenant.slug, status: tenant.status }, role: "OWNER" });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") throw new HttpError(409, "Ese slug de tienda ya está ocupado");
    throw error;
  }
});

authRouter.post("/select-tenant", requireSession, async (request, response) => {
  const auth = getAuthContext(request);
  const input = selectTenantSchema.parse(request.body);
  const membership = await database.membership.findFirst({
    where: { userId: auth.user.id, tenant: { slug: input.tenantSlug, status: "ACTIVE" } },
    include: { tenant: true },
  });

  if (!membership) throw new HttpError(403, "No tenés acceso a esa tienda");

  await selectSessionTenant(auth.sessionId, auth.user.id, membership.tenantId);
  response.json({
    tenant: { slug: membership.tenant.slug, name: membership.tenant.name },
    role: membership.role,
  });
});
