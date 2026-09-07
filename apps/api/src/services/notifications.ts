import type { NotificationEvent } from "@infinityshop/database";

import { environment } from "../config.js";
import { database } from "../database.js";
import { sendStoreNotification } from "./mail.js";

const defaults: Record<NotificationEvent, { subject: (store: string) => string; message: string }> = {
  ORDER_CREATED: { subject: (store) => `Recibimos tu pedido en ${store}`, message: "Tu pedido fue creado correctamente. Te avisaremos cuando cambie su estado." },
  ORDER_PAID: { subject: (store) => `Pago confirmado en ${store}`, message: "Confirmamos el pago de tu pedido. Ya estamos trabajando para prepararlo." },
  ORDER_SHIPPED: { subject: (store) => `Tu pedido de ${store} fue enviado`, message: "Tu compra ya está en camino." },
  CART_ABANDONED: { subject: (store) => `Tu carrito te espera en ${store}`, message: "Guardamos los productos que elegiste para que puedas completar tu compra." },
};

export async function dispatchTenantNotification(input: { tenantId: string; event: NotificationEvent; recipient: string; actionUrl: string }): Promise<void> {
  const tenant = await database.tenant.findUnique({
    where: { id: input.tenantId },
    include: { notificationRules: { where: { event: input.event } } },
  });
  if (!tenant) return;
  const rule = tenant.notificationRules[0];
  if (rule && !rule.active) return;
  await database.notificationLog.create({
    data: {
      tenantId: input.tenantId,
      event: input.event,
      recipient: input.recipient,
      subject: rule?.subject ?? defaults[input.event].subject(tenant.name),
      message: rule?.message ?? defaults[input.event].message,
      actionUrl: input.actionUrl,
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });
}

export async function processPendingNotifications(batchSize = 20): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  await database.notificationLog.updateMany({
    where: {
      status: "SENDING",
      OR: [
        { lockedAt: null },
        { lockedAt: { lte: new Date(now.getTime() - 10 * 60_000) } },
      ],
      attempts: { lt: environment.EMAIL_QUEUE_MAX_ATTEMPTS },
    },
    data: { status: "FAILED", lockedAt: null, nextAttemptAt: now, error: "Envío interrumpido; se reintentará" },
  });
  const pending = await database.notificationLog.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: environment.EMAIL_QUEUE_MAX_ATTEMPTS }, nextAttemptAt: { lte: now }, subject: { not: "" } },
    include: { tenant: { include: { settings: true } } },
    orderBy: { nextAttemptAt: "asc" },
    take: batchSize,
  });
  let sent = 0;
  let failed = 0;
  for (const notification of pending) {
    const claimed = await database.notificationLog.updateMany({
      where: { id: notification.id, status: { in: ["PENDING", "FAILED"] }, attempts: notification.attempts },
      data: { status: "SENDING", lockedAt: new Date(), attempts: { increment: 1 }, error: null },
    });
    if (claimed.count !== 1) continue;
    const attempt = notification.attempts + 1;
    try {
      await sendStoreNotification({
        storeName: notification.tenant.name,
        fromName: notification.tenant.settings?.emailFromName,
        to: notification.recipient,
        subject: notification.subject,
        message: notification.message,
        actionUrl: notification.actionUrl,
      });
      await database.notificationLog.update({ where: { id: notification.id }, data: { status: "SENT", sentAt: new Date(), lockedAt: null, error: null, actionUrl: "" } });
      sent += 1;
    } catch (error) {
      const delayMinutes = Math.min(60, 2 ** Math.max(0, attempt - 1));
      await database.notificationLog.update({
        where: { id: notification.id },
        data: { status: "FAILED", lockedAt: null, nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000), error: error instanceof Error ? error.message.slice(0, 300) : "Error de envío" },
      });
      failed += 1;
    }
  }
  return { sent, failed };
}
