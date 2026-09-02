import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  Scale,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const FUNCOES: {
  href: string;
  title: string;
  blurb: string;
  skill: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/operacoes-legais/vistagem",
    title: "Vistagem e agendamento",
    blurb: "Filas reais: captura Kurrier, match, jurídico, prazos e jobs VIOS (dry-run até o connector).",
    skill: "vios-vistagem-agendamento",
    icon: CalendarClock,
  },
  {
    href: "/operacoes-legais/fechamento",
    title: "Fechamento Legal Ops",
    blurb: "Rateio de horas da equipe Ops nas áreas jurídicas (timesheet, volumes, de-para Orquestra).",
    skill: "vios-fechamento-legal-ops",
    icon: Wallet,
  },
  {
    href: "/operacoes-legais/relatorios",
    title: "Relatórios VIOS (CSV)",
    blurb: "Dump completo de processos e prazos sem o corte de 500 linhas do Completo/DataTables.",
    skill: "vios-baixar-relatorio-csv",
    icon: ClipboardList,
  },
  {
    href: "/operacoes-legais/etiquetas",
    title: "Demanda de risco",
    blurb: "Etiqueta de pasta (id 203) em lote a partir da base Rec. Crédito.",
    skill: "vios-etiqueta-demanda-risco",
    icon: ShieldAlert,
  },
];

export function OpsLegaisHub() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#48466e]/10 text-[#48466e] dark:text-[#8f8bb8]">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Operações Legais</h2>
            <p className="text-muted-foreground max-w-2xl">
              Funções da área no ORQESTRAI. Acesso só para quem está em Operações Legais.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FUNCOES.map((fn) => (
          <Link key={fn.href} href={fn.href} className="group">
            <Card className="h-full transition-colors group-hover:border-[#48466e]/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="rounded-md bg-muted p-2 text-foreground">
                  <fn.icon className="h-5 w-5" />
                </span>
                <p className="font-semibold text-foreground">{fn.title}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{fn.blurb}</p>
                <p className="text-xs text-muted-foreground/80">Skill: {fn.skill}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
