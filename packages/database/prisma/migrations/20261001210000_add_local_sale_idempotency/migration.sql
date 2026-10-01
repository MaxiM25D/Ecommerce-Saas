ALTER TABLE "Order" ADD COLUMN "localSaleKey" TEXT;
CREATE UNIQUE INDEX "Order_localSaleKey_key" ON "Order"("localSaleKey");
