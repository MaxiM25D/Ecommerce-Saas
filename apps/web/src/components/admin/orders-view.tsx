"use client";

import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiAbsoluteUrl, apiRequest } from "@/lib/api";
import type { OrderDetail, OrderSummary, Role } from "./types";

const statusLabels: Record<string, string> = { PENDING: "Pendiente", CONFIRMED: "Confirmado", PREPARING: "Preparando", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" };
const paymentLabels: Record<string, string> = { PENDING: "Pago pendiente", APPROVED: "Pago aprobado", REJECTED: "Pago rechazado", CANCELLED: "Pago cancelado", REFUNDED: "Reembolsado" };
const nextStatus: Record<string, { status: string; label: string } | undefined> = { CONFIRMED: { status: "PREPARING", label: "Empezar preparación" }, SHIPPED: { status: "DELIVERED", label: "Marcar como entregado" } };
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount / 100);

export function OrdersView({ role }: { role: Role }) {
  const canManage = role !== "STAFF";
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() { const response = await apiRequest<{ orders: OrderSummary[] }>("/admin/orders"); setOrders(response.orders); }
  useEffect(() => { void apiRequest<{ orders: OrderSummary[] }>("/admin/orders").then(({ orders }) => setOrders(orders)); }, []);
  async function open(orderId: string) { setError(""); const response = await apiRequest<{ order: OrderDetail }>(`/admin/orders/${orderId}`); setSelected(response.order); }

  async function update(body: { status?: string; paymentStatus?: string }) {
    if (!selected) return; setBusy(true); setError("");
    try { const response = await apiRequest<{ order: OrderDetail }>(`/admin/orders/${selected.id}`, { method: "PATCH", body: JSON.stringify(body) }); setSelected(response.order); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo actualizar el pedido"); }
    finally { setBusy(false); }
  }

  async function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<{ order: OrderDetail; notification: { sent: boolean; error: string | null } }>(`/admin/orders/${selected.id}/dispatch`, { method: "POST", body: JSON.stringify({ carrier: form.get("carrier"), trackingCode: form.get("trackingCode") || null, trackingUrl: form.get("trackingUrl") || null, estimatedDelivery: form.get("estimatedDelivery") || null }) });
      setSelected(response.order); if (!response.notification.sent) setError("El pedido fue despachado, pero el correo no pudo enviarse. Podés reintentarlo."); await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo despachar el pedido"); }
    finally { setBusy(false); }
  }

  async function retryEmail() {
    if (!selected) return; setBusy(true); setError("");
    try { const response = await apiRequest<{ notification: { sent: boolean; error: string | null }; shipment: OrderDetail["shipment"] }>(`/admin/orders/${selected.id}/shipment-email`, { method: "POST" }); setSelected({ ...selected, shipment: response.shipment }); if (!response.notification.sent) setError(response.notification.error ?? "El correo volvió a fallar"); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo reenviar el correo"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-7xl"><div className="mb-6"><h2 className="text-xl font-semibold">Pedidos</h2><p className="mt-1 text-sm text-stone-400">Pagos, comprobantes, preparación, despacho y entrega.</p></div>{orders.length === 0 ? <Empty /> : <OrderTable orders={orders} onOpen={(id) => void open(id)} />}{selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/35"><button aria-label="Cerrar detalle" className="absolute inset-0" onClick={() => setSelected(null)} type="button" /><aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8"><header className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Pedido</p><h2 className="mt-1 text-3xl font-semibold">#{selected.number}</h2></div><button className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-xl" onClick={() => setSelected(null)} type="button">×</button></header><div className="mt-6 flex flex-wrap gap-2"><Badge label={statusLabels[selected.status] ?? selected.status} /><Badge label={paymentLabels[selected.paymentStatus] ?? selected.paymentStatus} /></div>
      <Section title="Cliente y entrega"><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Cliente" value={selected.customerName} /><Detail label="Email" value={selected.customerEmail} /><Detail label="Teléfono" value={selected.customerPhone ?? "—"} /><Detail label="Dirección" value={selected.shippingAddress ?? "—"} /></dl></Section>
      <Section title="Productos"><div className="divide-y divide-stone-100">{selected.items.map((item) => <div className="flex justify-between gap-4 py-3" key={item.id}><div><p className="text-sm font-semibold">{item.productName}</p><p className="text-xs text-stone-400">{item.quantity} × {money(item.unitPriceInCents, selected.currency)}</p></div><strong className="text-sm">{money(item.subtotalInCents, selected.currency)}</strong></div>)}</div></Section>
      {selected.paymentReceipt && <Section title="Comprobante de transferencia"><p className="text-sm text-stone-500">{selected.paymentReceipt.originalName}</p><button className="mt-4 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold" onClick={() => window.open(apiAbsoluteUrl(`/admin/orders/${selected.id}/receipt`), "_blank", "noopener,noreferrer")} type="button">Ver comprobante ↗</button></Section>}
      {selected.shipment && <Section title="Envío"><dl className="grid gap-3 text-sm"><Detail label="Transportista" value={selected.shipment.carrier} /><Detail label="Seguimiento" value={selected.shipment.trackingCode ?? "—"} /><Detail label="Email" value={selected.shipment.notificationStatus} /></dl>{selected.shipment.notificationStatus === "FAILED" && canManage && <Action disabled={busy} label="Reintentar correo" onClick={() => void retryEmail()} />}</Section>}
      <Section title="Historial"><ol className="space-y-3">{selected.statusHistory.map((entry) => <li className="flex gap-3 text-sm" key={entry.id}><span className="mt-1.5 h-2 w-2 rounded-full bg-amber-700" /><div><strong>{statusLabels[entry.status] ?? entry.status}</strong><p className="text-xs text-stone-400">{new Date(entry.createdAt).toLocaleString("es-AR")}{entry.note ? ` · ${entry.note}` : ""}</p></div></li>)}</ol></Section>
      {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {canManage && <section className="mt-8 space-y-3 border-t border-stone-200 pt-6"><h3 className="font-semibold">Acciones</h3>{selected.paymentMethod === "BANK_TRANSFER" && selected.paymentStatus === "PENDING" && <div className="grid gap-2 sm:grid-cols-2"><Action disabled={busy || !selected.paymentReceipt} label="Aprobar transferencia" onClick={() => void update({ paymentStatus: "APPROVED" })} primary /><Action disabled={busy} label="Rechazar comprobante" onClick={() => void update({ paymentStatus: "REJECTED" })} /></div>}{nextStatus[selected.status] && <Action disabled={busy} label={nextStatus[selected.status]!.label} onClick={() => void update({ status: nextStatus[selected.status]!.status })} primary />}{selected.status === "PREPARING" && <DispatchForm busy={busy} onSubmit={dispatch} />}{["PENDING", "CONFIRMED", "PREPARING"].includes(selected.status) && <Action danger disabled={busy} label="Cancelar pedido y reponer stock" onClick={() => void update({ status: "CANCELLED" })} />}</section>}
    </aside></div>}</div>;
}

function OrderTable({ orders, onOpen }: { orders: OrderSummary[]; onOpen: (id: string) => void }) { return <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[52rem] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase tracking-wider text-stone-400"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Pago</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-stone-100">{orders.map((order) => <tr className="cursor-pointer hover:bg-stone-50" key={order.id} onClick={() => onOpen(order.id)}><td className="px-5 py-4"><strong>#{order.number}</strong><p className="text-xs text-stone-400">{new Date(order.createdAt).toLocaleDateString("es-AR")}</p></td><td className="px-5 py-4">{order.customerName}<p className="text-xs text-stone-400">{order._count.items} productos</p></td><td className="px-5 py-4"><Badge label={statusLabels[order.status] ?? order.status} /></td><td className="px-5 py-4"><Badge label={paymentLabels[order.paymentStatus] ?? order.paymentStatus} />{order.paymentReceipt && <p className="mt-1 text-xs text-emerald-700">Comprobante adjunto</p>}</td><td className="px-5 py-4 text-right font-semibold">{money(order.totalInCents, order.currency)}</td></tr>)}</tbody></table></div></div>; }
function DispatchForm({ busy, onSubmit }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="space-y-3 rounded-2xl bg-stone-50 p-4" onSubmit={onSubmit}><h4 className="text-sm font-semibold">Preparar envío</h4><input className="control" name="carrier" placeholder="Transportista" required /><input className="control" name="trackingCode" placeholder="Código de seguimiento" /><input className="control" name="trackingUrl" placeholder="https://seguimiento..." type="url" /><label className="block text-xs text-stone-500">Entrega estimada<input className="control mt-1" name="estimatedDelivery" type="date" /></label><button className="w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy} type="submit">Despachar y notificar</button></form>; }
function Empty() { return <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-24 text-center"><p className="text-lg font-semibold">Todavía no hay pedidos</p></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-6 rounded-2xl bg-stone-50 p-5"><h3 className="mb-4 font-semibold">{title}</h3>{children}</section>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-stone-400">{label}</dt><dd className="mt-1 font-medium text-stone-700">{value}</dd></div>; }
function Badge({ label }: { label: string }) { return <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">{label}</span>; }
function Action({ label, onClick, disabled, primary, danger }: { label: string; onClick: () => void; disabled: boolean; primary?: boolean; danger?: boolean }) { return <button className={`mt-2 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40 ${danger ? "bg-red-50 text-red-700" : primary ? "bg-stone-950 text-white" : "border border-stone-200"}`} disabled={disabled} onClick={onClick} type="button">{label}</button>; }
