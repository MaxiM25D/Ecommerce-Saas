import bcrypt from "bcryptjs";

import { createDatabaseClient } from "../src/client.js";

const database = createDatabaseClient();

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} no está configurada en .env`);
  return value;
}

async function createSuperAdmin(): Promise<void> {
  const email = requiredEnvironment("SUPERADMIN_EMAIL").toLowerCase();
  const password = requiredEnvironment("SUPERADMIN_PASSWORD");
  const storeSlug = requiredEnvironment("SUPERADMIN_STORE_SLUG").toLowerCase();

  if (password.length < 10) throw new Error("SUPERADMIN_PASSWORD debe tener al menos 10 caracteres");

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await database.$transaction(async (transaction) => {
    const user = await transaction.user.upsert({
      where: { email },
      update: { passwordHash, firstName: "Super", lastName: "Admin" },
      create: { email, passwordHash, firstName: "Super", lastName: "Admin" },
    });
    const tenant = await transaction.tenant.upsert({
      where: { slug: storeSlug },
      update: { name: "InfinityShop Demo", status: "ACTIVE" },
      create: { name: "InfinityShop Demo", slug: storeSlug },
    });

    await transaction.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: { role: "OWNER" },
      create: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
    });
    await transaction.storeSettings.upsert({
      where: { tenantId: tenant.id },
      update: { primaryColor: "#B89B72", currency: "ARS" },
      create: { tenantId: tenant.id, primaryColor: "#B89B72", currency: "ARS" },
    });
    await transaction.authSession.deleteMany({ where: { userId: user.id } });

    return { email: user.email, storeSlug: tenant.slug };
  });

  console.log(`Superadmin local creado: ${result.email} / tienda: ${result.storeSlug} / rol: OWNER`);
}

try {
  await createSuperAdmin();
} finally {
  await database.$disconnect();
}
