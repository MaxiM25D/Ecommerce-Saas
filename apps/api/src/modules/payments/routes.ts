import { Router } from "express";

import { environment } from "../../config.js";
import { HttpError } from "../../errors.js";
import {
  processMercadoPagoWebhook,
  validateMercadoPagoSignature,
} from "../../services/mercado-pago.js";

export const paymentRouter = Router();

paymentRouter.post("/mercadopago/webhook/:webhookKey", async (request, response) => {
  const type = String(request.query.type ?? request.body?.type ?? "");
  const dataId = String(request.query["data.id"] ?? request.body?.data?.id ?? "");
  if (type !== "payment" || !dataId) {
    response.status(200).json({ received: true, ignored: true });
    return;
  }
  if (!environment.MP_WEBHOOK_SECRET) throw new HttpError(503, "El webhook de Mercado Pago no está configurado");
  const valid = validateMercadoPagoSignature({
    dataId,
    xRequestId: request.get("x-request-id"),
    xSignature: request.get("x-signature"),
    secret: environment.MP_WEBHOOK_SECRET,
  });
  if (!valid) throw new HttpError(401, "Firma de webhook inválida");

  await processMercadoPagoWebhook(request.params.webhookKey, dataId);
  response.status(200).json({ received: true });
});
