import { CatalogPage } from "@/components/storefront/catalog-page";

export default async function PublicStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CatalogPage slug={slug} />;
}
