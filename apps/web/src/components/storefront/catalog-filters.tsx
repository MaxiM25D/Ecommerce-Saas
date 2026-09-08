"use client";

import { ChevronDown, Check, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

const pill = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2";

export function CatalogFilters({ categories, category, fixedCategory, brand, tag, brands, tags, minPrice, maxPrice, search, color, onChange, onClear }: {
  categories: { id: string; slug: string; name: string }[];
  category: string; fixedCategory: boolean; brand: string; tag: string;
  brands: string[]; tags: string[]; minPrice: string; maxPrice: string; search: string; color: string;
  onChange: (key: "category" | "brand" | "tag" | "minPrice" | "maxPrice" | "search", value: string) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = [
    ...(!fixedCategory && category ? [{ key: "category" as const, label: categories.find((item) => item.slug === category)?.name ?? category }] : []),
    ...(brand ? [{ key: "brand" as const, label: `Marca: ${brand}` }] : []),
    ...(tag ? [{ key: "tag" as const, label: tag }] : []),
    ...(minPrice ? [{ key: "minPrice" as const, label: `Desde ${Number(minPrice).toLocaleString("es-AR")}` }] : []),
    ...(maxPrice ? [{ key: "maxPrice" as const, label: `Hasta ${Number(maxPrice).toLocaleString("es-AR")}` }] : []),
    ...(search.trim() ? [{ key: "search" as const, label: `“${search.trim()}”` }] : []),
  ];
  return <section aria-label="Filtros del catálogo" className="mt-7 space-y-4">
    {!fixedCategory && <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Categorías">
      {[{ id: "all", slug: "", name: "Todas" }, ...categories].map((item) => <button key={item.id} type="button" aria-pressed={category === item.slug} onClick={() => onChange("category", item.slug)} className={`${pill} shrink-0 ${category === item.slug ? "text-white hover:opacity-90" : "border-stone-200 bg-white text-stone-600"}`} style={category === item.slug ? { backgroundColor: color, borderColor: color } : undefined}>{item.name}</button>)}
    </div>}
    <div className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={expanded} aria-controls="catalog-extra-filters" className={`${pill} border-stone-200 text-stone-700`} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16} /> Filtros {active.length > 0 && <span className="rounded-full bg-stone-100 px-2 text-xs">{active.length}</span>}<ChevronDown size={14} className={`transition ${expanded ? "rotate-180" : ""}`} /></button>
        <span className="text-xs text-stone-500">{expanded ? "Los resultados se actualizan al elegir." : "Encontrá lo que buscás, a tu manera."}</span>
        {active.length > 0 && <button type="button" onClick={onClear} className="ml-auto rounded-lg px-2 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100">Limpiar todo</button>}
      </div>
      {expanded && <div id="catalog-extra-filters" className="mt-4 grid gap-6 border-t border-stone-100 pt-5 md:grid-cols-3">
        {brands.length > 0 && <Options title="Marca" options={brands} value={brand} color={color} onChange={(value) => onChange("brand", value)} />}
        {tags.length > 0 && <Options title="Características" options={tags} value={tag} color={color} onChange={(value) => onChange("tag", value)} />}
        <fieldset><legend className="mb-3 text-sm font-semibold">Tu presupuesto</legend><div className="flex gap-2">
          {([['minPrice', 'Desde', minPrice], ['maxPrice', 'Hasta', maxPrice]] as const).map(([key, label, value]) => <label key={key} className="min-w-0 flex-1 text-xs text-stone-500">{label}<input aria-label={`Precio ${label.toLowerCase()}`} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-2" type="number" min="0" inputMode="decimal" placeholder={key === 'minPrice' ? '0' : 'Sin límite'} value={value} onChange={(event) => onChange(key, event.target.value)} /></label>)}
        </div><p className="mt-2 text-xs text-stone-400">Completá uno o ambos importes.</p></fieldset>
      </div>}
    </div>
    {active.length > 0 && <div className="flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">{active.map((item) => <button key={item.key} type="button" aria-label={`Quitar filtro ${item.label}`} onClick={() => onChange(item.key, "")} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-400"><span className="truncate">{item.label}</span><X size={13} className="shrink-0" /></button>)}</div>}
  </section>;
}

function Options({ title, options, value, color, onChange }: { title: string; options: string[]; value: string; color: string; onChange: (value: string) => void }) {
  return <fieldset><legend className="mb-3 text-sm font-semibold">{title}</legend><div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">{options.map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(value === option ? "" : option)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition hover:bg-stone-50" style={{ borderColor: value === option ? color : '#e7e5e4', color: value === option ? color : '#57534e' }}>{value === option && <Check size={13} />}{option}</button>)}</div></fieldset>;
}
