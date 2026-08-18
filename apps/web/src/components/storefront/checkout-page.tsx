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
      .then(({ store }) => {
        if (active) setStore(store);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof ApiError
              ? caught.message
              : "No pudimos abrir esta tienda",
          );
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) return <StorefrontError message={error} />;
  if (!store) return <StorefrontLoading />;
  return (
    <StorefrontShell store={store}>
      <Checkout store={store} />
    </StorefrontShell>
  );
}

function Checkout({ store }: { store: PublicStore }) {
  const { items, subtotalInCents, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [discountInCents, setDiscountInCents] = useState(0);
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [savedCartEmail, setSavedCartEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "MERCADO_PAGO"
  >(store.paymentMethods.mercadoPago ? "MERCADO_PAGO" : "BANK_TRANSFER");
  const currency = store.settings?.currency ?? "ARS";
  const shippingMethods = store.shippingZones.flatMap((zone) =>
    zone.methods.map((method) => ({ ...method, zoneName: zone.name })),
  );
  const shippingInCents =
    shippingMethods.find(({ id }) => id === shippingMethodId)?.priceInCents ??
    0;
  const finalTotalInCents = Math.max(
    0,
    subtotalInCents - discountInCents + shippingInCents,
  );

  async function applyCoupon() {
    setError("");
    try {
      const response = await apiRequest<{
        coupon: { code: string; discountInCents: number };
      }>(
        `/storefront/${store.slug}/coupons/${encodeURIComponent(couponCode)}?subtotal=${subtotalInCents}`,
      );
      setCouponCode(response.coupon.code);
      setDiscountInCents(response.coupon.discountInCents);
    } catch (caught) {
      setDiscountInCents(0);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos aplicar el cupón",
      );
    }
  }

  async function saveAbandonedCart(email: string) {
    if (!email || email === savedCartEmail || items.length === 0) return;
    setSavedCartEmail(email);
    await apiRequest(`/storefront/${store.slug}/carts`, {
      method: "POST",
      body: JSON.stringify({
        email,
        items: items.map((item) => ({
          productId: item.id,
          variantId: item.selectedVariant?.id ?? null,
          quantity: item.quantity,
        })),
      }),
    }).catch(() => undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<CheckoutResult>(
        `/storefront/${store.slug}/orders`,
        {
          method: "POST",
          body: JSON.stringify({
            customer: {
              email: form.get("email"),
              firstName: form.get("firstName"),
              lastName: form.get("lastName"),
              phone: form.get("phone"),
              shippingAddress: form.get("shippingAddress"),
              postalCode: form.get("postalCode") || null,
              notes: form.get("notes") || null,
            },
            items: items.map((item) => ({
              productId: item.id,
              variantId: item.selectedVariant?.id ?? null,
              quantity: item.quantity,
            })),
            paymentMethod,
            couponCode: couponCode || null,
            shippingMethodId: shippingMethodId || null,
          }),
        },
      );
      localStorage.setItem(
        `infinityshop:order:${store.slug}:${response.order.id}`,
        response.orderToken,
      );
      clear();
      if (response.payment.method === "MERCADO_PAGO") {
        window.location.assign(response.payment.checkoutUrl);
        return;
      }
      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos crear el pedido",
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) return <OrderConfirmation result={result} store={store} />;
  const hasPaymentMethod =
    store.paymentMethods.bankTransfer || store.paymentMethods.mercadoPago;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Link
        className="text-sm font-medium text-stone-500 hover:text-stone-950"
        href={`/tienda/${store.slug}`}
      >
        ← Seguir comprando
      </Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_25rem] lg:items-start">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            Checkout seguro
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Completá tu pedido
          </h1>
          {items.length === 0 ? (
            <EmptyCart slug={store.slug} />
          ) : (
            <form className="mt-8 space-y-7" onSubmit={submit}>
              <FormCard title="Datos de contacto">
                <div className="grid gap-4 sm:grid-cols-2">
                  <CheckoutField label="Nombre" name="firstName" />
                  <CheckoutField label="Apellido" name="lastName" />
                  <CheckoutField
                    label="Email"
                    name="email"
                    type="email"
                    onBlur={(value) => void saveAbandonedCart(value)}
                  />
                  <CheckoutField label="Teléfono" name="phone" />
                </div>
              </FormCard>
              <FormCard title="Entrega">
                <div className="space-y-4">
                  <TextArea
                    label="Dirección completa"
                    name="shippingAddress"
                    placeholder="Calle, número, piso, localidad y provincia"
                    required
                  />
                  <CheckoutField
                    label="Código postal"
                    name="postalCode"
                    required={false}
                  />
                  <TextArea
                    label="Notas (opcional)"
                    name="notes"
                    placeholder="Indicaciones para la entrega"
                  />
                </div>
              </FormCard>
              {shippingMethods.length > 0 && (
                <FormCard title="Método de envío">
                  <select
                    className="control"
                    name="shippingMethodId"
                    value={shippingMethodId}
                    onChange={(event) =>
                      setShippingMethodId(event.target.value)
                    }
                    required
                  >
                    <option value="">Seleccioná una opción</option>
                    {shippingMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.zoneName} · {method.name} ·{" "}
                        {formatMoney(method.priceInCents, currency)}
                        {method.estimatedDays
                          ? ` · ${method.estimatedDays} días`
                          : ""}
                      </option>
                    ))}
                  </select>
                </FormCard>
              )}
              <FormCard title="Cupón">
                <div className="flex gap-3">
                  <input
                    className="control"
                    onChange={(event) =>
                      setCouponCode(event.target.value.toUpperCase())
                    }
                    placeholder="Código promocional"
                    value={couponCode}
                  />
                  <button
                    className="rounded-xl bg-stone-950 px-5 text-sm font-bold text-white"
                    onClick={() => void applyCoupon()}
                    type="button"
                  >
                    Aplicar
                  </button>
                </div>
                {discountInCents > 0 && (
                  <p className="mt-3 text-sm font-semibold text-emerald-700">
                    Descuento aplicado: {formatMoney(discountInCents, currency)}
                  </p>
                )}
              </FormCard>
              <FormCard title="Forma de pago">
                <div className="grid gap-3">
                  {store.paymentMethods.mercadoPago && (
                    <PaymentOption
                      checked={paymentMethod === "MERCADO_PAGO"}
                      description="Tarjeta, débito o saldo mediante Checkout Pro."
                      label="Mercado Pago"
                      onChange={() => setPaymentMethod("MERCADO_PAGO")}
                    />
                  )}
                  {store.paymentMethods.bankTransfer && (
                    <PaymentOption
                      checked={paymentMethod === "BANK_TRANSFER"}
                      description="Recibí los datos bancarios y adjuntá el comprobante."
                      label="Transferencia bancaria"
                      onChange={() => setPaymentMethod("BANK_TRANSFER")}
                    />
                  )}
                  {!hasPaymentMethod && (
                    <p className="text-sm text-red-700">
                      La tienda todavía no configuró medios de pago.
                    </p>
                  )}
                </div>
              </FormCard>
              {error && (
                <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                className="w-full rounded-full bg-stone-950 px-6 py-4 text-sm font-bold text-white disabled:opacity-50"
                disabled={busy || !hasPaymentMethod}
                type="submit"
              >
                {busy
                  ? "Creando pedido…"
                  : `Confirmar pedido por ${formatMoney(finalTotalInCents, currency)}`}
              </button>
            </form>
          )}
        </section>
        <OrderSummary
          currency={currency}
          discountInCents={discountInCents}
          shippingInCents={shippingInCents}
        />
      </div>
    </main>
  );
}

