"use client";

import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { CatalogFilters } from "./catalog-filters";
import { ProductCard, StorefrontError, StorefrontLoading } from "./catalog-page";
import { StorefrontShell } from "./storefront-shell";
import type { PublicStore, StorefrontProduct } from "./types";

type CatalogResponse = {
  products: StorefrontProduct[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  facets: { brands: string[]; tags: string[] };
};

const emptyCatalog: CatalogResponse = {
  products: [],
  pagination: { page: 1, limit: 24, total: 0, totalPages: 1 },
  facets: { brands: [], tags: [] },
};

export function ProductCatalogPage({
  slug,
  categorySlug = "",
}: {
  slug: string;
  categorySlug?: string;
}) {
  const [store, setStore] = useState<PublicStore | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse>(emptyCatalog);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(categorySlug);
  const [brand, setBrand] = useState("");
  const [tag, setTag] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ store: PublicStore }>(`/storefront/${slug}`)
      .then(({ store: responseStore }) => {
        if (active) setStore(responseStore);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof ApiError
              ? caught.message
              : "No pudimos abrir esta tienda",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), limit: "24", sort });
      if (search.trim()) query.set("search", search.trim());
      if (category) query.set("category", category);
      if (brand) query.set("brand", brand);
      if (tag) query.set("tag", tag);
      if (minPrice) query.set("minPrice", minPrice);
      if (maxPrice) query.set("maxPrice", maxPrice);
      setCatalogLoading(true);
      apiRequest<CatalogResponse>(`/storefront/${slug}/products?${query}`)
        .then((response) => {
          if (active) { setCatalog(response); setError(""); }
        })
        .catch((caught) => {
          if (active)
            setError(
              caught instanceof ApiError
                ? caught.message
                : "No pudimos cargar el catálogo",
            );
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [brand, category, maxPrice, minPrice, page, search, slug, sort, tag]);

  const activeCategory = useMemo(
    () => store?.categories?.find((item) => item.slug === categorySlug),
    [categorySlug, store?.categories],
  );
  const title = activeCategory?.name ?? "Todos los productos";
  const hasFilters = Boolean(search || category || brand || tag || minPrice || maxPrice);
  const primaryColor = store?.settings?.primaryColor ?? "#9A6B43";

  function resetPageAnd(action: () => void) {
    setPage(1);
    action();
  }

  function clearFilters() {
    setSearch("");
    if (!categorySlug) setCategory("");
    setBrand("");
    setTag("");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  }

  if (error && !store) return <StorefrontError message={error} />;
  if (loading || !store) return <StorefrontLoading />;

  return (
    <StorefrontShell store={store}>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950" href={`/tienda/${slug}`}>
          <ArrowLeft size={16} /> Volver al inicio
        </Link>

        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primaryColor }}>Catálogo</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{title}</h1>
            <p className="mt-3 text-sm text-stone-500">{catalog.pagination.total} productos para explorar</p>
          </div>
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Buscar productos</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              className="w-full rounded-full border border-stone-200 bg-white py-3.5 pl-12 pr-11 text-sm outline-none transition focus:border-stone-400 focus:ring-4 focus:ring-stone-100"
              onChange={(event) => resetPageAnd(() => setSearch(event.target.value))}
              placeholder="Buscar por nombre, descripción o SKU…"
              type="search"
              value={search}
            />
            {search && <button aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-stone-100" onClick={() => resetPageAnd(() => setSearch(""))} type="button"><X size={15} /></button>}
          </label>
        </div>

        <CatalogFilters categories={store.categories ?? []} category={category} fixedCategory={Boolean(categorySlug)} brand={brand} tag={tag} brands={catalog.facets.brands} tags={catalog.facets.tags} minPrice={minPrice} maxPrice={maxPrice} search={search} color={primaryColor} onClear={clearFilters} onChange={(key, value) => resetPageAnd(() => ({ category: setCategory, brand: setBrand, tag: setTag, minPrice: setMinPrice, maxPrice: setMaxPrice, search: setSearch })[key](value))} />
        <div className="mt-6 flex items-center justify-between gap-4">
          <p role="status" className="text-sm text-stone-500">{catalogLoading ? "Actualizando resultados…" : `${catalog.pagination.total} ${catalog.pagination.total === 1 ? "producto encontrado" : "productos encontrados"}`}</p>
          <div className="w-44 shrink-0"><FilterSelect label="Ordenar por" onChange={(value) => resetPageAnd(() => setSort(value))} value={sort}>
              <option value="featured">Destacados</option>
              <option value="recent">Más recientes</option>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
              <option value="name">Nombre A–Z</option>
            </FilterSelect></div>
        </div>

        {error && <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {catalogLoading ? (
          <CatalogSkeleton />
        ) : catalog.products.length === 0 ? (
          <div className="mt-8 rounded-[var(--store-radius)] border border-dashed border-stone-300 py-24 text-center">
            <p className="text-lg font-semibold">No encontramos productos</p>
            <p className="mt-2 text-sm text-stone-400">Probá con otros filtros o una búsqueda diferente.</p>
            {hasFilters && <button className="mt-5 rounded-full bg-stone-950 px-5 py-2.5 text-xs font-bold text-white" onClick={clearFilters} type="button">Limpiar filtros</button>}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
            {catalog.products.map((product) => (
              <ProductCard currency={store.settings?.currency ?? "ARS"} key={product.id} primaryColor={primaryColor} product={product} storeSlug={store.slug} />
            ))}
          </div>
        )}

        {catalog.pagination.totalPages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-4" aria-label="Paginación del catálogo">
            <button className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-35" disabled={page <= 1 || catalogLoading} onClick={() => { setPage((value) => Math.max(1, value - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button"><ArrowLeft size={15} /> Anterior</button>
            <span className="text-xs font-semibold text-stone-500">Página {catalog.pagination.page} de {catalog.pagination.totalPages}</span>
            <button className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-35" disabled={page >= catalog.pagination.totalPages || catalogLoading} onClick={() => { setPage((value) => Math.min(catalog.pagination.totalPages, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button">Siguiente <ArrowRight size={15} /></button>
          </nav>
        )}
      </main>
    </StorefrontShell>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold text-stone-500"><span className="mb-1.5 block">{label}</span><select className="h-11 w-full rounded-xl border border-stone-200 bg-[#fcfbfa] px-3 text-xs text-stone-800 outline-none focus:border-stone-400" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>;
}

function CatalogSkeleton() {
  return <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div className="aspect-[4/5] animate-pulse rounded-3xl bg-stone-200" key={index} />)}</div>;
}
