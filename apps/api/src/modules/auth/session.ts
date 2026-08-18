import { createHash, randomBytes } from "node:crypto";

import type { NextFunction, Request, RequestHandler, Response } from "express";

import { environment } from "../../config.js";
import { database } from "../../database.js";
import { HttpError } from "../../errors.js";

export const sessionCookieName = "infinityshop_session";

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response: Response, token: string): void {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: environment.SESSION_COOKIE_SAME_SITE,
    secure: environment.NODE_ENV === "production",
    domain: environment.SESSION_COOKIE_DOMAIN,
    maxAge: environment.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function createSession(
  response: Response,
  userId: string,
  activeTenantId: string,
): Promise<void> {
  const membership = await database.membership.findUnique({
    where: { tenantId_userId: { tenantId: activeTenantId, userId } },
  });

  if (!membership) throw new HttpError(403, "El usuario no pertenece a la tienda");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + environment.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await database.$transaction([
    database.authSession.create({ data: { tokenHash: hashSessionToken(token), userId, activeTenantId, expiresAt } }),
    database.user.update({ where: { id: userId }, data: { lastTenantId: activeTenantId } }),
  ]);
  setSessionCookie(response, token);
}

export async function selectSessionTenant(sessionId: string, userId: string, tenantId: string): Promise<void> {
  const membership = await database.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
  if (!membership) throw new HttpError(403, "No tenés acceso a esa tienda");
  await database.$transaction([
    database.authSession.update({ where: { id: sessionId }, data: { activeTenantId: tenantId } }),
    database.user.update({ where: { id: userId }, data: { lastTenantId: tenantId } }),
  ]);
}

export async function destroySession(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[sessionCookieName] as string | undefined;

  if (token) {
    await database.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: environment.SESSION_COOKIE_SAME_SITE,
    secure: environment.NODE_ENV === "production",
    domain: environment.SESSION_COOKIE_DOMAIN,
    path: "/",
  });
}

export async function requireSession(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = request.cookies?.[sessionCookieName] as string | undefined;
    if (!token) throw new HttpError(401, "Iniciá sesión para continuar");

    const session = await database.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true, activeTenant: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) await database.authSession.delete({ where: { id: session.id } });
      throw new HttpError(401, "La sesión venció o no es válida");
    }

    let activeTenant = session.activeTenant;
    let membership = await database.membership.findUnique({
      where: {
        tenantId_userId: { tenantId: session.activeTenantId, userId: session.userId },
      },
    });

    if (!membership || activeTenant.status !== "ACTIVE") {
      const fallback = await database.membership.findFirst({
        where: { userId: session.userId, tenant: { status: "ACTIVE" } },
        include: { tenant: true },
        orderBy: { createdAt: "asc" },
      });
      if (!fallback) throw new HttpError(403, "No tenés acceso a una tienda activa");
      membership = fallback;
      activeTenant = fallback.tenant;
      await database.$transaction([
        database.authSession.update({ where: { id: session.id }, data: { activeTenantId: fallback.tenantId } }),
        database.user.update({ where: { id: session.userId }, data: { lastTenantId: fallback.tenantId } }),
      ]);
    }

    request.auth = {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        platformRole: session.user.platformRole,
        emailVerified: Boolean(session.user.emailVerifiedAt),
      },
      tenant: {
        id: activeTenant.id,
        slug: activeTenant.slug,
        name: activeTenant.name,
      },
      role: membership.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthContext(request: Request): NonNullable<Request["auth"]> {
  if (!request.auth) throw new HttpError(401, "Iniciá sesión para continuar");
  return request.auth;
}

export function requireRoles(
  ...allowedRoles: Array<NonNullable<Request["auth"]>["role"]>
): RequestHandler {
  return (request, _response, next) => {
    try {
      const auth = getAuthContext(request);
      if (!allowedRoles.includes(auth.role)) {
        throw new HttpError(403, "No tenés permisos para realizar esta acción");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
