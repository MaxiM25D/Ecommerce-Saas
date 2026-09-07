-- New InfinityShop trials last seven days for both commercial plans.
ALTER TABLE "Plan" ALTER COLUMN "trialDays" SET DEFAULT 7;

UPDATE "Plan"
SET "trialDays" = 7,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('STARTER', 'PRO');

UPDATE "Subscription"
SET "trialEndsAt" = "currentPeriodFrom" + INTERVAL '7 days',
    "currentPeriodTo" = "currentPeriodFrom" + INTERVAL '7 days',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'TRIALING'
  AND "currentPeriodFrom" IS NOT NULL
  AND ("trialEndsAt" IS NULL OR "trialEndsAt" > "currentPeriodFrom" + INTERVAL '7 days');
