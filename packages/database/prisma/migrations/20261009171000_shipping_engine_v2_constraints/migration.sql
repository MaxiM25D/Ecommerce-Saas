ALTER TABLE "ShippingZone"
ALTER COLUMN "provinces" SET NOT NULL,
ALTER COLUMN "cities" SET NOT NULL;

ALTER TABLE "ShippingMethod"
ALTER COLUMN "excludedProductIds" SET NOT NULL,
ALTER COLUMN "excludedCategoryIds" SET NOT NULL;
