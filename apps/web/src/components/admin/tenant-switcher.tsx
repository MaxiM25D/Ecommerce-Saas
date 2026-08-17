"use client";

import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role } from "./types";

type TenantAccess = { name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; role: Role; joinedAt: string; current: boolean };

export function TenantSwitcher({ current, emailVerified, onSelected }: { current: { name: string; slug: string }; emailVerified: boolean; onSelected: (selection: { tenant: { name: string; slug: string }; role: Role }) => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tenants, setTenants] = useState<TenantAccess[]>([]);
  const [busySlug, setBusySlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void apiRequest<{ tenants: TenantAccess[] }>("/auth/tenants").then(({ tenants: values }) => setTenants(values));
  }, []);

  async function select(slug: string) {
    if (slug === current.slug) { setOpen(false); return; }
    setBusySlug(slug); setError("");
    try {
      const selection = await apiRequest<{ tenant: { name: string; slug: string }; role: Role }>("/auth/select-tenant", { method: "POST", body: JSON.stringify({ tenantSlug: slug }) });
      onSelected(selection); setOpen(false); setBusySlug("");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar de tienda"); setBusySlug(""); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusySlug("new"); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const selection = await apiRequest<{ tenant: { name: string; slug: string }; role: Role }>("/auth/tenants", { method: "POST", body: JSON.stringify({ name: form.get("name"), slug: form.get("slug") }) });
      onSelected(selection); setOpen(false); setCreating(false); setBusySlug("");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo crear la tienda"); setBusySlug(""); }
  }

  return <div className="relative my-7">
    <button className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left transition hover:bg-white/[0.1]" onClick={() => { setOpen(!open); setError(""); setCreating(false); }} type="button"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{current.name}</span><span className="mt-1 block truncate text-xs text-stone-400">/{current.slug}</span></span><span className={`ml-3 text-xs text-stone-400 transition ${open ? "rotate-180" : ""}`}>⌄</span></button>
    {open && <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#292725] shadow-2xl">
      {!creating ? <><div className="max-h-64 overflow-y-auto p-2">{tenants.map((tenant) => <button className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${tenant.current ? "bg-[#b89b72] text-white" : tenant.status === "ACTIVE" ? "text-stone-200 hover:bg-white/[0.06]" : "cursor-not-allowed text-stone-600"}`} disabled={tenant.status !== "ACTIVE" || Boolean(busySlug)} key={tenant.slug} onClick={() => void select(tenant.slug)} type="button"><span className="min-w-0"><span className="block truncate font-semibold">{tenant.name}</span><span className="mt-0.5 block truncate text-[10px] opacity-70">/{tenant.slug} · {tenant.role}</span></span>{busySlug === tenant.slug ? <span className="animate-pulse">…</span> : tenant.current ? <span>✓</span> : null}</button>)}</div><div className="border-t border-white/10 p-2">{emailVerified ? <button className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#d9bd94] hover:bg-white/[0.06]" onClick={() => setCreating(true)} type="button">＋ Crear otra tienda</button> : <p className="px-3 py-2 text-[11px] leading-4 text-stone-500">Verificá tu email para crear otra tienda.</p>}</div></> : <form className="space-y-3 p-4" onSubmit={create}><div className="flex items-center justify-between"><p className="text-sm font-semibold">Nueva tienda</p><button className="text-xs text-stone-400" onClick={() => setCreating(false)} type="button">Volver</button></div><input className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-500 focus:border-[#b89b72]" name="name" placeholder="Nombre de la tienda" required /><input className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-500 focus:border-[#b89b72]" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="mi-nueva-tienda" required />{error && <p className="rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>}<button className="w-full rounded-xl bg-[#b89b72] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busySlug === "new"} type="submit">{busySlug === "new" ? "Creando…" : "Crear y seleccionar"}</button></form>}
      {!creating && error && <p className="border-t border-white/10 bg-red-950/30 px-4 py-3 text-xs text-red-300">{error}</p>}
    </div>}
  </div>;
}
