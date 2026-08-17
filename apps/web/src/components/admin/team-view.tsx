"use client";

import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role } from "./types";

type Member = { role: Role; createdAt: string; user: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean } };
type Invitation = { id: string; email: string; role: Exclude<Role, "OWNER">; expiresAt: string; createdAt: string };

export function TeamView({ role }: { role: Role }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = role === "OWNER";

  function applyTeam(response: { members: Member[]; invitations: Invitation[] }) {
    setMembers(response.members);
    setInvitations(response.invitations);
  }

  async function load() {
    applyTeam(await apiRequest<{ members: Member[]; invitations: Invitation[] }>("/admin/team"));
  }

  useEffect(() => {
    void apiRequest<{ members: Member[]; invitations: Invitation[] }>("/admin/team").then(applyTeam);
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setPreviewUrl("");
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      const result = await apiRequest<{ emailSent: boolean; invitationUrl?: string }>("/admin/team", { method: "POST", body: JSON.stringify({ email: form.get("email"), role: form.get("role") }) });
      element.reset();
      setNotice(result.emailSent ? "Invitación enviada por email." : "Invitación creada. El correo no está configurado en este entorno.");
      setPreviewUrl(result.invitationUrl ?? "");
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo crear la invitación"); }
    finally { setBusy(false); }
  }

  async function update(userId: string, nextRole: string) { setError(""); try { await apiRequest(`/admin/team/${userId}`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) }); await load(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar el rol"); } }
  async function remove(userId: string) { if (!confirm("¿Quitar este miembro de la tienda?")) return; setError(""); try { await apiRequest(`/admin/team/${userId}`, { method: "DELETE" }); await load(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo quitar el miembro"); } }
  async function revoke(invitationId: string) { if (!confirm("¿Cancelar esta invitación?")) return; setError(""); try { await apiRequest(`/admin/team/invitations/${invitationId}`, { method: "DELETE" }); await load(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No se pudo cancelar la invitación"); } }

  return <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_23rem]">
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="border-b border-stone-100 px-6 py-5"><h2 className="font-semibold">Equipo de la tienda</h2><p className="mt-1 text-sm text-stone-400">OWNER administra todo, ADMIN gestiona el negocio y STAFF tiene acceso de lectura.</p></div><div className="divide-y divide-stone-100">{members.map((member) => <article className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center" key={member.user.id}><div><div className="flex items-center gap-2"><p className="font-semibold">{member.user.firstName} {member.user.lastName}</p>{member.user.emailVerified && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Verificado</span>}</div><p className="mt-1 text-xs text-stone-400">{member.user.email}</p></div><div className="flex items-center gap-2">{canManage && member.role !== "OWNER" ? <><select className="rounded-xl border border-stone-200 px-3 py-2 text-xs" onChange={(event) => void update(member.user.id, event.target.value)} value={member.role}><option value="ADMIN">ADMIN</option><option value="STAFF">STAFF</option></select><button className="rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => void remove(member.user.id)} type="button">Quitar</button></> : <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold">{member.role}</span>}</div></article>)}</div></section>
      {invitations.length > 0 && <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="border-b border-stone-100 px-6 py-5"><h2 className="font-semibold">Invitaciones pendientes</h2><p className="mt-1 text-sm text-stone-400">Reservan un lugar del plan hasta vencer o ser canceladas.</p></div><div className="divide-y divide-stone-100">{invitations.map((invitation) => <article className="flex items-center justify-between gap-4 px-6 py-4" key={invitation.id}><div><p className="font-semibold">{invitation.email}</p><p className="mt-1 text-xs text-stone-400">{invitation.role} · vence {new Date(invitation.expiresAt).toLocaleDateString("es-AR")}</p></div>{canManage && <button className="rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => void revoke(invitation.id)} type="button">Cancelar</button>}</article>)}</div></section>}
    </div>
    <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Invitar colaborador</h2><p className="mt-1 text-sm leading-5 text-stone-400">Puede aceptar con su cuenta o crear una desde el enlace seguro.</p>{canManage ? <form className="mt-6 space-y-4" onSubmit={invite}><label className="block text-sm font-medium"><span className="mb-1.5 block">Email</span><input className="control" name="email" placeholder="persona@email.com" required type="email" /></label><label className="block text-sm font-medium"><span className="mb-1.5 block">Rol</span><select className="control" name="role"><option value="STAFF">STAFF — solo lectura</option><option value="ADMIN">ADMIN — gestión</option></select></label>{error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}{notice && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">{notice}</p>}{previewUrl && <a className="block break-all rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800" href={previewUrl} target="_blank">Abrir invitación local ↗</a>}<button className="w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Enviando…" : "Enviar invitación"}</button></form> : <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Solo el propietario puede administrar miembros.</p>}</aside>
  </div>;
}
