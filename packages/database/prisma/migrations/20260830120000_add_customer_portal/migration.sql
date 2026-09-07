ALTER TYPE "NotificationEvent" ADD VALUE 'CUSTOMER_PORTAL_ACCESS';

CREATE TABLE "CustomerPortalToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPortalToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerPortalSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPortalSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPortalToken_tokenHash_key" ON "CustomerPortalToken"("tokenHash");
CREATE INDEX "CustomerPortalToken_tenantId_customerId_expiresAt_idx" ON "CustomerPortalToken"("tenantId", "customerId", "expiresAt");
CREATE UNIQUE INDEX "CustomerPortalSession_tokenHash_key" ON "CustomerPortalSession"("tokenHash");
CREATE INDEX "CustomerPortalSession_tenantId_customerId_expiresAt_idx" ON "CustomerPortalSession"("tenantId", "customerId", "expiresAt");

ALTER TABLE "CustomerPortalToken" ADD CONSTRAINT "CustomerPortalToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPortalToken" ADD CONSTRAINT "CustomerPortalToken_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPortalSession" ADD CONSTRAINT "CustomerPortalSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPortalSession" ADD CONSTRAINT "CustomerPortalSession_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
