"use client";

import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { CustomerDetail, CustomerSummary } from "./types";

type Pagination = { page: number; pageSize: number; total: number; pages: number };

const money = (amount: number, currency = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount / 100);

const orderStatus: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function CustomersView() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(page = 1, term = search) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (term.trim()) query.set("search", term.trim());
      const response = await apiRequest<{ customers: CustomerSummary[]; pagination: Pagination }>(`/admin/customers?${query}`);
      setCustomers(response.customers);
      setPagination(response.pagination);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const query = new URLSearchParams({ page: "1", pageSize: "20" });
    void apiRequest<{ customers: CustomerSummary[]; pagination: Pagination }>(`/admin/customers?${query}`)
      .then((response) => {
        setCustomers(response.customers);
        setPagination(response.pagination);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "No se pudieron cargar los clientes"))
      .finally(() => setLoading(false));
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(1);
  }

  async function open(customerId: string) {
    setError("");
    try {
      const response = await apiRequest<{ customer: CustomerDetail }>(`/admin/customers/${customerId}`);
      setSelected(response.customer);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo abrir el cliente");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clientes</h2>
          <p className="mt-1 text-sm text-stone-400">Contactos e historial de compras de tu tienda.</p>
        </div>
        <form className="flex w-full max-w-md gap-2" onSubmit={submitSearch}>
          <input aria-label="Buscar clientes" className="control" onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, email o teléfono" value={search} />
          <button className="rounded-xl bg-stone-950 px-5 text-sm font-semibold text-white" type="submit">Buscar</button>
        </form>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="rounded-2xl bg-white py-24 text-center text-sm text-stone-400">Cargando clientes…</div>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-24 text-center">
          <p className="text-lg font-semibold">No encontramos clientes</p>
          <p className="mt-2 text-sm text-stone-400">Los compradores aparecerán aquí después del checkout.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b bg-stone-50 text-xs uppercase tracking-wider text-stone-400">
                <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Contacto</th><th className="px-5 py-3">Pedidos</th><th className="px-5 py-3 text-right">Compras aprobadas</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((customer) => (
                  <tr className="cursor-pointer hover:bg-stone-50" key={customer.id} onClick={() => void open(customer.id)}>
                    <td className="px-5 py-4"><strong>{customer.firstName} {customer.lastName}</strong><p className="text-xs text-stone-400">Desde {new Date(customer.createdAt).toLocaleDateString("es-AR")}</p></td>
                    <td className="px-5 py-4">{customer.email}<p className="text-xs text-stone-400">{customer.phone ?? "Sin teléfono"}</p></td>
                    <td className="px-5 py-4">{customer._count.orders}</td>
                    <td className="px-5 py-4 text-right font-semibold">{money(customer.approvedSpentInCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-stone-500">
          <span>{pagination.total} cliente{pagination.total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-stone-200 bg-white px-4 py-2 disabled:opacity-40" disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)} type="button">Anterior</button>
            <span>Página {pagination.page} de {pagination.pages}</span>
            <button className="rounded-xl border border-stone-200 bg-white px-4 py-2 disabled:opacity-40" disabled={pagination.page >= pagination.pages || loading} onClick={() => void load(pagination.page + 1)} type="button">Siguiente</button>
          </div>
        </div>
      )}

      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CustomerDrawer({ customer, onClose }: { customer: CustomerDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <button aria-label="Cerrar detalle" className="absolute inset-0" onClick={onClose} type="button" />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
        <header className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Cliente</p><h2 className="mt-1 text-3xl font-semibold">{customer.firstName} {customer.lastName}</h2></div>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-xl" onClick={onClose} type="button">×</button>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Pedidos" value={String(customer.stats.orders)} />
          <Stat label="Pagados" value={String(customer.stats.approvedOrders)} />
          <Stat label="Total aprobado" value={money(customer.stats.approvedSpentInCents)} />
        </section>

        <section className="mt-6 rounded-2xl bg-stone-50 p-5">
          <h3 className="mb-4 font-semibold">Datos de contacto</h3>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Email" value={customer.email} />
            <Detail label="Teléfono" value={customer.phone ?? "—"} />
            <Detail label="Primer registro" value={new Date(customer.createdAt).toLocaleString("es-AR")} />
            <Detail label="Última actualización" value={new Date(customer.updatedAt).toLocaleString("es-AR")} />
          </dl>
        </section>

        <section className="mt-6 rounded-2xl bg-stone-50 p-5">
          <h3 className="mb-4 font-semibold">Historial de pedidos</h3>
          {customer.orders.length === 0 ? <p className="text-sm text-stone-400">Todavía no tiene pedidos.</p> : (
            <div className="divide-y divide-stone-200">
              {customer.orders.map((order) => (
                <div className="flex items-center justify-between gap-4 py-4" key={order.id}>
                  <div><strong className="text-sm">Pedido #{order.number}</strong><p className="text-xs text-stone-400">{new Date(order.createdAt).toLocaleDateString("es-AR")} · {order._count.items} productos · {orderStatus[order.status] ?? order.status}</p></div>
                  <div className="text-right"><strong className="text-sm">{money(order.totalInCents, order.currency)}</strong><p className={`text-xs ${order.paymentStatus === "APPROVED" ? "text-emerald-700" : "text-stone-400"}`}>{order.paymentStatus === "APPROVED" ? "Pago aprobado" : "Pago pendiente"}</p></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-stone-950 p-4 text-white"><p className="text-xs text-stone-400">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-stone-400">{label}</dt><dd className="mt-1 font-medium text-stone-700">{value}</dd></div>;
}
