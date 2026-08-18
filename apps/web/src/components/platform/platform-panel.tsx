"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

type Overview = {
  tenants: number;
  activeTenants: number;
  users: number;
  subscriptions: Array<{ status: string; _count: number }>;
  estimatedMonthlyRevenueInCents: number;
  orders: number;
  approvedGmvInCents: number;
  storefrontViews: number;
  abandonedCarts: number;
};
type Plan = {
  id: string;
  code: string;
  name: string;
  priceInCents: number;
  currency: string;
  maxProducts: number;
  maxMembers: number;
  maxOrdersPerMonth: number | null;
  active: boolean;
  _count: { subscriptions: number };
};
type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    plan: Plan;
  } | null;
  _count: { memberships: number; products: number; orders: number };
};

const money = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount / 100);

export function PlatformPanel() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [overviewData, plansData, tenantsData] = await Promise.all([
      apiRequest<Overview>("/platform/overview"),
      apiRequest<{ plans: Plan[] }>("/platform/plans"),
      apiRequest<{ tenants: Tenant[] }>("/platform/tenants"),
    ]);
    setOverview(overviewData);
    setPlans(plansData.plans);
    setTenants(tenantsData.tenants);
  }

  useEffect(() => {
    apiRequest<{ user: { platformRole: string } }>("/auth/me")
      .then(({ user }) => {
        if (user.platformRole !== "SUPERADMIN") router.replace("/admin");
        else void load().catch(handleError);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function handleError(caught: unknown) {
    setError(
      caught instanceof ApiError
        ? caught.message
        : "No se pudo completar la operación",
    );
  }
  async function updateTenant(id: string, status: string) {
    setError("");
    try {
      await apiRequest(`/platform/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (caught) {
      handleError(caught);
    }
  }
  async function updateSubscription(
    id: string,
    body: { planCode?: string; status?: string },
  ) {
    setError("");
    try {
      await apiRequest(`/platform/tenants/${id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch (caught) {
      handleError(caught);
    }
  }

  if (!overview)
    return (
      <main className="grid min-h-screen place-items-center bg-[#11110f] text-white">
        <div className="flex items-center gap-3 text-sm">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[#b89b72]" />{" "}
          Cargando plataforma…
        </div>
      </main>
    );
  const activeSubscriptions = overview.subscriptions
    .filter(({ status }) => ["ACTIVE", "TRIALING"].includes(status))
    .reduce((total, item) => total + item._count, 0);

  return (
    <div className="min-h-screen bg-[#f4f2ed] text-stone-950">
      <header className="border-b border-white/10 bg-[#11110f] text-white">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#b89b72] text-xl">
              ∞
            </span>
            <div>
              <p className="font-semibold">InfinityShop Platform</p>
              <p className="text-xs text-stone-500">Administración interna</p>
            </div>
          </div>
          <Link
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-white/10"
            href="/admin"
          >
            Volver a mi tienda
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[90rem] space-y-10 px-5 py-8 sm:px-8 sm:py-10">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Vista global
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Control de la plataforma
          </h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Tenants activos"
              value={`${overview.activeTenants} / ${overview.tenants}`}
            />
            <Metric label="Usuarios" value={overview.users} />
            <Metric
              label="Suscripciones vigentes"
              value={activeSubscriptions}
            />
            <Metric
              label="MRR estimado"
              value={money(overview.estimatedMonthlyRevenueInCents)}
            />
            <Metric label="Pedidos procesados" value={overview.orders} />
            <Metric
              label="GMV aprobado"
              value={money(overview.approvedGmvInCents)}
            />
            <Metric
              label="Visitas a tiendas"
              value={overview.storefrontViews}
            />
            <Metric
              label="Carritos abandonados"
              value={overview.abandonedCarts}
            />
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Planes</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => (
              <article
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                key={plan.id}
              >
                <div className="flex justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs">
                    {plan._count.subscriptions} tiendas
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold">
                  {money(plan.priceInCents)}
                </p>
                <p className="mt-3 text-xs leading-5 text-stone-400">
                  {plan.maxProducts} productos · {plan.maxMembers - 1}{" "}
                  colaboradores · pedidos sin límite
                </p>
              </article>
            ))}
          </div>
        </section>
        <section>
          <div>
            <h2 className="text-xl font-semibold">Tenants</h2>
            <p className="mt-1 text-sm text-stone-400">
              Planes, suscripciones, uso y acceso de todas las tiendas.
            </p>
          </div>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[70rem] text-left text-sm">
                <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wider text-stone-400">
                  <tr>
                    <th className="px-5 py-3">Tienda</th>
                    <th className="px-5 py-3">Uso</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Suscripción</th>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{tenant.name}</p>
                        <p className="mt-1 text-xs text-stone-400">
                          /{tenant.slug}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs text-stone-500">
                        {tenant._count.products} prod. ·{" "}
                        {tenant._count.memberships} miem. ·{" "}
                        {tenant._count.orders} ped.
                      </td>
                      <td className="px-5 py-4">
                        <select
                          className="rounded-xl border border-stone-200 px-3 py-2 text-xs"
                          onChange={(event) =>
                            void updateSubscription(tenant.id, {
                              planCode: event.target.value,
                            })
                          }
                          value={tenant.subscription?.plan.code ?? "STARTER"}
                        >
                          {plans.map((plan) => (
                            <option key={plan.code} value={plan.code}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          className="rounded-xl border border-stone-200 px-3 py-2 text-xs"
                          onChange={(event) =>
                            void updateSubscription(tenant.id, {
                              status: event.target.value,
                            })
                          }
                          value={tenant.subscription?.status ?? "ACTIVE"}
                        >
                          <option value="TRIALING">TRIALING</option>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="PAST_DUE">PAST_DUE</option>
                          <option value="CANCELED">CANCELED</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tenant.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${tenant.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}
                          onClick={() =>
                            void updateTenant(
                              tenant.id,
                              tenant.status === "ACTIVE"
                                ? "SUSPENDED"
                                : "ACTIVE",
                            )
                          }
                          type="button"
                        >
                          {tenant.status === "ACTIVE"
                            ? "Suspender"
                            : "Reactivar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-stone-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}
