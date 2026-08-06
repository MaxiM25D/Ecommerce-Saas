"use client";

import { FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role, Store } from "./types";

export function StoreView({ role, onStoreUpdated }: { role: Role; onStoreUpdated: (name: string) => void }) {
  const canManage = role !== "STAFF";
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest<{ store: Store }>("/admin/store").then(({ store }) => setStore(store));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<{ store: Store }>("/admin/store", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || null,
          logoUrl: form.get("logoUrl") || null,
          bannerUrl: form.get("bannerUrl") || null,
          primaryColor: form.get("primaryColor"),
          contactEmail: form.get("contactEmail") || null,
          whatsapp: form.get("whatsapp") || null,
          currency: form.get("currency"),
        }),
      });
      setStore(response.store);
      onStoreUpdated(response.store.name);
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo guardar la configuración");
    } finally {
      setBusy(false);
    }
  }

  if (!store) return <div className="h-96 animate-pulse rounded-2xl bg-stone-200" />;
  const settings = store.settings;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7">
          <h2 className="text-xl font-semibold tracking-tight">Identidad y contacto</h2>
          <p className="mt-1 text-sm text-stone-400">Información básica que verá tu cliente en la tienda.</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={store.name} label="Nombre de la tienda" name="name" required />
            <Field defaultValue={store.slug} disabled label="Slug permanente" name="slug" />
          </div>
          <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Descripción</span><textarea className="control min-h-28 resize-y" defaultValue={settings?.description ?? ""} disabled={!canManage} name="description" placeholder="Contá brevemente qué hace especial a tu tienda" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={settings?.logoUrl ?? ""} disabled={!canManage} label="URL del logo" name="logoUrl" type="url" />
            <Field defaultValue={settings?.bannerUrl ?? ""} disabled={!canManage} label="URL del banner" name="bannerUrl" type="url" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={settings?.contactEmail ?? ""} disabled={!canManage} label="Email de contacto" name="contactEmail" type="email" />
            <Field defaultValue={settings?.whatsapp ?? ""} disabled={!canManage} label="WhatsApp" name="whatsapp" placeholder="+54 9 11..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Color principal</span><div className="flex gap-2"><input className="h-12 w-14 rounded-xl border border-stone-200 bg-white p-1" defaultValue={settings?.primaryColor ?? "#B89B72"} disabled={!canManage} name="primaryColor" type="color" /><input className="control" defaultValue={settings?.primaryColor ?? "#B89B72"} disabled tabIndex={-1} /></div></label>
            <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Moneda</span><select className="control" defaultValue={settings?.currency ?? "ARS"} disabled={!canManage} name="currency"><option value="ARS">ARS — Peso argentino</option><option value="USD">USD — Dólar estadounidense</option></select></label>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Configuración guardada correctamente.</p>}
          {canManage && <button className="rounded-xl bg-stone-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar configuración"}</button>}
        </form>
      </section>

      <aside className="h-fit overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="h-28 bg-stone-200 bg-cover bg-center" style={settings?.bannerUrl ? { backgroundImage: `url(${settings.bannerUrl})` } : { background: `linear-gradient(135deg, ${settings?.primaryColor ?? "#B89B72"}, #292524)` }} />
        <div className="relative p-6 pt-10">
          <div className="absolute -top-8 grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-stone-950 bg-cover bg-center text-xl font-bold text-white" style={settings?.logoUrl ? { backgroundImage: `url(${settings.logoUrl})` } : undefined}>{!settings?.logoUrl && store.name[0]}</div>
          <p className="font-semibold">{store.name}</p>
          <p className="mt-1 text-xs text-stone-400">/{store.slug}</p>
          <p className="mt-4 text-sm leading-6 text-stone-500">{settings?.description || "La descripción de tu tienda aparecerá acá."}</p>
          <span className="mt-5 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{store.status === "ACTIVE" ? "Activa" : "Suspendida"}</span>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, name, defaultValue, placeholder, type = "text", disabled, required }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; disabled?: boolean; required?: boolean }) {
  return <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">{label}</span><input className="control disabled:cursor-not-allowed disabled:text-stone-400" defaultValue={defaultValue} disabled={disabled} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}
