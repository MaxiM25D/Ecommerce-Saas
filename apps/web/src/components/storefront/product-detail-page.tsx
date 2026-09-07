"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useCart } from "./cart-context";
import { StorefrontError, StorefrontLoading } from "./catalog-page";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { PublicStore, StorefrontProduct } from "./types";

export function ProductDetailPage({
  slug,
  productSlug,
}: {
  slug: string;
  productSlug: string;
}) {
  const [data, setData] = useState<{
    store: PublicStore;
    product: StorefrontProduct;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ store: PublicStore; product: StorefrontProduct }>(
      `/storefront/${slug}/products/${productSlug}`,
    )
      .then((response) => {
        if (active) setData(response);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof ApiError
              ? caught.message
              : "No pudimos cargar el producto",
          );
      });
    return () => {
      active = false;
    };
  }, [productSlug, slug]);

  if (error) return <StorefrontError message={error} />;
  if (!data) return <StorefrontLoading />;
  return (
    <StorefrontShell store={data.store}>
      <ProductDetail product={data.product} store={data.store} />
    </StorefrontShell>
  );
}

function ProductDetail({
  product,
  store,
}: {
  product: StorefrontProduct;
  store: PublicStore;
}) {
  const [selectedImage, setSelectedImage] = useState(product.images[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const { addItem } = useCart();
  const currency = store.settings?.currency ?? "ARS";
  const selectedVariant = product.variants.find(
    (variant) => variant.id === variantId,
  );
  const availableStock = selectedVariant?.stock ?? product.stock;
  const currentPrice = selectedVariant?.priceInCents ?? product.priceInCents;
  const primaryColor = store.settings?.primaryColor ?? "#9A6B43";

  function addToCart() {
    addItem(product, quantity, selectedVariant);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-6 sm:py-12 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950"
        href={`/tienda/${store.slug}`}
      >
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <section>
          <ProductImage
            className="aspect-square w-full rounded-[var(--store-radius)] border border-stone-200/70 shadow-[0_18px_60px_rgba(28,20,28,0.07)]"
            image={selectedImage}
            name={product.name}
          />
          {product.images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto">
              {product.images.map((image, index) => (
                <button
                  aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                  className="shrink-0 overflow-hidden rounded-[calc(var(--store-radius)*.65)] border-2 transition"
                  key={image}
                  onClick={() => setSelectedImage(image)}
                  style={{ borderColor: selectedImage === image ? primaryColor : "transparent" }}
                  type="button"
                >
                  <ProductImage
                    className="h-20 w-20"
                    image={image}
                    name={product.name}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="self-center lg:py-8">
          {product.category && (
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
              {product.category.name}
            </p>
          )}
          {product.brand && (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
              {product.brand}
            </p>
          )}
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-5 text-3xl font-bold tracking-[-0.03em]" style={{ color: primaryColor }}>
            {formatMoney(currentPrice, currency)}
          </p>
          <div className="my-7 h-px bg-stone-200" />
          <p className="whitespace-pre-line text-base leading-7 text-stone-600">
            {product.description ||
              "Un producto seleccionado especialmente para vos."}
          </p>
          {product.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {product.variants.length > 0 && (
            <label className="mt-7 block text-sm font-semibold">
              Variante
              <select
                className="mt-2 h-13 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none focus:ring-4 focus:ring-stone-100"
                value={variantId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setQuantity(1);
                }}
              >
                {product.variants.map((variant) => (
                  <option
                    disabled={variant.stock === 0}
                    key={variant.id}
                    value={variant.id}
                  >
                    {variant.name} ·{" "}
                    {formatMoney(variant.priceInCents, currency)}
                    {variant.stock === 0 ? " · sin stock" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-7 flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${availableStock > 0 ? "bg-emerald-500" : "bg-red-500"}`}
            />
            <span className="font-medium">
              {availableStock > 0
                ? `${availableStock} unidades disponibles`
                : "Producto sin stock"}
            </span>
          </div>

          {availableStock > 0 && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="flex h-13 items-center justify-between rounded-full border border-stone-300 bg-white px-2 sm:w-36">
                <button
                  aria-label="Reducir cantidad"
                  className="grid h-10 w-10 place-items-center"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  <Minus className="mx-auto" size={15} />
                </button>
                <span className="text-sm font-bold">{quantity}</span>
                <button
                  aria-label="Aumentar cantidad"
                  className="grid h-10 w-10 place-items-center disabled:text-stone-300"
                  disabled={quantity >= availableStock}
                  onClick={() =>
                    setQuantity((value) => Math.min(availableStock, value + 1))
                  }
                  type="button"
                >
                  <Plus className="mx-auto" size={15} />
                </button>
              </div>
              <button
                className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-110"
                onClick={addToCart}
                style={{ backgroundColor: primaryColor }}
                type="button"
              >
                {added ? <><Check size={17} /> ¡Agregado!</> : <><ShoppingBag size={17} /> Agregar al carrito</>}
              </button>
            </div>
          )}

          <div className="mt-9 grid gap-3 border-t border-stone-200 pt-7 sm:grid-cols-2">
            <InfoCard icon={<ShieldCheck size={18} />} title="Compra segura" text="Tus datos están protegidos" />
            <InfoCard icon={<PackageCheck size={18} />} title="Stock actualizado" text={`${availableStock} disponibles`} />
            {store.paymentMethods.mercadoPago && <InfoCard icon={<CreditCard size={18} />} title="Mercado Pago" text="Pagá desde su plataforma" />}
            {store.paymentMethods.bankTransfer && <InfoCard icon={<CreditCard size={18} />} title="Transferencia" text="Comprobante protegido" />}
          </div>
          <p className="mt-5 text-xs text-stone-400">SKU: {product.sku}</p>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-700">{icon}</span>
      <span><strong className="block text-xs text-stone-800">{title}</strong><span className="mt-0.5 block text-[11px] text-stone-400">{text}</span></span>
    </div>
  );
}
