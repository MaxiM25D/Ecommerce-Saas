"use client";

import { AlertCircle, CheckCircle2, ImageIcon, Upload, X } from "lucide-react";
import { useState } from "react";

const allowedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const maxImageSize = 5 * 1024 * 1024;

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
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);

  function selectFile(file: File | null) {
    if (!file) {
      setError("");
      setSelectedFile(null);
      onChange(null);
      return;
    }
    if (!allowedImageTypes.includes(file.type)) {
      setError("Formato no compatible. Elegí una imagen JPG, PNG, WEBP o AVIF.");
      return;
    }
    if (file.size > maxImageSize) {
      setError(`La imagen pesa ${formatFileSize(file.size)} y el máximo permitido es 5 MB.`);
      return;
    }
    if (file.size === 0) {
      setError("El archivo está vacío. Elegí otra imagen.");
      return;
    }
    setError("");
    setSelectedFile({ name: file.name, size: formatFileSize(file.size) });
    onChange(file);
  }

  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-[#3c303f]">{label}</p>
        {preview && (
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-[#8a667f] transition hover:text-[#6E3482]"
            onClick={() => selectFile(null)}
            type="button"
          >
            <X className="h-3.5 w-3.5" /> Quitar
          </button>
        )}
      </div>
      <label
        className={`group relative flex min-h-36 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-[#fbf9fc] transition hover:bg-[#f8f3f9] focus-within:ring-4 ${error ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100" : "border-[#d9cedd] hover:border-[#A56ABD] focus-within:border-[#6E3482] focus-within:ring-[#A56ABD]/10"}`}
        htmlFor={id}
      >
        <input
          accept="image/png,image/jpeg,image/webp,image/avif"
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={Boolean(error)}
          className="sr-only"
          id={id}
          onChange={(event) => {
            selectFile(event.target.files?.[0] ?? null);
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
            <span className="mt-1 text-[11px] leading-4 text-[#9a8d9d]" id={helpId}>
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
      {error && <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-red-700" id={errorId} role="alert"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}
      {selectedFile && preview.startsWith("blob:") && !error && <p className="mt-2 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{selectedFile.name}</span><span className="shrink-0 text-emerald-600/70">· {selectedFile.size} · lista para guardar</span></p>}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
