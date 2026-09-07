import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/storefront/product-detail-page";
import { getProductMetadata } from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const data = await getProductMetadata(slug, productSlug);
  if (!data) return { title: "Producto no encontrado", robots: { index: false, follow: false } };
  const description = data.product.description || `Comprá ${data.product.name} en ${data.store.name}.`;
  const image = data.product.images[0] || data.store.settings?.bannerUrl || data.store.settings?.logoUrl;
  return {
    title: `${data.product.name} — ${data.store.name}`,
    description,
    alternates: { canonical: `/tienda/${data.store.slug}/producto/${productSlug}` },
    openGraph: { type: "website", title: data.product.name, description, images: image ? [{ url: image, alt: data.product.name }] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title: data.product.name, description, images: image ? [image] : [] },
  };
}

export default async function PublicProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  return <ProductDetailPage productSlug={productSlug} slug={slug} />;
}
