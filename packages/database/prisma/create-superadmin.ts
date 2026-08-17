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
      update: { passwordHash, firstName: "Super", lastName: "Admin", platformRole: "SUPERADMIN", emailVerifiedAt: new Date() },
      create: { email, passwordHash, firstName: "Super", lastName: "Admin", platformRole: "SUPERADMIN", emailVerifiedAt: new Date() },
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
    await transaction.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { planId: "plan_pro", status: "ACTIVE" },
      create: { tenantId: tenant.id, planId: "plan_pro", status: "ACTIVE", currentPeriodFrom: new Date() },
    });
    const settings = await transaction.storeSettings.upsert({
      where: { tenantId: tenant.id },
      update: { primaryColor: "#B89B72", currency: "ARS" },
      create: {
        tenantId: tenant.id,
        description: "Productos seleccionados para acompañarte todos los días.",
        primaryColor: "#B89B72",
        currency: "ARS",
      },
    });
    if (!settings.bankAlias) {
      await transaction.storeSettings.update({
        where: { tenantId: tenant.id },
        data: {
          bankName: "Banco Demo",
          bankAlias: "INFINITYSHOP.DEMO",
          bankHolder: "InfinityShop Demo",
          bankTransferEnabled: true,
        },
      });
    } else if (!settings.bankTransferEnabled) {
      await transaction.storeSettings.update({
        where: { tenantId: tenant.id },
        data: { bankTransferEnabled: true },
      });
    }

    if ((await transaction.product.count({ where: { tenantId: tenant.id } })) === 0) {
      const category = await transaction.category.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: "destacados" } },
        update: { name: "Destacados" },
        create: { tenantId: tenant.id, name: "Destacados", slug: "destacados" },
      });
      await transaction.product.create({
        data: {
          tenantId: tenant.id,
          categoryId: category.id,
          sku: "INF-DEMO-001",
          slug: "producto-infinity",
          name: "Producto Infinity",
          description: "Producto de demostración para probar el catálogo, el detalle y el carrito.",
          priceInCents: 4990000,
          stock: 10,
          active: true,
        },
      });
    }
    await transaction.authSession.deleteMany({ where: { userId: user.id } });

    return { email: user.email, storeSlug: tenant.slug };
  });

  console.log(`Superadmin local creado: ${result.email} / tienda: ${result.storeSlug} / plataforma: SUPERADMIN / tienda: OWNER`);
}

try {
  await createSuperAdmin();
} finally {
  await database.$disconnect();
}
