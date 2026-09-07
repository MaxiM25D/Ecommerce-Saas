import { ProductCatalogPage } from "@/components/storefront/product-catalog-page";

export default async function PublicCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}) {
  const { slug, categorySlug } = await params;
  return <ProductCatalogPage categorySlug={categorySlug} slug={slug} />;
}
