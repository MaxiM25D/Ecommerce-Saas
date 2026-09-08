"use client";

import { Activity, ArrowLeft, Boxes, Building2, CircleDollarSign, CreditCard, ExternalLink, Globe2, MailCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, Store, TriangleAlert, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { EmptyState, Tip, panelStyles as styles } from "@/components/admin/guided-panel";
import { ApiError, apiRequest } from "@/lib/api";
import { confirmAction } from "@/lib/confirm-action";

type Overview = {
  tenants: number; activeTenants: number; users: number;
  subscriptions: Array<{ status: string; _count: number }>;
  estimatedMonthlyRevenueInCents: number; orders: number; approvedGmvInCents: number;
  storefrontViews: number; abandonedCarts: number;
  notifications: Array<{ status: string; _count: number }>;
  invoices: Array<{ status: string; _count: number }>;
  domains: Array<{ status: string; _count: number }>;
  trialsEndingSoon: number; newTenantsLast30Days: number;
};
type Plan = {
  id: string; code: string; name: string; priceInCents: number; currency: string;
  maxProducts: number; maxMembers: number; maxOrdersPerMonth: number | null;
  active: boolean; _count: { subscriptions: number };
};
type Tenant = {
  id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string;
  subscription: { status: string; cancelAtPeriodEnd: boolean; plan: Plan } | null;
  _count: { memberships: number; products: number; orders: number };
};
type Section = "overview" | "stores" | "plans" | "operations";

const money = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount / 100);
const subscriptionLabels: Record<string, string> = { TRIALING: "Prueba", ACTIVE: "Activa", PAST_DUE: "Pago pendiente", CANCELED: "Cancelada" };

