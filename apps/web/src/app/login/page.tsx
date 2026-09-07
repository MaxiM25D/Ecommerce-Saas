import { Check, CheckCircle2 } from "lucide-react";

import { AccessForm } from "@/components/access-form";
import styles from "@/components/auth-shell.module.css";
import { BrandLogo } from "@/components/brand-logo";
import { marketingPlans } from "@/lib/plan-catalog";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; plan?: string }>;
}) {
  const query = await searchParams;
  const initialMode = query.mode === "register" ? "register" : "login";
  const initialPlan = query.plan === "PRO" ? "PRO" : "STARTER";
  return (
    <main
      className={`${styles.shell} relative min-h-screen overflow-hidden px-5 py-7 text-white sm:px-8 lg:py-10`}
    >
      <div
        className={`${styles.orb} pointer-events-none absolute -right-32 top-16 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[100px]`}
      />
      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between">
        <BrandLogo />
        <span className="hidden items-center gap-2 text-xs text-white/45 sm:flex">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Acceso seguro a tu negocio
        </span>
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-7xl items-center gap-14 py-10 lg:grid-cols-[1fr_30rem] lg:py-0">
        <section className="hidden lg:block">
          <div className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3.5 py-2 text-xs font-semibold text-fuchsia-100">
            Tu centro de operaciones
          </div>
          <h1 className="mt-7 max-w-2xl text-6xl font-semibold leading-[1.02] tracking-[-0.055em]">
            Tu negocio no se detiene.
            <br />
            <span className="bg-gradient-to-r from-[#bf6bff] to-[#46a5f7] bg-clip-text text-transparent">
              Vos tampoco.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-indigo-100/55">
            Ingresá para gestionar ventas, productos y clientes, o creá tu
            tienda y empezá a vender en minutos.
          </p>
          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-2">
            {marketingPlans.map((plan) => (
              <article
                className={`rounded-2xl border p-5 ${plan.featured ? "border-fuchsia-400/35 bg-fuchsia-400/[.07]" : "border-white/10 bg-white/[.035]"}`}
                key={plan.code}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{plan.name}</h2>
                    <p className="mt-1 text-[11px] leading-4 text-white/35">
                      {plan.description}
                    </p>
                  </div>
                  {plan.featured && (
                    <span className="rounded-full bg-fuchsia-400/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-fuchsia-200">
                      Más completo
                    </span>
                  )}
                </div>
                <p className="mt-4 text-xl font-bold">
                  {plan.price}
                  <span className="ml-1 text-[10px] font-normal text-white/30">
                    /mes
                  </span>
                </p>
                <p className="mt-1 text-[10px] text-blue-200/60">
                  {plan.capacity}
                </p>
                <ul className="mt-4 grid gap-2">
                  {plan.features.map((feature) => (
                    <li
                      className="flex gap-2 text-[10px] leading-4 text-white/45"
                      key={feature}
                    >
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
        <AccessForm initialMode={initialMode} initialPlan={initialPlan} />
      </div>
    </main>
  );
}
