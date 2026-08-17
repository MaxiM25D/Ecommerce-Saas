import nodemailer from "nodemailer";

import { environment } from "../config.js";
import { HttpError } from "../errors.js";

let transporter: nodemailer.Transporter | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTransporter(): nodemailer.Transporter {
  if (!environment.SMTP_HOST || !environment.SMTP_USER || !environment.SMTP_PASS) {
    throw new HttpError(503, "El servicio de correo no está configurado");
  }
  transporter ??= nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE,
    auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASS },
  });
  return transporter;
}

export async function sendShipmentEmail(input: {
  storeName: string;
  fromName?: string | null;
  storeSlug: string;
  customerName: string;
  customerEmail: string;
  orderNumber: number;
  carrier: string;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  estimatedDelivery?: Date | null;
}): Promise<void> {
  const orderUrl = `${environment.WEB_URL.replace(/\/$/, "")}/tienda/${encodeURIComponent(input.storeSlug)}`;
  const estimated = input.estimatedDelivery
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(input.estimatedDelivery)
    : null;
  const fromAddress = environment.SMTP_FROM ?? environment.SMTP_USER;
  const fromName = input.fromName?.trim() || input.storeName;
  const lines = [
    `Hola ${input.customerName},`,
    "",
    `Tu pedido #${input.orderNumber} de ${input.storeName} ya fue enviado.`,
    `Transportista: ${input.carrier}`,
    input.trackingCode ? `Código de seguimiento: ${input.trackingCode}` : null,
    estimated ? `Entrega estimada: ${estimated}` : null,
    input.trackingUrl ? `Seguimiento: ${input.trackingUrl}` : null,
    "",
    `Tienda: ${orderUrl}`,
  ].filter(Boolean).join("\n");

  await getTransporter().sendMail({
    from: `"${fromName.replaceAll('"', "")}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Tu pedido #${input.orderNumber} de ${input.storeName} fue enviado`,
    text: lines,
    html: `<div style="background:#f5f1ed;padding:28px;font-family:Arial,sans-serif;color:#262321"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e1dad3;padding:32px"><p style="font-size:24px;font-weight:bold">${escapeHtml(input.storeName)}</p><p>Hola ${escapeHtml(input.customerName)},</p><h1 style="font-size:26px">Tu pedido ya está en camino</h1><p><strong>Orden:</strong> #${input.orderNumber}</p><p><strong>Transportista:</strong> ${escapeHtml(input.carrier)}</p>${input.trackingCode ? `<p><strong>Seguimiento:</strong> ${escapeHtml(input.trackingCode)}</p>` : ""}${estimated ? `<p><strong>Entrega estimada:</strong> ${escapeHtml(estimated)}</p>` : ""}${input.trackingUrl ? `<p><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 18px;background:#1e1e1e;color:#fff;text-decoration:none;border-radius:6px">Seguir envío</a></p>` : ""}<p><a href="${escapeHtml(orderUrl)}">Visitar ${escapeHtml(input.storeName)}</a></p></div></div>`,
  });
}
