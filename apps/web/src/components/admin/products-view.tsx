"use client";

import { FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Category, Product, Role } from "./types";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function ProductsView({ role }: { role: Role }) {
  const canManage = role !== "STAFF";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [productResponse, categoryResponse] = await Promise.all([
      apiRequest<{ products: Product[] }>("/admin/products"),
      apiRequest<{ categories: Category[] }>("/admin/categories"),
    ]);
    setProducts(productResponse.products);
    setCategories(categoryResponse.categories);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<{ products: Product[] }>("/admin/products"),
      apiRequest<{ categories: Category[] }>("/admin/categories"),
    ]).then(([productResponse, categoryResponse]) => {
      if (!active) return;
      setProducts(productResponse.products);
      setCategories(categoryResponse.categories);
    });
    return () => {
      active = false;
    };
  }, []);

  function openForm(product: Product | null) {
    setEditing(product);
    setError("");
    setShowForm(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const images = String(form.get("images") ?? "")
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);
    const body = {
      categoryId: form.get("categoryId") || null,
      sku: form.get("sku"),
      slug: form.get("slug"),
      name: form.get("name"),
      description: form.get("description") || null,
      priceInCents: Math.round(Number(form.get("price")) * 100),
      stock: Number(form.get("stock")),
      images,
      active: form.get("active") === "on",
    };

    try {
      await apiRequest(editing ? `/admin/products/${editing.id}` : "/admin/products", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo guardar el producto");
    } finally {
      setBusy(false);
    }
  }

  async function remove(product: Product) {
    if (!confirm(`¿Eliminar “${product.name}”?`)) return;
    try {
      await apiRequest(`/admin/products/${product.id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo eliminar el producto");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Catálogo de productos</h2>
          <p className="mt-1 text-sm text-stone-400">Gestioná precio, inventario, imágenes y visibilidad.</p>
        </div>
        {canManage && <button className="rounded-xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700" onClick={() => openForm(null)} type="button">+ Nuevo producto</button>}
      </div>

      {error && !showForm && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-24 text-center">
          <p className="text-lg font-semibold">Tu catálogo está vacío</p>
          <p className="mt-2 text-sm text-stone-400">Creá una categoría y luego agregá tu primer producto.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wider text-stone-400">
                <tr><th className="px-5 py-3">Producto</th><th className="px-5 py-3">Categoría</th><th className="px-5 py-3">Precio</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((product) => (
                  <tr className="hover:bg-stone-50/60" key={product.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 rounded-xl bg-stone-100 bg-cover bg-center"
                          style={product.images[0] ? { backgroundImage: `url(${product.images[0]})` } : undefined}
                        >
                          {!product.images[0] && <span className="grid h-full place-items-center font-serif text-stone-400">{product.name[0]}</span>}
                        </div>
                        <div><p className="font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-stone-400">{product.sku}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-stone-500">{product.category?.name ?? "Sin categoría"}</td>
                    <td className="px-5 py-4 font-semibold">{money.format(product.priceInCents / 100)}</td>
                    <td className="px-5 py-4"><span className={product.stock < 5 ? "font-semibold text-red-600" : "text-stone-600"}>{product.stock}</span></td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{product.active ? "Activo" : "Oculto"}</span></td>
                    <td className="px-5 py-4 text-right">
                      {canManage ? <div className="flex justify-end gap-2"><button className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50" onClick={() => openForm(product)} type="button">Editar</button><button className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => remove(product)} type="button">Eliminar</button></div> : <span className="text-xs text-stone-400">Solo lectura</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35" role="dialog" aria-modal="true">
          <button aria-label="Cerrar formulario" className="absolute inset-0" onClick={() => setShowForm(false)} type="button" />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-7 flex items-start justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Catálogo</p><h2 className="mt-1 text-2xl font-semibold">{editing ? "Editar producto" : "Nuevo producto"}</h2></div>
              <button className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-xl" onClick={() => setShowForm(false)} type="button">×</button>
            </div>
            <ProductForm categories={categories} editing={editing} error={error} busy={busy} onSubmit={submit} />
          </aside>
        </div>
      )}
    </div>
  );
}

function ProductForm({ categories, editing, error, busy, onSubmit }: { categories: Category[]; editing: Product | null; error: string; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="space-y-5" key={editing?.id ?? "new"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field defaultValue={editing?.name} label="Nombre" name="name" placeholder="Cinturón Toro" />
        <Field defaultValue={editing?.sku} label="SKU" name="sku" placeholder="LUN-CIN-001" />
      </div>
      <Field defaultValue={editing?.slug} label="Slug" name="slug" placeholder="cinturon-toro" />
      <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Categoría</span><select className="control" defaultValue={editing?.categoryId ?? ""} name="categoryId"><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Descripción</span><textarea className="control min-h-24 resize-y" defaultValue={editing?.description ?? ""} name="description" placeholder="Detalles del producto" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field defaultValue={editing ? String(editing.priceInCents / 100) : undefined} label="Precio (ARS)" min="0" name="price" placeholder="45000" step="0.01" type="number" />
        <Field defaultValue={editing ? String(editing.stock) : undefined} label="Stock" min="0" name="stock" placeholder="10" step="1" type="number" />
      </div>
      <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">Imágenes <span className="font-normal text-stone-400">(una URL por línea)</span></span><textarea className="control min-h-28 resize-y" defaultValue={editing?.images.join("\n")} name="images" placeholder="https://.../producto.jpg" /></label>
      <label className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3"><span><span className="block text-sm font-semibold">Producto activo</span><span className="text-xs text-stone-400">Visible en la tienda pública</span></span><input className="h-5 w-5 accent-amber-700" defaultChecked={editing?.active ?? true} name="active" type="checkbox" /></label>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button className="w-full rounded-xl bg-stone-950 px-5 py-3.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar producto"}</button>
    </form>
  );
}

function Field({ label, name, placeholder, defaultValue, type = "text", min, step }: { label: string; name: string; placeholder: string; defaultValue?: string; type?: string; min?: string; step?: string }) {
  return <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">{label}</span><input className="control" defaultValue={defaultValue} min={min} name={name} placeholder={placeholder} required step={step} type={type} /></label>;
}
