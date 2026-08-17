import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { database } from "../database.js";
import { environment } from "../config.js";
import { HttpError } from "../errors.js";
import { decryptSecret, encryptSecret, hashOpaqueToken } from "./secret-vault.js";
import { releaseReservedOrder } from "./orders.js";

const authorizationEndpoint = "https://auth.mercadopago.com/authorization";
const apiEndpoint = "https://api.mercadopago.com";

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id: number;
  public_key?: string;
};

type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount: number;
  currency_id: string;
};

function oauthConfiguration() {
  if (!environment.MP_CLIENT_ID || !environment.MP_CLIENT_SECRET) {
    throw new HttpError(503, "Configurá MP_CLIENT_ID y MP_CLIENT_SECRET para conectar Mercado Pago");
  }
  return {
    clientId: environment.MP_CLIENT_ID,
    clientSecret: environment.MP_CLIENT_SECRET,
    redirectUri: `${environment.API_PUBLIC_URL.replace(/\/$/, "")}/api/integrations/mercadopago/callback`,
  };
}

async function mercadoPagoRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiEndpoint}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as (T & { message?: string }) | null;
  if (!response.ok || !body) {
    throw new HttpError(502, body?.message ?? "Mercado Pago no pudo procesar la solicitud");
  }
  return body;
}

