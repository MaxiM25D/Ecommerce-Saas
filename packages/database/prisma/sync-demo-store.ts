import { createDatabaseClient } from "../src/client.js";
import { syncDemoStore } from "./demo-store.js";

const database = createDatabaseClient();

async function run(): Promise<void> {
  const storeSlug = process.env.DEMO_STORE_SLUG?.trim().toLowerCase() || "infinityshop-demo";

  await database.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.upsert({
      where: { slug: storeSlug },
      update: { status: "ACTIVE" },
      create: { slug: storeSlug, name: "Nébula Living", status: "ACTIVE" },
    });

    await transaction.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { planId: "plan_pro", status: "ACTIVE" },
      create: { tenantId: tenant.id, planId: "plan_pro", status: "ACTIVE", currentPeriodFrom: new Date() },
    });

    const ownerEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    if (ownerEmail) {
      const owner = await transaction.user.findUnique({ where: { email: ownerEmail } });
      if (owner) {
        await transaction.membership.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
          update: { role: "OWNER" },
          create: { tenantId: tenant.id, userId: owner.id, role: "OWNER" },
        });
      }
    }

    await syncDemoStore(transaction, tenant.id);
  });
  console.log(`Tienda demo actualizada: ${storeSlug} / Nébula Living / 4 productos`);
}

try {
  await run();
} finally {
  await database.$disconnect();
}
