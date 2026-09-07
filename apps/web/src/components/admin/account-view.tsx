"use client";

import { CheckCircle2, KeyRound, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { Field, GuideLink, Tip, panelStyles as styles } from "./guided-panel";

type User = { firstName: string; lastName: string; email: string; emailVerified: boolean };

export function AccountView({ user, onOpenStore, onUserUpdated }: { user: User; onOpenStore: () => void; onUserUpdated: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");

  function resetFeedback() { setMessage(""); setError(""); setVerificationUrl(""); }

  async function resend() {
    setBusy(true); resetFeedback();
    try {
      const response = await apiRequest<{ emailVerified: boolean; emailSent: boolean; verificationUrl?: string }>("/auth/email-verification", { method: "POST" });
      setMessage(response.emailVerified ? "Tu email ya está verificado." : response.emailSent ? "Te enviamos un nuevo enlace de verificación." : "El enlace fue generado, pero el servicio de correo no está disponible.");
      setVerificationUrl(response.verificationUrl ?? "");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo generar el enlace"); }
    finally { setBusy(false); }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); resetFeedback();
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<{ user: User }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ firstName: form.get("firstName"), lastName: form.get("lastName") }) });
      onUserUpdated(response.user); setMessage("Tus datos personales se actualizaron.");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudieron guardar tus datos"); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); resetFeedback();
    const element = event.currentTarget; const form = new FormData(element);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmation")) { setError("La nueva contraseña y su confirmación no coinciden."); setBusy(false); return; }
    try {
      await apiRequest("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword }) });
      element.reset(); setMessage("Contraseña actualizada. Cerramos tus otras sesiones por seguridad.");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar la contraseña"); }
    finally { setBusy(false); }
  }

  return <div className={`${styles.surface} mx-auto max-w-6xl space-y-6`}>
    <header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E3482]">Mi cuenta</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Tu perfil y seguridad</h2><p className="mt-2 text-sm text-[#807384]">Estos datos pertenecen a tu cuenta personal y se mantienen aunque cambies de tienda.</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      <Summary icon={UserRound} label="Nombre" value={`${user.firstName} ${user.lastName}`} help="Se usa dentro del panel y en invitaciones." />
      <Summary icon={Mail} label="Email de acceso" value={user.email} help="Es la dirección con la que iniciás sesión." />
      <Summary icon={ShieldCheck} label="Seguridad del email" value={user.emailVerified ? "Verificado" : "Pendiente"} help={user.emailVerified ? "La dirección está confirmada." : "Todavía falta confirmar la dirección."} success={user.emailVerified} />
    </div>

    {message && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={16} /> {message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="rounded-[1.5rem] border border-[#e6dfe8] bg-white p-6">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Datos personales</h3><p className="mt-1 text-xs leading-5 text-[#807384]">Podés cambiar tu nombre. El email de acceso no se modifica desde este formulario.</p></div><span className="rounded-lg bg-[#f5eff8] p-2 text-[#6E3482]"><UserRound size={18} /></span></div>
        <form className="mt-6 space-y-5" onSubmit={updateProfile}>
          <Field label="Nombre" help="Se muestra a tu equipo y en comunicaciones internas." example="Ejemplo: Maximiliano"><input defaultValue={user.firstName} name="firstName" required /></Field>
          <Field label="Apellido" help="Completá tu apellido real para identificar tu cuenta." example="Ejemplo: Morandi"><input defaultValue={user.lastName} name="lastName" required /></Field>
          <Field label="Email de acceso" help="Por seguridad, esta dirección permanece bloqueada desde el panel."><input disabled value={user.email} readOnly /></Field>
          <button className={`${styles.button} w-full`} disabled={busy} type="submit"><Save size={16} /> {busy ? "Guardando…" : "Guardar mis datos"}</button>
        </form>
      </section>

      <div className="space-y-6">
        <section className="rounded-[1.5rem] border border-[#e6dfe8] bg-white p-6">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Cambiar contraseña</h3><p className="mt-1 text-xs leading-5 text-[#807384]">Usá al menos 10 caracteres. Al cambiarla, se cierran tus otras sesiones.</p></div><span className="rounded-lg bg-[#f5eff8] p-2 text-[#6E3482]"><KeyRound size={18} /></span></div>
          <form className="mt-6 space-y-5" onSubmit={changePassword}>
            <Field label="Contraseña actual" help="Confirma que sos la persona propietaria de la cuenta."><input autoComplete="current-password" minLength={10} name="currentPassword" required type="password" /></Field>
            <Field label="Nueva contraseña" help="Debe ser diferente a la actual y tener entre 10 y 72 caracteres."><input autoComplete="new-password" maxLength={72} minLength={10} name="newPassword" required type="password" /></Field>
            <Field label="Repetir nueva contraseña" help="Escribila otra vez para evitar errores."><input autoComplete="new-password" maxLength={72} minLength={10} name="confirmation" required type="password" /></Field>
            <button className={`${styles.button} w-full`} disabled={busy} type="submit"><KeyRound size={16} /> {busy ? "Actualizando…" : "Cambiar contraseña"}</button>
          </form>
          <p className="mt-4 text-center text-xs text-[#807384]">¿No recordás la actual? <Link className="font-semibold text-[#6E3482] underline" href="/recuperar-clave">Recuperala por email</Link>.</p>
        </section>

        <section className={`rounded-[1.5rem] border p-6 ${user.emailVerified ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
          <h3 className={`font-semibold ${user.emailVerified ? "text-emerald-900" : "text-amber-900"}`}>{user.emailVerified ? "Email verificado" : "Verificación pendiente"}</h3>
          <p className={`mt-2 text-sm leading-6 ${user.emailVerified ? "text-emerald-700" : "text-amber-800"}`}>{user.emailVerified ? "Tu dirección está confirmada y puede usarse para funciones sensibles de la cuenta." : "Verificá el email para habilitar suscripciones, invitaciones y otras acciones protegidas."}</p>
          {!user.emailVerified && <button className="mt-4 rounded-xl bg-[#49225B] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void resend()} type="button">{busy ? "Enviando…" : "Reenviar verificación"}</button>}
          {verificationUrl && <a className="mt-4 block break-all rounded-xl border border-amber-200 bg-white px-4 py-3 text-xs font-semibold text-amber-800" href={verificationUrl}>Abrir verificación local →</a>}
        </section>
      </div>
    </div>
    <Tip title="Cuenta personal y tienda son cosas distintas">Tu nombre, email y contraseña se administran acá. El nombre comercial, logo, pagos y contacto del negocio se configuran en <GuideLink onClick={onOpenStore}>Mi tienda</GuideLink>.</Tip>
  </div>;
}

function Summary({ icon: Icon, label, value, help, success = false }: { icon: typeof UserRound; label: string; value: string; help: string; success?: boolean }) {
  return <article className={styles.card}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-[#807384]">{label}</p><p className="mt-2 break-words text-lg font-semibold">{value}</p><p className="mt-2 text-xs leading-5 text-[#918495]">{help}</p></div><span className={`rounded-lg p-2 ${success ? "bg-emerald-50 text-emerald-700" : "bg-[#f5eff8] text-[#6E3482]"}`}><Icon size={17} /></span></div></article>;
}
