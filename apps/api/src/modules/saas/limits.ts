import type { NextFunction, Request, Response } from "express";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { getAuthContext } from "../auth/session.js";

export async function getSubscriptionContext(tenantId: string) {
  const subscription = await database.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!subscription) throw new HttpError(409, "La tienda todavía no tiene un plan asignado");
  return subscription;
}

export function assertSubscriptionWritable(status: string, trialEndsAt?: Date | null): void {
  if (status === "TRIALING" && (!trialEndsAt || trialEndsAt <= new Date())) {
    throw new HttpError(402, "El período de prueba terminó; elegí un plan para continuar");
  }
  if (!new Set(["ACTIVE", "TRIALING"]).has(status)) {
    throw new HttpError(402, "La suscripción de la tienda necesita regularizarse para continuar");
  }
}

export async function requireWritableSubscription(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenant } = getAuthContext(request);
    const subscription = await getSubscriptionContext(tenant.id);
    assertSubscriptionWritable(subscription.status, subscription.trialEndsAt);
    next();
  } catch (error) {
    next(error);
  }
}

export function monthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function newTrialSubscription(planId: string, trialDays: number, now = new Date()) {
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  return { planId, status: "TRIALING" as const, trialEndsAt, currentPeriodFrom: now, currentPeriodTo: trialEndsAt };
}
