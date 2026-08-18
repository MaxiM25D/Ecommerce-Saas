ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT;
CREATE INDEX "OrderItem_tenantId_variantId_idx" ON "OrderItem"("tenantId", "variantId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "ProductVariant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
