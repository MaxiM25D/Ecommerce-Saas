"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import type { Dashboard } from "./types";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    apiRequest<Dashboard>("/admin/dashboard").then(setData);
  }, []);

  if (!data) return <Skeleton />;

  const metrics = [
    { label: "Ventas aprobadas", value: money.format(data.metrics.approvedRevenueInCents / 100), note: `${data.metrics.orders} pedidos` },
    { label: "Productos", value: data.metrics.products, note: `${data.metrics.activeProducts} activos` },
    { label: "Clientes", value: data.metrics.customers, note: "registrados" },
    { label: "Categorías", value: data.metrics.categories, note: "en catálogo" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section>
        <p className="text-sm text-stone-500">Una vista rápida de cómo está funcionando tu tienda.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={metric.label}>
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-medium text-stone-500">{metric.label}</p>
                <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
              </div>
              <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
              <p className="mt-1 text-xs text-stone-400">{metric.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5">
          <div>
            <h2 className="font-semibold">Pedidos recientes</h2>
            <p className="mt-1 text-xs text-stone-400">Los últimos cinco movimientos de la tienda</p>
          </div>
        </div>
        {data.recentOrders.length === 0 ? (
          <Empty text="Todavía no hay pedidos. Cuando llegue el primero, aparecerá acá." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-400">
                <tr><th className="px-6 py-3">Pedido</th><th className="px-6 py-3">Cliente</th><th className="px-6 py-3">Estado</th><th className="px-6 py-3 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 font-semibold">#{order.number}</td>
                    <td className="px-6 py-4 text-stone-600">{order.customerName}</td>
                    <td className="px-6 py-4"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{order.status}</span></td>
                    <td className="px-6 py-4 text-right font-semibold">{money.format(order.totalInCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Skeleton() {
  return <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div className="h-36 rounded-2xl bg-stone-200" key={item} />)}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-6 py-16 text-center text-sm text-stone-400">{text}</div>;
}
