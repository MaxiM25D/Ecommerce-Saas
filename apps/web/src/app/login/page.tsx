import Link from "next/link";

import { AccessForm } from "@/components/access-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f1eb] px-5 py-12">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-200/50 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-stone-300/60 blur-3xl" />
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_28rem]">
        <section className="hidden lg:block">
          <Link className="mb-16 inline-flex items-center gap-3 text-sm font-bold text-stone-800" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-950 text-white">L</span>
            LUNEK Commerce
          </Link>
          <p className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight text-stone-950">
            Tu operación clara. Tu tienda lista para crecer.
          </p>
          <p className="mt-6 max-w-md text-lg leading-8 text-stone-600">
            Catálogo, inventario, clientes y pedidos aislados de forma segura para cada negocio.
          </p>
        </section>
        <AccessForm />
      </div>
    </main>
  );
}
