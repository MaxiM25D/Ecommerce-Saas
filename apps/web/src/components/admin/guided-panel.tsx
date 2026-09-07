import { ArrowRight, Info } from "lucide-react";
import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

import styles from "./guided-panel.module.css";

export { styles as panelStyles };

export function Field({ label, help, example, children }: { label: string; help: string; example?: string; children: ReactElement<{ id?: string; "aria-describedby"?: string }> }) {
  const id = useId();
  return <div className={styles.field}>
    <label htmlFor={id} className={styles.label}>{label}</label>
    <span id={`${id}-help`} className={styles.help}>{help}</span>
    <span className={styles.control}>{cloneElement(children, { id, "aria-describedby": `${id}-help${example ? ` ${id}-example` : ""}` })}</span>
    {example && <span id={`${id}-example`} className={styles.example}>{example}</span>}
  </div>;
}

export function Tip({ title = "Cómo funciona", children }: { title?: string; children: ReactNode }) {
  return <aside className={styles.tip}><Info aria-hidden="true" size={17} /><div><p className="font-semibold">{title}</p><div className="mt-1 text-xs leading-6">{children}</div></div></aside>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className={styles.empty}><p className="text-sm font-semibold text-[#4b3a50]">{title}</p><p className="mt-2 text-xs leading-6 text-[#807384]">{children}</p></div>;
}

export function GuideLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="inline-flex items-center gap-1 font-semibold text-[#6E3482] underline decoration-[#cdb4d8] underline-offset-2 transition hover:text-[#49225B] hover:decoration-[#6E3482] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E3482]" onClick={onClick} type="button">{children}<ArrowRight aria-hidden="true" size={12} /></button>;
}
