"use client";

import { CheckCircle2, Clock3, MailPlus, ShieldCheck, UserRound, UsersRound, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { EmptyState, Field, GuideLink, Tip, panelStyles as styles } from "./guided-panel";
import type { Role } from "./types";

type Member = { role: Role; createdAt: string; user: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean } };
type Invitation = { id: string; email: string; role: Exclude<Role, "OWNER">; expiresAt: string; createdAt: string };
const roleCopy: Record<Role, { label: string; help: string }> = {
  OWNER: { label: "Propietario", help: "Control total: equipo, plan, cobros y configuración." },
  ADMIN: { label: "Administrador", help: "Gestiona productos, pedidos, clientes y la tienda." },
  STAFF: { label: "Personal", help: "Puede consultar el panel, sin realizar cambios." },
};

export function TeamView({ onOpenPlan, role }: { onOpenPlan: () => void; role: Role }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const canManage = role === "OWNER";

  function applyTeam(response: { members: Member[]; invitations: Invitation[] }) {
    setMembers(response.members); setInvitations(response.invitations);
  }
  async function load() { applyTeam(await apiRequest<{ members: Member[]; invitations: Invitation[] }>("/admin/team")); }

  useEffect(() => {
    let active = true;
    void apiRequest<{ members: Member[]; invitations: Invitation[] }>("/admin/team")
      .then((response) => { if (active) applyTeam(response); })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? caught.message : "No se pudo cargar el equipo"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setPreviewUrl("");
    const element = event.currentTarget; const form = new FormData(element);
    try {
      const result = await apiRequest<{ emailSent: boolean; invitationUrl?: string }>("/admin/team", { method: "POST", body: JSON.stringify({ email: form.get("email"), role: form.get("role") }) });
      element.reset();
      setNotice(result.emailSent ? "Invitación enviada por email." : "Invitación creada. El correo no está configurado en este entorno.");
      setPreviewUrl(result.invitationUrl ?? "");
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo crear la invitación"); }
    finally { setBusy(false); }
  }

  async function update(userId: string, nextRole: string) {
    if (!confirm(`¿Cambiar el rol a ${roleCopy[nextRole as Role]?.label ?? nextRole}?`)) return;
    setBusy(true); setError("");
    try { await apiRequest(`/admin/team/${userId}`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) }); await load(); setNotice("Rol actualizado."); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar el rol"); }
    finally { setBusy(false); }
  }
  async function remove(userId: string) {
    if (!confirm("¿Quitar este miembro? Perderá el acceso a la tienda, pero su cuenta no se elimina.")) return;
    setBusy(true); setError("");
    try { await apiRequest(`/admin/team/${userId}`, { method: "DELETE" }); await load(); setNotice("Miembro quitado del equipo."); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo quitar el miembro"); }
    finally { setBusy(false); }
  }
  async function revoke(invitationId: string) {
    if (!confirm("¿Cancelar esta invitación? El enlace dejará de funcionar.")) return;
    setBusy(true); setError("");
    try { await apiRequest(`/admin/team/invitations/${invitationId}`, { method: "DELETE" }); await load(); setNotice("Invitación cancelada."); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cancelar la invitación"); }
    finally { setBusy(false); }
  }

  return <div className={`${styles.surface} mx-auto max-w-7xl`}>
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E3482]">Equipo</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Personas y permisos, sin confusiones</h2><p className="mt-2 text-sm text-[#807384]">Invitá colaboradores y decidí exactamente qué puede hacer cada uno.</p></header>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Summary icon={UsersRound} label="Miembros activos" value={members.length} help="Personas con acceso actual." />
      <Summary icon={Clock3} label="Invitaciones pendientes" value={invitations.length} help="También reservan un lugar del plan." />
      <Summary icon={ShieldCheck} label="Tu permiso" value={roleCopy[role].label} help={roleCopy[role].help} />
    </div>
    <Tip title="Elegí el permiso mínimo necesario">Usá Administrador para quien opera el negocio y Personal para quien solo necesita consultar. Solo el Propietario administra el equipo y la suscripción desde <GuideLink onClick={onOpenPlan}>Plan y uso</GuideLink>.</Tip>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={16} /> {notice}</p>}
    {loading ? <div className="mt-6 h-72 animate-pulse rounded-2xl bg-[#eee9ef]" /> : <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.5rem] border border-[#e6dfe8] bg-white">
          <div className="border-b border-[#eee9ef] px-6 py-5"><h3 className="font-semibold">Miembros del equipo</h3><p className="mt-1 text-xs leading-5 text-[#807384]">Los cambios de rol se aplican en la próxima acción del usuario.</p></div>
          <div className="divide-y divide-[#eee9ef]">{members.map((member) => <article className="flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center" key={member.user.id}>
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f5eff8] text-sm font-semibold text-[#6E3482]">{member.user.firstName[0]}{member.user.lastName[0]}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{member.user.firstName} {member.user.lastName}</p>{member.user.emailVerified ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Email verificado</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">Email pendiente</span>}</div><p className="mt-1 truncate text-xs text-[#807384]">{member.user.email}</p><p className="mt-1 text-[11px] text-[#918495]">{roleCopy[member.role].help}</p></div></div>
            <div className="flex shrink-0 items-center gap-2">{canManage && member.role !== "OWNER" ? <><label><span className="sr-only">Rol de {member.user.firstName}</span><select className="rounded-xl border border-[#e6dfe8] bg-white px-3 py-2 text-xs text-[#4b3a50]" disabled={busy} onChange={(event) => void update(member.user.id, event.target.value)} value={member.role}><option value="ADMIN">Administrador</option><option value="STAFF">Personal · solo lectura</option></select></label><button className="rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" disabled={busy} onClick={() => void remove(member.user.id)} type="button">Quitar</button></> : <span className="rounded-full bg-[#f4eff7] px-3 py-1.5 text-xs font-semibold text-[#6E3482]">{roleCopy[member.role].label}</span>}</div>
          </article>)}</div>
        </section>
        <section className="overflow-hidden rounded-[1.5rem] border border-[#e6dfe8] bg-white">
          <div className="border-b border-[#eee9ef] px-6 py-5"><h3 className="font-semibold">Invitaciones pendientes</h3><p className="mt-1 text-xs leading-5 text-[#807384]">Vencen automáticamente si la persona no acepta a tiempo.</p></div>
          {invitations.length === 0 ? <div className="p-6"><EmptyState title="No hay invitaciones pendientes">Las nuevas invitaciones aparecerán acá hasta que sean aceptadas o canceladas.</EmptyState></div> : <div className="divide-y divide-[#eee9ef]">{invitations.map((invitation) => <article className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center" key={invitation.id}><div><p className="font-semibold">{invitation.email}</p><p className="mt-1 text-xs text-[#807384]">{roleCopy[invitation.role].label} · vence {new Date(invitation.expiresAt).toLocaleDateString("es-AR")}</p></div>{canManage && <button className="inline-flex items-center gap-1.5 self-start rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 sm:self-auto" disabled={busy} onClick={() => void revoke(invitation.id)} type="button"><XCircle size={14} /> Cancelar</button>}</article>)}</div>}
        </section>
      </div>
      <aside className="h-fit rounded-[1.5rem] border border-[#e6dfe8] bg-white p-6 shadow-[0_20px_50px_rgba(52,31,59,.05)]">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Invitar colaborador</h3><p className="mt-1 text-xs leading-5 text-[#807384]">Recibirá un enlace seguro para ingresar o crear su cuenta.</p></div><span className="rounded-lg bg-[#f5eff8] p-2 text-[#6E3482]"><MailPlus size={18} /></span></div>
        {canManage ? <form className="mt-6 space-y-5" onSubmit={invite}>
          <Field label="Email de la persona" help="La invitación solo puede aceptarse con esta dirección." example="Ejemplo: ventas@mitienda.com"><input name="email" placeholder="ventas@mitienda.com" required type="email" /></Field>
          <Field label="Permiso" help="Podés cambiarlo más adelante desde la lista de miembros."><select name="role"><option value="STAFF">Personal — solo lectura</option><option value="ADMIN">Administrador — gestión del negocio</option></select></Field>
          <Tip title="Antes de enviar">Las invitaciones pendientes también cuentan para el límite de colaboradores. Consultá el disponible en <GuideLink onClick={onOpenPlan}>Plan y uso</GuideLink>.</Tip>
          {previewUrl && <a className="block break-all rounded-xl bg-[#f5eff8] px-3 py-2.5 text-xs font-semibold text-[#6E3482]" href={previewUrl} target="_blank">Abrir invitación local ↗</a>}
          <button className={`${styles.button} w-full`} disabled={busy} type="submit">{busy ? "Enviando…" : "Enviar invitación"}</button>
        </form> : <Tip title="Acceso de consulta">Solo el Propietario puede invitar, quitar miembros o cambiar permisos.</Tip>}
      </aside>
    </div>}
  </div>;
}

function Summary({ icon: Icon, label, value, help }: { icon: typeof UserRound; label: string; value: string | number; help: string }) {
  return <article className={styles.card}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#807384]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-2 text-xs leading-5 text-[#918495]">{help}</p></div><span className="rounded-lg bg-[#f5eff8] p-2 text-[#6E3482]"><Icon size={17} /></span></div></article>;
}
