"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";

const inputClass = "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setResetUrl("");
    const form = new FormData(event.currentTarget);
    try { const result = await apiRequest<{ message: string; resetUrl?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.get("email") }) }); setMessage(result.message); setResetUrl(result.resetUrl ?? ""); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo procesar la solicitud"); }
    finally { setBusy(false); }
  }
  return <><Header title="Recuperá tu contraseña" description="Ingresá tu email y te enviaremos un enlace válido durante una hora." /><form className="mt-7 space-y-4" onSubmit={submit}><Field label="Email" name="email" type="email" placeholder="vos@tienda.com" />{message && <Success>{message}</Success>}{error && <ErrorMessage>{error}</ErrorMessage>}{resetUrl && <a className="block break-all rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" href={resetUrl}>Abrir recuperación local →</a>}<Submit busy={busy} label="Enviar instrucciones" /></form><BackToLogin /></>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const password = String(form.get("password")); if (password !== form.get("confirmation")) { setError("Las contraseñas no coinciden"); setBusy(false); return; } try { await apiRequest("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); setDone(true); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar la contraseña"); } finally { setBusy(false); } }
  if (!token) return <><Header title="Enlace incompleto" description="Abrí el enlace recibido por email para restablecer tu contraseña." /><BackToLogin /></>;
  if (done) return <><Header title="Contraseña actualizada" description="Cerramos tus sesiones anteriores. Ya podés ingresar con la nueva contraseña." /><Link className="mt-7 block rounded-xl bg-stone-950 px-5 py-3.5 text-center text-sm font-bold text-white" href="/login">Ingresar</Link></>;
  return <><Header title="Creá una nueva contraseña" description="Debe tener entre 10 y 72 caracteres." /><form className="mt-7 space-y-4" onSubmit={submit}><Field label="Nueva contraseña" name="password" type="password" placeholder="Mínimo 10 caracteres" /><Field label="Repetir contraseña" name="confirmation" type="password" placeholder="Repetí la contraseña" />{error && <ErrorMessage>{error}</ErrorMessage>}<Submit busy={busy} label="Guardar contraseña" /></form><BackToLogin /></>;
}

export function VerifyEmailAction({ token, sent }: { token: string; sent: boolean }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "success");
  const [message, setMessage] = useState(token ? "Estamos verificando tu dirección…" : sent ? "Revisá tu correo y abrí el enlace de verificación." : "Abrí el enlace que recibiste por email.");
  useEffect(() => { if (!token) return; void apiRequest<{ emailVerified: boolean }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }).then(() => { setStatus("success"); setMessage("Tu email quedó verificado correctamente."); }).catch((caught) => { setStatus("error"); setMessage(caught instanceof ApiError ? caught.message : "No se pudo verificar el email"); }); }, [token]);
  return <><Header title={status === "success" && token ? "Email verificado" : "Verificación de email"} description={message} />{status === "loading" && <div className="mt-7 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-amber-600" /></div>}{status === "error" && <ErrorMessage>{message}</ErrorMessage>}<Link className="mt-7 block rounded-xl bg-stone-950 px-5 py-3.5 text-center text-sm font-bold text-white" href="/admin">Ir al panel</Link></>;
}

type InvitationInfo = { email: string; role: string; tenantName: string; expiresAt: string; existingUser: boolean };
export function InvitationAcceptance({ token }: { token: string }) {
  const router = useRouter(); const [invitation, setInvitation] = useState<InvitationInfo | null>(null); const [loading, setLoading] = useState(Boolean(token)); const [busy, setBusy] = useState(false); const [error, setError] = useState(token ? "" : "El enlace de invitación está incompleto");
  useEffect(() => { if (!token) return; void apiRequest<{ invitation: InvitationInfo }>(`/auth/invitations/${encodeURIComponent(token)}`).then(({ invitation: value }) => setInvitation(value)).catch((caught) => setError(caught instanceof ApiError ? caught.message : "No se pudo abrir la invitación")).finally(() => setLoading(false)); }, [token]);
  async function accept(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await apiRequest("/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token, password: form.get("password"), ...(!invitation?.existingUser ? { firstName: form.get("firstName"), lastName: form.get("lastName") } : {}) }) }); router.push("/admin"); router.refresh(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo aceptar la invitación"); } finally { setBusy(false); } }
  if (loading) return <Header title="Cargando invitación…" description="Estamos validando el enlace seguro." />;
  if (!invitation) return <><Header title="Invitación no disponible" description={error || "El enlace venció o ya fue utilizado."} /><BackToLogin /></>;
  return <><Header title={`Sumate a ${invitation.tenantName}`} description={`Te invitaron como ${invitation.role} usando ${invitation.email}.`} /><form className="mt-7 space-y-4" onSubmit={accept}>{!invitation.existingUser && <div className="grid grid-cols-2 gap-3"><Field label="Nombre" name="firstName" placeholder="Tu nombre" /><Field label="Apellido" name="lastName" placeholder="Tu apellido" /></div>}<Field label={invitation.existingUser ? "Tu contraseña actual" : "Creá una contraseña"} name="password" type="password" placeholder="Mínimo 10 caracteres" />{error && <ErrorMessage>{error}</ErrorMessage>}<Submit busy={busy} label="Aceptar invitación" /></form><p className="mt-5 text-center text-xs text-stone-400">Vence el {new Date(invitation.expiresAt).toLocaleString("es-AR")}</p></>;
}

function Header({ title, description }: { title: string; description: string }) { return <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Seguridad de cuenta</p><h1 className="text-3xl font-semibold tracking-tight text-stone-950">{title}</h1><p className="mt-3 text-sm leading-6 text-stone-500">{description}</p></div>; }
function Field({ label, name, type = "text", placeholder }: { label: string; name: string; type?: string; placeholder: string }) { return <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block">{label}</span><input className={inputClass} name={name} placeholder={placeholder} required type={type} /></label>; }
function Submit({ busy, label }: { busy: boolean; label: string }) { return <button className="w-full rounded-xl bg-stone-950 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Procesando…" : label}</button>; }
function ErrorMessage({ children }: { children: React.ReactNode }) { return <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>; }
function Success({ children }: { children: React.ReactNode }) { return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{children}</p>; }
function BackToLogin() { return <Link className="mt-6 block text-center text-sm font-semibold text-stone-500 hover:text-stone-950" href="/login">← Volver al ingreso</Link>; }
