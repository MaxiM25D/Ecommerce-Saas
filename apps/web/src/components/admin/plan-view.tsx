"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role } from "./types";

type Plan = {
  id: string; code: "STARTER" | "PRO"; name: string; description: string | null;
  priceInCents: number; currency: string; maxProducts: number; maxMembers: number; features: string[];
};
type Invoice = {
  id: string; status: string; planName: string; amountInCents: number; currency: string;
  periodFrom: string | null; paidAt: string | null; failureReason: string | null; createdAt: string;
};
type Data = {
  subscription: {
    status: string; cancelAtPeriodEnd: boolean; trialEndsAt: string | null; currentPeriodTo: string | null;
    providerStatus: string | null; providerCheckoutUrl: string | null; plan: Plan; pendingPlan: Plan | null;
  };
  usage: { products: number; members: number; monthlyOrders: number };
  plans: Plan[];
  invoices: Invoice[];
  billingConfigured: boolean;
};

const featureLabels: Record<string, string> = {
  CORE_CATALOG: "Catálogo, carrito y checkout", TENANT_MP_OAUTH: "Mercado Pago por tienda",
  BANK_TRANSFER: "Transferencias y comprobantes", STOCK_MANAGEMENT: "Stock y pedidos",
  BASIC_CUSTOMERS: "Gestión básica de clientes", FEATURED_PRODUCTS: "Destacados, marcas y etiquetas",
  BASIC_TRANSACTIONAL_EMAILS: "Emails transaccionales", BASIC_STORE_CUSTOMIZATION: "Personalización básica",
  STANDARD_DOMAIN: "URL estándar InfinityShop", ADVANCED_ANALYTICS: "Analytics avanzados",
  COUPONS_PROMOTIONS: "Cupones y promociones", PRODUCT_VARIANTS: "Variantes de productos",
  ABANDONED_CART_RECOVERY: "Carritos abandonados", AUTOMATIONS: "Automatizaciones",
  CUSTOM_EMAILS: "Emails personalizados", CUSTOM_DOMAIN: "Dominio personalizado",
  ADVANCED_STORE_CUSTOMIZATION: "Personalización avanzada", PRIORITY_SUPPORT: "Soporte prioritario",
};
const visibleFeatures = (features: string[]) => features.filter((feature) => featureLabels[feature]);
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("es-AR") : "—";

