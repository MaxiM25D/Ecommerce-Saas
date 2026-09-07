DROP TABLE "CustomerPortalToken";
DROP TABLE "CustomerPortalSession";

ALTER TABLE "Customer"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "accountCreatedAt" TIMESTAMP(3);

CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_tenantId_customerId_expiresAt_idx" ON "CustomerSession"("tenantId", "customerId", "expiresAt");
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