export function PlatformPanel({ initialSection = "overview" }: { initialSection?: Section }) {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [section, setSection] = useState<Section>(initialSection);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const [subscriptionFilter, setSubscriptionFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [overviewData, plansData, tenantsData] = await Promise.all([
      apiRequest<Overview>("/platform/overview"),
      apiRequest<{ plans: Plan[] }>("/platform/plans"),
      apiRequest<{ tenants: Tenant[] }>("/platform/tenants"),
    ]);
    setOverview(overviewData); setPlans(plansData.plans); setTenants(tenantsData.tenants);
  }

  useEffect(() => {
    apiRequest<{ user: { platformRole: string } }>("/auth/me")
      .then(({ user }) => { if (user.platformRole !== "SUPERADMIN") router.replace("/admin"); else void load().catch(handleError); })
      .catch(() => router.replace("/login"));
  }, [router]);

  function handleError(caught: unknown) { setError(caught instanceof ApiError ? caught.message : "No se pudo completar la operación"); }

  function selectSection(nextSection: Section) {
    setSection(nextSection);
    router.replace(`/platform?section=${nextSection}`, { scroll: false });
  }

  async function refresh() {
    setBusy(true); setError(""); setNotice("");
    try { await load(); setNotice("Datos globales actualizados."); }
    catch (caught) { handleError(caught); }
    finally { setBusy(false); }
  }

  async function updateTenant(tenant: Tenant) {
    const nextStatus = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const suspending = nextStatus === "SUSPENDED";
    if (!(await confirmAction({
      title: suspending ? `¿Suspender ${tenant.name}?` : `¿Reactivar ${tenant.name}?`,
      description: suspending ? "Sus clientes no podrán comprar y su equipo perderá el acceso hasta reactivarla." : "La tienda y su panel volverán a estar disponibles.",
      confirmLabel: suspending ? "Suspender tienda" : "Reactivar tienda",
      tone: suspending ? "danger" : "primary",
    }))) return;
    setBusy(true); setError(""); setNotice("");
    try { await apiRequest(`/platform/tenants/${tenant.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }); await load(); setNotice(nextStatus === "ACTIVE" ? "Tienda reactivada." : "Tienda suspendida."); }
    catch (caught) { handleError(caught); }
    finally { setBusy(false); }
  }

  async function updateSubscription(tenant: Tenant, body: { planCode?: string; status?: string }) {
    const description = body.planCode
      ? `cambiar el plan de ${tenant.name} a ${plans.find((plan) => plan.code === body.planCode)?.name ?? body.planCode}`
      : `cambiar la suscripción de ${tenant.name} a ${subscriptionLabels[body.status ?? ""] ?? body.status}`;
    if (!(await confirmAction({ title: `¿Confirmás ${description}?`, description: "Este cambio administrativo se aplica directamente y no inicia un cobro en Mercado Pago.", confirmLabel: "Aplicar cambio" }))) return;
    setBusy(true); setError(""); setNotice("");
    try { await apiRequest(`/platform/tenants/${tenant.id}/subscription`, { method: "PATCH", body: JSON.stringify(body) }); await load(); setNotice("Suscripción actualizada."); }
    catch (caught) { handleError(caught); }
    finally { setBusy(false); }
  }

  const filteredTenants = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return tenants.filter((tenant) => {
      const matchesTerm = !term || [tenant.name, tenant.slug].some((value) => value.toLocaleLowerCase("es").includes(term));
      return matchesTerm && (tenantFilter === "ALL" || tenant.status === tenantFilter) && (subscriptionFilter === "ALL" || tenant.subscription?.status === subscriptionFilter);
    });
  }, [tenants, search, tenantFilter, subscriptionFilter]);

  if (!overview) return <main className="grid min-h-screen place-items-center bg-[#17131a] text-white"><div className="flex items-center gap-3 text-sm"><span className="h-3 w-3 animate-pulse rounded-full bg-[#a56abd]" /> Cargando plataforma…</div></main>;

  const activeSubscriptions = overview.subscriptions.filter(({ status }) => ["ACTIVE", "TRIALING"].includes(status)).reduce((total, item) => total + item._count, 0);
  const pastDue = overview.subscriptions.find(({ status }) => status === "PAST_DUE")?._count ?? 0;
  const notificationCount = (status: string) => overview.notifications.find((item) => item.status === status)?._count ?? 0;
  const invoiceCount = (status: string) => overview.invoices.find((item) => item.status === status)?._count ?? 0;
  const domainCount = (status: string) => overview.domains.find((item) => item.status === status)?._count ?? 0;
  const metrics = [
    { label: "Tiendas activas", value: `${overview.activeTenants} / ${overview.tenants}`, help: "Tiendas disponibles sobre el total registrado.", icon: Store },
    { label: "Usuarios", value: overview.users, help: "Cuentas únicas con acceso a una o más tiendas.", icon: UsersRound },
    { label: "Suscripciones vigentes", value: activeSubscriptions, help: "Incluye planes activos y períodos de prueba.", icon: CreditCard },
    { label: "MRR estimado", value: money(overview.estimatedMonthlyRevenueInCents), help: "Ingreso mensual estimado según planes vigentes; no reemplaza cobros reales.", icon: CircleDollarSign },
    { label: "Pedidos procesados", value: overview.orders, help: "Pedidos creados entre todas las tiendas.", icon: ShoppingBag },
    { label: "GMV aprobado", value: money(overview.approvedGmvInCents), help: "Volumen vendido con pago aprobado; no es ingreso de InfinityShop.", icon: Activity },
    { label: "Visitas a tiendas", value: overview.storefrontViews, help: "Aperturas registradas de tiendas públicas.", icon: Building2 },
    { label: "Carritos abandonados", value: overview.abandonedCarts, help: "Carritos marcados como abandonados en toda la plataforma.", icon: Boxes },
  ];

  const nav: Array<{ id: Section; label: string; help: string }> = [
    { id: "overview", label: "Vista general", help: "Métricas globales" },
    { id: "stores", label: "Tiendas", help: "Acceso y suscripciones" },
    { id: "plans", label: "Planes", help: "Precios y capacidad" },
    { id: "operations", label: "Operación", help: "Emails, cobros y dominios" },
  ];

  return <div className="min-h-screen bg-[#f8f7f9] text-[#211b23]">
    <header className="border-b border-white/[0.07] bg-[#17131a] text-white"><div className="mx-auto flex max-w-[94rem] items-center justify-between px-5 py-5 sm:px-8"><BrandLogo subtitle="Administración interna" /><Link className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white" href="/admin"><ArrowLeft size={14} /> Volver a mi tienda</Link></div></header>
    <main className={`${styles.surface} mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10`}>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6E3482]">Panel SaaS</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Control de InfinityShop</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#807384]">Supervisá la plataforma completa. Las ventas de las tiendas y los ingresos por suscripciones se muestran por separado.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e6dfe8] bg-white px-4 py-2.5 text-xs font-semibold text-[#6E3482] transition hover:bg-[#fdfafe] disabled:opacity-50" disabled={busy} onClick={() => void refresh()} type="button"><RefreshCw className={busy ? "animate-spin" : ""} size={14} /> Actualizar datos</button></header>
      <nav aria-label="Secciones del Panel SaaS" className="my-7 grid gap-2 rounded-2xl border border-[#e6dfe8] bg-white p-2 sm:grid-cols-2 lg:grid-cols-4">{nav.map((item) => <button aria-current={section === item.id ? "page" : undefined} className={`rounded-xl px-4 py-3 text-left transition ${section === item.id ? "bg-[#f0e7f3] text-[#49225B]" : "text-[#807384] hover:bg-[#fbf8fc]"}`} key={item.id} onClick={() => selectSection(item.id)} type="button"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs opacity-70">{item.help}</span></button>)}</nav>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}

      {section === "overview" && <div className="space-y-7">
        {pastDue > 0 && <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="shrink-0" size={18} /><div><p className="font-semibold">{pastDue} suscripción{pastDue === 1 ? "" : "es"} con pago pendiente</p><p className="mt-1 text-xs leading-5">Revisalas en Tiendas antes de suspender el acceso. Un pago pendiente no confirma por sí solo una deuda real.</p></div></div>}
        <section aria-label="Métricas globales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</section>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={styles.card}><h2 className="font-semibold">Estado de suscripciones</h2><p className="mt-1 text-xs leading-5 text-[#807384]">Cantidad de tiendas en cada estado administrativo.</p><div className="mt-5 grid grid-cols-2 gap-3">{overview.subscriptions.map((item) => <div className="rounded-xl bg-[#fbfafc] p-4" key={item.status}><p className="text-xs text-[#807384]">{subscriptionLabels[item.status] ?? "En revisión"}</p><p className="mt-2 text-2xl font-semibold">{item._count}</p></div>)}</div></section>
          <section className={styles.card}><h2 className="font-semibold">Acciones rápidas</h2><p className="mt-1 text-xs leading-5 text-[#807384]">Entrá a una sección antes de realizar cambios globales.</p><div className="mt-5 space-y-2"><button className="flex w-full items-center justify-between rounded-xl border border-[#e6dfe8] px-4 py-3 text-left text-sm font-semibold text-[#6E3482] hover:bg-[#fdfafe]" onClick={() => selectSection("stores")} type="button">Revisar tiendas <span>→</span></button><button className="flex w-full items-center justify-between rounded-xl border border-[#e6dfe8] px-4 py-3 text-left text-sm font-semibold text-[#6E3482] hover:bg-[#fdfafe]" onClick={() => selectSection("operations")} type="button">Revisar operación <span>→</span></button></div><Tip title="Cuidado con los cambios manuales">Cambiar un plan o estado desde este panel no cobra, devuelve dinero ni sincroniza automáticamente una suscripción de Mercado Pago.</Tip></section>
        </div>
      </div>}

      {section === "stores" && <section>
        <div><h2 className="text-xl font-semibold">Tiendas y suscripciones</h2><p className="mt-1 text-sm text-[#807384]">Buscá una tienda y revisá su uso antes de modificar el acceso o el plan.</p></div>
        <div className="mt-5 rounded-2xl border border-[#e6dfe8] bg-white p-4"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem]"><label className="relative"><span className="sr-only">Buscar tienda</span><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#918495]" /><input className="control pl-10!" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o dirección" /></label><select aria-label="Filtrar acceso de tienda" className="control" value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}><option value="ALL">Todos los accesos</option><option value="ACTIVE">Activas</option><option value="SUSPENDED">Suspendidas</option></select><select aria-label="Filtrar suscripción" className="control" value={subscriptionFilter} onChange={(event) => setSubscriptionFilter(event.target.value)}><option value="ALL">Todas las suscripciones</option><option value="TRIALING">Prueba</option><option value="ACTIVE">Activas</option><option value="PAST_DUE">Pago pendiente</option><option value="CANCELED">Canceladas</option></select></div><p className="mt-3 text-xs text-[#918495]">Mostrando {filteredTenants.length} de {tenants.length} tiendas.</p></div>
        {filteredTenants.length === 0 ? <div className="mt-5"><EmptyState title="No encontramos tiendas">Probá otra búsqueda o limpiá los filtros.</EmptyState></div> : <div className="mt-5 overflow-hidden rounded-2xl border border-[#e6dfe8] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[70rem] text-left text-sm"><caption className="sr-only">Tiendas, uso, plan, suscripción y acceso</caption><thead className="bg-[#fbfafc] text-xs uppercase tracking-wider text-[#918495]"><tr><th scope="col" className="px-5 py-3">Tienda</th><th scope="col" className="px-5 py-3">Uso</th><th scope="col" className="px-5 py-3">Plan</th><th scope="col" className="px-5 py-3">Suscripción</th><th scope="col" className="px-5 py-3">Acceso</th><th scope="col" className="px-5 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-[#eee9ef]">{filteredTenants.map((tenant) => <tr key={tenant.id}><td className="px-5 py-4"><Link className="inline-flex items-center gap-1.5 font-semibold text-[#49225B] hover:underline" href={`/tienda/${tenant.slug}`} target="_blank">{tenant.name}<ExternalLink size={12} /></Link><p className="mt-1 text-xs text-[#807384]">/{tenant.slug} · desde {new Date(tenant.createdAt).toLocaleDateString("es-AR")}</p></td><td className="px-5 py-4 text-xs leading-5 text-[#807384]">{tenant._count.products} productos<br />{tenant._count.memberships} miembros · {tenant._count.orders} pedidos</td><td className="px-5 py-4"><select aria-label={`Plan de ${tenant.name}`} className="rounded-xl border border-[#e6dfe8] bg-white px-3 py-2 text-xs" disabled={busy} onChange={(event) => void updateSubscription(tenant, { planCode: event.target.value })} value={tenant.subscription?.plan.code ?? "STARTER"}>{plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}</select></td><td className="px-5 py-4"><select aria-label={`Estado de suscripción de ${tenant.name}`} className="rounded-xl border border-[#e6dfe8] bg-white px-3 py-2 text-xs" disabled={busy} onChange={(event) => void updateSubscription(tenant, { status: event.target.value })} value={tenant.subscription?.status ?? "ACTIVE"}><option value="TRIALING">Prueba</option><option value="ACTIVE">Activa</option><option value="PAST_DUE">Pago pendiente</option><option value="CANCELED">Cancelada</option></select>{tenant.subscription?.cancelAtPeriodEnd && <p className="mt-1 text-[10px] text-amber-700">Cancela al final del período</p>}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tenant.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{tenant.status === "ACTIVE" ? "Activa" : "Suspendida"}</span></td><td className="px-5 py-4 text-right"><button className={`rounded-xl px-3 py-2 text-xs font-semibold ${tenant.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`} disabled={busy} onClick={() => void updateTenant(tenant)} type="button">{tenant.status === "ACTIVE" ? "Suspender" : "Reactivar"}</button></td></tr>)}</tbody></table></div></div>}
      </section>}

      {section === "plans" && <section><div><h2 className="text-xl font-semibold">Planes de InfinityShop</h2><p className="mt-1 text-sm text-[#807384]">Precios, capacidad y cantidad de tiendas asociadas. Esta vista es informativa.</p></div><div className="mt-5 grid gap-5 lg:grid-cols-2">{plans.map((plan) => <article className={styles.card} key={plan.id}><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-semibold">{plan.name}</h3><p className="mt-1 text-xs text-[#807384]">{plan.active ? "Disponible para nuevas suscripciones" : "No disponible para nuevas suscripciones"}</p></div><span className="rounded-full bg-[#f4eff7] px-2.5 py-1 text-xs font-semibold text-[#6E3482]">{plan._count.subscriptions} tienda{plan._count.subscriptions === 1 ? "" : "s"}</span></div><p className="mt-5 text-3xl font-semibold">{money(plan.priceInCents)}<span className="text-sm font-normal text-[#918495]"> / mes</span></p><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#fbfafc] p-4 text-sm"><div><p className="text-xs text-[#918495]">Productos</p><p className="mt-1 font-semibold">Hasta {plan.maxProducts}</p></div><div><p className="text-xs text-[#918495]">Equipo</p><p className="mt-1 font-semibold">{Math.max(0, plan.maxMembers - 1)} colaboradores</p></div></div><p className="mt-4 text-xs leading-5 text-[#807384]">Los pedidos no tienen límite mensual en este plan.</p></article>)}</div><Tip title="Edición de planes">Actualmente este panel permite asignar planes existentes a las tiendas. Los precios y límites del catálogo central no se editan desde esta pantalla.</Tip></section>}

      {section === "operations" && <section className="space-y-6"><div><h2 className="text-xl font-semibold">Salud operativa</h2><p className="mt-1 text-sm text-[#807384]">Detectá rápidamente tareas que necesitan revisión antes de afectar a una tienda.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><OperationalCard icon={MailCheck} label="Emails en cola" value={notificationCount("PENDING") + notificationCount("SENDING")} help="Pendientes o en proceso de envío." alert={notificationCount("FAILED")} alertLabel={`${notificationCount("FAILED")} fallidos`} /><OperationalCard icon={CreditCard} label="Cobros a revisar" value={invoiceCount("PENDING") + invoiceCount("FAILED")} help="Facturas SaaS pendientes o fallidas." alert={invoiceCount("FAILED")} alertLabel={`${invoiceCount("FAILED")} fallidos`} /><OperationalCard icon={Globe2} label="Dominios pendientes" value={domainCount("PENDING")} help="Esperando verificación DNS." alert={domainCount("FAILED")} alertLabel={`${domainCount("FAILED")} fallidos`} /><OperationalCard icon={ShieldCheck} label="Pruebas por vencer" value={overview.trialsEndingSoon} help="Finalizan dentro de los próximos 7 días." /></div><div className="grid gap-5 lg:grid-cols-2"><section className={styles.card}><h3 className="font-semibold">Crecimiento reciente</h3><p className="mt-1 text-xs leading-5 text-[#807384]">Altas creadas durante los últimos 30 días.</p><p className="mt-5 text-4xl font-semibold text-[#49225B]">{overview.newTenantsLast30Days}</p><p className="mt-2 text-xs text-[#918495]">tienda{overview.newTenantsLast30Days === 1 ? "" : "s"} nueva{overview.newTenantsLast30Days === 1 ? "" : "s"}</p></section><section className={styles.card}><h3 className="font-semibold">Cómo actuar</h3><div className="mt-4 space-y-3 text-xs leading-5 text-[#807384]"><p><strong className="text-[#4b3a50]">Emails:</strong> los reintentos son automáticos; revisá Resend si aumentan los fallidos.</p><p><strong className="text-[#4b3a50]">Cobros:</strong> confirmá el estado en Mercado Pago antes de modificar una suscripción manualmente.</p><p><strong className="text-[#4b3a50]">Dominios:</strong> pedile al owner que revise los registros DNS indicados en Crecimiento.</p></div><button className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#6E3482]" onClick={() => selectSection("stores")} type="button">Ir a tiendas <span>→</span></button></section></div><Tip title="Lectura operativa">Estos indicadores muestran el estado registrado por InfinityShop. Para investigar un proveedor externo, compará también sus logs y paneles oficiales.</Tip></section>}
    </main>
  </div>;
}

function OperationalCard({ label, value, help, icon: Icon, alert = 0, alertLabel }: { label: string; value: number; help: string; icon: typeof Store; alert?: number; alertLabel?: string }) {
  return <article className={styles.card}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#807384]">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p><p className="mt-2 text-xs leading-5 text-[#918495]">{help}</p>{alert > 0 && <p className="mt-3 inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">{alertLabel}</p>}</div><span className={`rounded-lg p-2 ${alert > 0 ? "bg-red-50 text-red-700" : "bg-[#f5eff8] text-[#6E3482]"}`}><Icon size={18} /></span></div></article>;
}

function Metric({ label, value, help, icon: Icon }: { label: string; value: string | number; help: string; icon: typeof Store }) {
  return <article className={styles.card}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#807384]">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-3 text-xs leading-5 text-[#918495]">{help}</p></div><span className="rounded-lg bg-[#f5eff8] p-2 text-[#6E3482]"><Icon size={18} /></span></div></article>;
}
