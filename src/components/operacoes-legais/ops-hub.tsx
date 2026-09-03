import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OpsPageHeading } from "@/components/operacoes-legais/ops-page-heading";

const FUNCOES: {
  href: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/operacoes-legais/vistagem",
    title: "Vistagem e agendamento",
    blurb: "Captura Kurrier, match, jurídico, prazos e jobs VIOS.",
    icon: CalendarClock,
  },
  {
    href: "/operacoes-legais/fechamento",
    title: "Fechamento Legal Ops",
    blurb: "Rateio de horas da equipe Ops nas áreas jurídicas.",
    icon: Wallet,
  },
  {
    href: "/operacoes-legais/relatorios",
    title: "Relatórios VIOS (CSV)",
    blurb: "Dump completo de processos e prazos, sem o corte de 500 linhas.",
    icon: ClipboardList,
  },
  {
    href: "/operacoes-legais/etiquetas",
    title: "Demanda de risco",
    blurb: "Etiqueta de pasta (id 203) em lote a partir da base Rec. Crédito.",
    icon: ShieldAlert,
  },
];

export function OpsLegaisHub() {
  return (
    <div className="space-y-6">
      <OpsPageHeading
        title="Operações Legais"
        description="Captura, vistagem e agendamento VIOS — no mesmo layout do ORQESTRAI."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {FUNCOES.map((fn) => (
          <Link key={fn.href} href={fn.href} className="group">
            <Card className="h-full rounded-lg border-border/80 shadow-sm transition-colors group-hover:border-[#47cdd0]/50">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="rounded-md border border-[#47cdd0]/30 bg-[#e8f8f8] p-2 text-[#285f7a]">
                  <fn.icon className="h-5 w-5" />
                </span>
                <p className="font-semibold text-foreground">{fn.title}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{fn.blurb}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
