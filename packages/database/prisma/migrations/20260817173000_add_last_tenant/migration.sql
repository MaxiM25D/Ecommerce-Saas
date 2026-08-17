ALTER TABLE "User" ADD COLUMN "lastTenantId" TEXT;

CREATE INDEX "User_lastTenantId_idx" ON "User"("lastTenantId");

ALTER TABLE "User" ADD CONSTRAINT "User_lastTenantId_fkey" FOREIGN KEY ("lastTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
