ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_PICKUP';
ALTER TYPE "OrderStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "NotificationEvent" ADD VALUE 'ORDER_READY_FOR_PICKUP';

CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');

ALTER TABLE "Order"
ADD COLUMN "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN "pickupLocationName" TEXT,
ADD COLUMN "pickupAddress" TEXT,
ADD COLUMN "pickupMapsUrl" TEXT,
ADD COLUMN "pickupOpeningHours" TEXT,
ADD COLUMN "pickupInstructions" TEXT,
ADD COLUMN "pickupPhone" TEXT,
ADD COLUMN "pickupReadyAt" TIMESTAMP(3),
ADD COLUMN "pickupCompletedAt" TIMESTAMP(3);

CREATE TABLE "PickupLocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "postalCode" TEXT,
  "mapsUrl" TEXT,
  "phone" TEXT,
  "openingHours" TEXT,
  "instructions" TEXT,
  "preparationMinutes" INTEGER NOT NULL DEFAULT 120,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PickupLocation_tenantId_name_key" ON "PickupLocation"("tenantId", "name");
CREATE UNIQUE INDEX "PickupLocation_tenantId_id_key" ON "PickupLocation"("tenantId", "id");
CREATE INDEX "PickupLocation_tenantId_active_idx" ON "PickupLocation"("tenantId", "active");

ALTER TABLE "PickupLocation"
ADD CONSTRAINT "PickupLocation_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
