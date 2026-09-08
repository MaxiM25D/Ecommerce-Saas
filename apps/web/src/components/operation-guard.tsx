"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { isOperationPending, subscribeOperation } from "@/lib/pending-operation";

export function OperationGuard({ children }: { children: React.ReactNode }) {
  const pending = useSyncExternalStore(subscribeOperation, isOperationPending, () => false);
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preventNavigation = (event: Event) => {
      if (!isOperationPending()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isOperationPending()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("click", preventNavigation, true);
    document.addEventListener("submit", preventNavigation, true);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("click", preventNavigation, true);
      document.removeEventListener("submit", preventNavigation, true);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement;
    status.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [pending]);
  return <>
    <div inert={pending} aria-busy={pending} className="flex min-h-screen min-w-0 flex-col">{children}</div>
    {pending && <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/25 px-5 backdrop-blur-sm">
      <div ref={status} tabIndex={-1} role="status" aria-live="polite" className="w-full max-w-sm rounded-2xl border border-[#e6dfe8] bg-white p-6 text-center text-[#49225b] shadow-xl outline-none">
        <span aria-hidden="true" className="mx-auto mb-4 block h-7 w-7 animate-spin rounded-full border-2 border-[#e6dfe8] border-t-[#6e3482]" />
        <p className="font-semibold">Estamos procesando tu solicitud</p>
        <p className="mt-2 text-sm text-stone-500">Esperá un momento antes de cambiar de pantalla.</p>
      </div>
    </div>}
  </>;
}
