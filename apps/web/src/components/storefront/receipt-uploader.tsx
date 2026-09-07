"use client";

import { CheckCircle2, FileCheck2, UploadCloud } from "lucide-react";
import { useState } from "react";

import { FilePicker } from "@/components/file-picker";
import { ApiError, apiRequest } from "@/lib/api";

type ReceiptUploaderProps = {
  existingReceiptName?: string;
  onUploaded?: () => void | Promise<void>;
  orderId: string;
  orderToken?: string;
  customerSessionToken?: string;
  accentColor?: string;
  slug: string;
};

export function ReceiptUploader({
  existingReceiptName,
  onUploaded,
  orderId,
  orderToken,
  customerSessionToken,
  accentColor = "#171417",
  slug,
}: ReceiptUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [inputVersion, setInputVersion] = useState(0);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    const form = new FormData();
    form.append("receipt", file);
    try {
      await apiRequest(`/storefront/${slug}/orders/${orderId}/receipt`, {
        method: "POST",
        headers: {
          ...(orderToken ? { "x-order-token": orderToken } : {}),
          ...(customerSessionToken
            ? { "x-customer-session": customerSessionToken }
            : {}),
        },
        body: form,
      });
      setMessage(
        "Comprobante enviado correctamente. La tienda ya puede revisarlo.",
      );
      setFile(null);
      setInputVersion((value) => value + 1);
      await onUploaded?.();
    } catch (caught) {
      setFailed(true);
      setMessage(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos enviar el comprobante",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-black/[0.07] bg-white p-5 text-left shadow-[0_18px_60px_rgba(28,20,30,0.08)] sm:p-7">
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
          style={{ backgroundColor: accentColor }}
        >
          {existingReceiptName ? <FileCheck2 size={19} /> : <UploadCloud size={19} />}
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
            Último paso
          </p>
          <h2 className="mt-1 font-semibold tracking-[-0.02em]">
            {existingReceiptName
              ? "Reemplazar comprobante"
              : "Adjuntar comprobante"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            La tienda lo revisará para confirmar el pago.
          </p>
        </div>
      </div>
      {existingReceiptName && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="shrink-0" size={16} />
          <span className="min-w-0 truncate">Actual: {existingReceiptName}</span>
        </div>
      )}
      <div className="mt-5">
        <FilePicker
          accept="application/pdf,image/jpeg,image/png,image/webp"
          buttonLabel="Elegir comprobante"
          description="PDF, JPG, PNG o WEBP de hasta 8 MB"
          id={`receipt-${orderId}-${inputVersion}`}
          key={inputVersion}
          name="receipt"
          onChange={(files) => setFile(files[0] ?? null)}
          selectedNames={file ? [file.name] : []}
        />
      </div>
      {message && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          failed
            ? "border border-red-100 bg-red-50 text-red-700"
            : "border border-emerald-100 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      )}
      <button
        className="mt-5 w-full rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-stone-300 disabled:shadow-none"
        disabled={!file || busy}
        onClick={() => void upload()}
        style={file && !busy ? { backgroundColor: accentColor } : undefined}
        type="button"
      >
        {busy
          ? "Enviando…"
          : existingReceiptName
            ? "Reemplazar comprobante"
            : "Enviar comprobante"}
      </button>
    </section>
  );
}
