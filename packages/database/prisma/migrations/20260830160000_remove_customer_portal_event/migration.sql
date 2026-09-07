ALTER TYPE "NotificationEvent" RENAME TO "NotificationEvent_old";
CREATE TYPE "NotificationEvent" AS ENUM ('ORDER_CREATED', 'ORDER_PAID', 'ORDER_SHIPPED', 'CART_ABANDONED');
ALTER TABLE "NotificationRule" ALTER COLUMN "event" TYPE "NotificationEvent" USING ("event"::text::"NotificationEvent");
ALTER TABLE "NotificationLog" ALTER COLUMN "event" TYPE "NotificationEvent" USING ("event"::text::"NotificationEvent");
DROP TYPE "NotificationEvent_old";
