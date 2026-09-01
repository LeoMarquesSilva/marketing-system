"use client";

import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditorialLoading({ label = "Organizando a mesa editorial" }: { label?: string }) {
  return (
    <div className="grid gap-3" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin text-[#347796]" aria-hidden />
        {label}
      </div>
      <div className="h-28 animate-pulse rounded-[1.25rem] bg-[#04202f]/[0.055]" />
      <div className="h-20 animate-pulse rounded-[1.25rem] bg-[#04202f]/[0.035]" />
    </div>
  );
}

export function EditorialError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[1.25rem] bg-red-50 px-5 py-5 text-red-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
        <div>
          <p className="font-semibold">Não foi possível carregar esta etapa</p>
          <p className="mt-1 text-sm text-red-900/70">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="border-red-200 bg-white">
          Tentar novamente
        </Button>
      )}
    </section>
  );
}

export function EditorialEmpty({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] bg-[#04202f] px-6 py-9 text-white sm:px-8">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[#47cdd0]/20" />
      <div className="absolute -right-2 top-7 h-20 w-20 rounded-full bg-[#47cdd0]/10 blur-xl" />
      <p className="editorial-kicker font-mono text-[11px] uppercase text-[#7fe1e3]">{eyebrow}</p>
      <h3 className="editorial-display mt-3 max-w-xl text-2xl font-semibold text-balance">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#7fe1e3] transition-transform hover:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fe1e3]"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </section>
  );
}
