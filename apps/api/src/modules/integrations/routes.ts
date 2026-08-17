import { Router } from "express";
import { z } from "zod";

import { environment } from "../../config.js";
import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { getAuthContext, requireRoles, requireSession } from "../auth/session.js";
import {
  completeMercadoPagoAuthorization,
  createMercadoPagoAuthorization,
} from "../../services/mercado-pago.js";

export const integrationRouter = Router();
export const adminIntegrationRouter = Router();

const callbackSchema = z.object({ code: z.string().min(1), state: z.string().min(20) });

integrationRouter.get("/mercadopago/callback", async (request, response) => {
  try {
    const { code, state } = callbackSchema.parse(request.query);
    await completeMercadoPagoAuthorization(code, state);
    response.redirect(`${environment.WEB_URL.replace(/\/$/, "")}/admin?tab=store&mercadopago=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo conectar Mercado Pago";
    response.redirect(`${environment.WEB_URL.replace(/\/$/, "")}/admin?tab=store&mercadopago=error&message=${encodeURIComponent(message)}`);
  }
});

adminIntegrationRouter.use(requireSession);

adminIntegrationRouter.get("/mercadopago", async (request, response) => {
  const { tenant } = getAuthContext(request);
  const connection = await database.mercadoPagoConnection.findUnique({
    where: { tenantId: tenant.id },
    select: { mercadoPagoUserId: true, liveMode: true, connectedAt: true, updatedAt: true },
  });
  response.json({
    configured: Boolean(environment.MP_CLIENT_ID && environment.MP_CLIENT_SECRET && environment.MP_TOKEN_ENCRYPTION_KEY),
    connection,
  });
});

adminIntegrationRouter.post("/mercadopago/authorize", requireRoles("OWNER", "ADMIN"), async (request, response) => {
  const { tenant, user } = getAuthContext(request);
  const authorizationUrl = await createMercadoPagoAuthorization(tenant.id, user.id);
  response.json({ authorizationUrl });
});

adminIntegrationRouter.delete("/mercadopago", requireRoles("OWNER"), async (request, response) => {
  const { tenant } = getAuthContext(request);
  const result = await database.mercadoPagoConnection.deleteMany({ where: { tenantId: tenant.id } });
  if (result.count === 0) throw new HttpError(404, "La tienda no tiene Mercado Pago conectado");
  response.status(204).send();
});
