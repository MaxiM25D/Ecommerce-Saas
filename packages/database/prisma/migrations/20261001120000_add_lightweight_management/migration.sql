-- Lightweight in-store management: local sales, auditable stock and manual payments.
CREATE TYPE "SalesChannel" AS ENUM ('ONLINE', 'LOCAL');
CREATE TYPE "StockMovementType" AS ENUM ('LOCAL_SALE', 'LOCAL_SALE_CANCELLED', 'MANUAL_ADJUSTMENT');

ALTER TYPE "PaymentMethod" ADD VALUE 'CASH';
ALTER TYPE "PaymentMethod" ADD VALUE 'CARD_EXTERNAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'MERCADO_PAGO_EXTERNAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';

ALTER TABLE "Order"
  ADD COLUMN "channel" "SalesChannel" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "soldByUserId" TEXT;

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "orderId" TEXT,
  "changedByUserId" TEXT,
  "type" "StockMovementType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "stockAfter" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_tenantId_channel_createdAt_idx" ON "Order"("tenantId", "channel", "createdAt");
CREATE INDEX "Order_soldByUserId_idx" ON "Order"("soldByUserId");
CREATE INDEX "StockMovement_tenantId_createdAt_idx" ON "StockMovement"("tenantId", "createdAt");
CREATE INDEX "StockMovement_tenantId_productId_createdAt_idx" ON "StockMovement"("tenantId", "productId", "createdAt");
CREATE INDEX "StockMovement_tenantId_variantId_createdAt_idx" ON "StockMovement"("tenantId", "variantId", "createdAt");
CREATE INDEX "StockMovement_tenantId_orderId_idx" ON "StockMovement"("tenantId", "orderId");
CREATE INDEX "StockMovement_changedByUserId_idx" ON "StockMovement"("changedByUserId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "ProductVariant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
