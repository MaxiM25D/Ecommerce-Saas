"use client";

import { type FormEvent, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role, Store } from "./types";

type MercadoPagoIntegration = {
  configured: boolean;
  connection: {
    mercadoPagoUserId: string;
    liveMode: boolean;
    connectedAt: string;
    updatedAt: string;
  } | null;
};

export function StoreView({
  role,
  onStoreUpdated,
  mercadoPagoResult,
  mercadoPagoMessage,
}: {
  role: Role;
  onStoreUpdated: (name: string) => void;
  mercadoPagoResult?: string;
  mercadoPagoMessage?: string;
}) {
  const canManage = role !== "STAFF";
  const [store, setStore] = useState<Store | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [mercadoPago, setMercadoPago] = useState<MercadoPagoIntegration | null>(
    null,
  );
  const [error, setError] = useState(
    mercadoPagoResult === "error"
      ? (mercadoPagoMessage ?? "No se pudo conectar Mercado Pago")
      : "",
  );
  const [success, setSuccess] = useState(mercadoPagoResult === "connected");
  const [busy, setBusy] = useState(false);
  const canAdvanced =
    canManage && features.includes("ADVANCED_STORE_CUSTOMIZATION");

  async function loadIntegrations() {
    const response = await apiRequest<MercadoPagoIntegration>(
      "/admin/integrations/mercadopago",
    );
    setMercadoPago(response);
  }

  useEffect(() => {
    void Promise.all([
      apiRequest<{ store: Store; features: string[] }>("/admin/store"),
      apiRequest<MercadoPagoIntegration>("/admin/integrations/mercadopago"),
    ]).then(([storeResponse, integration]) => {
      setStore(storeResponse.store);
      setFeatures(storeResponse.features);
      setMercadoPago(integration);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<{ store: Store; features: string[] }>(
        "/admin/store",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description") || null,
            logoUrl: form.get("logoUrl") || null,
            bannerUrl: form.get("bannerUrl") || null,
            primaryColor: form.get("primaryColor"),
            contactEmail: form.get("contactEmail") || null,
            ...(features.includes("ADVANCED_STORE_CUSTOMIZATION")
              ? {
                  secondaryColor: form.get("secondaryColor"),
                  fontFamily: form.get("fontFamily"),
                  borderRadius: form.get("borderRadius"),
                  announcement: form.get("announcement") || null,
                  showPoweredBy: form.get("showPoweredBy") === "on",
                }
              : {}),
            whatsapp: form.get("whatsapp") || null,
            currency: form.get("currency"),
            bankName: form.get("bankName") || null,
            bankAlias: form.get("bankAlias") || null,
            bankHolder: form.get("bankHolder") || null,
            bankCvu: form.get("bankCvu") || null,
            bankCuit: form.get("bankCuit") || null,
            bankTransferEnabled: form.get("bankTransferEnabled") === "on",
            bankReservationHours: Number(form.get("bankReservationHours")),
            emailFromName: form.get("emailFromName") || null,
          }),
        },
      );
      setStore(response.store);
      setFeatures(response.features);
      onStoreUpdated(response.store.name);
      setSuccess(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No se pudo guardar la configuración",
      );
    } finally {
      setBusy(false);
    }
  }

  async function connectMercadoPago() {
    setBusy(true);
    setError("");
    try {
      const { authorizationUrl } = await apiRequest<{
        authorizationUrl: string;
      }>("/admin/integrations/mercadopago/authorize", { method: "POST" });
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No se pudo iniciar la conexión",
      );
      setBusy(false);
    }
  }

  async function disconnectMercadoPago() {
    if (!confirm("¿Desconectar Mercado Pago de esta tienda?")) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/admin/integrations/mercadopago", { method: "DELETE" });
      await loadIntegrations();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No se pudo desconectar Mercado Pago",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!store || !mercadoPago)
    return <div className="h-96 animate-pulse rounded-2xl bg-stone-200" />;
  const settings = store.settings;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7">
          <h2 className="text-xl font-semibold tracking-tight">
            Identidad, pagos y contacto
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            Configuración propia de esta tienda.
          </p>
        </div>
        <form className="space-y-6" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              defaultValue={store.name}
              label="Nombre de la tienda"
              name="name"
              required
            />
            <Field
              defaultValue={store.slug}
              disabled
              label="Slug permanente"
              name="slug"
            />
          </div>

          <ConfigBox
            title="Mercado Pago"
            description="Cada tienda cobra directamente en su propia cuenta conectada mediante OAuth."
          >
            {mercadoPago.connection ? (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    Cuenta conectada
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Usuario MP {mercadoPago.connection.mercadoPagoUserId} ·{" "}
                    {mercadoPago.connection.liveMode ? "Producción" : "Prueba"}
                  </p>
                </div>
                {role === "OWNER" && (
                  <button
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700"
                    disabled={busy}
                    onClick={() => void disconnectMercadoPago()}
                    type="button"
                  >
                    Desconectar
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-stone-600">
                  {mercadoPago.configured
                    ? "Conectá la cuenta del vendedor para habilitar Checkout Pro."
                    : "Primero configurá las credenciales OAuth de InfinityShop en el backend."}
                </p>
                {canManage && (
                  <button
                    className="mt-4 rounded-xl bg-[#009ee3] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                    disabled={busy || !mercadoPago.configured}
                    onClick={() => void connectMercadoPago()}
                    type="button"
                  >
                    Conectar Mercado Pago
                  </button>
                )}
              </div>
            )}
          </ConfigBox>

          <ConfigBox
            title="Transferencia bancaria"
            description="El stock se reserva durante el plazo indicado y el cliente adjunta un comprobante privado."
          >
            <label className="mb-4 flex items-center gap-3 text-sm font-semibold">
              <input
                defaultChecked={settings?.bankTransferEnabled ?? false}
                disabled={!canManage}
                name="bankTransferEnabled"
                type="checkbox"
              />{" "}
              Habilitar transferencias
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                defaultValue={settings?.bankName ?? ""}
                disabled={!canManage}
                label="Banco"
                name="bankName"
              />
              <Field
                defaultValue={settings?.bankAlias ?? ""}
                disabled={!canManage}
                label="Alias"
                name="bankAlias"
              />
              <Field
                defaultValue={settings?.bankCvu ?? ""}
                disabled={!canManage}
                label="CVU"
                name="bankCvu"
              />
              <Field
                defaultValue={settings?.bankCuit ?? ""}
                disabled={!canManage}
                label="CUIT"
                name="bankCuit"
              />
              <Field
                defaultValue={settings?.bankHolder ?? ""}
                disabled={!canManage}
                label="Titular"
                name="bankHolder"
              />
              <Field
                defaultValue={String(settings?.bankReservationHours ?? 24)}
                disabled={!canManage}
                label="Horas de reserva"
                min="1"
                name="bankReservationHours"
                type="number"
              />
            </div>
          </ConfigBox>

          <label className="block text-sm font-medium text-stone-700">
            <span className="mb-1.5 block">Descripción</span>
            <textarea
              className="control min-h-28 resize-y"
              defaultValue={settings?.description ?? ""}
              disabled={!canManage}
              name="description"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              defaultValue={settings?.logoUrl ?? ""}
              disabled={!canManage}
              label="URL del logo"
              name="logoUrl"
              type="url"
            />
            <Field
              defaultValue={settings?.bannerUrl ?? ""}
              disabled={!canManage}
              label="URL del banner"
              name="bannerUrl"
              type="url"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              defaultValue={settings?.contactEmail ?? ""}
              disabled={!canManage}
              label="Email de contacto"
              name="contactEmail"
              type="email"
            />
            <Field
              defaultValue={settings?.emailFromName ?? ""}
              disabled={!canManage}
              label="Nombre en emails"
              name="emailFromName"
            />
            <Field
              defaultValue={settings?.whatsapp ?? ""}
              disabled={!canManage}
              label="WhatsApp"
              name="whatsapp"
            />
            <label className="block text-sm font-medium text-stone-700">
              <span className="mb-1.5 block">Moneda</span>
              <select
                className="control"
                defaultValue={settings?.currency ?? "ARS"}
                disabled={!canManage}
                name="currency"
              >
                <option value="ARS">ARS — Peso argentino</option>
                <option value="USD">USD — Dólar estadounidense</option>
              </select>
            </label>
          </div>
          <ConfigBox
            title="Personalización visual"
            description="Colores, tipografía, estilo y anuncio de la tienda."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                <span className="mb-1.5 block">Color principal</span>
                <input
                  className="h-12 w-20 rounded-xl border border-stone-200 bg-white p-1"
                  defaultValue={settings?.primaryColor ?? "#B89B72"}
                  disabled={!canManage}
                  name="primaryColor"
                  type="color"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                <span className="mb-1.5 block">Color secundario</span>
                <input
                  className="h-12 w-20 rounded-xl border border-stone-200 bg-white p-1"
                  defaultValue={settings?.secondaryColor ?? "#292524"}
                  disabled={!canAdvanced}
                  name="secondaryColor"
                  type="color"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                <span className="mb-1.5 block">Tipografía</span>
                <select
                  className="control"
                  defaultValue={settings?.fontFamily ?? "SYSTEM"}
                  disabled={!canAdvanced}
                  name="fontFamily"
                >
                  <option value="SYSTEM">Sistema</option>
                  <option value="SERIF">Editorial</option>
                  <option value="MODERN">Moderna</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-stone-700">
                <span className="mb-1.5 block">Bordes</span>
                <select
                  className="control"
                  defaultValue={settings?.borderRadius ?? "MEDIUM"}
                  disabled={!canAdvanced}
                  name="borderRadius"
                >
                  <option value="SQUARE">Rectos</option>
                  <option value="MEDIUM">Medios</option>
                  <option value="SOFT">Suaves</option>
                </select>
              </label>
            </div>
            <Field
              defaultValue={settings?.announcement ?? ""}
              disabled={!canAdvanced}
              label="Anuncio superior"
              name="announcement"
            />
            <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
              <input
                defaultChecked={settings?.showPoweredBy ?? true}
                disabled={!canAdvanced}
                name="showPoweredBy"
                type="checkbox"
              />{" "}
              Mostrar “Creada con InfinityShop”
            </label>
          </ConfigBox>
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Configuración guardada correctamente.
            </p>
          )}
          {canManage && (
            <button
              className="rounded-xl bg-stone-950 px-6 py-3.5 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              {busy ? "Guardando…" : "Guardar configuración"}
            </button>
          )}
        </form>
      </section>
      <aside className="h-fit overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div
          className="h-28 bg-stone-200 bg-cover bg-center"
          style={
            settings?.bannerUrl
              ? { backgroundImage: `url(${settings.bannerUrl})` }
              : {
                  background: `linear-gradient(135deg, ${settings?.primaryColor ?? "#B89B72"}, #292524)`,
                }
          }
        />
        <div className="relative p-6 pt-10">
          <div
            className="absolute -top-8 grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-stone-950 bg-cover bg-center text-xl font-bold text-white"
            style={
              settings?.logoUrl
                ? { backgroundImage: `url(${settings.logoUrl})` }
                : undefined
            }
          >
            {!settings?.logoUrl && store.name[0]}
          </div>
          <p className="font-semibold">{store.name}</p>
          <p className="mt-1 text-xs text-stone-400">/{store.slug}</p>
          <p className="mt-4 text-sm leading-6 text-stone-500">
            {settings?.description ||
              "La descripción de tu tienda aparecerá acá."}
          </p>
        </div>
      </aside>
    </div>
  );
}

function ConfigBox({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-stone-400">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
function Field({
  label,
  name,
  defaultValue,
  type = "text",
  disabled,
  required,
  min,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      <input
        className="control disabled:cursor-not-allowed disabled:text-stone-400"
        defaultValue={defaultValue}
        disabled={disabled}
        min={min}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}
