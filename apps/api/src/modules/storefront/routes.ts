import { Router } from "express";

import { database } from "../../database.js";
import { HttpError } from "../../errors.js";
import { tenantSlug } from "../auth/schemas.js";

export const storefrontRouter = Router();

const productSelection = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  description: true,
  images: true,
  priceInCents: true,
  stock: true,
  category: { select: { id: true, name: true, slug: true } },
} as const;

storefrontRouter.get("/:slug", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const store = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      name: true,
      slug: true,
      settings: true,
      categories: {
        where: { products: { some: { active: true } } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: { where: { active: true } } } },
        },
      },
      products: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: productSelection,
      },
    },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");
  response.json({ store });
});

storefrontRouter.get("/:slug/products/:productSlug", async (request, response) => {
  const slug = tenantSlug.parse(request.params.slug);
  const productSlug = tenantSlug.parse(request.params.productSlug);
  const store = await database.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { name: true, slug: true, settings: true },
  });

  if (!store) throw new HttpError(404, "Tienda no encontrada");

  const product = await database.product.findFirst({
    where: { tenant: { slug }, slug: productSlug, active: true },
    select: productSelection,
  });

  if (!product) throw new HttpError(404, "Producto no encontrado");
  response.json({ store, product });
});
