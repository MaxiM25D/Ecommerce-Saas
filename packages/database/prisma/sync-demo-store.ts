import { createDatabaseClient } from "../src/client.js";
import { syncDemoStore } from "./demo-store.js";

const database = createDatabaseClient();

async function run(): Promise<void> {
  const storeSlug = process.env.SUPERADMIN_STORE_SLUG?.trim().toLowerCase();
  if (!storeSlug) throw new Error("SUPERADMIN_STORE_SLUG no está configurada en .env");

  const tenant = await database.tenant.findUnique({ where: { slug: storeSlug } });
  if (!tenant) throw new Error(`La tienda ${storeSlug} no existe. Ejecutá primero npm run db:superadmin.`);

  await database.$transaction((transaction) => syncDemoStore(transaction, tenant.id));
  console.log(`Tienda demo actualizada: ${storeSlug} / Nébula Living / 4 productos`);
}

try {
  await run();
} finally {
  await database.$disconnect();
}
