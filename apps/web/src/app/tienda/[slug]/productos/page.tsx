import { ProductCatalogPage } from "@/components/storefront/product-catalog-page";

export default async function PublicProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductCatalogPage slug={slug} />;
}
