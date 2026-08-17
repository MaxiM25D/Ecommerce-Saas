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
    sameSite: "lax",
    secure: environment.NODE_ENV === "production",
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

  await database.authSession.create({
    data: { tokenHash: hashSessionToken(token), userId, activeTenantId, expiresAt },
  });
  setSessionCookie(response, token);
}

export async function destroySession(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[sessionCookieName] as string | undefined;

  if (token) {
    await database.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: environment.NODE_ENV === "production",
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

    const membership = await database.membership.findUnique({
      where: {
        tenantId_userId: { tenantId: session.activeTenantId, userId: session.userId },
      },
    });

    if (!membership) throw new HttpError(403, "La sesión no tiene acceso a esta tienda");
    if (session.activeTenant.status !== "ACTIVE") throw new HttpError(403, "La tienda está suspendida");

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
        id: session.activeTenant.id,
        slug: session.activeTenant.slug,
        name: session.activeTenant.name,
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
