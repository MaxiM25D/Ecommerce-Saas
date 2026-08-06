import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f1eb] text-stone-950">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3 font-semibold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-950 font-serif text-white">L</span>LUNEK Commerce</div>
        <Link className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold hover:bg-white" href="/login">Ingresar</Link>
      </nav>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pt-24">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Ecommerce multi-tenant</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">La operación de tu tienda, sin ruido.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-stone-600">Administrá catálogo, inventario, clientes y pedidos desde una plataforma diseñada para crecer con tu negocio.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link className="rounded-xl bg-stone-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-amber-700" href="/login">Crear mi tienda</Link><Link className="rounded-xl border border-stone-300 bg-white/50 px-6 py-3.5 text-sm font-bold" href="/admin">Ver panel</Link></div>
        </div>
        <div className="relative min-h-[25rem]">
          <div className="absolute inset-6 rotate-3 rounded-[2.5rem] bg-[#b89b72]" />
          <div className="absolute inset-0 -rotate-2 rounded-[2.5rem] border border-stone-200 bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between"><div><p className="text-xs text-stone-400">Resumen de hoy</p><p className="mt-1 text-xl font-semibold">Hola, LUNEK</p></div><span className="h-10 w-10 rounded-full bg-stone-950" /></div>
            <div className="mt-8 grid grid-cols-2 gap-4"><div className="rounded-2xl bg-stone-950 p-5 text-white"><p className="text-xs text-stone-400">Ventas</p><p className="mt-4 text-2xl font-semibold">$ 248.000</p></div><div className="rounded-2xl bg-amber-50 p-5"><p className="text-xs text-amber-700">Pedidos</p><p className="mt-4 text-2xl font-semibold">18</p></div></div>
            <div className="mt-5 space-y-3">{["Cinturón Toro", "Bolso Norte", "Billetera Cuero"].map((name, index) => <div className="flex items-center gap-3 rounded-xl border border-stone-100 p-3" key={name}><span className="grid h-10 w-10 place-items-center rounded-lg bg-stone-100 text-xs">0{index + 1}</span><span className="text-sm font-medium">{name}</span><span className="ml-auto text-xs text-emerald-600">Activo</span></div>)}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
