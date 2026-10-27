CREATE TYPE "ShippingPricingType" AS ENUM ('FIXED', 'FREE', 'TO_AGREE', 'WEIGHT_TABLE', 'ORDER_TOTAL_TABLE');

ALTER TABLE "Product"
ADD COLUMN "weightInGrams" INTEGER,
ADD COLUMN "widthInMm" INTEGER,
ADD COLUMN "heightInMm" INTEGER,
ADD COLUMN "lengthInMm" INTEGER;

ALTER TABLE "ProductVariant"
ADD COLUMN "weightInGrams" INTEGER,
ADD COLUMN "widthInMm" INTEGER,
ADD COLUMN "heightInMm" INTEGER,
ADD COLUMN "lengthInMm" INTEGER;

ALTER TABLE "ShippingZone"
ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'AR',
ADD COLUMN "provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "postalRanges" JSONB;

ALTER TABLE "ShippingMethod"
ADD COLUMN "pricingType" "ShippingPricingType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "rateRules" JSONB,
ADD COLUMN "minimumOrderInCents" INTEGER,
ADD COLUMN "maximumOrderInCents" INTEGER,
ADD COLUMN "minimumWeightInGrams" INTEGER,
ADD COLUMN "maximumWeightInGrams" INTEGER,
ADD COLUMN "excludedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "excludedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preparationDaysMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "preparationDaysMax" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN "shippingPricingType" TEXT,
ADD COLUMN "shippingChargeableWeightGrams" INTEGER,
ADD COLUMN "shippingQuoteSnapshot" JSONB;

CREATE TABLE "ShippingOrigin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'AR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShippingOrigin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingOrigin_tenantId_name_key" ON "ShippingOrigin"("tenantId", "name");
CREATE UNIQUE INDEX "ShippingOrigin_tenantId_id_key" ON "ShippingOrigin"("tenantId", "id");
CREATE INDEX "ShippingOrigin_tenantId_active_isDefault_idx" ON "ShippingOrigin"("tenantId", "active", "isDefault");
ALTER TABLE "ShippingOrigin" ADD CONSTRAINT "ShippingOrigin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
