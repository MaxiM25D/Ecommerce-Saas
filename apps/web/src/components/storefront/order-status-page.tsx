"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

type PublicOrder = {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  stockExpiresAt: string | null;
  receipt: { originalName: string; updatedAt: string } | null;
  shipment: { carrier: string; trackingCode: string | null; trackingUrl: string | null; estimatedDelivery: string | null } | null;
  statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
};

const labels: Record<string, string> = { PENDING: "Pendiente", CONFIRMED: "Confirmado", PREPARING: "En preparación", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" };

export function OrderStatusPage({ slug, orderId }: { slug: string; orderId: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(`infinityshop:order:${slug}:${orderId}`);
    if (!token) { queueMicrotask(() => setError("No encontramos el acceso a este pedido en este navegador.")); return; }
    apiRequest<{ order: PublicOrder }>(`/storefront/${slug}/orders/${orderId}`, { headers: { "x-order-token": token } })
      .then(({ order }) => setOrder(order))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "No pudimos consultar el pedido"));
  }, [slug, orderId]);

  if (error) return <main className="mx-auto max-w-2xl px-5 py-24 text-center"><h1 className="text-3xl font-semibold">No pudimos abrir el pedido</h1><p className="mt-4 text-stone-500">{error}</p><Link className="mt-8 inline-block rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white" href={`/tienda/${slug}`}>Volver a la tienda</Link></main>;
  if (!order) return <main className="grid min-h-screen place-items-center text-sm text-stone-500">Consultando pedido…</main>;

  return <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Seguimiento</p><h1 className="mt-2 text-4xl font-semibold">Pedido #{order.number}</h1><div className="mt-7 flex flex-wrap gap-2"><Badge>{labels[order.status] ?? order.status}</Badge><Badge>Pago: {labels[order.paymentStatus] ?? order.paymentStatus}</Badge></div>{order.receipt && <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><strong className="text-emerald-800">Comprobante recibido</strong><p className="mt-1 text-sm text-emerald-700">{order.receipt.originalName}</p></section>}{order.shipment && <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6"><h2 className="font-semibold">Datos del envío</h2><dl className="mt-4 grid gap-3 text-sm"><Row label="Transportista" value={order.shipment.carrier} />{order.shipment.trackingCode && <Row label="Código" value={order.shipment.trackingCode} />}{order.shipment.estimatedDelivery && <Row label="Entrega estimada" value={new Date(order.shipment.estimatedDelivery).toLocaleDateString("es-AR")} />}</dl>{order.shipment.trackingUrl && <a className="mt-5 inline-block rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white" href={order.shipment.trackingUrl} rel="noreferrer" target="_blank">Seguir envío ↗</a>}</section>}<section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6"><h2 className="font-semibold">Historial</h2><ol className="mt-5 space-y-4">{order.statusHistory.map((item) => <li className="flex gap-4" key={`${item.status}-${item.createdAt}`}><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-700" /><div><p className="text-sm font-semibold">{labels[item.status] ?? item.status}</p><p className="mt-0.5 text-xs text-stone-400">{new Date(item.createdAt).toLocaleString("es-AR")}{item.note ? ` · ${item.note}` : ""}</p></div></li>)}</ol></section><Link className="mt-8 inline-block text-sm font-semibold text-stone-600" href={`/tienda/${slug}`}>← Volver a la tienda</Link></main>;
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700">{children}</span>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-6"><dt className="text-stone-400">{label}</dt><dd className="font-semibold">{value}</dd></div>; }
