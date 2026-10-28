type SupportedPaymentMethod = "BANK_TRANSFER" | "CASH" | string;

export type PaymentPricingSettings = {
  bankTransferDiscountPercentage: number;
  cashDiscountPercentage: number;
  paymentDiscountsCombinableWithCoupons: boolean;
};

export type PaymentPricedLine<T> = T & {
  listUnitPriceInCents: number;
  unitPriceInCents: number;
  paymentDiscountInCents: number;
  pricingSource: "LIST" | "STORE_PERCENTAGE" | "PRODUCT_OVERRIDE";
};

export function paymentMethodDiscountPercentage(
  paymentMethod: SupportedPaymentMethod,
  settings: PaymentPricingSettings,
): number {
  if (paymentMethod === "BANK_TRANSFER") return settings.bankTransferDiscountPercentage;
  if (paymentMethod === "CASH") return settings.cashDiscountPercentage;
  return 0;
}

export function applyPaymentPricing<T extends {
  quantity: number;
  listUnitPriceInCents: number;
  bankTransferPriceInCents: number | null;
  cashPriceInCents: number | null;
}>(input: {
  lines: T[];
  paymentMethod: SupportedPaymentMethod;
  settings: PaymentPricingSettings;
  hasCoupon: boolean;
}): Array<PaymentPricedLine<T>> {
  const percentage = paymentMethodDiscountPercentage(input.paymentMethod, input.settings);
  const canApply = !input.hasCoupon || input.settings.paymentDiscountsCombinableWithCoupons;
  return input.lines.map((line) => {
    const explicitPrice = input.paymentMethod === "BANK_TRANSFER"
      ? line.bankTransferPriceInCents
      : input.paymentMethod === "CASH"
        ? line.cashPriceInCents
        : null;
    const percentagePrice = percentage > 0
      ? Math.floor(line.listUnitPriceInCents * (100 - percentage) / 100)
      : line.listUnitPriceInCents;
    const unitPriceInCents = canApply
      ? Math.min(line.listUnitPriceInCents, explicitPrice ?? percentagePrice)
      : line.listUnitPriceInCents;
    return {
      ...line,
      unitPriceInCents,
      paymentDiscountInCents: (line.listUnitPriceInCents - unitPriceInCents) * line.quantity,
      pricingSource: unitPriceInCents === line.listUnitPriceInCents
        ? "LIST"
        : explicitPrice !== null
          ? "PRODUCT_OVERRIDE"
          : "STORE_PERCENTAGE",
    };
  });
}
