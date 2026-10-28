import type { CartItem, PublicStore, StorefrontProduct } from "./types";

export type CheckoutPaymentMethod = "BANK_TRANSFER" | "MERCADO_PAGO" | "CASH";

type Priceable = Pick<StorefrontProduct, "priceInCents" | "bankTransferPriceInCents" | "cashPriceInCents">;

export function specialUnitPrice(
  item: Priceable,
  method: CheckoutPaymentMethod,
  settings: PublicStore["settings"],
  hasCoupon = false,
) {
  if (hasCoupon && settings?.paymentDiscountsCombinableWithCoupons === false) return item.priceInCents;
  const explicit = method === "BANK_TRANSFER"
    ? item.bankTransferPriceInCents
    : method === "CASH"
      ? item.cashPriceInCents
      : null;
  const percentage = method === "BANK_TRANSFER"
    ? settings?.bankTransferDiscountPercentage ?? 0
    : method === "CASH"
      ? settings?.cashDiscountPercentage ?? 0
      : 0;
  const percentagePrice = percentage > 0
    ? Math.floor(item.priceInCents * (100 - percentage) / 100)
    : item.priceInCents;
  return Math.min(item.priceInCents, explicit ?? percentagePrice);
}

export function cartPaymentDiscount(
  items: CartItem[],
  method: CheckoutPaymentMethod,
  settings: PublicStore["settings"],
  hasCoupon: boolean,
) {
  return items.reduce((total, item) => {
    const priceable = item.selectedVariant
      ? {
          ...item.selectedVariant,
          bankTransferPriceInCents: item.selectedVariant.bankTransferPriceInCents ?? item.bankTransferPriceInCents,
          cashPriceInCents: item.selectedVariant.cashPriceInCents ?? item.cashPriceInCents,
        }
      : item;
    return total + (priceable.priceInCents - specialUnitPrice(priceable, method, settings, hasCoupon)) * item.quantity;
  }, 0);
}
