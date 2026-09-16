import { HttpError } from "../errors.js";

// A subscription/invoice being authorized or processed is not proof of payment.
export function billingPaymentStatus(status?: string): "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED" {
  if (status === "approved") return "PAID";
  if (["rejected", "failed"].includes(status ?? "")) return "FAILED";
  if (["cancelled", "canceled"].includes(status ?? "")) return "CANCELED";
  if (["refunded", "charged_back"].includes(status ?? "")) return "REFUNDED";
  return "PENDING";
}

export function assertPaymentRecipient(collectorId: number | string | undefined, expectedId: string): void {
  if (collectorId == null || String(collectorId) !== expectedId) {
    throw new HttpError(409, "La cuenta receptora del pago no coincide con la tienda");
  }
}
