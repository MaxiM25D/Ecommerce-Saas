import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPaymentRecipient, billingPaymentStatus } from "../src/services/payment-validation.js";
import { applyPaymentPricing } from "../src/services/payment-pricing.js";

test("authorization and invoice processing do not prove money was collected", () => {
  for (const status of [undefined, "pending", "authorized", "processed", "in_process", "unknown"]) {
    assert.equal(billingPaymentStatus(status), "PENDING");
  }
  assert.equal(billingPaymentStatus("approved"), "PAID");
});

test("rejection, cancellation and refunds cannot activate a paid invoice", () => {
  assert.equal(billingPaymentStatus("rejected"), "FAILED");
  assert.equal(billingPaymentStatus("cancelled"), "CANCELED");
  assert.equal(billingPaymentStatus("refunded"), "REFUNDED");
  assert.equal(billingPaymentStatus("charged_back"), "REFUNDED");
});

test("payment must belong to the connected seller, not another tenant", () => {
  assert.doesNotThrow(() => assertPaymentRecipient(12345, "12345"));
  assert.throws(() => assertPaymentRecipient(54321, "12345"));
  assert.throws(() => assertPaymentRecipient(undefined, "12345"));
});

test("payment pricing applies product overrides before store percentages", () => {
  const lines = applyPaymentPricing({
    lines: [
      { quantity: 2, listUnitPriceInCents: 100_000, bankTransferPriceInCents: 82_000, cashPriceInCents: null },
      { quantity: 1, listUnitPriceInCents: 50_000, bankTransferPriceInCents: null, cashPriceInCents: null },
    ],
    paymentMethod: "BANK_TRANSFER",
    settings: { bankTransferDiscountPercentage: 10, cashDiscountPercentage: 5, paymentDiscountsCombinableWithCoupons: true },
    hasCoupon: false,
  });
  assert.deepEqual(lines.map(({ unitPriceInCents }) => unitPriceInCents), [82_000, 45_000]);
  assert.equal(lines.reduce((sum, line) => sum + line.paymentDiscountInCents, 0), 41_000);
  assert.deepEqual(lines.map(({ pricingSource }) => pricingSource), ["PRODUCT_OVERRIDE", "STORE_PERCENTAGE"]);
});

test("payment pricing preserves list price when coupons are not combinable", () => {
  const [line] = applyPaymentPricing({
    lines: [{ quantity: 1, listUnitPriceInCents: 100_000, bankTransferPriceInCents: null, cashPriceInCents: 75_000 }],
    paymentMethod: "CASH",
    settings: { bankTransferDiscountPercentage: 0, cashDiscountPercentage: 10, paymentDiscountsCombinableWithCoupons: false },
    hasCoupon: true,
  });
  assert.equal(line?.unitPriceInCents, 100_000);
  assert.equal(line?.paymentDiscountInCents, 0);
});
