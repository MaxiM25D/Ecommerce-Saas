"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ApiError, apiRequest } from "@/lib/api";
import { CategoriesView } from "./categories-view";
import { DashboardView } from "./dashboard-view";
import { ProductsView } from "./products-view";
import { OrdersView } from "./orders-view";
import { StoreView } from "./store-view";
import type { Role } from "./types";

type Tab = "dashboard" | "categories" | "products" | "orders" | "store";
type Session = {
  user: { firstName: string; lastName: string; email: string };
  tenant: { name: string; slug: string };
  role: Role;
};

const navigation: Array<{ id: Tab; label: string; symbol: string }> = [
  { id: "dashboard", label: "Resumen", symbol: "⌁" },
  { id: "categories", label: "Categorías", symbol: "◇" },
  { id: "products", label: "Productos", symbol: "▦" },
  { id: "orders", label: "Pedidos", symbol: "◎" },
  { id: "store", label: "Mi tienda", symbol: "◉" },
];

export function AdminPanel() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    apiRequest<Session>("/auth/me")
      .then(setSession)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await apiRequest("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f4ef]">
        <div className="flex items-center gap-3 text-sm font-semibold text-stone-600">
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-600" /> Cargando tu tienda…
        </div>
      </main>
    );
  }

  if (!session) return null;

  const content = {
    dashboard: <DashboardView />,
    categories: <CategoriesView role={session.role} />,
    products: <ProductsView role={session.role} />,
    orders: <OrdersView role={session.role} />,
    store: <StoreView role={session.role} onStoreUpdated={(name) => setSession({ ...session, tenant: { ...session.tenant, name } })} />,
  }[tab];

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-stone-950 lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside
        className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[16.5rem] flex-col bg-[#1b1a18] p-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b89b72] font-serif text-xl">∞</span>
            <div>
              <p className="font-semibold tracking-tight">InfinityShop</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Commerce OS</p>
            </div>
          </div>
          <button className="text-stone-400 lg:hidden" onClick={() => setMenuOpen(false)} type="button">×</button>
        </div>

        <div className="my-7 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="truncate text-sm font-semibold">{session.tenant.name}</p>
          <p className="mt-1 truncate text-xs text-stone-400">/{session.tenant.slug}</p>
        </div>

        <nav className="space-y-1.5">
          {navigation.map((item) => (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                tab === item.id ? "bg-[#b89b72] text-white" : "text-stone-400 hover:bg-white/[0.06] hover:text-white"
              }`}
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setMenuOpen(false);
              }}
              type="button"
            >
              <span className="w-5 text-center text-lg">{item.symbol}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center gap-3 px-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-stone-700 text-xs font-bold">
              {session.user.firstName[0]}{session.user.lastName[0]}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.user.firstName} {session.user.lastName}</p>
              <p className="text-[10px] uppercase tracking-wider text-stone-500">{session.role}</p>
            </div>
          </div>
          <button className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-stone-400 transition hover:bg-white/[0.06] hover:text-white" onClick={logout} type="button">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {menuOpen && <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} type="button" />}

      <main className="min-w-0">
        <header className="flex h-20 items-center justify-between border-b border-stone-200 bg-white/80 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 lg:hidden" onClick={() => setMenuOpen(true)} type="button">☰</button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Panel administrativo</p>
              <h1 className="text-lg font-semibold">{navigation.find(({ id }) => id === tab)?.label}</h1>
            </div>
          </div>
          <Link className="rounded-full bg-stone-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-700" href={`/tienda/${session.tenant.slug}`} target="_blank">Ver tienda ↗</Link>
        </header>
        <div className="p-5 sm:p-8 lg:p-10">{content}</div>
      </main>
    </div>
  );
}
