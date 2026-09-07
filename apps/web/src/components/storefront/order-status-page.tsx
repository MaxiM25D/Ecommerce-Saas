"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileCheck2, PackageCheck, RefreshCw, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { ReceiptUploader } from "./receipt-uploader";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { PublicStore } from "./types";

type PublicOrder = {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  stockExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  currency: string;
  subtotalInCents: number;
  discountInCents: number;
  shippingInCents: number;
  totalInCents: number;
  shippingAddress: string | null;
  shippingMethod: string | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPriceInCents: number;
    subtotalInCents: number;
    image: string | null;
    productSlug: string | null;
  }>;
  customer: { email: string; firstName: string; lastName: string; hasAccount: boolean };
  receipt: { originalName: string; updatedAt: string } | null;
  shipment: { carrier: string; trackingCode: string | null; trackingUrl: string | null; estimatedDelivery: string | null } | null;
  statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
};

const orderLabels: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
const paymentLabels: Record<string, string> = {
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
  CANCELLED: "Pago cancelado",
  REFUNDED: "Pago reembolsado",
};

function paymentLabel(order: PublicOrder) {
  if (order.paymentStatus === "PENDING") return order.receipt ? "Pago en revisión" : "Pago pendiente";
  return paymentLabels[order.paymentStatus] ?? order.paymentStatus;
}

function fetchOrder(slug: string, orderId: string, orderToken?: string, customerSessionToken?: string) {
  return apiRequest<{ order: PublicOrder }>(`/storefront/${slug}/orders/${orderId}`, {
    headers: {
      ...(orderToken ? { "x-order-token": orderToken } : {}),
      ...(customerSessionToken ? { "x-customer-session": customerSessionToken } : {}),
    },
  });
}

