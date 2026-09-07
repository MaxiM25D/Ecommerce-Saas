"use client";

import { ImageIcon, Upload, X } from "lucide-react";

export function StoreAssetPicker({
  description,
  id,
  label,
  onChange,
  preview,
  ratio,
}: {
  description: string;
  id: string;
  label: string;
  onChange: (file: File | null) => void;
  preview: string;
  ratio: "square" | "wide";
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-[#3c303f]">{label}</p>
        {preview && (
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-[#8a667f] transition hover:text-[#6E3482]"
            onClick={() => onChange(null)}
            type="button"
          >
            <X className="h-3.5 w-3.5" /> Quitar
          </button>
        )}
      </div>
      <label
        className="group relative flex min-h-36 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#d9cedd] bg-[#fbf9fc] transition hover:border-[#A56ABD] hover:bg-[#f8f3f9] focus-within:border-[#6E3482] focus-within:ring-4 focus-within:ring-[#A56ABD]/10"
        htmlFor={id}
      >
        <input
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="sr-only"
          id={id}
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        {preview ? (
          <span
            className={`absolute bg-center ${ratio === "square" ? "inset-5 rounded-xl bg-contain bg-no-repeat" : "inset-0 bg-cover"}`}
            style={{ backgroundImage: `url(${preview})` }}
          />
        ) : (
          <span className="relative flex flex-col items-center px-4 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eee5f1] text-[#6E3482]">
              {ratio === "square" ? (
                <ImageIcon className="h-5 w-5" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </span>
            <span className="mt-3 text-sm font-semibold text-[#5b465f]">
              Subir {label.toLowerCase()}
            </span>
            <span className="mt-1 text-[11px] leading-4 text-[#9a8d9d]">
              {description}
            </span>
          </span>
        )}
        {preview && (
          <span className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#5b465f] shadow-sm backdrop-blur">
            Reemplazar
          </span>
        )}
      </label>
    </div>
  );
}
