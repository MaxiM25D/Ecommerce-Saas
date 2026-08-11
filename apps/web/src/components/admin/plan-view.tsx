"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

type Plan = { id: string; code: string; name: string; priceInCents: number; currency: string; maxProducts: number; maxMembers: number; maxOrdersPerMonth: number };
type Data = {
  subscription: { status: string; cancelAtPeriodEnd: boolean; trialEndsAt: string | null; plan: Plan };
  usage: { products: number; members: number; monthlyOrders: number };
  plans: Plan[];
};

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);

export function PlanView() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { void apiRequest<Data>("/admin/subscription").then(setData); }, []);
  if (!data) return <div className="h-80 animate-pulse rounded-2xl bg-stone-200" />;
  const { plan } = data.subscription;
  return <div className="mx-auto max-w-7xl space-y-7">
    <section className="rounded-3xl bg-stone-950 p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b89b72]">Suscripción</p><h2 className="mt-2 text-3xl font-semibold">Plan {plan.name}</h2><p className="mt-2 text-sm text-stone-400">Estado: {data.subscription.status}</p></div><div className="sm:text-right"><p className="text-3xl font-semibold">{money(plan.priceInCents, plan.currency)}</p><p className="mt-1 text-xs text-stone-400">por mes</p></div></div></section>
    <section><h2 className="text-xl font-semibold">Uso del plan</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><Usage label="Productos" value={data.usage.products} limit={plan.maxProducts} /><Usage label="Miembros" value={data.usage.members} limit={plan.maxMembers} /><Usage label="Pedidos este mes" value={data.usage.monthlyOrders} limit={plan.maxOrdersPerMonth} /></div></section>
    <section><h2 className="text-xl font-semibold">Planes disponibles</h2><p className="mt-1 text-sm text-stone-400">Los cambios de plan se gestionan por ahora desde el equipo de InfinityShop.</p><div className="mt-5 grid gap-4 lg:grid-cols-3">{data.plans.map((item) => <article className={`rounded-2xl border bg-white p-6 ${item.id === plan.id ? "border-amber-600 ring-2 ring-amber-100" : "border-stone-200"}`} key={item.id}><div className="flex justify-between"><h3 className="text-lg font-semibold">{item.name}</h3>{item.id === plan.id && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Actual</span>}</div><p className="mt-4 text-2xl font-semibold">{money(item.priceInCents, item.currency)}</p><ul className="mt-5 space-y-2 text-sm text-stone-500"><li>Hasta {item.maxProducts} productos</li><li>Hasta {item.maxMembers} miembros</li><li>{item.maxOrdersPerMonth} pedidos mensuales</li></ul></article>)}</div></section>
  </div>;
}

function Usage({ label, value, limit }: { label: string; value: number; limit: number }) {
  const percentage = Math.min(100, Math.round((value / limit) * 100));
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><p className="text-sm font-medium text-stone-500">{label}</p><p className="text-sm font-semibold">{value} / {limit}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${percentage >= 90 ? "bg-red-500" : "bg-amber-600"}`} style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-stone-400">{percentage}% utilizado</p></article>;
}
