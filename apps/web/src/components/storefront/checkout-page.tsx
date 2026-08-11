"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useCart } from "./cart-context";
import { StorefrontError, StorefrontLoading } from "./catalog-page";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { CheckoutResult, PublicStore } from "./types";

export function CheckoutPage({ slug }: { slug: string }) {
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
  return <StorefrontShell store={store}><Checkout store={store} /></StorefrontShell>;
}

function Checkout({ store }: { store: PublicStore }) {
  const { items, subtotalInCents, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const currency = store.settings?.currency ?? "ARS";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<CheckoutResult>(`/storefront/${store.slug}/orders`, {
        method: "POST",
        body: JSON.stringify({
          customer: {
            email: form.get("email"),
            firstName: form.get("firstName"),
            lastName: form.get("lastName"),
            phone: form.get("phone"),
            shippingAddress: form.get("shippingAddress"),
            notes: form.get("notes") || null,
          },
          items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
          paymentMethod: "BANK_TRANSFER",
        }),
      });
      setResult(response);
      clear();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos crear el pedido");
    } finally {
      setBusy(false);
    }
  }

  if (result) return <OrderConfirmation result={result} store={store} />;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Link className="text-sm font-medium text-stone-500 hover:text-stone-950" href={`/tienda/${store.slug}`}>← Seguir comprando</Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_25rem] lg:items-start">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Checkout seguro</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Completá tu pedido</h1>
          {items.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-20 text-center"><p className="text-lg font-semibold">Tu carrito está vacío</p><Link className="mt-5 inline-block rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white" href={`/tienda/${store.slug}`}>Volver al catálogo</Link></div>
          ) : (
            <form className="mt-8 space-y-7" onSubmit={submit}>
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="font-semibold">Datos de contacto</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2"><CheckoutField label="Nombre" name="firstName" /><CheckoutField label="Apellido" name="lastName" /><CheckoutField label="Email" name="email" type="email" /><CheckoutField label="Teléfono" name="phone" /></div>
              </div>
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="font-semibold">Entrega</h2>
                <div className="mt-5 space-y-4"><label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Dirección completa</span><textarea className="control min-h-24 resize-y" name="shippingAddress" placeholder="Calle, número, piso, localidad y provincia" required /></label><label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Notas <span className="font-normal text-stone-400">(opcional)</span></span><textarea className="control min-h-20 resize-y" name="notes" placeholder="Indicaciones para la entrega" /></label></div>
              </div>
              <div className="rounded-3xl border-2 border-stone-950 bg-white p-5 sm:p-7"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-950 text-white">$</span><div><p className="font-semibold">Transferencia bancaria</p><p className="mt-1 text-sm leading-6 text-stone-500">Al confirmar te mostraremos los datos para realizar la transferencia. El pedido quedará pendiente hasta que la tienda confirme el pago.</p></div></div></div>
              {error && <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
              <button className="w-full rounded-full bg-stone-950 px-6 py-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Creando pedido…" : `Confirmar pedido por ${formatMoney(subtotalInCents, currency)}`}</button>
            </form>
          )}
        </section>
        <OrderSummary currency={currency} />
      </div>
    </main>
  );
}

function OrderSummary({ currency }: { currency: string }) {
  const { items, subtotalInCents } = useCart();
  return <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 sm:p-6"><h2 className="font-semibold">Resumen</h2><div className="mt-5 space-y-4">{items.map((item) => <div className="flex gap-3" key={item.id}><ProductImage className="h-16 w-16 shrink-0 rounded-xl" image={item.images[0]} name={item.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-stone-400">Cantidad: {item.quantity}</p></div><p className="text-sm font-semibold">{formatMoney(item.priceInCents * item.quantity, currency)}</p></div>)}</div><div className="mt-6 flex justify-between border-t border-stone-100 pt-5"><span className="text-sm text-stone-500">Total</span><strong className="text-xl">{formatMoney(subtotalInCents, currency)}</strong></div></aside>;
}

function OrderConfirmation({ result, store }: { result: CheckoutResult; store: PublicStore }) {
  const paymentConfigured = result.payment.alias || result.payment.bankName;
  return <main className="mx-auto max-w-2xl px-5 py-16 text-center sm:py-24"><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</span><p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Pedido recibido</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Pedido #{result.order.number}</h1><p className="mx-auto mt-4 max-w-lg leading-7 text-stone-500">Reservamos tus productos. Realizá la transferencia para que la tienda pueda confirmar el pago y preparar el pedido.</p><section className="mt-9 rounded-3xl border border-stone-200 bg-white p-6 text-left shadow-sm sm:p-8"><div className="flex justify-between border-b border-stone-100 pb-5"><span className="text-sm text-stone-500">Total a transferir</span><strong className="text-xl">{formatMoney(result.order.totalInCents, result.order.currency)}</strong></div>{paymentConfigured ? <dl className="mt-5 space-y-3 text-sm">{result.payment.bankName && <DataRow label="Banco" value={result.payment.bankName} />}{result.payment.alias && <DataRow label="Alias" value={result.payment.alias} />}{result.payment.holder && <DataRow label="Titular" value={result.payment.holder} />}</dl> : <p className="mt-5 text-sm leading-6 text-amber-700">La tienda todavía no cargó sus datos bancarios. Contactala para recibir las instrucciones de pago.</p>}</section><Link className="mt-8 inline-block rounded-full bg-stone-950 px-7 py-3.5 text-sm font-bold text-white" href={`/tienda/${store.slug}`}>Volver a la tienda</Link></main>;
}

function CheckoutField({ label, name, type = "text" }: { label: string; name: string; type?: string }) {
  return <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">{label}</span><input className="control" name={name} required type={type} /></label>;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-6"><dt className="text-stone-400">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>;
}
