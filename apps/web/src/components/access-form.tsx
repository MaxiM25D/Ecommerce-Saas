"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";

type Mode = "login" | "register";

export function AccessForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const body =
      mode === "login"
        ? {
            email: form.get("email"),
            password: form.get("password"),
            tenantSlug: form.get("tenantSlug") || undefined,
          }
        : {
            email: form.get("email"),
            password: form.get("password"),
            firstName: form.get("firstName"),
            lastName: form.get("lastName"),
            storeName: form.get("storeName"),
            storeSlug: form.get("storeSlug"),
          };

    try {
      await apiRequest(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo conectar con la API");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-7 shadow-[0_30px_80px_-35px_rgba(41,37,36,0.3)] sm:p-9">
      <div className="mb-8 flex rounded-full bg-stone-100 p-1">
        {(["login", "register"] as const).map((item) => (
          <button
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              mode === item ? "bg-white text-stone-950 shadow-sm" : "text-stone-500"
            }`}
            key={item}
            onClick={() => {
              setMode(item);
              setError("");
            }}
            type="button"
          >
            {item === "login" ? "Ingresar" : "Crear tienda"}
          </button>
        ))}
      </div>

      <div className="mb-7">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">LUNEK Commerce</p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
          {mode === "login" ? "Volvé a tu negocio" : "Abrí tu tienda digital"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          {mode === "login"
            ? "Gestioná catálogo, stock y ventas desde un solo lugar."
            : "Creá tu espacio y quedá asignado automáticamente como propietario."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" name="firstName" placeholder="Maxi" required />
            <Field label="Apellido" name="lastName" placeholder="Morandi" required />
          </div>
        )}
        <Field label="Email" name="email" placeholder="vos@tienda.com" required type="email" />
        <Field label="Contraseña" name="password" placeholder="Mínimo 10 caracteres" required type="password" />
        {mode === "register" ? (
          <>
            <Field label="Nombre de la tienda" name="storeName" placeholder="LUNEK" required />
            <Field label="Slug de la tienda" name="storeSlug" placeholder="lunek" required />
          </>
        ) : (
          <Field label="Slug de tienda (opcional)" name="tenantSlug" placeholder="lunek" />
        )}

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          className="mt-2 w-full rounded-xl bg-stone-950 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {busy ? "Procesando…" : mode === "login" ? "Ingresar al panel" : "Crear tienda"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      <input
        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}
