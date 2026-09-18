ALTER TABLE "StoreSettings"
ADD COLUMN "shippingPolicy" TEXT,
ADD COLUMN "returnPolicy" TEXT;

ALTER TABLE "ShippingMethod"
ADD COLUMN "estimatedDaysMin" INTEGER,
ADD COLUMN "estimatedDaysMax" INTEGER,
ADD COLUMN "freeShippingThresholdInCents" INTEGER,
ADD COLUMN "carrierCode" TEXT,
ADD COLUMN "carrierName" TEXT,
ADD COLUMN "trackingUrlTemplate" TEXT;

UPDATE "ShippingMethod"
SET "estimatedDaysMin" = "estimatedDays",
    "estimatedDaysMax" = "estimatedDays"
WHERE "estimatedDays" IS NOT NULL;

ALTER TABLE "Order"
ADD COLUMN "shippingZoneName" TEXT,
ADD COLUMN "shippingEstimatedDaysMin" INTEGER,
ADD COLUMN "shippingEstimatedDaysMax" INTEGER,
ADD COLUMN "shippingFreeThresholdInCents" INTEGER,
ADD COLUMN "shippingCarrierCode" TEXT,
ADD COLUMN "shippingCarrierName" TEXT,
ADD COLUMN "shippingTrackingUrlTemplate" TEXT,
ADD COLUMN "shippingPolicySnapshot" TEXT,
ADD COLUMN "returnPolicySnapshot" TEXT;
