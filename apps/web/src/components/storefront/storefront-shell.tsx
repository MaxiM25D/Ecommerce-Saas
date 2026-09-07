"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Mail,
  Menu,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useState, type CSSProperties } from "react";

import { CartProvider, useCart } from "./cart-context";
import type { PublicStore } from "./types";

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(
    amount / 100,
  );

export function StorefrontShell({
  store,
  children,
}: {
  store: PublicStore;
  children: React.ReactNode;
}) {
  return (
    <CartProvider storeSlug={store.slug}>
      <StorefrontChrome store={store}>{children}</StorefrontChrome>
    </CartProvider>
  );
}

function StorefrontChrome({
  store,
  children,
}: {
  store: PublicStore;
  children: React.ReactNode;
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const primaryColor = store.settings?.primaryColor ?? "#9A6B43";
  const secondaryColor = store.settings?.secondaryColor ?? "#292524";
  const radius =
    store.settings?.borderRadius === "SOFT"
      ? "1.75rem"
      : store.settings?.borderRadius === "SQUARE"
        ? "0.25rem"
        : "1rem";
  const fontFamily =
    store.settings?.fontFamily === "SERIF"
      ? "Georgia, serif"
      : store.settings?.fontFamily === "MODERN"
        ? "Arial, sans-serif"
        : "inherit";

  return (
    <div
      className="flex min-h-screen flex-col bg-[#fcfbfa] text-[#171417]"
      style={
        {
          "--store-color": primaryColor,
          "--store-secondary": secondaryColor,
          "--store-radius": radius,
          fontFamily,
        } as CSSProperties
      }
    >
      {store.settings?.announcement && (
        <div
          className="px-4 py-2 text-center text-xs font-semibold text-white"
          style={{ backgroundColor: secondaryColor }}
        >
          {store.settings.announcement}
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-3"
            href={`/tienda/${store.slug}`}
          >
            <span
              className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden border border-black/[0.06] bg-stone-950 bg-cover bg-center text-sm font-bold text-white shadow-sm"
              style={{
                borderRadius: "calc(var(--store-radius) * .7)",
                ...(store.settings?.logoUrl
                  ? { backgroundImage: `url(${store.settings.logoUrl})` }
                  : {}),
              }}
            >
              {!store.settings?.logoUrl && store.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold tracking-[-0.02em] sm:text-lg">{store.name}</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400 sm:block">Tienda online</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
            <Link
              className="transition hover:text-stone-950"
              href={`/tienda/${store.slug}`}
            >
              Inicio
            </Link>
            <Link
              className="transition hover:text-stone-950"
              href={`/tienda/${store.slug}/productos`}
            >
              Productos
            </Link>
            <Link
              className="transition hover:text-stone-950"
              href={`/tienda/${store.slug}/mis-pedidos`}
            >
              Mi cuenta
            </Link>
          </nav>
          <div className="flex items-center gap-2">
          <button
            aria-label={`Abrir carrito con ${itemCount} productos`}
            className="flex shrink-0 items-center gap-2 rounded-full bg-[#171417] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <ShoppingBag aria-hidden size={17} strokeWidth={1.8} />
            <span className="hidden sm:inline">Carrito</span>
            <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 py-0.5 text-[11px] text-stone-950">
              {itemCount}
            </span>
          </button>
          <button
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-stone-100 bg-white px-5 py-4 md:hidden">
            <Link className="block py-2 text-sm font-semibold" href={`/tienda/${store.slug}`} onClick={() => setMenuOpen(false)}>Inicio</Link>
            <Link className="block py-2 text-sm font-semibold" href={`/tienda/${store.slug}/productos`} onClick={() => setMenuOpen(false)}>Productos</Link>
            <Link className="block py-2 text-sm font-semibold" href={`/tienda/${store.slug}/mis-pedidos`} onClick={() => setMenuOpen(false)}>Mi cuenta</Link>
          </nav>
        )}
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-stone-200 bg-[#171417] text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-12 text-sm text-white/55 sm:flex-row sm:items-end lg:px-8">
          <div>
            <p className="text-xl font-semibold text-white">{store.name}</p>
            {store.settings?.description && <p className="mt-2 max-w-md leading-6">{store.settings.description}</p>}
            {store.settings?.showPoweredBy !== false && (
              <Link
                aria-label="Conocer InfinityShop"
                className="group mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/70 transition duration-300 hover:-translate-y-0.5 hover:border-[#A56ABD]/70 hover:bg-[#6E3482]/30 hover:text-white hover:shadow-[0_10px_30px_rgba(165,106,189,0.2)]"
                href="/"
              >
                <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-md bg-gradient-to-br from-[#A56ABD] to-[#49225B] shadow-sm transition duration-300 group-hover:rotate-12">
                  <Image
                    alt=""
                    className="aspect-square h-6 w-6 object-contain"
                    height={24}
                    sizes="24px"
                    src="/infinityshop-mark.png"
                    width={24}
                  />
                </span>
                <span>Creada con <strong className="font-bold text-white">InfinityShop</strong></span>
                <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={14} />
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {store.settings?.contactEmail && (
              <a className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-white transition hover:bg-white hover:text-black" href={`mailto:${store.settings.contactEmail}`}><Mail size={15} /> Contacto</a>
            )}
            {store.settings?.whatsapp && (
              <a
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-white transition hover:bg-white hover:text-black"
                href={`https://wa.me/${store.settings.whatsapp.replace(/\D/g, "")}`}
                rel="noreferrer"
                target="_blank"
              >
                <MessageCircle size={15} /> WhatsApp <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </div>
      </footer>

      <CartDrawer
        currency={store.settings?.currency ?? "ARS"}
        onClose={() => setCartOpen(false)}
        open={cartOpen}
        primaryColor={primaryColor}
        storeSlug={store.slug}
      />
    </div>
  );
}

function CartDrawer({
  currency,
  onClose,
  open,
  primaryColor,
  storeSlug,
}: {
  currency: string;
  onClose: () => void;
  open: boolean;
  primaryColor: string;
  storeSlug: string;
}) {
  const { items, itemCount, subtotalInCents, removeItem, setQuantity, clear } = useCart();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
    >
      <button
        aria-label="Cerrar carrito"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby="cart-drawer-title"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5 sm:px-7">
          <div>
            <p className="text-lg font-semibold" id="cart-drawer-title">Tu carrito</p>
            <p className="mt-0.5 text-xs text-stone-400">
              {itemCount} {itemCount === 1 ? "producto" : "productos"}
            </p>
          </div>
          <button
            aria-label="Cerrar carrito"
            autoFocus
            className="grid h-10 w-10 place-items-center rounded-full bg-stone-100"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div>
              <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-stone-100 text-3xl">
                ◇
              </span>
              <p className="mt-5 text-lg font-semibold">
                Tu carrito está vacío
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                Agregá productos del catálogo para verlos acá.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
              {items.map((item) => (
                <article className="flex gap-4 border-b border-stone-100 pb-5 last:border-0" key={item.cartKey}>
                  <ProductImage
                    className="h-20 w-20 shrink-0 rounded-2xl"
                    image={item.images[0]}
                    name={item.name}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.name}
                    </p>
                    {item.selectedVariant && (
                      <p className="mt-1 text-xs text-stone-400">
                        {item.selectedVariant.name}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-stone-500">
                      {formatMoney(item.priceInCents, currency)} c/u
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-stone-200">
                        <button
                          aria-label={`Quitar una unidad de ${item.name}`}
                          className="h-8 w-8"
                          onClick={() =>
                            setQuantity(item.cartKey, item.quantity - 1)
                          }
                          type="button"
                        >
                          <Minus className="mx-auto" size={13} />
                        </button>
                        <span className="min-w-7 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          aria-label={`Agregar una unidad de ${item.name}`}
                          className="h-8 w-8 disabled:text-stone-300"
                          disabled={item.quantity >= item.stock}
                          onClick={() =>
                            setQuantity(item.cartKey, item.quantity + 1)
                          }
                          type="button"
                        >
                          <Plus className="mx-auto" size={13} />
                        </button>
                      </div>
                      <button
                        className="text-xs font-semibold text-red-600"
                        onClick={() => removeItem(item.cartKey)}
                        type="button"
                      >
                        <span className="inline-flex items-center gap-1"><Trash2 size={13} /> Quitar</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="border-t border-stone-100 px-5 py-5 sm:px-7">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm text-stone-500">Subtotal</span>
                <strong className="text-xl">
                  {formatMoney(subtotalInCents, currency)}
                </strong>
              </div>
              <p className="mb-4 text-xs leading-5 text-stone-400">
                El envío y los descuentos se calculan en el checkout.
              </p>
              <Link
                className="block w-full rounded-full px-5 py-3.5 text-center text-sm font-bold text-white"
                href={`/tienda/${storeSlug}/checkout`}
                onClick={onClose}
                style={{ backgroundColor: primaryColor }}
              >
                Finalizar compra
              </Link>
              <button
                className="mt-3 w-full py-2 text-xs font-semibold text-stone-400"
                onClick={clear}
                type="button"
              >
                Vaciar carrito
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function ProductImage({
  image,
  name,
  className,
}: {
  image?: string;
  name: string;
  className: string;
}) {
  return (
    <div
      aria-label={name}
      className={`grid place-items-center overflow-hidden bg-stone-100 bg-cover bg-center ${className}`}
      role="img"
      style={
        image
          ? { backgroundImage: `url(${image})` }
          : { background: "linear-gradient(145deg, #e7e5e4, #fafaf9)" }
      }
    >
      {!image && (
        <span className="font-serif text-2xl text-stone-400">
          {name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

export { formatMoney };
