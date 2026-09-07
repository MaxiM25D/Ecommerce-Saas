import type { Metadata } from "next";
import { CatalogPage } from "@/components/storefront/catalog-page";
import { getStoreMetadata } from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreMetadata(slug);
  if (!store) return { title: "Tienda no encontrada", robots: { index: false, follow: false } };
  const description = store.settings?.description || `Comprá online en ${store.name}.`;
  const image = store.settings?.bannerUrl || store.settings?.logoUrl;
  return {
    title: store.name,
    description,
    alternates: { canonical: `/tienda/${store.slug}` },
    openGraph: { title: store.name, description, images: image ? [{ url: image, alt: store.name }] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title: store.name, description, images: image ? [image] : [] },
  };
}

export default async function PublicStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CatalogPage slug={slug} />;
}
