"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useCart } from "./cart-context";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { PublicStore, StorefrontProduct } from "./types";

const emptyProducts: StorefrontProduct[] = [];

export function CatalogPage({ slug }: { slug: string }) {
  const [store, setStore] = useState<PublicStore | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ store: PublicStore }>(`/storefront/${slug}`)
      .then(({ store }) => { if (active) setStore(store); })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? caught.message : "No pudimos abrir esta tienda"); });
    return () => { active = false; };
  }, [slug]);

  if (error) return <StorefrontError message={error} />;
  if (!store) return <StorefrontLoading />;

  return <StorefrontShell store={store}><Catalog store={store} /></StorefrontShell>;
}

function Catalog({ store }: { store: PublicStore }) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const products = store.products ?? emptyProducts;
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "all" || product.category?.slug === category;
    const term = search.trim().toLowerCase();
    return matchesCategory && (!term || product.name.toLowerCase().includes(term));
  }), [category, products, search]);
  const primaryColor = store.settings?.primaryColor ?? "#9A6B43";

  return (
    <main>
      <section className="relative overflow-hidden border-b border-stone-200 bg-stone-950 text-white">
        {store.settings?.bannerUrl && <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: `url(${store.settings.bannerUrl})` }} />}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_35%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-white/55">Tienda oficial</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">{store.name}</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg">{store.settings?.description || "Descubrí nuestra selección de productos y encontrá tu próximo favorito."}</p>
          <a className="mt-9 inline-flex rounded-full px-6 py-3 text-sm font-bold text-white transition hover:brightness-110" href="#catalogo" style={{ backgroundColor: primaryColor }}>Ver colección</a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-20 lg:px-8" id="catalogo">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primaryColor }}>Nuestro catálogo</p><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Productos destacados</h2></div>
          <label className="relative block w-full lg:max-w-xs"><span className="sr-only">Buscar productos</span><input className="w-full rounded-full border border-stone-200 bg-white px-5 py-3 text-sm outline-none transition focus:border-stone-500" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar productos…" type="search" value={search} /></label>
        </div>

        <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
          <CategoryButton active={category === "all"} label={`Todos (${products.length})`} onClick={() => setCategory("all")} />
          {(store.categories ?? []).map((item) => <CategoryButton active={category === item.slug} key={item.id} label={`${item.name} (${item._count.products})`} onClick={() => setCategory(item.slug)} />)}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-stone-300 py-24 text-center"><p className="text-lg font-semibold">No encontramos productos</p><p className="mt-2 text-sm text-stone-400">Probá otra categoría o búsqueda.</p></div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => <ProductCard currency={store.settings?.currency ?? "ARS"} key={product.id} product={product} storeSlug={store.slug} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition ${active ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"}`} onClick={onClick} type="button">{label}</button>;
}

function ProductCard({ currency, product, storeSlug }: { currency: string; product: StorefrontProduct; storeSlug: string }) {
  const { addItem } = useCart();
  return (
    <article className="group min-w-0">
      <Link className="block" href={`/tienda/${storeSlug}/producto/${product.slug}`}>
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
          <ProductImage className="aspect-[4/5] w-full transition duration-500 group-hover:scale-[1.025]" image={product.images[0]} name={product.name} />
          {product.stock === 0 && <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">Sin stock</span>}
          {product.featured && product.stock > 0 && <span className="absolute left-3 top-3 rounded-full bg-stone-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">Destacado</span>}
        </div>
        <p className="mt-4 truncate text-sm font-semibold sm:text-base">{product.name}</p>
        <p className="mt-1 text-sm text-stone-500">{formatMoney(product.priceInCents, currency)}</p>
      </Link>
      <button className="mt-3 w-full rounded-full border border-stone-300 px-3 py-2.5 text-xs font-bold transition hover:border-stone-950 hover:bg-stone-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={product.stock === 0} onClick={() => addItem(product)} type="button">{product.stock > 0 ? "Agregar al carrito" : "No disponible"}</button>
    </article>
  );
}

export function StorefrontLoading() {
  return <main className="min-h-screen bg-[#fbfaf7]"><div className="h-18 border-b border-stone-200 bg-white" /><div className="h-[28rem] animate-pulse bg-stone-900" /><div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-5 py-16 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div className="aspect-[4/5] animate-pulse rounded-3xl bg-stone-200" key={item} />)}</div></main>;
}

export function StorefrontError({ message }: { message: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-6 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-950 text-2xl text-white">∞</span><h1 className="mt-6 text-3xl font-semibold">No encontramos la tienda</h1><p className="mt-3 text-stone-500">{message}</p><Link className="mt-7 inline-block rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white" href="/">Volver a InfinityShop</Link></div></main>;
}
