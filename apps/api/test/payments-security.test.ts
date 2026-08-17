import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { validateMercadoPagoSignature } from "../src/services/mercado-pago.js";

test("valida la firma oficial del webhook de Mercado Pago", () => {
  const dataId = "123456789";
  const requestId = "request-abc";
  const timestamp = "1704908010";
  const secret = "webhook-secret-for-tests";
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const signature = createHmac("sha256", secret).update(manifest).digest("hex");

  assert.equal(validateMercadoPagoSignature({
    dataId,
    xRequestId: requestId,
    xSignature: `ts=${timestamp},v1=${signature}`,
    secret,
  }), true);
  assert.equal(validateMercadoPagoSignature({
    dataId,
    xRequestId: requestId,
    xSignature: `ts=${timestamp},v1=${"0".repeat(64)}`,
    secret,
  }), false);
});
