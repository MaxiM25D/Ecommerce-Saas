-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'CLOUDINARY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "publicTokenHash" TEXT,
ADD COLUMN     "stockExpiresAt" TIMESTAMP(3),
ADD COLUMN     "stockStatus" "StockStatus" NOT NULL DEFAULT 'RESERVED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featuredOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "bankCuit" TEXT,
ADD COLUMN     "bankCvu" TEXT,
ADD COLUMN     "bankReservationHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailFromName" TEXT;

-- CreateTable
CREATE TABLE "MercadoPagoConnection" (
    "tenantId" TEXT NOT NULL,
    "mercadoPagoUserId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "publicKey" TEXT,
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "webhookKey" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MercadoPagoConnection_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "MercadoPagoOAuthState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifierEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MercadoPagoOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "preferenceId" TEXT,
    "externalPaymentId" TEXT,
    "externalStatus" TEXT,
    "statusDetail" TEXT,
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notificationStatus" "NotificationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "notificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "notificationError" TEXT,
    "lastNotificationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "changedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoConnection_webhookKey_key" ON "MercadoPagoConnection"("webhookKey");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoOAuthState_stateHash_key" ON "MercadoPagoOAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "MercadoPagoOAuthState_tenantId_expiresAt_idx" ON "MercadoPagoOAuthState"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "MercadoPagoOAuthState_userId_idx" ON "MercadoPagoOAuthState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_preferenceId_key" ON "PaymentAttempt"("preferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_externalPaymentId_key" ON "PaymentAttempt"("externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_tenantId_orderId_idx" ON "PaymentAttempt"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_tenantId_status_idx" ON "PaymentAttempt"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_tenantId_id_key" ON "PaymentAttempt"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_orderId_key" ON "PaymentReceipt"("orderId");

-- CreateIndex
CREATE INDEX "PaymentReceipt_tenantId_orderId_idx" ON "PaymentReceipt"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_tenantId_id_key" ON "PaymentReceipt"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_tenantId_orderId_key" ON "PaymentReceipt"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_tenantId_orderId_idx" ON "Shipment"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_tenantId_id_key" ON "Shipment"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_tenantId_orderId_key" ON "Shipment"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_tenantId_orderId_createdAt_idx" ON "OrderStatusHistory"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_changedByUserId_idx" ON "OrderStatusHistory"("changedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicTokenHash_key" ON "Order"("publicTokenHash");

-- CreateIndex
CREATE INDEX "Order_tenantId_stockStatus_stockExpiresAt_idx" ON "Order"("tenantId", "stockStatus", "stockExpiresAt");

-- AddForeignKey
ALTER TABLE "MercadoPagoConnection" ADD CONSTRAINT "MercadoPagoConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoPagoOAuthState" ADD CONSTRAINT "MercadoPagoOAuthState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoPagoOAuthState" ADD CONSTRAINT "MercadoPagoOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
