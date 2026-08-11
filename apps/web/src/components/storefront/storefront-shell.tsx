"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { CartProvider, useCart } from "./cart-context";
import type { PublicStore } from "./types";

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount / 100);

export function StorefrontShell({ store, children }: { store: PublicStore; children: React.ReactNode }) {
  return (
    <CartProvider storeSlug={store.slug}>
      <StorefrontChrome store={store}>{children}</StorefrontChrome>
    </CartProvider>
  );
}

function StorefrontChrome({ store, children }: { store: PublicStore; children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const { itemCount } = useCart();
  const primaryColor = store.settings?.primaryColor ?? "#9A6B43";

  return (
    <div
      className="min-h-screen bg-[#fbfaf7] text-stone-950"
      style={{ "--store-color": primaryColor } as CSSProperties}
    >
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#fbfaf7]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center gap-3" href={`/tienda/${store.slug}`}>
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-950 bg-cover bg-center text-sm font-bold text-white"
              style={store.settings?.logoUrl ? { backgroundImage: `url(${store.settings.logoUrl})` } : undefined}
            >
              {!store.settings?.logoUrl && store.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-base font-semibold tracking-tight sm:text-lg">{store.name}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
            <Link className="transition hover:text-stone-950" href={`/tienda/${store.slug}`}>Inicio</Link>
            <Link className="transition hover:text-stone-950" href={`/tienda/${store.slug}#catalogo`}>Productos</Link>
          </nav>
          <button
            aria-label={`Abrir carrito con ${itemCount} productos`}
            className="flex shrink-0 items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <span aria-hidden>Bolsa</span>
            <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 py-0.5 text-[11px] text-stone-950">{itemCount}</span>
          </button>
        </div>
      </header>

      {children}

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 py-10 text-sm text-stone-500 sm:flex-row sm:items-center lg:px-8">
          <div><p className="font-semibold text-stone-900">{store.name}</p><p className="mt-1">Tienda creada con InfinityShop.</p></div>
          <div className="flex flex-wrap gap-5">
            {store.settings?.contactEmail && <a href={`mailto:${store.settings.contactEmail}`}>Contacto</a>}
            {store.settings?.whatsapp && <a href={`https://wa.me/${store.settings.whatsapp.replace(/\D/g, "")}`} rel="noreferrer" target="_blank">WhatsApp</a>}
          </div>
        </div>
      </footer>

      <CartDrawer currency={store.settings?.currency ?? "ARS"} onClose={() => setCartOpen(false)} open={cartOpen} primaryColor={primaryColor} />
    </div>
  );
}

function CartDrawer({ currency, onClose, open, primaryColor }: { currency: string; onClose: () => void; open: boolean; primaryColor: string }) {
  const { items, subtotalInCents, removeItem, setQuantity, clear } = useCart();

  return (
    <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <button aria-label="Cerrar carrito" className={`absolute inset-0 bg-black/35 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} type="button" />
      <aside className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5 sm:px-7">
          <div><p className="text-lg font-semibold">Tu carrito</p><p className="mt-0.5 text-xs text-stone-400">{items.length} productos distintos</p></div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-xl" onClick={onClose} type="button">×</button>
        </div>

        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-stone-100 text-3xl">◇</span><p className="mt-5 text-lg font-semibold">Tu carrito está vacío</p><p className="mt-2 text-sm leading-6 text-stone-400">Agregá productos del catálogo para verlos acá.</p></div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
              {items.map((item) => (
                <article className="flex gap-4" key={item.id}>
                  <ProductImage className="h-20 w-20 shrink-0 rounded-2xl" image={item.images[0]} name={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{formatMoney(item.priceInCents, currency)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-stone-200">
                        <button className="h-8 w-8" onClick={() => setQuantity(item.id, item.quantity - 1)} type="button">−</button>
                        <span className="min-w-7 text-center text-xs font-semibold">{item.quantity}</span>
                        <button className="h-8 w-8 disabled:text-stone-300" disabled={item.quantity >= item.stock} onClick={() => setQuantity(item.id, item.quantity + 1)} type="button">+</button>
                      </div>
                      <button className="text-xs font-semibold text-red-600" onClick={() => removeItem(item.id)} type="button">Quitar</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="border-t border-stone-100 px-5 py-5 sm:px-7">
              <div className="mb-5 flex items-center justify-between"><span className="text-sm text-stone-500">Subtotal</span><strong className="text-xl">{formatMoney(subtotalInCents, currency)}</strong></div>
              <button className="w-full rounded-full px-5 py-3.5 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }} type="button">Finalizar compra — próximamente</button>
              <button className="mt-3 w-full py-2 text-xs font-semibold text-stone-400" onClick={clear} type="button">Vaciar carrito</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function ProductImage({ image, name, className }: { image?: string; name: string; className: string }) {
  return (
    <div
      aria-label={name}
      className={`grid place-items-center overflow-hidden bg-stone-100 bg-cover bg-center ${className}`}
      role="img"
      style={image ? { backgroundImage: `url(${image})` } : { background: "linear-gradient(145deg, #e7e5e4, #fafaf9)" }}
    >
      {!image && <span className="font-serif text-2xl text-stone-400">{name.slice(0, 1)}</span>}
    </div>
  );
}

export { formatMoney };
