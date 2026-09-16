import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPaymentRecipient, billingPaymentStatus } from "../src/services/payment-validation.js";

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
