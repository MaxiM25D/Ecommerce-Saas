import assert from "node:assert/strict";
import { test } from "node:test";

import { calculateShippingQuotes, type ShippingQuoteZone } from "../src/services/shipping-quotes.js";

function method(overrides: Partial<ShippingQuoteZone["methods"][number]> = {}): ShippingQuoteZone["methods"][number] {
  return {
    id: "method-1", name: "Envío estándar", pricingType: "FIXED", priceInCents: 500_000, rateRules: null,
    minimumOrderInCents: null, maximumOrderInCents: null, minimumWeightInGrams: null, maximumWeightInGrams: null,
    excludedProductIds: [], excludedCategoryIds: [], estimatedDays: null, estimatedDaysMin: 2, estimatedDaysMax: 4,
    preparationDaysMin: 1, preparationDaysMax: 2, freeShippingThresholdInCents: null,
    carrierCode: "CUSTOM", carrierName: "Transporte de prueba", trackingUrlTemplate: null, ...overrides,
  };
}

function zone(overrides: Partial<ShippingQuoteZone> = {}): ShippingQuoteZone {
  return { id: "zone-1", name: "Nacional", countryCode: "AR", provinces: [], cities: [], postalPrefixes: [], postalRanges: null, methods: [method()], ...overrides };
}

const completeLine = { productId: "product-1", categoryId: "category-1", quantity: 1, weightInGrams: 2_000, widthInMm: 400, heightInMm: 300, lengthInMm: 500 };
const destination = { countryCode: "AR", province: "La Rioja", city: "La Rioja", postalCode: "F5300ABC" };

test("elige la zona más específica y suma preparación al plazo", () => {
  const result = calculateShippingQuotes({
    zones: [zone(), zone({ id: "zone-local", name: "La Rioja", provinces: ["La Rioja"], postalPrefixes: ["5300"], methods: [method({ id: "local", priceInCents: 300_000 })] })],
    lines: [completeLine], destination, merchandiseInCents: 50_000_00,
  });
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0]?.id, "local");
  assert.equal(result.quotes[0]?.priceInCents, 300_000);
  assert.equal(result.quotes[0]?.estimatedDaysMin, 3);
  assert.equal(result.quotes[0]?.estimatedDaysMax, 6);
});

test("cotiza por el mayor entre peso real y volumétrico", () => {
  const result = calculateShippingQuotes({
    zones: [zone({ methods: [method({ pricingType: "WEIGHT_TABLE", rateRules: [
      { from: 0, to: 10_000, priceInCents: 450_000 },
      { from: 10_001, to: null, priceInCents: 900_000 },
    ] })] })],
    lines: [completeLine], destination, merchandiseInCents: 50_000_00,
  });
  assert.equal(result.physical.realWeightInGrams, 2_000);
  assert.equal(result.physical.volumetricWeightInGrams, 12_000);
  assert.equal(result.physical.chargeableWeightInGrams, 12_000);
  assert.equal(result.quotes[0]?.priceInCents, 900_000);
});

test("oculta tarifas por peso si faltan medidas y respeta envío gratis", () => {
  const missing = { ...completeLine, widthInMm: null };
  const noQuote = calculateShippingQuotes({ zones: [zone({ methods: [method({ pricingType: "WEIGHT_TABLE", rateRules: [{ from: 0, to: null, priceInCents: 450_000 }] })] })], lines: [missing], destination, merchandiseInCents: 100_000_00 });
  assert.equal(noQuote.quotes.length, 0);
  const constrained = calculateShippingQuotes({ zones: [zone({ methods: [method({ minimumWeightInGrams: 1_000 })] })], lines: [missing], destination, merchandiseInCents: 100_000_00 });
  assert.equal(constrained.quotes.length, 0);
  const free = calculateShippingQuotes({ zones: [zone({ methods: [method({ freeShippingThresholdInCents: 100_000_00 })] })], lines: [completeLine], destination, merchandiseInCents: 100_000_00 });
  assert.equal(free.quotes[0]?.priceInCents, 0);
});

test("distingue gratis de precio a convenir", () => {
  const result = calculateShippingQuotes({ zones: [zone({ methods: [method({ id: "free", pricingType: "FREE" }), method({ id: "agree", pricingType: "TO_AGREE" })] })], lines: [completeLine], destination, merchandiseInCents: 10_000_00 });
  assert.equal(result.quotes.find(({ id }) => id === "free")?.requiresCoordination, false);
  assert.equal(result.quotes.find(({ id }) => id === "agree")?.requiresCoordination, true);
});
