type RateRule = { from: number; to: number | null; priceInCents: number };
type PostalRange = { from: string; to?: string | null };

export type ShippingQuoteLine = {
  productId: string;
  categoryId: string | null;
  quantity: number;
  weightInGrams: number | null;
  widthInMm: number | null;
  heightInMm: number | null;
  lengthInMm: number | null;
};

export type ShippingQuoteZone = {
  id: string;
  name: string;
  countryCode: string;
  provinces: string[];
  cities: string[];
  postalPrefixes: string[];
  postalRanges: unknown;
  methods: Array<{
    id: string;
    name: string;
    pricingType: "FIXED" | "FREE" | "TO_AGREE" | "WEIGHT_TABLE" | "ORDER_TOTAL_TABLE";
    priceInCents: number;
    rateRules: unknown;
    minimumOrderInCents: number | null;
    maximumOrderInCents: number | null;
    minimumWeightInGrams: number | null;
    maximumWeightInGrams: number | null;
    excludedProductIds: string[];
    excludedCategoryIds: string[];
    estimatedDays: number | null;
    estimatedDaysMin: number | null;
    estimatedDaysMax: number | null;
    preparationDaysMin: number;
    preparationDaysMax: number;
    freeShippingThresholdInCents: number | null;
    carrierCode: string | null;
    carrierName: string | null;
    trackingUrlTemplate: string | null;
  }>;
};

const normalize = (value: string) => value.trim().toLocaleUpperCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizePostalCode = (value: string) => normalize(value).replace(/\s+/g, "");
const postalDigits = (value: string) => Number(normalizePostalCode(value).match(/\d{4}/)?.[0] ?? NaN);

function parsedPostalRanges(value: unknown): PostalRange[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PostalRange => Boolean(item && typeof item === "object" && "from" in item && typeof item.from === "string"));
}

function parsedRateRules(value: unknown): RateRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RateRule => Boolean(
    item && typeof item === "object"
    && "from" in item && typeof item.from === "number"
    && "priceInCents" in item && typeof item.priceInCents === "number"
    && (!("to" in item) || item.to === null || typeof item.to === "number"),
  )).sort((left, right) => left.from - right.from);
}

function zoneSpecificity(zone: ShippingQuoteZone, destination: { countryCode: string; province: string; city: string; postalCode: string }): number {
  if (normalize(zone.countryCode) !== normalize(destination.countryCode)) return -1;
  let score = 1;
  if (zone.provinces.length) {
    if (!zone.provinces.some((value) => normalize(value) === normalize(destination.province))) return -1;
    score += 100;
  }
  if (zone.cities.length) {
    if (!zone.cities.some((value) => normalize(value) === normalize(destination.city))) return -1;
    score += 200;
  }
  const postalCode = normalizePostalCode(destination.postalCode);
  const postalCandidates = /^[A-Z]\d/.test(postalCode) ? [postalCode, postalCode.slice(1)] : [postalCode];
  const prefixMatches = zone.postalPrefixes.filter((prefix) => {
    const normalizedPrefix = normalizePostalCode(prefix);
    const prefixCandidates = /^[A-Z]\d/.test(normalizedPrefix) ? [normalizedPrefix, normalizedPrefix.slice(1)] : [normalizedPrefix];
    return postalCandidates.some((candidate) => prefixCandidates.some((prefixCandidate) => candidate.startsWith(prefixCandidate)));
  });
  const ranges = parsedPostalRanges(zone.postalRanges);
  const numericPostalCode = postalDigits(postalCode);
  const rangeMatches = ranges.filter((range) => {
    const from = postalDigits(range.from);
    const to = postalDigits(range.to ?? range.from);
    return Number.isFinite(numericPostalCode) && Number.isFinite(from) && Number.isFinite(to) && numericPostalCode >= from && numericPostalCode <= to;
  });
  if ((zone.postalPrefixes.length || ranges.length) && !prefixMatches.length && !rangeMatches.length) return -1;
  if (prefixMatches.length) score += 1000 + Math.max(...prefixMatches.map((prefix) => normalizePostalCode(prefix).length));
  if (rangeMatches.length) score += 900;
  return score;
}

