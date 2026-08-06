import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { getAuthContext, createSession, destroySession, requireSession } from "./session.js";
import { loginSchema, registerSchema, selectTenantSchema } from "./schemas.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

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
        },
      });

      return { user, tenant };
    });

    await createSession(response, result.user.id, result.tenant.id);
    response.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      tenant: { slug: result.tenant.slug, name: result.tenant.name },
      role: "OWNER",
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

  const membership = user.memberships.find(({ tenant }) => tenant.status === "ACTIVE");
  if (!membership) throw new HttpError(403, "No tenés acceso a una tienda activa");

  await createSession(response, user.id, membership.tenantId);
  response.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    tenant: { slug: membership.tenant.slug, name: membership.tenant.name },
    role: membership.role,
  });
});

authRouter.post("/logout", async (request, response) => {
  await destroySession(request, response);
  response.status(204).send();
});

authRouter.get("/me", requireSession, (request, response) => {
  const auth = getAuthContext(request);
  response.json({ user: auth.user, tenant: { slug: auth.tenant.slug, name: auth.tenant.name }, role: auth.role });
});

authRouter.post("/select-tenant", requireSession, async (request, response) => {
  const auth = getAuthContext(request);
  const input = selectTenantSchema.parse(request.body);
  const membership = await database.membership.findFirst({
    where: { userId: auth.user.id, tenant: { slug: input.tenantSlug, status: "ACTIVE" } },
    include: { tenant: true },
  });

  if (!membership) throw new HttpError(403, "No tenés acceso a esa tienda");

  await database.authSession.update({
    where: { id: auth.sessionId },
    data: { activeTenantId: membership.tenantId },
  });
  response.json({
    tenant: { slug: membership.tenant.slug, name: membership.tenant.name },
    role: membership.role,
  });
});
