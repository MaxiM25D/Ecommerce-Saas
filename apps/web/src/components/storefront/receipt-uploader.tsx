"use client";

import { useState } from "react";

import { FilePicker } from "@/components/file-picker";
import { ApiError, apiRequest } from "@/lib/api";

type ReceiptUploaderProps = {
  existingReceiptName?: string;
  onUploaded?: () => void | Promise<void>;
  orderId: string;
  orderToken: string;
  slug: string;
};

export function ReceiptUploader({
  existingReceiptName,
  onUploaded,
  orderId,
  orderToken,
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
        headers: { "x-order-token": orderToken },
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
    <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 text-left shadow-sm sm:p-8">
      <h2 className="font-semibold">
        {existingReceiptName
          ? "Reemplazar comprobante"
          : "Adjuntar comprobante"}
      </h2>
      {existingReceiptName && (
        <p className="mt-1 truncate text-sm text-stone-500">
          Actual: {existingReceiptName}
        </p>
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
            failed ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      )}
      <button
        className="mt-5 w-full rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!file || busy}
        onClick={() => void upload()}
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
