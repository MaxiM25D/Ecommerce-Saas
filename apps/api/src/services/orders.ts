import { database } from "../database.js";
import { HttpError } from "../errors.js";
import { hashOpaqueToken } from "./secret-vault.js";

export function orderTokenMatches(
  token: string | undefined,
  expectedHash: string | null,
): boolean {
  return Boolean(
    token && expectedHash && hashOpaqueToken(token) === expectedHash,
  );
}

export async function requirePublicOrder(
  tenantId: string,
  orderId: string,
  token: string | undefined,
) {
  const order = await database.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      paymentReceipt: true,
      shipment: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || !orderTokenMatches(token, order.publicTokenHash)) {
    throw new HttpError(404, "Pedido no encontrado");
  }
  return order;
}

export async function releaseReservedOrder(
  tenantId: string,
  orderId: string,
  note: string,
  includeCommitted = false,
): Promise<boolean> {
  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    const order = await transaction.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: { select: { productId: true, variantId: true, quantity: true } },
      },
    });
    if (!order || order.stockStatus === "RELEASED") return false;
    if (
      order.stockStatus === "COMMITTED" &&
      (!includeCommitted ||
        !["PENDING", "CONFIRMED", "PREPARING"].includes(order.status))
    )
      return false;

    for (const item of order.items) {
      if (item.variantId) {
        await transaction.productVariant.updateMany({
          where: { id: item.variantId, tenantId },
          data: { stock: { increment: item.quantity } },
        });
      } else if (item.productId) {
        await transaction.product.updateMany({
          where: { id: item.productId, tenantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    await transaction.order.update({
      where: { id: order.id },
      data: {
        stockStatus: "RELEASED",
        stockExpiresAt: null,
        status: "CANCELLED",
        paymentStatus:
          order.paymentStatus === "PENDING" ? "CANCELLED" : order.paymentStatus,
      },
    });
    await transaction.orderStatusHistory.create({
      data: { tenantId, orderId, status: "CANCELLED", note },
    });
    return true;
  });
}

export async function releaseExpiredReservations(): Promise<number> {
  const expired = await database.order.findMany({
    where: { stockStatus: "RESERVED", stockExpiresAt: { lte: new Date() } },
    select: { id: true, tenantId: true },
    take: 100,
  });
  const results = await Promise.all(
    expired.map(({ id, tenantId }) =>
      releaseReservedOrder(tenantId, id, "Reserva vencida"),
    ),
  );
  return results.filter(Boolean).length;
}