async function exchangeToken(body: Record<string, string>): Promise<OAuthTokenResponse> {
  const response = await fetch(`${apiEndpoint}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as (OAuthTokenResponse & { message?: string }) | null;
  if (!response.ok || !result?.access_token) {
    throw new HttpError(502, result?.message ?? "No se pudo autorizar la cuenta de Mercado Pago");
  }
  return result;
}

export async function createMercadoPagoAuthorization(tenantId: string, userId: string): Promise<string> {
  const { clientId, redirectUri } = oauthConfiguration();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  await database.mercadoPagoOAuthState.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await database.mercadoPagoOAuthState.create({
    data: {
      tenantId,
      userId,
      stateHash: hashOpaqueToken(state),
      codeVerifierEncrypted: encryptSecret(verifier),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function completeMercadoPagoAuthorization(code: string, state: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = oauthConfiguration();
  const oauthState = await database.mercadoPagoOAuthState.findUnique({
    where: { stateHash: hashOpaqueToken(state) },
    include: { tenant: { select: { slug: true } } },
  });
  if (!oauthState || oauthState.expiresAt <= new Date()) {
    throw new HttpError(400, "La autorización venció o no es válida");
  }
  await database.mercadoPagoOAuthState.delete({ where: { id: oauthState.id } });

  const token = await exchangeToken({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: decryptSecret(oauthState.codeVerifierEncrypted),
  });
  if (!token.refresh_token) throw new HttpError(502, "Mercado Pago no devolvió un refresh token");

  await database.mercadoPagoConnection.upsert({
    where: { tenantId: oauthState.tenantId },
    update: {
      mercadoPagoUserId: String(token.user_id),
      accessTokenEncrypted: encryptSecret(token.access_token),
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      publicKey: token.public_key ?? null,
      liveMode: token.access_token.startsWith("APP_USR"),
      connectedAt: new Date(),
    },
    create: {
      tenantId: oauthState.tenantId,
      mercadoPagoUserId: String(token.user_id),
      accessTokenEncrypted: encryptSecret(token.access_token),
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      publicKey: token.public_key ?? null,
      liveMode: token.access_token.startsWith("APP_USR"),
      webhookKey: randomBytes(24).toString("base64url"),
    },
  });
  return oauthState.tenant.slug;
}

async function getAccessToken(tenantId: string): Promise<{ accessToken: string; webhookKey: string }> {
  const connection = await database.mercadoPagoConnection.findUnique({ where: { tenantId } });
  if (!connection) throw new HttpError(409, "La tienda todavía no conectó Mercado Pago");
  if (!connection.accessTokenExpiresAt || connection.accessTokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return { accessToken: decryptSecret(connection.accessTokenEncrypted), webhookKey: connection.webhookKey };
  }

  const { clientId, clientSecret } = oauthConfiguration();
  const token = await exchangeToken({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: decryptSecret(connection.refreshTokenEncrypted),
  });
  const updated = await database.mercadoPagoConnection.update({
    where: { tenantId },
    data: {
      accessTokenEncrypted: encryptSecret(token.access_token),
      ...(token.refresh_token ? { refreshTokenEncrypted: encryptSecret(token.refresh_token) } : {}),
      accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    },
  });
  return { accessToken: token.access_token, webhookKey: updated.webhookKey };
}

export async function createCheckoutPreference(orderId: string, tenantId: string): Promise<{
  preferenceId: string;
  checkoutUrl: string;
}> {
  const order = await database.order.findFirst({
    where: { id: orderId, tenantId, paymentMethod: "MERCADO_PAGO", stockStatus: "RESERVED" },
    include: { items: true, tenant: { select: { slug: true } } },
  });
  if (!order) throw new HttpError(404, "Pedido pendiente no encontrado");
  if (order.stockExpiresAt && order.stockExpiresAt <= new Date()) {
    await releaseReservedOrder(tenantId, orderId, "Reserva de Mercado Pago vencida");
    throw new HttpError(409, "La reserva de stock venció");
  }

  const existing = await database.paymentAttempt.findFirst({ where: { tenantId, orderId, provider: "MERCADO_PAGO" } });
  if (existing?.preferenceId && existing.checkoutUrl) {
    return { preferenceId: existing.preferenceId, checkoutUrl: existing.checkoutUrl };
  }
  const attempt = existing ?? await database.paymentAttempt.create({
    data: {
      tenantId,
      orderId,
      provider: "MERCADO_PAGO",
      idempotencyKey: randomUUID(),
      amountInCents: order.totalInCents,
      currency: order.currency,
    },
  });
  const { accessToken, webhookKey } = await getAccessToken(tenantId);
  const frontendUrl = environment.WEB_URL.replace(/\/$/, "");
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(frontendUrl).hostname);
  const body: Record<string, unknown> = {
    items: order.items.map((item) => ({
      id: item.productId ?? item.sku,
      title: item.productName,
      quantity: item.quantity,
      currency_id: order.currency,
      unit_price: item.unitPriceInCents / 100,
    })),
    payer: { email: order.customerEmail },
    external_reference: attempt.id,
    metadata: { payment_attempt_id: attempt.id },
    notification_url: `${environment.API_PUBLIC_URL.replace(/\/$/, "")}/api/payments/mercadopago/webhook/${webhookKey}?source_news=webhooks`,
  };
  if (order.stockExpiresAt) {
    body.expires = true;
    body.expiration_date_to = order.stockExpiresAt.toISOString();
  }
  if (!isLocal) {
    const returnUrl = `${frontendUrl}/tienda/${encodeURIComponent(order.tenant.slug)}/pedido/${encodeURIComponent(order.id)}`;
    body.back_urls = { success: `${returnUrl}?payment=success`, pending: `${returnUrl}?payment=pending`, failure: `${returnUrl}?payment=failure` };
    body.auto_return = "approved";
  }

  const preference = await mercadoPagoRequest<{
    id: string;
    init_point: string;
    sandbox_init_point?: string;
  }>("/checkout/preferences", accessToken, {
    method: "POST",
    headers: { "X-Idempotency-Key": attempt.idempotencyKey },
    body: JSON.stringify(body),
  });
  await database.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      preferenceId: preference.id,
      checkoutUrl: preference.init_point,
      sandboxCheckoutUrl: preference.sandbox_init_point ?? null,
    },
  });
  return { preferenceId: preference.id, checkoutUrl: preference.init_point };
}

export function validateMercadoPagoSignature(input: {
  dataId: string;
  xRequestId: string | undefined;
  xSignature: string | undefined;
  secret: string;
}): boolean {
  if (!input.xRequestId || !input.xSignature) return false;
  const entries = Object.fromEntries(input.xSignature.split(",").map((part) => part.trim().split("=", 2)));
  const timestamp = entries.ts;
  const signature = entries.v1;
  if (!timestamp || !signature) return false;
  const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${timestamp};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function normalizePaymentStatus(status: string): "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED" {
  if (status === "approved") return "APPROVED";
  if (status === "rejected") return "REJECTED";
  if (status === "cancelled" || status === "canceled") return "CANCELLED";
  if (status === "refunded" || status === "charged_back") return "REFUNDED";
  return "PENDING";
}

export async function processMercadoPagoWebhook(webhookKey: string, paymentId: string): Promise<void> {
  const connection = await database.mercadoPagoConnection.findUnique({ where: { webhookKey } });
  if (!connection) throw new HttpError(404, "Conexión de Mercado Pago no encontrada");
  const { accessToken } = await getAccessToken(connection.tenantId);
  const payment = await mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, accessToken);
  if (!payment.external_reference) throw new HttpError(400, "El pago no tiene una referencia válida");

  const attempt = await database.paymentAttempt.findFirst({
    where: { id: payment.external_reference, tenantId: connection.tenantId },
    include: { order: { include: { items: { select: { productId: true, quantity: true } } } } },
  });
  if (!attempt) throw new HttpError(404, "Intento de pago no encontrado");
  if (Math.round(payment.transaction_amount * 100) !== attempt.amountInCents || payment.currency_id !== attempt.currency) {
    throw new HttpError(409, "El importe o la moneda no coincide con el pedido");
  }
  const status = normalizePaymentStatus(payment.status);

  await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Order" WHERE id = ${attempt.orderId} AND "tenantId" = ${attempt.tenantId} FOR UPDATE`;
    const current = await transaction.order.findFirst({
      where: { id: attempt.orderId, tenantId: attempt.tenantId },
      include: { items: { select: { productId: true, quantity: true } } },
    });
    if (!current) throw new HttpError(404, "Pedido no encontrado");
    await transaction.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        externalPaymentId: String(payment.id),
        externalStatus: payment.status,
        statusDetail: payment.status_detail ?? null,
        status,
      },
    });

    if (status === "APPROVED") {
      const statusChanged = current.status === "PENDING";
      await transaction.order.update({
        where: { id: current.id },
        data: {
          paymentStatus: "APPROVED",
          stockStatus: "COMMITTED",
          stockExpiresAt: null,
          ...(statusChanged ? { status: "CONFIRMED" } : {}),
        },
      });
      if (statusChanged) await transaction.orderStatusHistory.create({
        data: { tenantId: current.tenantId, orderId: current.id, status: "CONFIRMED", note: "Pago aprobado por Mercado Pago" },
      });
      return;
    }

    await transaction.order.update({ where: { id: current.id }, data: { paymentStatus: status } });
  });

  if (["CANCELLED", "REFUNDED"].includes(status)) {
    await releaseReservedOrder(attempt.tenantId, attempt.orderId, `Pago ${payment.status} en Mercado Pago`, true);
  }
}
