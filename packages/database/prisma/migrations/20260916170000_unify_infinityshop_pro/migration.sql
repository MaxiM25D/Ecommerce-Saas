-- InfinityShop now has a single commercial plan. STARTER remains archived so
-- historical invoices keep their original plan code and name.
UPDATE "Plan"
SET
  "name" = 'InfinityShop Pro',
  "description" = 'Todas las herramientas para vender, gestionar y hacer crecer tu tienda.',
  "priceInCents" = 5000000,
  "currency" = 'ARS',
  "maxProducts" = 1000,
  "maxMembers" = 6,
  "maxOrdersPerMonth" = NULL,
  "trialDays" = 7,
  "features" = ARRAY[
    'CORE_CATALOG', 'CORE_CART_CHECKOUT', 'TENANT_MP_OAUTH', 'BANK_TRANSFER',
    'STOCK_MANAGEMENT', 'ORDER_MANAGEMENT', 'BASIC_CUSTOMERS', 'FEATURED_PRODUCTS',
    'BRANDS_TAGS', 'BASIC_TRANSACTIONAL_EMAILS', 'BASIC_STORE_CUSTOMIZATION', 'STANDARD_DOMAIN',
    'ADVANCED_ANALYTICS', 'COUPONS_PROMOTIONS', 'PRODUCT_VARIANTS', 'ABANDONED_CART_RECOVERY',
    'AUTOMATIONS', 'CUSTOM_EMAILS', 'CUSTOM_DOMAIN', 'ADVANCED_STORE_CUSTOMIZATION', 'PRIORITY_SUPPORT'
  ],
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'plan_pro';

-- Move current STARTER subscriptions without changing their
-- operational status, trial dates, billing periods or invoice history.
UPDATE "Subscription"
SET "planId" = 'plan_pro', "updatedAt" = CURRENT_TIMESTAMP
WHERE "planId" = 'plan_starter';

-- A pending plan change no longer has meaning because PRO is now the only
-- commercial plan. Mercado Pago amounts are reconciled by the pre-deploy job.
UPDATE "Subscription"
SET "pendingPlanId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "pendingPlanId" IS NOT NULL;

UPDATE "Plan"
SET
  "name" = 'Starter (histórico)',
  "active" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'plan_starter';
