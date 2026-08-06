import type { DatabaseClient } from "./client.js";

export function createTenantRepository(database: DatabaseClient, tenantId: string) {
  const tenantWhere = { tenantId } as const;

  return {
    products: {
      list: () => database.product.findMany({ where: tenantWhere, orderBy: { name: "asc" } }),
      findById: (id: string) => database.product.findFirst({ where: { tenantId, id } }),
    },
    customers: {
      list: () => database.customer.findMany({ where: tenantWhere, orderBy: { email: "asc" } }),
      findById: (id: string) => database.customer.findFirst({ where: { tenantId, id } }),
    },
    carts: {
      list: () => database.cart.findMany({ where: tenantWhere, include: { items: true } }),
      findById: (id: string) =>
        database.cart.findFirst({ where: { tenantId, id }, include: { items: true } }),
    },
    orders: {
      list: () => database.order.findMany({ where: tenantWhere, include: { items: true } }),
      findById: (id: string) =>
        database.order.findFirst({ where: { tenantId, id }, include: { items: true } }),
    },
  };
}
