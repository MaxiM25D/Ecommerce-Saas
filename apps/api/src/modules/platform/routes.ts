import { Router, type NextFunction, type Request, type Response } from "express";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { getAuthContext, requireSession } from "../auth/session.js";
import { tenantIdSchema, updateSubscriptionSchema, updateTenantSchema } from "./schemas.js";

export const platformRouter = Router();

function requirePlatformAdmin(request: Request, _response: Response, next: NextFunction): void {
  try {
    if (getAuthContext(request).user.platformRole !== "SUPERADMIN") {
      throw new HttpError(403, "Esta sección es exclusiva del equipo de InfinityShop");
    }
    next();
  } catch (error) {
    next(error);
  }
}

platformRouter.use(requireSession, requirePlatformAdmin);

platformRouter.get("/overview", async (_request, response) => {
  const [tenants, activeTenants, users, subscriptions, billableSubscriptions] = await Promise.all([
    database.tenant.count(),
    database.tenant.count({ where: { status: "ACTIVE" } }),
    database.user.count(),
    database.subscription.groupBy({ by: ["status"], _count: true }),
    database.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      select: { plan: { select: { priceInCents: true } } },
    }),
  ]);
  const estimatedMonthlyRevenueInCents = billableSubscriptions.reduce(
    (total, subscription) => total + subscription.plan.priceInCents,
    0,
  );
  response.json({ tenants, activeTenants, users, subscriptions, estimatedMonthlyRevenueInCents });
});

platformRouter.get("/plans", async (_request, response) => {
  const plans = await database.plan.findMany({
    orderBy: { priceInCents: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });
  response.json({ plans });
});

platformRouter.get("/tenants", async (_request, response) => {
  const tenants = await database.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { memberships: true, products: true, orders: true } },
    },
  });
  response.json({ tenants });
});

platformRouter.patch("/tenants/:id", async (request, response) => {
  const auth = getAuthContext(request);
  const id = tenantIdSchema.parse(request.params.id);
  const input = updateTenantSchema.parse(request.body);
  if (id === auth.tenant.id && input.status === "SUSPENDED") {
    throw new HttpError(409, "No podés suspender la tienda usada por tu sesión actual");
  }
  const existing = await database.tenant.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Tenant no encontrado");
  const tenant = await database.tenant.update({ where: { id }, data: input });
  response.json({ tenant });
});

platformRouter.patch("/tenants/:id/subscription", async (request, response) => {
  const tenantId = tenantIdSchema.parse(request.params.id);
  const input = updateSubscriptionSchema.parse(request.body);
  const tenant = await database.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new HttpError(404, "Tenant no encontrado");

  const plan = input.planCode
    ? await database.plan.findUnique({ where: { code: input.planCode } })
    : null;
  if (input.planCode && (!plan || !plan.active)) throw new HttpError(404, "Plan no disponible");

  const subscription = await database.subscription.upsert({
    where: { tenantId },
    update: {
      ...(plan ? { planId: plan.id } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: input.cancelAtPeriodEnd } : {}),
    },
    create: {
      tenantId,
      planId: plan?.id ?? "plan_free",
      status: input.status ?? "ACTIVE",
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      currentPeriodFrom: new Date(),
    },
    include: { plan: true },
  });
  response.json({ subscription });
});