function EmptyCart({ slug }: { slug: string }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-20 text-center">
      <p className="text-lg font-semibold">Tu carrito está vacío</p>
      <Link
        className="mt-5 inline-block rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white"
        href={`/tienda/${slug}`}
      >
        Volver al catálogo
      </Link>
    </div>
  );
}
function FormCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="mb-5 font-semibold">{title}</h2>
      {children}
    </div>
  );
}
function TextArea({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      <textarea
        className="control min-h-20 resize-y"
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}
function CheckoutField({
  label,
  name,
  type = "text",
  required = true,
  onBlur,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  onBlur?: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      <input
        className="control"
        name={name}
        required={required}
        type={type}
        onBlur={(event) => onBlur?.(event.target.value)}
      />
    </label>
  );
}

function PaymentOption({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-4 ${checked ? "border-stone-950 bg-stone-50" : "border-stone-200"}`}
    >
      <input
        checked={checked}
        className="mt-1 h-4 w-4 accent-stone-950"
        name="paymentMethod"
        onChange={onChange}
        type="radio"
      />
      <span>
        <strong className="block text-sm">{label}</strong>
        <span className="mt-1 block text-xs leading-5 text-stone-500">
          {description}
        </span>
      </span>
    </label>
  );
}

function OrderSummary({
  currency,
  discountInCents,
  shippingInCents,
}: {
  currency: string;
  discountInCents: number;
  shippingInCents: number;
}) {
  const { items, subtotalInCents } = useCart();
  return (
    <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 sm:p-6">
      <h2 className="font-semibold">Resumen</h2>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div className="flex gap-3" key={item.id}>
            <ProductImage
              className="h-16 w-16 shrink-0 rounded-xl"
              image={item.images[0]}
              name={item.name}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-stone-400">
                Cantidad: {item.quantity}
              </p>
              {item.selectedVariant && (
                <p className="mt-1 text-xs text-stone-400">
                  {item.selectedVariant.name}
                </p>
              )}
            </div>
            <p className="text-sm font-semibold">
              {formatMoney(item.priceInCents * item.quantity, currency)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2 border-t border-stone-100 pt-5 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Subtotal</span>
          <span>{formatMoney(subtotalInCents, currency)}</span>
        </div>
        {discountInCents > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Descuento</span>
            <span>− {formatMoney(discountInCents, currency)}</span>
          </div>
        )}
        {shippingInCents > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-500">Envío</span>
            <span>{formatMoney(shippingInCents, currency)}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-between border-t border-stone-100 pt-4">
        <span className="text-sm text-stone-500">Total</span>
        <strong className="text-xl">
          {formatMoney(
            Math.max(0, subtotalInCents - discountInCents + shippingInCents),
            currency,
          )}
        </strong>
      </div>
    </aside>
  );
}

function OrderConfirmation({
  result,
  store,
}: {
  result: CheckoutResult;
  store: PublicStore;
}) {
  if (result.payment.method !== "BANK_TRANSFER") return null;
  const payment = result.payment;
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-center sm:py-24">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
        ✓
      </span>
      <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        Pedido recibido
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Pedido #{result.order.number}
      </h1>
      <p className="mx-auto mt-4 max-w-lg leading-7 text-stone-500">
        Reservamos tus productos durante {payment.reservationHours} horas.
        Transferí el total exacto y adjuntá el comprobante.
      </p>
      <section className="mt-9 rounded-3xl border border-stone-200 bg-white p-6 text-left shadow-sm sm:p-8">
        <div className="flex justify-between border-b border-stone-100 pb-5">
          <span className="text-sm text-stone-500">Total</span>
          <strong className="text-xl">
            {formatMoney(result.order.totalInCents, result.order.currency)}
          </strong>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          {payment.bankName && (
            <DataRow label="Banco" value={payment.bankName} />
          )}
          {payment.alias && <DataRow label="Alias" value={payment.alias} />}
          {payment.cvu && <DataRow label="CVU" value={payment.cvu} />}
          {payment.cuit && <DataRow label="CUIT" value={payment.cuit} />}
          {payment.holder && <DataRow label="Titular" value={payment.holder} />}
        </dl>
      </section>
      <ReceiptUpload
        orderId={result.order.id}
        orderToken={result.orderToken}
        slug={store.slug}
      />
      <Link
        className="mt-8 inline-block rounded-full bg-stone-950 px-7 py-3.5 text-sm font-bold text-white"
        href={`/tienda/${store.slug}/pedido/${result.order.id}`}
      >
        Ver estado del pedido
      </Link>
    </main>
  );
}

function ReceiptUpload({
  slug,
  orderId,
  orderToken,
}: {
  slug: string;
  orderId: string;
  orderToken: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.append("receipt", file);
    try {
      await apiRequest(`/storefront/${slug}/orders/${orderId}/receipt`, {
        method: "POST",
        headers: { "x-order-token": orderToken },
        body: form,
      });
      setMessage(
        "Comprobante enviado correctamente. La tienda ya puede revisarlo.",
      );
      setFile(null);
    } catch (caught) {
      setMessage(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos enviar el comprobante",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 text-left shadow-sm sm:p-8">
      <h2 className="font-semibold">Adjuntar comprobante</h2>
      <p className="mt-1 text-sm text-stone-500">
        PDF, JPG, PNG o WEBP de hasta 8 MB.
      </p>
      <input
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="mt-5 block w-full text-sm"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        type="file"
      />
      {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}
      <button
        className="mt-5 w-full rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
        disabled={!file || busy}
        onClick={() => void upload()}
        type="button"
      >
        {busy ? "Enviando…" : "Enviar comprobante"}
      </button>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-stone-400">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
