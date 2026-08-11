"use client";

import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { OrderDetail, OrderSummary, Role } from "./types";

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
const paymentLabels: Record<string, string> = {
  PENDING: "Pago pendiente",
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
  REFUNDED: "Reembolsado",
};
const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  PENDING: { status: "CONFIRMED", label: "Confirmar pedido" },
  CONFIRMED: { status: "PREPARING", label: "Empezar preparación" },
  PREPARING: { status: "SHIPPED", label: "Marcar como enviado" },
  SHIPPED: { status: "DELIVERED", label: "Marcar como entregado" },
};

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount / 100);

export function OrdersView({ role }: { role: Role }) {
  const canManage = role !== "STAFF";
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await apiRequest<{ orders: OrderSummary[] }>("/admin/orders");
    setOrders(response.orders);
  }

  useEffect(() => { void apiRequest<{ orders: OrderSummary[] }>("/admin/orders").then(({ orders }) => setOrders(orders)); }, []);

  async function open(orderId: string) {
    setError("");
    const response = await apiRequest<{ order: OrderDetail }>(`/admin/orders/${orderId}`);
    setSelected(response.order);
  }

  async function update(body: { status?: string; paymentStatus?: string }) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest<{ order: OrderDetail }>(`/admin/orders/${selected.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setSelected(response.order);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo actualizar el pedido");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-7xl">
    <div className="mb-6"><h2 className="text-xl font-semibold tracking-tight">Pedidos</h2><p className="mt-1 text-sm text-stone-400">Controlá pagos, preparación y entrega.</p></div>
    {orders.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-24 text-center"><p className="text-lg font-semibold">Todavía no hay pedidos</p><p className="mt-2 text-sm text-stone-400">Los pedidos creados desde la tienda aparecerán acá.</p></div> : <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[52rem] text-left text-sm"><thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wider text-stone-400"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Pago</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-stone-100">{orders.map((order) => <tr className="cursor-pointer hover:bg-stone-50" key={order.id} onClick={() => void open(order.id)}><td className="px-5 py-4"><p className="font-semibold">#{order.number}</p><p className="mt-1 text-xs text-stone-400">{new Date(order.createdAt).toLocaleDateString("es-AR")}</p></td><td className="px-5 py-4"><p className="font-medium">{order.customerName}</p><p className="mt-1 text-xs text-stone-400">{order._count.items} productos</p></td><td className="px-5 py-4"><StatusBadge status={order.status} /></td><td className="px-5 py-4"><PaymentBadge status={order.paymentStatus} /></td><td className="px-5 py-4 text-right font-semibold">{money(order.totalInCents, order.currency)}</td></tr>)}</tbody></table></div></div>}

    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/35"><button aria-label="Cerrar detalle" className="absolute inset-0" onClick={() => setSelected(null)} type="button" /><aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Pedido</p><h2 className="mt-1 text-3xl font-semibold">#{selected.number}</h2></div><button className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-xl" onClick={() => setSelected(null)} type="button">×</button></div>
      <div className="mt-7 flex flex-wrap gap-2"><StatusBadge status={selected.status} /><PaymentBadge status={selected.paymentStatus} /></div>
      <section className="mt-7 rounded-2xl bg-stone-50 p-5"><h3 className="font-semibold">Cliente y entrega</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Cliente" value={selected.customerName} /><Detail label="Email" value={selected.customerEmail} /><Detail label="Teléfono" value={selected.customerPhone ?? "—"} /><Detail label="Dirección" value={selected.shippingAddress ?? "—"} />{selected.notes && <div className="sm:col-span-2"><Detail label="Notas" value={selected.notes} /></div>}</dl></section>
      <section className="mt-6"><h3 className="font-semibold">Productos</h3><div className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200">{selected.items.map((item) => <div className="flex justify-between gap-4 p-4" key={item.id}><div><p className="text-sm font-semibold">{item.productName}</p><p className="mt-1 text-xs text-stone-400">{item.sku} · {item.quantity} × {money(item.unitPriceInCents, selected.currency)}</p></div><p className="text-sm font-semibold">{money(item.subtotalInCents, selected.currency)}</p></div>)}</div><div className="mt-4 flex justify-between text-lg"><span>Total</span><strong>{money(selected.totalInCents, selected.currency)}</strong></div></section>
      {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {canManage && <section className="mt-8 space-y-3 border-t border-stone-200 pt-6"><h3 className="font-semibold">Acciones</h3>{selected.paymentStatus === "PENDING" && <div className="grid gap-2 sm:grid-cols-2"><Action disabled={busy} label="Aprobar transferencia" onClick={() => void update({ paymentStatus: "APPROVED" })} primary /><Action disabled={busy} label="Rechazar pago" onClick={() => void update({ paymentStatus: "REJECTED" })} /></div>}{selected.paymentStatus === "APPROVED" && <Action disabled={busy} label="Marcar reembolso" onClick={() => void update({ paymentStatus: "REFUNDED" })} />}{nextStatus[selected.status] && <Action disabled={busy} label={nextStatus[selected.status]!.label} onClick={() => void update({ status: nextStatus[selected.status]!.status })} primary />}{["PENDING", "CONFIRMED", "PREPARING"].includes(selected.status) && <Action danger disabled={busy} label="Cancelar pedido y reponer stock" onClick={() => void update({ status: "CANCELLED" })} />}</section>}
    </aside></div>}
  </div>;
}

function StatusBadge({ status }: { status: string }) { return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{statusLabels[status] ?? status}</span>; }
function PaymentBadge({ status }: { status: string }) { const approved = status === "APPROVED"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${approved ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{paymentLabels[status] ?? status}</span>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-stone-400">{label}</dt><dd className="mt-1 font-medium text-stone-700">{value}</dd></div>; }
function Action({ label, onClick, disabled, primary, danger }: { label: string; onClick: () => void; disabled: boolean; primary?: boolean; danger?: boolean }) { return <button className={`w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${danger ? "bg-red-50 text-red-700" : primary ? "bg-stone-950 text-white" : "border border-stone-200"}`} disabled={disabled} onClick={onClick} type="button">{label}</button>; }
