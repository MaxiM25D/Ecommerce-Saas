import { Router } from "express";

import { environment } from "../../config.js";
import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { validateMercadoPagoSignature } from "../../services/mercado-pago.js";
import {
  cancelBillingSubscription,
  getBillingOverview,
  startBillingCheckout,
  syncBillingSubscription,
  syncProviderInvoice,
  syncProviderSubscription,
} from "../../services/saas-billing.js";
import { getProviderSubscription } from "../../services/saas-billing-provider.js";
import { getAuthContext, requireRoles, requireSession } from "../auth/session.js";
import { billingWebhookSchema, cancelBillingSchema, selectBillingPlanSchema } from "./schemas.js";

export const billingRouter = Router();

billingRouter.post("/mercadopago/webhook", async (request, response) => {
  if (!environment.SAAS_MP_WEBHOOK_SECRET) throw new HttpError(503, "Webhook de facturación no configurado");
  const input = billingWebhookSchema.parse(request.body);
  const dataId = String(request.query["data.id"] ?? input.data.id).toLowerCase();
  if (dataId !== input.data.id.toLowerCase()) throw new HttpError(400, "El recurso notificado no coincide");
  const requestId = request.get("x-request-id");
  if (!validateMercadoPagoSignature({ dataId, xRequestId: requestId, xSignature: request.get("x-signature"), secret: environment.SAAS_MP_WEBHOOK_SECRET })) {
    throw new HttpError(401, "Firma de webhook inválida");
  }
  // La URL registrada usa setup=true para validar firma y conectividad con
  // los identificadores ficticios del simulador de Mercado Pago.
  if (request.query.setup === "true") {
    response.status(200).json({ received: true, setup: true });
    return;
  }
  const eventId = `MERCADO_PAGO:${requestId}`;
  if (await database.billingWebhookEvent.findUnique({ where: { id: eventId } })) {
    response.status(200).json({ received: true, duplicate: true });
    return;
  }
  if (input.type === "subscription_preapproval") {
    await syncProviderSubscription(await getProviderSubscription(input.data.id));
  } else if (input.type === "subscription_authorized_payment") {
    await syncProviderInvoice(input.data.id);
  } else {
    response.status(202).json({ received: true, ignored: true });
    return;
  }
  await database.billingWebhookEvent.create({ data: { id: eventId, provider: "MERCADO_PAGO", eventType: input.type, resourceId: input.data.id } });
  response.json({ received: true });
});

billingRouter.use(requireSession);

billingRouter.get("/overview", async (request, response) => {
  response.json(await getBillingOverview(getAuthContext(request).tenant.id));
});

billingRouter.post("/checkout", requireRoles("OWNER"), async (request, response) => {
  const auth = getAuthContext(request);
  const input = selectBillingPlanSchema.parse(request.body);
  response.json(await startBillingCheckout({ tenantId: auth.tenant.id, tenantName: auth.tenant.name, payerEmail: auth.user.email, planCode: input.planCode }));
});

billingRouter.post("/sync", requireRoles("OWNER"), async (request, response) => {
  response.json({ subscription: await syncBillingSubscription(getAuthContext(request).tenant.id) });
});

billingRouter.post("/cancel", requireRoles("OWNER"), async (request, response) => {
  const input = cancelBillingSchema.parse(request.body);
  response.json({ subscription: await cancelBillingSubscription(getAuthContext(request).tenant.id, input.immediately) });
});

billingRouter.post("/resume", requireRoles("OWNER"), async (request, response) => {
  const tenantId = getAuthContext(request).tenant.id;
  const subscription = await database.subscription.update({ where: { tenantId }, data: { cancelAtPeriodEnd: false }, include: { plan: true } });
  response.json({ subscription });
});
