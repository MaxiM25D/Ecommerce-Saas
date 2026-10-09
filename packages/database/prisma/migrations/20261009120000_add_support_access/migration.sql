-- AlterTable
ALTER TABLE "AuthSession"
ADD COLUMN "supportOriginTenantId" TEXT,
ADD COLUMN "supportStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupportAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SupportAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAccessLog_userId_startedAt_idx" ON "SupportAccessLog"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "SupportAccessLog_tenantId_startedAt_idx" ON "SupportAccessLog"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "SupportAccessLog_sessionId_endedAt_idx" ON "SupportAccessLog"("sessionId", "endedAt");

-- AddForeignKey
ALTER TABLE "SupportAccessLog" ADD CONSTRAINT "SupportAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessLog" ADD CONSTRAINT "SupportAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
