type StoreMetadata = {
  name: string;
  slug: string;
  settings: { description: string | null; logoUrl: string | null; bannerUrl: string | null } | null;
};

type ProductMetadata = {
  store: StoreMetadata;
  product: { name: string; description: string | null; images: string[] };
};

const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function read<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { next: { revalidate: 300 } });
    return response.ok ? response.json() as Promise<T> : null;
  } catch {
    return null;
  }
}

export async function getStoreMetadata(slug: string): Promise<StoreMetadata | null> {
  const data = await read<{ store: StoreMetadata }>(`/storefront/${encodeURIComponent(slug)}`);
  return data?.store ?? null;
}

export async function getProductMetadata(slug: string, productSlug: string): Promise<ProductMetadata | null> {
  return read<ProductMetadata>(`/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(productSlug)}/metadata`);
}
