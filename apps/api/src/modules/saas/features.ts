import { HttpError } from "../../errors.js";

export const planFeatureCodes = [
  "CORE_CATALOG", "CORE_CART_CHECKOUT", "TENANT_MP_OAUTH", "BANK_TRANSFER",
  "STOCK_MANAGEMENT", "ORDER_MANAGEMENT", "BASIC_CUSTOMERS", "FEATURED_PRODUCTS",
  "BRANDS_TAGS", "BASIC_TRANSACTIONAL_EMAILS", "BASIC_STORE_CUSTOMIZATION", "STANDARD_DOMAIN",
  "ADVANCED_ANALYTICS", "COUPONS_PROMOTIONS", "PRODUCT_VARIANTS", "ABANDONED_CART_RECOVERY",
  "AUTOMATIONS", "CUSTOM_EMAILS", "CUSTOM_DOMAIN", "ADVANCED_STORE_CUSTOMIZATION", "PRIORITY_SUPPORT",
] as const;

export type PlanFeatureCode = typeof planFeatureCodes[number];

export function hasPlanFeature(features: string[], feature: PlanFeatureCode): boolean {
  return features.includes(feature);
}

export function assertPlanFeature(features: string[], feature: PlanFeatureCode): void {
  if (!hasPlanFeature(features, feature)) {
    throw new HttpError(403, "Esta función requiere un plan superior");
  }
}
