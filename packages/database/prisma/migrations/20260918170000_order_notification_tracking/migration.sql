ALTER TABLE "NotificationLog"
ADD COLUMN "orderId" TEXT;

CREATE INDEX "NotificationLog_tenantId_orderId_createdAt_idx"
ON "NotificationLog"("tenantId", "orderId", "createdAt");

ALTER TABLE "NotificationLog"
ADD CONSTRAINT "NotificationLog_tenantId_orderId_fkey"
FOREIGN KEY ("tenantId", "orderId")
REFERENCES "Order"("tenantId", "id")
ON DELETE CASCADE
ON UPDATE CASCADE;
