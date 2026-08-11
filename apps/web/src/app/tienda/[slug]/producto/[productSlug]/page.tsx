import { ProductDetailPage } from "@/components/storefront/product-detail-page";

export default async function PublicProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  return <ProductDetailPage productSlug={productSlug} slug={slug} />;
}
