import Link from "next/link";

export function AuthActionShell({ children }: { children: React.ReactNode }) {
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f1eb] px-5 py-12"><div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-200/50 blur-3xl" /><div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-stone-300/60 blur-3xl" /><section className="relative z-10 w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-7 shadow-[0_30px_80px_-35px_rgba(41,37,36,0.3)] sm:p-9"><Link className="mb-8 inline-flex items-center gap-3 text-sm font-bold text-stone-800" href="/"><span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-950 text-white">∞</span>InfinityShop</Link>{children}</section></main>;
}
