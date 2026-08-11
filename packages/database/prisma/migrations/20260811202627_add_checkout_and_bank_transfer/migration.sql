-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'MERCADO_PAGO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN     "shippingAddress" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "bankAlias" TEXT,
ADD COLUMN     "bankHolder" TEXT,
ADD COLUMN     "bankName" TEXT;