function physicalSummary(lines: ShippingQuoteLine[]) {
  let realWeightInGrams = 0;
  let volumetricWeightInGrams = 0;
  let missingPhysicalData = false;
  for (const line of lines) {
    if (!line.weightInGrams || !line.widthInMm || !line.heightInMm || !line.lengthInMm) missingPhysicalData = true;
    realWeightInGrams += (line.weightInGrams ?? 0) * line.quantity;
    volumetricWeightInGrams += Math.ceil(((line.widthInMm ?? 0) * (line.heightInMm ?? 0) * (line.lengthInMm ?? 0)) / 5000) * line.quantity;
  }
  return {
    realWeightInGrams,
    volumetricWeightInGrams,
    chargeableWeightInGrams: Math.max(realWeightInGrams, volumetricWeightInGrams),
    missingPhysicalData,
  };
}

function tablePrice(rules: RateRule[], value: number): number | null {
  const rule = rules.find(({ from, to }) => value >= from && (to === null || value <= to));
  return rule?.priceInCents ?? null;
}

export function calculateShippingQuotes(input: {
  zones: ShippingQuoteZone[];
  lines: ShippingQuoteLine[];
  destination: { countryCode?: string; province: string; city: string; postalCode: string };
  merchandiseInCents: number;
}) {
  const physical = physicalSummary(input.lines);
  const destination = { ...input.destination, countryCode: input.destination.countryCode ?? "AR" };
  const zones = input.zones.map((zone) => ({ zone, specificity: zoneSpecificity(zone, destination) })).filter(({ specificity }) => specificity >= 0);
  const bestSpecificity = Math.max(-1, ...zones.map(({ specificity }) => specificity));
  const selectedZones = zones.filter(({ specificity }) => specificity === bestSpecificity).map(({ zone }) => zone);
  const productIds = new Set(input.lines.map(({ productId }) => productId));
  const categoryIds = new Set(input.lines.flatMap(({ categoryId }) => categoryId ? [categoryId] : []));

  const quotes = selectedZones.flatMap((zone) => zone.methods.flatMap((method) => {
    if (method.minimumOrderInCents !== null && input.merchandiseInCents < method.minimumOrderInCents) return [];
    if (method.maximumOrderInCents !== null && input.merchandiseInCents > method.maximumOrderInCents) return [];
    if (method.minimumWeightInGrams !== null && physical.chargeableWeightInGrams < method.minimumWeightInGrams) return [];
    if (method.maximumWeightInGrams !== null && physical.chargeableWeightInGrams > method.maximumWeightInGrams) return [];
    if (method.excludedProductIds.some((id) => productIds.has(id)) || method.excludedCategoryIds.some((id) => categoryIds.has(id))) return [];
    if ((method.pricingType === "WEIGHT_TABLE" || method.minimumWeightInGrams !== null || method.maximumWeightInGrams !== null) && physical.missingPhysicalData) return [];

    const basePrice = method.pricingType === "FREE" || method.pricingType === "TO_AGREE"
      ? 0
      : method.pricingType === "WEIGHT_TABLE"
        ? tablePrice(parsedRateRules(method.rateRules), physical.chargeableWeightInGrams)
        : method.pricingType === "ORDER_TOTAL_TABLE"
          ? tablePrice(parsedRateRules(method.rateRules), input.merchandiseInCents)
          : method.priceInCents;
    if (basePrice === null) return [];
    const free = Boolean(method.freeShippingThresholdInCents && input.merchandiseInCents >= method.freeShippingThresholdInCents);
    const transitMin = method.estimatedDaysMin ?? method.estimatedDays ?? 0;
    const transitMax = method.estimatedDaysMax ?? method.estimatedDays ?? transitMin;
    return [{
      id: method.id,
      name: method.name,
      zoneId: zone.id,
      zoneName: zone.name,
      pricingType: method.pricingType,
      priceInCents: free ? 0 : basePrice,
      requiresCoordination: method.pricingType === "TO_AGREE",
      estimatedDaysMin: method.preparationDaysMin + transitMin || null,
      estimatedDaysMax: method.preparationDaysMax + transitMax || null,
      freeShippingThresholdInCents: method.freeShippingThresholdInCents,
      carrierCode: method.carrierCode,
      carrierName: method.carrierName,
      trackingUrlTemplate: method.trackingUrlTemplate,
      ...physical,
    }];
  }));

  return { quotes: quotes.sort((left, right) => left.priceInCents - right.priceInCents), physical };
}
