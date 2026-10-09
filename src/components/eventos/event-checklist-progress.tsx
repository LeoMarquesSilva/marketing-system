import { Check, Clock3, ListChecks, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function EventChecklistProgress({ completed, total, actions }: { completed: number; total: number; actions: ReactNode }) {
  const progress = total ? Math.round(completed / total * 100) : 0;
  const circumference = 2 * Math.PI * 46;

  return <section aria-label="Resumo do checklist" className="rounded-2xl border border-border/50 bg-card p-4 shadow-[0_4px_20px_rgba(24,56,77,0.04)] sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Progresso do checklist</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Acompanhe as entregas e o que falta para o evento.</p>
      </div>
      {actions}
    </div>
    <div className="mt-5 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-6 xl:grid-cols-[120px_minmax(0,1fr)_260px]">
      <div role="progressbar" aria-label="Progresso do checklist" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${completed} de ${total} concluídos`} className="relative size-28 sm:size-30">
        <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="56" cy="56" r="46" fill="none" stroke="currentColor" strokeWidth="8" className="text-emerald-500/10" />
          <circle cx="56" cy="56" r="46" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} className="text-emerald-500 transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold tabular-nums tracking-tight">{progress}%</span><span className="mt-0.5 text-xs text-muted-foreground">concluído</span></div>
      </div>
      <dl className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { label: "Concluídos", value: completed, icon: Check, color: "bg-emerald-500/10 text-emerald-600" },
          { label: "Pendentes", value: total - completed, icon: Clock3, color: "bg-amber-500/10 text-amber-600" },
          { label: "Total de itens", value: total, icon: ListChecks, color: "bg-primary/10 text-primary" },
        ].map(metric => <div key={metric.label} className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-2.5 py-2 sm:flex-col sm:items-start sm:gap-3 sm:p-4 lg:flex-row lg:items-center">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-10 ${metric.color}`}><metric.icon className="size-4 sm:size-5" aria-hidden="true" /></span>
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 sm:block"><dd className="order-2 text-lg font-semibold tabular-nums leading-6 sm:text-2xl">{metric.value}</dd><dt className="text-xs text-muted-foreground sm:mt-1">{metric.label}</dt></div>
        </div>)}
      </dl>
      <div className="hidden items-start gap-3 rounded-xl bg-emerald-500/5 p-4 xl:flex">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div><p className="text-sm font-semibold">{total > 0 && completed === total ? "Tudo pronto!" : "Cada entrega conta"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{total ? `${completed} de ${total} concluídos. Acompanhe as pendências com sua equipe.` : "Comece pelos itens da proposta e distribua os responsáveis."}</p></div>
      </div>
    </div>
  </section>;
}
