import type { NotificationEvent } from "@infinityshop/database";

import { database } from "../database.js";
import { sendStoreNotification } from "./mail.js";

const defaults: Record<
  NotificationEvent,
  { subject: (store: string) => string; message: string }
> = {
  ORDER_CREATED: {
    subject: (store) => `Recibimos tu pedido en ${store}`,
    message:
      "Tu pedido fue creado correctamente. Te avisaremos cuando cambie su estado.",
  },
  ORDER_PAID: {
    subject: (store) => `Pago confirmado en ${store}`,
    message:
      "Confirmamos el pago de tu pedido. Ya estamos trabajando para prepararlo.",
  },
  ORDER_SHIPPED: {
    subject: (store) => `Tu pedido de ${store} fue enviado`,
    message: "Tu compra ya está en camino.",
  },
  CART_ABANDONED: {
    subject: (store) => `Tu carrito te espera en ${store}`,
    message:
      "Guardamos los productos que elegiste para que puedas completar tu compra.",
  },
};

export async function dispatchTenantNotification(input: {
  tenantId: string;
  event: NotificationEvent;
  recipient: string;
  actionUrl: string;
}): Promise<void> {
  const tenant = await database.tenant.findUnique({
    where: { id: input.tenantId },
    include: {
      settings: true,
      notificationRules: { where: { event: input.event } },
    },
  });
  if (!tenant) return;
  const rule = tenant.notificationRules[0];
  if (rule && !rule.active) return;
  const log = await database.notificationLog.create({
    data: {
      tenantId: input.tenantId,
      event: input.event,
      recipient: input.recipient,
      status: "SENDING",
    },
  });
  try {
    await sendStoreNotification({
      storeName: tenant.name,
      fromName: tenant.settings?.emailFromName,
      to: input.recipient,
      subject: rule?.subject ?? defaults[input.event].subject(tenant.name),
      message: rule?.message ?? defaults[input.event].message,
      actionUrl: input.actionUrl,
    });
    await database.notificationLog.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (error) {
    await database.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Error de envío",
      },
    });
  }
}
