import { ShieldCheck } from "lucide-react";

import styles from "./auth-shell.module.css";
import { AuthCardMotion } from "./auth-motion";
import { BrandLogo } from "./brand-logo";

export function AuthActionShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`${styles.shell} relative grid min-h-screen place-items-center overflow-hidden px-5 py-12 text-white`}
    >
      <div
        className={`${styles.orb} pointer-events-none absolute -left-32 top-12 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[90px]`}
      />
      <div
        className={`${styles.orb} pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-500/15 blur-[90px]`}
      />
      <div className="relative z-10 w-full max-w-md">
        <AuthCardMotion>
          <section className="rounded-[2rem] border border-white/10 bg-[#0b0d28]/85 p-7 shadow-[0_35px_100px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-9">
            <div className="mb-9 flex items-center justify-between">
              <BrandLogo />
              <ShieldCheck className="h-5 w-5 text-emerald-300/70" />
            </div>
            {children}
          </section>
        </AuthCardMotion>
      </div>
    </main>
  );
}
