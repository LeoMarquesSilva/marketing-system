"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bloco das Configurações: borda leve, título e corpo (sem card dentro de card). */
export function ConfigSection({
  title,
  description,
  action,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]", className)}>
      <header className="flex flex-col gap-2 border-b border-[#eef4f5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {Icon ? <Icon className="size-4 text-[#347796]" aria-hidden /> : null}
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Interruptor acessível (não há Switch no kit de UI). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 disabled:opacity-50",
        checked ? "bg-[#347796]" : "bg-slate-300",
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function BulletList({ items, empty }: { items: string[] | undefined; empty?: string }) {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return empty ? <p className="text-sm text-slate-500">{empty}</p> : null;
  return (
    <ul className="space-y-1.5">
      {list.map((item, index) => (
        <li key={index} className="flex gap-2 text-sm leading-snug text-slate-700">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#347796]/60" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-900">
        {children}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