export function OrderStatusPage({ slug, orderId, accessToken }: { slug: string; orderId: string; accessToken?: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [store, setStore] = useState<PublicStore | null>(null);
  const [orderToken, setOrderToken] = useState("");
  const [customerSessionToken, setCustomerSessionToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedOrderToken = localStorage.getItem(`infinityshop:order:${slug}:${orderId}`);
    const portalSession = localStorage.getItem(`infinityshop:customer:${slug}`);
    const token = accessToken || storedOrderToken || "";
    if (accessToken) {
      localStorage.setItem(`infinityshop:order:${slug}:${orderId}`, accessToken);
      window.history.replaceState({}, "", `/tienda/${slug}/pedido/${orderId}`);
    }
    if (!token && !portalSession) {
      queueMicrotask(() => setError("No encontramos el acceso a este pedido en este navegador."));
      return;
    }
    Promise.all([
      fetchOrder(slug, orderId, token, portalSession ?? undefined),
      apiRequest<{ store: PublicStore }>(`/storefront/${slug}`),
    ])
      .then(([{ order: activeOrder }, { store: activeStore }]) => {
        setOrderToken(token);
        setCustomerSessionToken(portalSession ?? "");
        setOrder(activeOrder);
        setStore(activeStore);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "No pudimos consultar el pedido"));
  }, [accessToken, slug, orderId]);

  async function refreshOrder() {
    if (!orderToken && !customerSessionToken) return;
    const response = await fetchOrder(slug, orderId, orderToken, customerSessionToken);
    setOrder(response.order);
  }

  if (error) return (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold">No pudimos abrir el pedido</h1>
      <p className="mt-4 text-stone-500">{error}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link className="rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white" href={`/tienda/${slug}`}>Volver a la tienda</Link>
        <Link className="rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-bold" href={`/tienda/${slug}/mis-pedidos`}>Acceder a Mis pedidos</Link>
      </div>
    </main>
  );

  if (!order || !store) return <main className="grid min-h-screen place-items-center text-sm text-stone-500">Consultando pedido…</main>;

  const accentColor = store.settings?.primaryColor ?? "#6E3482";
  const accountQuery = new URLSearchParams({
    email: order.customer.email,
    firstName: order.customer.firstName,
    lastName: order.customer.lastName,
    mode: order.customer.hasAccount ? "login" : "register",
  });
  const ordersHref = customerSessionToken ? `/tienda/${slug}/mis-pedidos` : `/tienda/${slug}/mis-pedidos?${accountQuery.toString()}`;

  return (
    <StorefrontShell store={store}>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border-b border-stone-200 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Seguimiento</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Pedido #{order.number}</h1>
            <div className="mt-5 flex flex-wrap gap-2"><Badge>{orderLabels[order.status] ?? order.status}</Badge><Badge>{paymentLabel(order)}</Badge></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-xs font-bold transition hover:border-stone-400" href={`/tienda/${slug}`}><ArrowLeft size={14} /> Volver a la tienda</Link>
            <Link className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg" href={ordersHref} style={{ backgroundColor: accentColor }}><ShoppingBag size={15} /> Ver mis pedidos</Link>
          </div>
        </div>

        <OrderProgress accentColor={accentColor} status={order.status} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-start">
          <div className="space-y-6">
            {order.receipt && (
              <section className="flex items-start gap-4 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><FileCheck2 size={20} /></span>
                <div className="min-w-0"><strong className="text-emerald-900">Comprobante recibido</strong><p className="mt-1 truncate text-sm text-emerald-700">{order.receipt.originalName}</p>{order.paymentStatus === "PENDING" && <p className="mt-2 text-xs leading-5 text-emerald-700">La tienda está revisando tu transferencia. Te avisaremos cuando el pago sea confirmado.</p>}</div>
              </section>
            )}

            <section className="rounded-[1.75rem] border border-black/[0.07] bg-white p-6 shadow-[0_18px_60px_rgba(28,20,30,0.06)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-100"><Clock3 size={18} /></span><div><h2 className="font-semibold">Historial del pedido</h2><p className="mt-0.5 text-xs text-stone-400">Últimas actualizaciones</p></div></div>
                <button aria-label="Actualizar pedido" className="grid h-9 w-9 place-items-center rounded-xl border border-stone-200 text-stone-500 hover:text-stone-950" onClick={() => void refreshOrder()} type="button"><RefreshCw size={15} /></button>
              </div>
              <ol className="mt-7">
                {order.statusHistory.map((item, index) => (
                  <li className="relative flex gap-4 pb-7 last:pb-0" key={`${item.status}-${item.createdAt}`}>
                    {index < order.statusHistory.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-stone-200" />}
                    <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: accentColor }}><CheckCircle2 size={15} /></span>
                    <div className="pt-1"><p className="text-sm font-semibold">{orderLabels[item.status] ?? item.status}</p><p className="mt-1 text-xs text-stone-400">{new Date(item.createdAt).toLocaleString("es-AR")}{item.note ? ` · ${item.note}` : ""}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            {order.shipment && (
              <section className="rounded-[1.75rem] border border-black/[0.07] bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3"><PackageCheck size={20} /><h2 className="font-semibold">Datos del envío</h2></div>
                <dl className="mt-5 grid gap-3 text-sm"><Row label="Transportista" value={order.shipment.carrier} />{order.shipment.trackingCode && <Row label="Código" value={order.shipment.trackingCode} />}{order.shipment.estimatedDelivery && <Row label="Entrega estimada" value={new Date(order.shipment.estimatedDelivery).toLocaleDateString("es-AR")} />}</dl>
                {order.shipment.trackingUrl && <a className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white" href={order.shipment.trackingUrl} rel="noreferrer" style={{ backgroundColor: accentColor }} target="_blank">Seguir envío <ArrowRight size={14} /></a>}
              </section>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28">
            <OrderSummary order={order} slug={slug} />
            {order.paymentMethod === "BANK_TRANSFER" &&
              (orderToken || customerSessionToken) && (
                <ReceiptUploader
                  accentColor={accentColor}
                  customerSessionToken={customerSessionToken || undefined}
                  existingReceiptName={order.receipt?.originalName}
                  onUploaded={refreshOrder}
                  orderId={order.id}
                  orderToken={orderToken}
                  slug={slug}
                />
              )}
          </aside>
        </div>
      </main>
    </StorefrontShell>
  );
}

const progressStages = [
  { status: "PENDING", label: "Recibido" },
  { status: "CONFIRMED", label: "Confirmado" },
  { status: "PREPARING", label: "Preparando" },
  { status: "SHIPPED", label: "Enviado" },
  { status: "DELIVERED", label: "Entregado" },
];

function OrderProgress({
  status,
  accentColor,
}: {
  status: string;
  accentColor: string;
}) {
  if (status === "CANCELLED")
    return (
      <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        <strong>Pedido cancelado.</strong> El seguimiento de esta compra fue
        cerrado.
      </section>
    );
  const currentIndex = Math.max(
    0,
    progressStages.findIndex((stage) => stage.status === status),
  );
  return (
    <section className="mt-8 overflow-x-auto rounded-[1.75rem] border border-black/[0.07] bg-white px-5 py-6 shadow-[0_12px_40px_rgba(28,20,30,0.04)] sm:px-8">
      <ol className="grid min-w-[34rem] grid-cols-5">
        {progressStages.map((stage, index) => {
          const completed = index <= currentIndex;
          return (
            <li className="relative text-center" key={stage.status}>
              {index > 0 && (
                <span
                  className="absolute right-1/2 top-4 h-0.5 w-full"
                  style={{
                    backgroundColor:
                      index <= currentIndex ? accentColor : "#e7e5e4",
                  }}
                />
              )}
              <span
                className="relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border-2 bg-white"
                style={{
                  borderColor: completed ? accentColor : "#d6d3d1",
                  color: completed ? accentColor : "#a8a29e",
                }}
              >
                {index < currentIndex ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </span>
              <p
                className={`mt-3 text-[11px] font-bold ${completed ? "text-stone-800" : "text-stone-400"}`}
              >
                {stage.label}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OrderSummary({ order, slug }: { order: PublicOrder; slug: string }) {
  const reservationExpired = Boolean(
    order.stockExpiresAt && new Date(order.stockExpiresAt) <= new Date(),
  );
  return (
    <section className="rounded-[1.75rem] border border-black/[0.07] bg-white p-5 shadow-[0_18px_60px_rgba(28,20,30,0.06)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
            Resumen
          </p>
          <h2 className="mt-1 font-semibold">Tu compra</h2>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1.5 text-[10px] font-bold text-stone-600">
          {order.paymentMethod === "BANK_TRANSFER"
            ? "Transferencia"
            : "Mercado Pago"}
        </span>
      </div>

      <div className="mt-5 space-y-4 border-y border-stone-100 py-5">
        {order.items.map((item) => {
          const content = (
            <>
              <ProductImage
                className="h-14 w-14 shrink-0 rounded-2xl"
                image={item.image ?? undefined}
                name={item.productName}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {item.productName}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {item.variantName ? `${item.variantName} · ` : ""}
                  {item.quantity} × {formatMoney(item.unitPriceInCents, order.currency)}
                </p>
              </div>
              <p className="text-sm font-semibold">
                {formatMoney(item.subtotalInCents, order.currency)}
              </p>
            </>
          );
          return item.productSlug ? (
            <Link
              className="flex items-center gap-3"
              href={`/tienda/${slug}/producto/${item.productSlug}`}
              key={item.id}
            >
              {content}
            </Link>
          ) : (
            <div className="flex items-center gap-3" key={item.id}>
              {content}
            </div>
          );
        })}
      </div>

      <dl className="mt-5 space-y-2.5 text-sm">
        <SummaryRow
          label="Subtotal"
          value={formatMoney(order.subtotalInCents, order.currency)}
        />
        {order.discountInCents > 0 && (
          <SummaryRow
            label="Descuento"
            value={`− ${formatMoney(order.discountInCents, order.currency)}`}
          />
        )}
        <SummaryRow
          label="Envío"
          value={
            order.shippingInCents > 0
              ? formatMoney(order.shippingInCents, order.currency)
              : "Sin cargo"
          }
        />
      </dl>
      <div className="mt-4 flex items-end justify-between border-t border-stone-100 pt-4">
        <span className="text-sm text-stone-500">Total</span>
        <strong className="text-2xl tracking-[-0.04em]">
          {formatMoney(order.totalInCents, order.currency)}
        </strong>
      </div>

      {(order.shippingAddress || order.shippingMethod) && (
        <div className="mt-5 rounded-2xl bg-stone-50 px-4 py-4 text-xs leading-5 text-stone-500">
          <strong className="block text-stone-800">Entrega</strong>
          {order.shippingMethod && <span>{order.shippingMethod}</span>}
          {order.shippingMethod && order.shippingAddress && <span> · </span>}
          {order.shippingAddress && <span>{order.shippingAddress}</span>}
        </div>
      )}

      {order.paymentStatus === "PENDING" && order.stockExpiresAt && (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-xs ${reservationExpired ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
        >
          {reservationExpired
            ? "La reserva de stock venció. Consultá con la tienda antes de pagar."
            : `Stock reservado hasta ${new Date(order.stockExpiresAt).toLocaleString("es-AR")}.`}
        </p>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-5">
      <dt className="text-stone-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm">{children}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-6 border-b border-stone-100 py-2 last:border-0"><dt className="text-stone-400">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}
