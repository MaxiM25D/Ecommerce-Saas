"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { marketingPlans, type MarketingPlanCode } from "@/lib/plan-catalog";

type Mode = "login" | "register";

export function AccessForm({
  initialMode = "login",
  initialPlan = "STARTER",
}: {
  initialMode?: Mode;
  initialPlan?: MarketingPlanCode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [planCode, setPlanCode] = useState<MarketingPlanCode>(initialPlan);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const body =
      mode === "login"
        ? { email: form.get("email"), password: form.get("password") }
        : {
            email: form.get("email"),
            password: form.get("password"),
            firstName: form.get("firstName"),
            lastName: form.get("lastName"),
            storeName: form.get("storeName"),
            storeSlug: form.get("storeSlug"),
            planCode,
          };

    try {
      const result = await apiRequest<{
        verification?: { verificationUrl?: string };
      }>(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (mode === "register") {
        const verificationUrl = result.verification?.verificationUrl;
        router.push(
          verificationUrl
            ? `${new URL(verificationUrl).pathname}${new URL(verificationUrl).search}`
            : "/verificar-email?sent=1",
        );
      } else {
        router.push("/admin");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No se pudo conectar con la API",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-[2rem] border border-white/10 bg-[#0b0d28]/85 p-6 shadow-[0_35px_100px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-8"
      initial={{ opacity: 0, y: 22 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-8 grid grid-cols-2 rounded-xl border border-white/[.07] bg-white/[.04] p-1">
        {(["login", "register"] as const).map((item) => (
          <button
            className={`relative rounded-lg px-4 py-2.5 text-sm font-semibold transition ${mode === item ? "text-white" : "text-white/40 hover:text-white/70"}`}
            key={item}
            onClick={() => changeMode(item)}
            type="button"
          >
            {mode === item && (
              <motion.span
                className="absolute inset-0 rounded-lg border border-white/10 bg-white/10 shadow-sm"
                layoutId="access-mode"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">
              {item === "login" ? "Ingresar" : "Crear tienda"}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: mode === "login" ? 12 : -12 }}
          initial={{ opacity: 0, x: mode === "login" ? -12 : 12 }}
          key={mode}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-7">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-300">
              {mode === "login" ? "Bienvenido de nuevo" : "7 días gratis"}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              {mode === "login"
                ? "Volvé a tu negocio"
                : "Creá tu tienda online"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              {mode === "login"
                ? "Todo lo que necesitás para seguir vendiendo."
                : "Configurá lo esencial ahora. Podés personalizar todo después."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <Field
                  autoComplete="given-name"
                  icon={UserRound}
                  label="Nombre"
                  name="firstName"
                  placeholder=""
                />
                <Field
                  autoComplete="family-name"
                  icon={UserRound}
                  label="Apellido"
                  name="lastName"
                  placeholder=""
                />
              </div>
            )}
            <Field
              autoComplete="email"
              icon={Mail}
              label="Email"
              name="email"
              placeholder="vos@tienda.com"
              type="email"
            />
            <Field
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              icon={LockKeyhole}
              label="Contraseña"
              name="password"
              placeholder="Mínimo 10 caracteres"
              type={showPassword ? "text" : "password"}
              trailing={
                <button
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="text-white/35 transition hover:text-white"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />
            {mode === "login" && (
              <Link
                className="block text-right text-xs font-semibold text-blue-300 transition hover:text-blue-200"
                href="/recuperar-clave"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            )}

            {mode === "register" && (
              <>
                <Field
                  autoComplete="organization"
                  icon={Store}
                  label="Nombre de la tienda"
                  name="storeName"
                  onChange={(value) => {
                    setStoreName(value);
                    if (!customSlug) setStoreSlug(createSlug(value));
                  }}
                  placeholder="Mi tienda"
                  value={storeName}
                />
                <Field
                  icon={Store}
                  label="Dirección de tu tienda"
                  name="storeSlug"
                  onChange={(value) => {
                    setCustomSlug(true);
                    setStoreSlug(createSlug(value));
                  }}
                  placeholder="mi-tienda"
                  prefix="infinityshop.com.ar/tienda/"
                  value={storeSlug}
                />
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-white/70">
                      Elegí tu plan
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                      7 días gratis
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {marketingPlans.map((plan) => {
                      const selected = planCode === plan.code;
                      return (
                        <label
                          className={`relative cursor-pointer rounded-xl border p-3 transition ${selected ? "border-fuchsia-400/70 bg-fuchsia-400/10 ring-2 ring-fuchsia-400/10" : "border-white/10 bg-white/[.035] hover:border-white/20"}`}
                          key={plan.code}
                        >
                          <input
                            checked={selected}
                            className="sr-only"
                            name="planCode"
                            onChange={() => setPlanCode(plan.code)}
                            type="radio"
                            value={plan.code}
                          />
                          <span className="flex items-start justify-between gap-2">
                            <strong className="text-sm text-white">
                              {plan.name}
                            </strong>
                            {selected && (
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-fuchsia-400 text-[#080a2d]">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </span>
                            )}
                          </span>
                          <span className="mt-2 block text-base font-bold text-white">
                            {plan.price}
                            <span className="ml-1 text-[10px] font-normal text-white/35">
                              /mes
                            </span>
                          </span>
                          <span className="mt-1 block text-[10px] leading-4 text-white/35">
                            {plan.capacity}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-white/30">
                    No se realizará ningún cobro durante el período de prueba.
                  </p>
                </div>
                <p className="text-xs leading-5 text-white/35">
                  Al continuar aceptás los términos de uso y la política de
                  privacidad.
                </p>
              </>
            )}

            {error && (
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 rounded-xl border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm text-red-200"
                initial={{ opacity: 0, y: -4 }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </motion.p>
            )}

            <button
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a334d2] to-[#397eea] px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_35px_rgba(121,54,210,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(121,54,210,.4)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {busy ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  {mode === "login" ? "Ingresar al panel" : "Crear mi tienda"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}

function Field({
  autoComplete,
  icon: Icon,
  label,
  name,
  onChange,
  placeholder,
  prefix,
  trailing,
  type = "text",
  value,
}: {
  autoComplete?: string;
  icon: LucideIcon;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder: string;
  prefix?: string;
  trailing?: React.ReactNode;
  type?: string;
  value?: string;
}) {
  return (
    <label className="block text-sm font-medium text-white/70">
      <span className="mb-1.5 block">{label}</span>
      <span className="flex min-h-12 items-center rounded-xl border border-white/10 bg-white/[.045] px-3.5 transition focus-within:border-fuchsia-400/60 focus-within:bg-white/[.07] focus-within:ring-2 focus-within:ring-fuchsia-400/10">
        <Icon className="mr-3 h-4 w-4 shrink-0 text-white/25" />
        {prefix && (
          <span className="hidden shrink-0 text-xs text-white/25 sm:inline">
            {prefix}
          </span>
        )}
        <input
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/20"
          name={name}
          onChange={
            onChange ? (event) => onChange(event.target.value) : undefined
          }
          placeholder={placeholder}
          required
          type={type}
          value={value}
        />
        {trailing}
      </span>
    </label>
  );
}

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
