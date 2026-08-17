"use client";

import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

export function AccountView({ user }: { user: { firstName: string; lastName: string; email: string; emailVerified: boolean } }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");

  async function resend() {
    setBusy(true); setMessage(""); setError(""); setVerificationUrl("");
    try {
      const response = await apiRequest<{ emailVerified: boolean; emailSent: boolean; verificationUrl?: string }>("/auth/email-verification", { method: "POST" });
      setMessage(response.emailVerified ? "Tu email ya está verificado." : response.emailSent ? "Te enviamos un nuevo enlace de verificación." : "El enlace fue generado, pero SMTP no está configurado.");
      setVerificationUrl(response.verificationUrl ?? "");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo generar el enlace"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl"><section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Mi cuenta</p><h2 className="mt-2 text-2xl font-semibold">{user.firstName} {user.lastName}</h2><p className="mt-1 text-stone-500">{user.email}</p><div className={`mt-7 rounded-2xl p-5 ${user.emailVerified ? "bg-emerald-50" : "bg-amber-50"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className={`font-semibold ${user.emailVerified ? "text-emerald-900" : "text-amber-900"}`}>{user.emailVerified ? "Email verificado" : "Email pendiente de verificación"}</h3><p className={`mt-1 text-sm ${user.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>{user.emailVerified ? "Tu dirección de correo está confirmada." : "Confirmá tu dirección para proteger la cuenta y recibir notificaciones importantes."}</p></div>{!user.emailVerified && <button className="shrink-0 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void resend()} type="button">{busy ? "Enviando…" : "Reenviar enlace"}</button>}</div></div>{message && <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">{message}</p>}{error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{verificationUrl && <a className="mt-4 block break-all rounded-xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800" href={verificationUrl}>Abrir verificación local →</a>}</section></div>;
}
