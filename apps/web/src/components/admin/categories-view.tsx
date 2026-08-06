"use client";

import { FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Category, Role } from "./types";

export function CategoriesView({ role }: { role: Role }) {
  const canManage = role !== "STAFF";
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await apiRequest<{ categories: Category[] }>("/admin/categories");
    setCategories(response.categories);
  }

  useEffect(() => {
    let active = true;
    void apiRequest<{ categories: Category[] }>("/admin/categories").then((response) => {
      if (active) setCategories(response.categories);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    const form = new FormData(formElement);

    try {
      await apiRequest(editing ? `/admin/categories/${editing.id}` : "/admin/categories", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ name: form.get("name"), slug: form.get("slug") }),
      });
      formElement.reset();
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo guardar la categoría");
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    if (!confirm(`¿Eliminar la categoría “${category.name}”?`)) return;
    setError("");
    try {
      await apiRequest(`/admin/categories/${category.id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_23rem]">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-6 py-5">
          <h2 className="font-semibold">Categorías del catálogo</h2>
          <p className="mt-1 text-sm text-stone-400">Organizá los productos para que sean fáciles de encontrar.</p>
        </div>
        {categories.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-stone-400">Creá tu primera categoría desde el formulario.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {categories.map((category) => (
              <article className="flex items-center justify-between gap-4 px-6 py-4" key={category.id}>
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 font-serif text-lg text-amber-800">{category.name[0]}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{category.name}</p>
                    <p className="mt-0.5 text-xs text-stone-400">/{category.slug} · {category._count?.products ?? 0} productos</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50" onClick={() => setEditing(category)} type="button">Editar</button>
                    <button className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => remove(category)} type="button">Eliminar</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">{editing ? "Editar categoría" : "Nueva categoría"}</h2>
        <p className="mt-1 text-sm text-stone-400">{canManage ? "El slug será visible en la URL." : "Tu rol permite consultar, no editar."}</p>
        {canManage && (
          <form className="mt-6 space-y-4" key={editing?.id ?? "new"} onSubmit={submit}>
            <FormField defaultValue={editing?.name} label="Nombre" name="name" placeholder="Cinturones" />
            <FormField defaultValue={editing?.slug} label="Slug" name="slug" placeholder="cinturones" />
            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar"}</button>
              {editing && <button className="rounded-xl border border-stone-200 px-4 text-sm" onClick={() => setEditing(null)} type="button">Cancelar</button>}
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

function FormField({ label, name, placeholder, defaultValue }: { label: string; name: string; placeholder: string; defaultValue?: string }) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      <input className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 outline-none focus:border-amber-600 focus:bg-white" defaultValue={defaultValue} name={name} placeholder={placeholder} required />
    </label>
  );
}
