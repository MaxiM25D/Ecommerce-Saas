-- InfinityShop now offers only STARTER and PRO. Existing FREE tenants receive a
-- 14-day STARTER trial; paid subscriptions retain their current status.
UPDATE "Subscription"
SET "planId" = 'plan_starter',
    "status" = 'TRIALING',
    "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '14 days',
    "currentPeriodFrom" = CURRENT_TIMESTAMP,
    "currentPeriodTo" = CURRENT_TIMESTAMP + INTERVAL '14 days',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "planId" = 'plan_free';

DELETE FROM "Plan" WHERE "id" = 'plan_free';

CREATE TYPE "PlanCode_new" AS ENUM ('STARTER', 'PRO');
ALTER TABLE "Plan" ALTER COLUMN "code" TYPE "PlanCode_new" USING ("code"::text::"PlanCode_new");
ALTER TYPE "PlanCode" RENAME TO "PlanCode_old";
ALTER TYPE "PlanCode_new" RENAME TO "PlanCode";
DROP TYPE "PlanCode_old";

CREATE TYPE "BillingProvider" AS ENUM ('MERCADO_PAGO');
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

ALTER TABLE "Plan"
ADD COLUMN "description" TEXT,
ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "maxOrdersPerMonth" DROP NOT NULL;

UPDATE "Plan" SET
  "name" = 'Starter',
  "description" = 'Todo lo necesario para vender normalmente.',
  "priceInCents" = 5000000,
  "currency" = 'ARS',
  "maxProducts" = 150,
  "maxMembers" = 2,
  "maxOrdersPerMonth" = NULL,
  "trialDays" = 14,
  "features" = ARRAY[
    'CORE_CATALOG', 'CORE_CART_CHECKOUT', 'TENANT_MP_OAUTH', 'BANK_TRANSFER',
    'STOCK_MANAGEMENT', 'ORDER_MANAGEMENT', 'BASIC_CUSTOMERS', 'FEATURED_PRODUCTS',
    'BRANDS_TAGS', 'BASIC_TRANSACTIONAL_EMAILS', 'BASIC_STORE_CUSTOMIZATION', 'STANDARD_DOMAIN'
  ],
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'plan_starter';

UPDATE "Plan" SET
  "name" = 'Pro',
  "description" = 'Más capacidad, automatización y herramientas para crecer.',
  "priceInCents" = 7000000,
  "currency" = 'ARS',
  "maxProducts" = 1000,
  "maxMembers" = 6,
  "maxOrdersPerMonth" = NULL,
  "trialDays" = 14,
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

ALTER TABLE "Subscription"
ADD COLUMN "pendingPlanId" TEXT,
ADD COLUMN "billingProvider" "BillingProvider",
ADD COLUMN "providerSubscriptionId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerCheckoutUrl" TEXT,
ADD COLUMN "payerEmail" TEXT,
ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentFailedAt" TIMESTAMP(3);

CREATE TABLE "BillingInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "providerInvoiceId" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "planCode" "PlanCode" NOT NULL,
  "planName" TEXT NOT NULL,
  "amountInCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3),
  "periodTo" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "rawStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "eventType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");
CREATE INDEX "Subscription_pendingPlanId_idx" ON "Subscription"("pendingPlanId");
CREATE UNIQUE INDEX "BillingInvoice_provider_providerInvoiceId_key" ON "BillingInvoice"("provider", "providerInvoiceId");
CREATE INDEX "BillingInvoice_tenantId_createdAt_idx" ON "BillingInvoice"("tenantId", "createdAt");
CREATE INDEX "BillingInvoice_tenantId_status_idx" ON "BillingInvoice"("tenantId", "status");
CREATE INDEX "BillingWebhookEvent_provider_resourceId_idx" ON "BillingWebhookEvent"("provider", "resourceId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pendingPlanId_fkey" FOREIGN KEY ("pendingPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscription_fkey" FOREIGN KEY ("tenantId") REFERENCES "Subscription"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
