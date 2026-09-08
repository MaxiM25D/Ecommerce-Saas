"use client";

import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  LogOut,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { StorefrontError, StorefrontLoading } from "./catalog-page";
import { formatMoney, ProductImage, StorefrontShell } from "./storefront-shell";
import type { PublicStore } from "./types";

type CustomerOrder = {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalInCents: number;
  currency: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    product: { images: string[] } | null;
  }>;
  _count: { items: number };
};

type OrdersResponse = {
  customer: { firstName: string; lastName: string; email: string };
  orders: CustomerOrder[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function CustomerOrdersPage({
  slug,
  initialEmail = "",
  initialFirstName = "",
  initialLastName = "",
  initialMode = "login",
}: {
  slug: string;
  initialEmail?: string;
  initialFirstName?: string;
  initialLastName?: string;
  initialMode?: "login" | "register";
}) {
  const [store, setStore] = useState<PublicStore | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">(initialMode);
  const [error, setError] = useState("");
  const storageKey = `infinityshop:customer:${slug}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    apiRequest<{ store: PublicStore }>(`/storefront/${slug}`, { signal: controller.signal })
      .then(({ store: responseStore }) => {
        if (active) setStore(responseStore);
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof ApiError ? caught.message : "No pudimos abrir la tienda");
      });

    const storedSession = localStorage.getItem(storageKey) ?? "";
    queueMicrotask(() => {
      if (!active) return;
      setSessionToken(storedSession);
      setLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, storageKey]);

  useEffect(() => {
    if (!sessionToken) return;
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (active) setBusy(true);
    });
    apiRequest<OrdersResponse>(`/storefront/${slug}/customer/orders?page=${page}&limit=10`, {
      headers: { "x-customer-session": sessionToken },
      signal: controller.signal,
    })
      .then((response) => {
        if (active) {
          setOrders(response);
          setError("");
        }
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && [401, 403].includes(caught.status)) {
          localStorage.removeItem(storageKey);
          setSessionToken("");
          setOrders(null);
        }
        setError(caught instanceof ApiError ? caught.message : "No pudimos cargar tus pedidos");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, sessionToken, slug, storageKey, retry]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<{ sessionToken: string }>(
        `/storefront/${slug}/customer-auth/${authMode}`,
        {
        method: "POST",
        body: JSON.stringify(
          authMode === "login"
            ? { email: form.get("email"), password: form.get("password") }
            : {
                email: form.get("email"),
                password: form.get("password"),
                firstName: form.get("firstName"),
                lastName: form.get("lastName"),
                phone: form.get("phone") || undefined,
              },
        ),
      });
      localStorage.setItem(storageKey, response.sessionToken);
      setSessionToken(response.sessionToken);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos solicitar el acceso");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await apiRequest(`/storefront/${slug}/customer-auth/session`, {
      method: "DELETE",
      headers: { "x-customer-session": sessionToken },
    }).catch(() => undefined);
    localStorage.removeItem(storageKey);
    setSessionToken("");
    setOrders(null);
  }

  if (!store && error) return <StorefrontError message={error} />;
  if (!store || loading) return <StorefrontLoading />;

  return (
    <StorefrontShell store={store}>
      {!sessionToken ? (
        <AccessPanel busy={busy} error={error} initialEmail={initialEmail} initialFirstName={initialFirstName} initialLastName={initialLastName} mode={authMode} onModeChange={setAuthMode} onSubmit={authenticate} store={store} />
      ) : (
        <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: store.settings?.primaryColor }}>Mi cuenta</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">Mis pedidos</h1>
              {orders && <p className="mt-3 text-sm text-stone-500">Hola {orders.customer.firstName}. Estas son tus compras en {store.name}.</p>}
            </div>
            <button className="inline-flex items-center gap-2 self-start rounded-full border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold" onClick={logout} type="button"><LogOut size={15} /> Cerrar acceso</button>
          </div>

          {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button type="button" disabled={busy} className="mt-2 font-semibold underline disabled:opacity-50" onClick={() => setRetry((value) => value + 1)}>Volver a intentar</button></div>}
          {busy && !orders ? <OrdersSkeleton /> : orders?.orders.length === 0 ? (
            <div className="mt-8 rounded-[var(--store-radius)] border border-dashed border-stone-300 py-20 text-center">
              <ShoppingBag className="mx-auto text-stone-300" size={38} />
              <p className="mt-4 text-lg font-semibold">Todavía no hay pedidos</p>
              <Link className="mt-5 inline-flex rounded-full bg-stone-950 px-5 py-3 text-xs font-bold text-white" href={`/tienda/${slug}/productos`}>Explorar productos</Link>
            </div>
          ) : (
            <div className={`mt-8 space-y-4 transition ${busy ? "opacity-55" : ""}`}>
              {orders?.orders.map((order) => <OrderCard key={order.id} order={order} slug={slug} />)}
            </div>
          )}

          {orders && orders.pagination.totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Paginación de pedidos">
              <button className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-35" disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={14} /> Anterior</button>
              <span className="text-xs font-semibold text-stone-500">Página {orders.pagination.page} de {orders.pagination.totalPages}</span>
              <button className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-35" disabled={page >= orders.pagination.totalPages || busy} onClick={() => setPage((value) => value + 1)} type="button">Siguiente <ArrowRight size={14} /></button>
            </nav>
          )}
        </main>
      )}
    </StorefrontShell>
  );
}

function AccessPanel({ store, mode, busy, error, initialEmail, initialFirstName, initialLastName, onSubmit, onModeChange }: { store: PublicStore; mode: "login" | "register"; busy: boolean; error: string; initialEmail: string; initialFirstName: string; initialLastName: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onModeChange: (mode: "login" | "register") => void }) {
  return (
    <main className="mx-auto grid min-h-[65vh] max-w-5xl place-items-center px-5 py-12 sm:px-6">
      <section className="w-full max-w-lg rounded-[var(--store-radius)] border border-stone-200 bg-white p-6 shadow-[0_20px_70px_rgba(28,20,28,0.08)] sm:p-9">
        <div className="grid grid-cols-2 rounded-full bg-stone-100 p-1 text-xs font-bold">
          <button className={`rounded-full px-4 py-2.5 transition ${mode === "login" ? "bg-white shadow-sm" : "text-stone-500"}`} onClick={() => onModeChange("login")} type="button">Iniciar sesión</button>
          <button className={`rounded-full px-4 py-2.5 transition ${mode === "register" ? "bg-white shadow-sm" : "text-stone-500"}`} onClick={() => onModeChange("register")} type="button">Crear cuenta</button>
        </div>
        <span className="mt-7 grid h-12 w-12 place-items-center rounded-2xl bg-stone-100">{mode === "login" ? <LockKeyhole size={22} /> : <UserRound size={22} />}</span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: store.settings?.primaryColor }}>Cuenta de comprador</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{mode === "login" ? "Ingresá a tus pedidos" : "Creá tu cuenta"}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-500">{mode === "login" ? `Accedé a tus compras y seguimientos de ${store.name}.` : "Registrate con email y contraseña. Ingresás inmediatamente, sin verificación por correo."}</p>
        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          {mode === "register" && <div className="grid gap-4 sm:grid-cols-2"><AccountInput autoComplete="given-name" defaultValue={initialFirstName} label="Nombre" name="firstName" /><AccountInput autoComplete="family-name" defaultValue={initialLastName} label="Apellido" name="lastName" /></div>}
          <AccountInput autoComplete="email" defaultValue={initialEmail} label="Email de la compra" name="email" readOnly={Boolean(initialEmail)} type="email" />
          {mode === "register" && <AccountInput autoComplete="tel" label="Teléfono (opcional)" name="phone" required={false} type="tel" />}
          <AccountInput autoComplete={mode === "login" ? "current-password" : "new-password"} label="Contraseña" minLength={10} name="password" type="password" />
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>}
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white disabled:opacity-60" disabled={busy} style={{ backgroundColor: store.settings?.primaryColor }} type="submit">{mode === "login" ? <LockKeyhole size={17} /> : <UserRound size={17} />} {busy ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
        </form>
      </section>
    </main>
  );
}

function AccountInput({ label, name, type = "text", autoComplete, required = true, minLength, defaultValue, readOnly = false }: { label: string; name: string; type?: string; autoComplete: string; required?: boolean; minLength?: number; defaultValue?: string; readOnly?: boolean }) {
  return <label className="block text-xs font-semibold text-stone-600">{label}<input autoComplete={autoComplete} className="mt-2 h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none read-only:bg-stone-50 read-only:text-stone-500 focus:border-stone-400 focus:ring-4 focus:ring-stone-100" defaultValue={defaultValue} minLength={minLength} name={name} readOnly={readOnly} required={required} type={type} /></label>;
}

function OrderCard({ order, slug }: { order: CustomerOrder; slug: string }) {
  const firstItem = order.items[0];
  return (
    <article className="grid gap-5 rounded-[var(--store-radius)] border border-stone-200 bg-white p-5 shadow-[0_10px_35px_rgba(28,20,28,0.04)] sm:grid-cols-[5rem_1fr_auto] sm:items-center">
      <ProductImage className="h-20 w-20 rounded-2xl" image={firstItem?.product?.images[0]} name={firstItem?.productName ?? `Pedido ${order.number}`} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">Pedido #{order.number}</h2><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">{statusLabels[order.status] ?? order.status}</span></div>
        <p className="mt-2 truncate text-sm text-stone-500">{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(", ")}{order._count.items > order.items.length ? ` y ${order._count.items - order.items.length} más` : ""}</p>
        <p className="mt-2 text-xs text-stone-400">{new Date(order.createdAt).toLocaleDateString("es-AR", { dateStyle: "long" })}</p>
      </div>
      <div className="flex items-center justify-between gap-5 sm:block sm:text-right">
        <strong className="block text-lg">{formatMoney(order.totalInCents, order.currency)}</strong>
        <Link className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold" href={`/tienda/${slug}/pedido/${order.id}`}>Ver seguimiento <ArrowRight size={14} /></Link>
      </div>
    </article>
  );
}

function OrdersSkeleton() {
  return <div className="mt-8 space-y-4">{[1, 2, 3].map((item) => <div className="h-32 animate-pulse rounded-3xl bg-stone-200" key={item} />)}</div>;
}
