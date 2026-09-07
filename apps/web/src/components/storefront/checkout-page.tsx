"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useCart } from "./cart-context";
import { StorefrontError, StorefrontLoading } from "./catalog-page";
import { ReceiptUploader } from "./receipt-uploader";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { CheckoutResult, PublicStore, StorefrontCustomer } from "./types";

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
  const [postalCode, setPostalCode] = useState("");
  const [savedCartEmail, setSavedCartEmail] = useState("");
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null);
  const [customerSessionToken, setCustomerSessionToken] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "MERCADO_PAGO"
  >(store.paymentMethods.mercadoPago ? "MERCADO_PAGO" : "BANK_TRANSFER");
  const currency = store.settings?.currency ?? "ARS";
  const shippingMethods = useMemo(
    () =>
      store.shippingZones.flatMap((zone) =>
        zone.methods.map((method) => ({
          ...method,
          zoneName: zone.name,
          postalPrefixes: zone.postalPrefixes,
        })),
      ),
    [store.shippingZones],
  );
  const eligibleShippingMethods = useMemo(
    () =>
      shippingMethods.filter(
        (method) =>
          method.postalPrefixes.length === 0 ||
          !postalCode.trim() ||
          method.postalPrefixes.some((prefix) =>
            postalCode.trim().toUpperCase().startsWith(prefix.toUpperCase()),
          ),
      ),
    [postalCode, shippingMethods],
  );
  const shippingInCents =
    shippingMethods.find(({ id }) => id === shippingMethodId)?.priceInCents ??
    0;
  const finalTotalInCents = Math.max(
    0,
    subtotalInCents - discountInCents + shippingInCents,
  );

  useEffect(() => {
    const storageKey = `infinityshop:customer:${store.slug}`;
    const token = localStorage.getItem(storageKey) ?? "";
    if (!token) return;
    apiRequest<{ customer: StorefrontCustomer }>(
      `/storefront/${store.slug}/customer-auth/session`,
      { headers: { "x-customer-session": token } },
    )
      .then(({ customer: activeCustomer }) => {
        setCustomerSessionToken(token);
        setCustomer(activeCustomer);
      })
      .catch(() => {
        localStorage.removeItem(storageKey);
        setCustomerSessionToken("");
      });
  }, [store.slug]);

  function updatePostalCode(value: string) {
    setPostalCode(value);
    const selectedMethod = shippingMethods.find(
      ({ id }) => id === shippingMethodId,
    );
    if (
      selectedMethod &&
      selectedMethod.postalPrefixes.length > 0 &&
      !selectedMethod.postalPrefixes.some((prefix) =>
        value.trim().toUpperCase().startsWith(prefix.toUpperCase()),
      )
    )
      setShippingMethodId("");
  }

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
          headers: customerSessionToken
            ? { "x-customer-session": customerSessionToken }
            : undefined,
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

  if (result)
    return (
      <OrderConfirmation
        customerLoggedIn={Boolean(customerSessionToken)}
        result={result}
        store={store}
      />
    );
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
            <form
              className="mt-8 space-y-5"
              key={customer?.email ?? "guest-checkout"}
              onSubmit={submit}
            >
              {customer ? (
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Comprás como {customer.firstName} {customer.lastName}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Este pedido aparecerá automáticamente en tu cuenta.
                    </p>
                  </div>
                  <Link className="text-xs font-bold text-emerald-800 underline" href={`/tienda/${store.slug}/mis-pedidos`}>
                    Ver mi cuenta
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-600">
                  ¿Ya tenés una cuenta?{" "}
                  <Link className="font-bold text-stone-950 underline" href={`/tienda/${store.slug}/mis-pedidos`}>
                    Iniciá sesión
                  </Link>{" "}
                  para guardar este pedido en “Mis pedidos”.
                </div>
              )}
              <FormCard description="Datos para identificarte y enviarte las novedades del pedido." step="01" title="Contacto">
                <div className="grid gap-4 sm:grid-cols-2">
                  <CheckoutField defaultValue={customer?.firstName} label="Nombre" name="firstName" readOnly={Boolean(customer)} />
                  <CheckoutField defaultValue={customer?.lastName} label="Apellido" name="lastName" readOnly={Boolean(customer)} />
                  <CheckoutField
                    defaultValue={customer?.email}
                    label="Email"
                    name="email"
                    type="email"
                    onBlur={(value) => void saveAbandonedCart(value)}
                    readOnly={Boolean(customer)}
                  />
                  <CheckoutField label="Teléfono" name="phone" />
                </div>
              </FormCard>
              <FormCard description="Indicá dónde querés recibir la compra." step="02" title="Entrega">
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
                    onChange={updatePostalCode}
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
                <FormCard description="Mostramos las opciones disponibles para tu código postal." step="03" title="Método de envío">
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
                    {eligibleShippingMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.zoneName} · {method.name} ·{" "}
                        {formatMoney(method.priceInCents, currency)}
                        {method.estimatedDays
                          ? ` · ${method.estimatedDays} días`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {postalCode && eligibleShippingMethods.length === 0 && (
                    <p className="mt-3 text-sm text-red-700">
                      No encontramos envíos disponibles para ese código postal.
                    </p>
                  )}
                </FormCard>
              )}
              <FormCard
                description="Si tenés un código promocional, aplicalo antes de pagar."
                step={shippingMethods.length > 0 ? "04" : "03"}
                title="Descuento"
              >
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
              <FormCard description="Elegí cómo querés abonar tu compra." step={shippingMethods.length > 0 ? "05" : "04"} title="Pago">
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
                style={{ backgroundColor: store.settings?.primaryColor ?? "#171417" }}
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
  description,
  step,
  children,
}: {
  title: string;
  description?: string;
  step?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex gap-4">
        {step && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">
            {step}
          </span>
        )}
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
          )}
        </div>
      </div>
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
  onChange,
  defaultValue,
  readOnly = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  onBlur?: (value: string) => void;
  onChange?: (value: string) => void;
  defaultValue?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      <input
        className="control"
        defaultValue={defaultValue}
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
        required={required}
        readOnly={readOnly}
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
          <div className="flex gap-3" key={item.cartKey}>
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
  customerLoggedIn,
}: {
  result: CheckoutResult;
  store: PublicStore;
  customerLoggedIn: boolean;
}) {
  if (result.payment.method !== "BANK_TRANSFER") return null;
  const payment = result.payment;
  const accentColor = store.settings?.primaryColor ?? "#6E3482";
  return (
    <main className="relative overflow-hidden px-5 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
        style={{ backgroundColor: accentColor }}
      />
      <div className="relative mx-auto max-w-6xl">
        <Link
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 transition hover:text-stone-950"
          href={`/tienda/${store.slug}`}
        >
          ← Volver a la tienda
        </Link>

        <header className="mt-7 flex flex-col justify-between gap-7 border-b border-stone-200 pb-9 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              <CheckCircle2 size={14} /> Pedido recibido
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Pedido #{result.order.number}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-stone-500 sm:text-base">
              Tu compra ya está reservada. Completá la transferencia y enviá
              el comprobante para que la tienda pueda confirmar el pago.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <Clock3 style={{ color: accentColor }} size={19} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Reserva activa</p>
              <p className="mt-0.5 text-sm font-semibold">{payment.reservationHours} horas</p>
            </div>
          </div>
        </header>

        <div className="mt-9 grid gap-7 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <section className="overflow-hidden rounded-[1.75rem] border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(28,20,30,0.08)]">
            <div className="flex items-center justify-between gap-5 border-b border-stone-100 px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-100">
                  <Landmark size={18} />
                </span>
                <div>
                  <p className="font-semibold">Datos de transferencia</p>
                  <p className="mt-0.5 text-xs text-stone-400">Copiá los datos sin errores</p>
                </div>
              </div>
              <ShieldCheck className="text-emerald-600" size={21} />
            </div>

            <div className="px-6 py-6 sm:px-8">
              <div
                className="rounded-3xl px-5 py-5 text-white sm:px-6"
                style={{ backgroundColor: accentColor }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Total exacto a transferir</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  {formatMoney(result.order.totalInCents, result.order.currency)}
                </p>
              </div>
              <dl className="mt-5 divide-y divide-stone-100">
                {payment.bankName && <DataRow label="Banco" value={payment.bankName} />}
                {payment.alias && <DataRow copyable label="Alias" value={payment.alias} />}
                {payment.cvu && <DataRow copyable label="CVU" value={payment.cvu} />}
                {payment.cuit && <DataRow copyable label="CUIT" value={payment.cuit} />}
                {payment.holder && <DataRow label="Titular" value={payment.holder} />}
              </dl>
            </div>
          </section>

          <div className="space-y-5 lg:sticky lg:top-28">
            <section className="rounded-[1.75rem] border border-black/[0.07] bg-[#f7f5f7] p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Cómo continuar</p>
              <ol className="mt-5 space-y-4">
                <ConfirmationStep number="1" text="Transferí el total exacto a la cuenta indicada." />
                <ConfirmationStep number="2" text="Adjuntá una imagen o PDF del comprobante." />
                <ConfirmationStep number="3" text="La tienda revisará el pago y actualizará tu pedido." />
              </ol>
            </section>
            <ReceiptUploader
              accentColor={accentColor}
              orderId={result.order.id}
              orderToken={result.orderToken}
              slug={store.slug}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-stone-200 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-stone-400">Guardá el número #{result.order.number} para identificar tu compra.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {customerLoggedIn && (
              <Link
                className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-bold text-stone-800 transition hover:border-stone-400"
                href={`/tienda/${store.slug}/mis-pedidos`}
              >
                Ir a Mis pedidos
              </Link>
            )}
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
              href={`/tienda/${store.slug}/pedido/${result.order.id}`}
              style={{ backgroundColor: accentColor }}
            >
              Ver estado del pedido <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function ConfirmationStep({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold shadow-sm">{number}</span>
      <p className="pt-1 text-sm leading-5 text-stone-600">{text}</p>
    </li>
  );
}

function DataRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex items-center justify-between gap-5 py-3.5">
      <dt className="text-xs font-medium text-stone-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right text-sm font-semibold">
        <span className="break-all">{value}</span>
        {copyable && (
          <button
            aria-label={`Copiar ${label}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-950"
            onClick={() => void copyValue()}
            type="button"
          >
            {copied ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
          </button>
        )}
      </dd>
    </div>
  );
}