export function PlanView({ role }: { role: Role }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => setData(await apiRequest<Data>("/billing/overview")), []);
  useEffect(() => {
    let active = true;
    void apiRequest<Data>("/billing/overview")
      .then((value) => { if (active) setData(value); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo cargar la facturación"); });
    return () => { active = false; };
  }, []);

  async function action(path: string, body?: object) {
    setBusy(true); setError("");
    try { await apiRequest(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo completar la operación"); }
    finally { setBusy(false); }
  }

  async function choosePlan(planCode: Plan["code"]) {
    setBusy(true); setError("");
    try {
      const result = await apiRequest<{ checkoutUrl: string | null; requiresCheckout: boolean }>("/billing/checkout", { method: "POST", body: JSON.stringify({ planCode }) });
      if (result.requiresCheckout && result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar el plan"); }
    finally { setBusy(false); }
  }

  if (!data && !error) return <div className="h-80 animate-pulse rounded-2xl bg-stone-200" />;
  if (!data) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  const { subscription, usage } = data;
  const canManage = role === "OWNER";
  const renewalDate = subscription.status === "TRIALING" ? subscription.trialEndsAt : subscription.currentPeriodTo;

  return <div className="mx-auto max-w-7xl space-y-7">
    <section className="rounded-3xl bg-stone-950 p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b89b72]">Suscripción InfinityShop</p><h2 className="mt-2 text-3xl font-semibold">Plan {subscription.plan.name}</h2><p className="mt-2 text-sm text-stone-400">{statusLabel(subscription.status)} · {subscription.status === "TRIALING" ? "prueba hasta" : "próximo período"} {date(renewalDate)}</p>{subscription.pendingPlan && <p className="mt-2 text-sm text-amber-300">Cambio pendiente a {subscription.pendingPlan.name}</p>}</div><div className="sm:text-right"><p className="text-3xl font-semibold">{money(subscription.plan.priceInCents, subscription.plan.currency)}</p><p className="mt-1 text-xs text-stone-400">por mes</p></div></div>{subscription.cancelAtPeriodEnd && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-500/15 p-4 text-sm text-amber-100"><span>La suscripción se cancelará al terminar el período.</span>{canManage && <button disabled={busy} onClick={() => void action("/billing/resume")} className="font-semibold underline" type="button">Mantener suscripción</button>}</div>}{canManage && subscription.providerStatus && <button className="mt-5 text-xs font-semibold text-stone-400 underline" disabled={busy} onClick={() => void action("/billing/sync")} type="button">Actualizar estado desde Mercado Pago</button>}</section>

    {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

    <section><h2 className="text-xl font-semibold">Uso del plan</h2><p className="mt-1 text-sm text-stone-500">Los pedidos, checkout, seguridad y aislamiento no tienen límites por volumen.</p><div className="mt-4 grid gap-4 md:grid-cols-3"><Usage label="Productos" value={usage.products} limit={subscription.plan.maxProducts} /><Usage label="Miembros" value={usage.members} limit={subscription.plan.maxMembers} /><article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-stone-500">Pedidos este mes</p><p className="mt-3 text-3xl font-semibold">{usage.monthlyOrders}</p><p className="mt-2 text-xs text-emerald-700">Sin límite por plan</p></article></div></section>

    <section><h2 className="text-xl font-semibold">Planes disponibles</h2><p className="mt-1 text-sm text-stone-500">Los precios y permisos provienen de la configuración central de InfinityShop.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{data.plans.map((plan) => <article className={`flex flex-col rounded-2xl border bg-white p-6 ${plan.id === subscription.plan.id ? "border-amber-600 ring-2 ring-amber-100" : "border-stone-200"}`} key={plan.id}><div className="flex justify-between gap-4"><div><h3 className="text-xl font-semibold">{plan.name}</h3><p className="mt-2 text-sm text-stone-500">{plan.description}</p></div>{plan.id === subscription.plan.id && <span className="h-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Actual</span>}</div><p className="mt-5 text-3xl font-semibold">{money(plan.priceInCents, plan.currency)}<span className="text-sm font-normal text-stone-400"> / mes</span></p><p className="mt-3 text-sm font-medium">{plan.maxProducts} productos · {plan.maxMembers - 1} colaboradores</p><ul className="mt-5 grid gap-2 text-sm text-stone-500 sm:grid-cols-2">{visibleFeatures(plan.features).map((feature) => <li key={feature}>✓ {featureLabels[feature]}</li>)}</ul>{canManage && plan.id !== subscription.plan.id && <button className="mt-6 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !data.billingConfigured} onClick={() => void choosePlan(plan.code)} type="button">Elegir {plan.name}</button>}</article>)}</div>{!data.billingConfigured && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">El catálogo de planes ya está activo. Para cobrar automáticamente falta configurar las credenciales propias de Mercado Pago de InfinityShop.</p>}</section>

    <section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Historial de facturas</h2><p className="mt-1 text-sm text-stone-500">Cobros recurrentes de InfinityShop, separados de las ventas de tu tienda.</p></div>{canManage && !subscription.cancelAtPeriodEnd && subscription.status !== "CANCELED" && <button className="text-sm font-semibold text-red-600 disabled:opacity-50" disabled={busy} onClick={() => { if (window.confirm("¿Cancelar al finalizar el período actual?")) void action("/billing/cancel", { immediately: false }); }} type="button">Cancelar suscripción</button>}</div><div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-400"><tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Importe</th></tr></thead><tbody className="divide-y divide-stone-100">{data.invoices.map((invoice) => <tr key={invoice.id}><td className="px-5 py-4">{date(invoice.periodFrom ?? invoice.createdAt)}</td><td className="px-5 py-4">{invoice.planName}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoice.status === "PAID" ? "bg-emerald-50 text-emerald-700" : invoice.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{invoice.status}</span>{invoice.failureReason && <p className="mt-1 text-xs text-red-600">{invoice.failureReason}</p>}</td><td className="px-5 py-4 text-right font-semibold">{money(invoice.amountInCents, invoice.currency)}</td></tr>)}{data.invoices.length === 0 && <tr><td className="px-5 py-8 text-center text-stone-400" colSpan={4}>Todavía no hay facturas emitidas.</td></tr>}</tbody></table></div></div></section>
  </div>;
}

function statusLabel(status: string) { return ({ TRIALING: "Período de prueba", ACTIVE: "Activa", PAST_DUE: "Pago pendiente", CANCELED: "Cancelada" } as Record<string, string>)[status] ?? status; }

function Usage({ label, value, limit }: { label: string; value: number; limit: number }) {
  const percentage = Math.min(100, Math.round((value / limit) * 100));
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><p className="text-sm font-medium text-stone-500">{label}</p><p className="text-sm font-semibold">{value} / {limit}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${percentage >= 90 ? "bg-red-500" : "bg-amber-600"}`} style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-stone-400">{percentage}% utilizado</p></article>;
}
