"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileSpreadsheet, LoaderCircle, Scale, StickyNote, Tags } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasOperacoesLegaisAccess } from "@/lib/access-control";

const MODULES = [
  {
    title: "Vistagem e agendamento",
    description: "Publicações, prazos e agendamento no VIOS.",
    icon: CalendarClock,
  },
  {
    title: "Fechamento Legal Ops",
    description: "Rateio mensal das hours de Ops para as áreas jurídicas.",
    icon: StickyNote,
  },
  {
    title: "Relatórios CSV",
    description: "Dump completo de processos e prazos do VIOS.",
    icon: FileSpreadsheet,
  },
  {
    title: "Etiqueta demanda de risco",
    description: "Incluir a etiqueta de pasta Demanda de risco no VIOS.",
    icon: Tags,
  },
] as const;

export function OperacoesLegaisClient() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !hasOperacoesLegaisAccess(profile)) {
      router.replace("/");
    }
  }, [loading, profile, router, user]);

  if (loading || !user || !hasOperacoesLegaisAccess(profile)) {
    return (
      <div className="flex min-h-[48vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Operações Legais</h2>
            <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
          </div>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Módulo da área de Operações Legais. As funções entram aqui aos poucos; por
          enquanto esta sheet só está visível para admin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border bg-card p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <item.icon className="size-5" />
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Em breve
              </span>
            </div>
            <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
