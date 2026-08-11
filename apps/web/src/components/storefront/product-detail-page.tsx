"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useCart } from "./cart-context";
import { StorefrontError, StorefrontLoading } from "./catalog-page";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { PublicStore, StorefrontProduct } from "./types";

export function ProductDetailPage({ slug, productSlug }: { slug: string; productSlug: string }) {
  const [data, setData] = useState<{ store: PublicStore; product: StorefrontProduct } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ store: PublicStore; product: StorefrontProduct }>(`/storefront/${slug}/products/${productSlug}`)
      .then((response) => { if (active) setData(response); })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? caught.message : "No pudimos cargar el producto"); });
    return () => { active = false; };
  }, [productSlug, slug]);

  if (error) return <StorefrontError message={error} />;
  if (!data) return <StorefrontLoading />;
  return <StorefrontShell store={data.store}><ProductDetail product={data.product} store={data.store} /></StorefrontShell>;
}

function ProductDetail({ product, store }: { product: StorefrontProduct; store: PublicStore }) {
  const [selectedImage, setSelectedImage] = useState(product.images[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const currency = store.settings?.currency ?? "ARS";

  function addToCart() {
    addItem(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950" href={`/tienda/${store.slug}`}>← Volver al catálogo</Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <section>
          <ProductImage className="aspect-square w-full rounded-3xl sm:rounded-[2.5rem]" image={selectedImage} name={product.name} />
          {product.images.length > 1 && <div className="mt-4 flex gap-3 overflow-x-auto">{product.images.map((image) => <button className={`shrink-0 overflow-hidden rounded-2xl border-2 ${selectedImage === image ? "border-stone-950" : "border-transparent"}`} key={image} onClick={() => setSelectedImage(image)} type="button"><ProductImage className="h-20 w-20" image={image} name={product.name} /></button>)}</div>}
        </section>

        <section className="self-center lg:py-8">
          {product.category && <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{product.category.name}</p>}
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{product.name}</h1>
          <p className="mt-5 text-2xl font-semibold">{formatMoney(product.priceInCents, currency)}</p>
          <div className="my-7 h-px bg-stone-200" />
          <p className="whitespace-pre-line text-base leading-7 text-stone-600">{product.description || "Un producto seleccionado especialmente para vos."}</p>
          <div className="mt-7 flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${product.stock > 0 ? "bg-emerald-500" : "bg-red-500"}`} /><span className="font-medium">{product.stock > 0 ? `${product.stock} unidades disponibles` : "Producto sin stock"}</span></div>

          {product.stock > 0 && <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="flex h-13 items-center justify-between rounded-full border border-stone-300 px-2 sm:w-36"><button className="grid h-10 w-10 place-items-center" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">−</button><span className="text-sm font-bold">{quantity}</span><button className="grid h-10 w-10 place-items-center disabled:text-stone-300" disabled={quantity >= product.stock} onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} type="button">+</button></div>
            <button className="h-13 flex-1 rounded-full bg-stone-950 px-7 text-sm font-bold text-white transition hover:opacity-85" onClick={addToCart} type="button">{added ? "¡Agregado!" : "Agregar al carrito"}</button>
          </div>}

          <div className="mt-9 grid gap-3 border-t border-stone-200 pt-7 text-sm text-stone-500 sm:grid-cols-2"><p>✓ Compra protegida</p><p>✓ Stock actualizado</p><p>✓ Atención directa</p><p>SKU: {product.sku}</p></div>
        </section>
      </div>
    </main>
  );
}
