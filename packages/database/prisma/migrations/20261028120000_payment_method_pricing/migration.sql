ALTER TABLE "Product"
ADD COLUMN "bankTransferPriceInCents" INTEGER,
ADD COLUMN "cashPriceInCents" INTEGER;

ALTER TABLE "ProductVariant"
ADD COLUMN "bankTransferPriceInCents" INTEGER,
ADD COLUMN "cashPriceInCents" INTEGER;

ALTER TABLE "StoreSettings"
ADD COLUMN "bankTransferDiscountPercentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cashOnPickupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cashDiscountPercentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentDiscountsCombinableWithCoupons" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Order"
ADD COLUMN "paymentDiscountInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentPricingSnapshot" JSONB;

ALTER TABLE "OrderItem"
ADD COLUMN "listUnitPriceInCents" INTEGER;

UPDATE "OrderItem"
SET "listUnitPriceInCents" = "unitPriceInCents";

ALTER TABLE "OrderItem"
ALTER COLUMN "listUnitPriceInCents" SET NOT NULL,
ADD COLUMN "paymentDiscountInCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_bankTransferPrice_nonnegative" CHECK ("bankTransferPriceInCents" IS NULL OR "bankTransferPriceInCents" >= 0),
ADD CONSTRAINT "Product_cashPrice_nonnegative" CHECK ("cashPriceInCents" IS NULL OR "cashPriceInCents" >= 0);

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_bankTransferPrice_nonnegative" CHECK ("bankTransferPriceInCents" IS NULL OR "bankTransferPriceInCents" >= 0),
ADD CONSTRAINT "ProductVariant_cashPrice_nonnegative" CHECK ("cashPriceInCents" IS NULL OR "cashPriceInCents" >= 0);

ALTER TABLE "StoreSettings"
ADD CONSTRAINT "StoreSettings_bankTransferDiscount_range" CHECK ("bankTransferDiscountPercentage" BETWEEN 0 AND 90),
ADD CONSTRAINT "StoreSettings_cashDiscount_range" CHECK ("cashDiscountPercentage" BETWEEN 0 AND 90);
