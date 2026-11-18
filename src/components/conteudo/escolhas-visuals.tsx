"use client";

import {
  CheckCircle2,
  Link2,
  Newspaper,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CollaboratorAvatar } from "@/components/conteudo/content-schedule-visuals";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import {
  ESCOLHA_STAGE_LABELS,
  stageOfStatus,
  type EscolhaItem,
  type EscolhaPerson,
  type EscolhaStage,
} from "@/lib/content-escolhas";
import { cn } from "@/lib/utils";

export function PersonAvatar({ person, className = "size-8" }: { person: EscolhaPerson; className?: string }) {
  return <CollaboratorAvatar person={{ name: person.name, avatarUrl: person.avatarUrl }} className={className} />;
}

/** Fotos sobrepostas de quem participou (até `max`, depois "+N"). */
export function PeopleStack({ people, max = 5, className }: { people: EscolhaPerson[]; max?: number; className?: string }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)} aria-label={people.map((person) => person.name).join(", ")}>
      {shown.map((person, index) => (
        <span key={`${person.id ?? person.name}-${index}`} className={cn("rounded-full ring-2 ring-white", index > 0 && "-ml-2")} title={person.name}>
          <PersonAvatar person={person} className="size-7" />
        </span>
      ))}
      {rest > 0 ? (
        <span className="-ml-2 flex size-7 items-center justify-center rounded-full bg-[#eaf2f5] text-xs font-semibold text-[#285f7a] ring-2 ring-white">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** Ícone + nome da área jurídica. */
export function AreaTag({ area, className }: { area: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600", className)}>
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded ring-1", getAreaIconStyle(area))}>
        <AreaIcon area={area} className="size-3" aria-hidden />
      </span>
      <span className="truncate">{area}</span>
    </span>
  );
}

const STAGE_STYLES: Record<EscolhaStage, string> = {
  disponivel: "bg-slate-100 text-slate-700",
  escolhida: "bg-sky-50 text-sky-800 ring-1 ring-sky-200/70",
  gestor_aprovou: "bg-[#48466e]/10 text-[#48466e] ring-1 ring-[#48466e]/15",
  enviada: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70",
  descartada: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
};

const STAGE_DOTS: Record<EscolhaStage, string> = {
  disponivel: "bg-slate-400",
  escolhida: "bg-sky-500",
  gestor_aprovou: "bg-[#48466e]",
  enviada: "bg-emerald-500",
  descartada: "bg-red-500",
};

export function stageDotClass(stage: EscolhaStage): string {
  return STAGE_DOTS[stage];
}

/** Etapa atual da matéria (rótulo curto, cores de estado). */
export function StageBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const stage = stageOfStatus(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", STAGE_STYLES[stage], className)}>
      <span className={cn("size-1.5 rounded-full", STAGE_DOTS[stage])} aria-hidden />
      {label ?? ESCOLHA_STAGE_LABELS[stage]}
    </span>
  );
}

function formatWhen(iso: string): { exact: string; relative: string } {
  const date = new Date(iso);
  return {
    exact: format(date, "dd MMM yyyy 'às' HH:mm", { locale: ptBR }),
    relative: formatDistanceToNow(date, { addSuffix: true, locale: ptBR }),
  };
}

type HistoryStep = {
  key: string;
  icon: LucideIcon;
  label: string;
  person?: EscolhaPerson | null;
  personFallback?: string;
  at?: string | null;
  done: boolean;
  tone?: "danger";
};

function historySteps(item: EscolhaItem): HistoryStep[] {
  const steps: HistoryStep[] = [];
  steps.push(
    item.fromLink
      ? { key: "origem", icon: Link2, label: "Trazida por link", person: item.createdBy, at: item.createdAt, done: true }
      : { key: "origem", icon: Newspaper, label: "Chegou pela busca de notícias", at: item.publishedAt ?? item.createdAt, done: true },
  );

  if (item.status === "rejeitado" && !item.chosenBy) {
    steps.push({
      key: "descarte",
      icon: Trash2,
      label: "Descartada",
      person: item.rejectedBy,
      personFallback: "Quem descartou não foi registrado (antes de 17/11/2026)",
      at: item.rejectedAt,
      done: true,
      tone: "danger",
    });
    return steps;
  }

  steps.push({
    key: "escolha",
    icon: UserCheck,
    label: item.chosenBy ? "Escolhida" : "Ainda ninguém escolheu",
    person: item.chosenBy,
    at: item.chosenAt,
    done: Boolean(item.chosenBy),
  });
  if (item.hasAlterations) {
    steps.push({ key: "edicao", icon: Pencil, label: "Texto ajustado", person: item.editedBy, at: item.editedAt, done: true });
  }
  const stage = stageOfStatus(item.status);
  const reviewed = stage === "gestor_aprovou" || stage === "enviada";
  steps.push({
    key: "gestor",
    icon: ShieldCheck,
    label: reviewed ? "Gestor aprovou" : "Aprovação do gestor",
    at: item.reviewerApprovedAt,
    done: reviewed,
  });
  steps.push({
    key: "envio",
    icon: stage === "enviada" ? CheckCircle2 : Send,
    label: stage === "enviada" ? "Enviada ao Marketing" : "Envio ao Marketing",
    person: item.sentBy,
    at: item.sentAt,
    done: stage === "enviada",
  });
  if (item.status === "rejeitado") {
    steps.push({ key: "descarte", icon: Trash2, label: "Descartada", person: item.rejectedBy, at: item.rejectedAt, done: true, tone: "danger" });
  }
  return steps;
}

/** Linha do tempo da matéria: quem trouxe, quem escolheu, quem ajustou e onde está. */
export function RoteiroHistorico({ item, className }: { item: EscolhaItem; className?: string }) {
  const steps = historySteps(item);
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const when = step.at ? formatWhen(step.at) : null;
        const last = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? <span className="absolute left-[15px] top-8 bottom-0 w-px bg-[#dce9eb]" aria-hidden /> : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                step.done
                  ? step.tone === "danger"
                    ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                    : "bg-[#347796] text-white"
                  : "border border-dashed border-slate-300 bg-white text-slate-400",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-sm font-semibold", step.done ? "text-slate-900" : "text-slate-500")}>{step.label}</p>
              {step.person ? (
                <span className="mt-1.5 flex items-center gap-2">
                  <PersonAvatar person={step.person} className="size-6" />
                  <span className="truncate text-sm text-slate-700">{step.person.name}</span>
                </span>
              ) : step.done && step.personFallback ? (
                <p className="mt-1 text-xs text-slate-500">{step.personFallback}</p>
              ) : null}
              {when ? (
                <p className="mt-1 text-xs text-slate-500" title={when.exact}>
                  {when.exact} · {when.relative}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
