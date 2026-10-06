import { CheckCircle2, Clock3, MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CollaboratorAvatar } from "@/components/conteudo/content-schedule-visuals";
import { REEL_DELIVERY_STATUS_LABELS, type ReelDeliveryStatus } from "@/lib/reel-deliveries/domain";
import type { ReelDecision, ReelPerson } from "@/lib/reel-deliveries/types";

const STATUS_TONES: Record<ReelDeliveryStatus, string> = {
  awaiting_approval: "border-amber-200 bg-amber-50 text-amber-800",
  changes_requested: "border-red-200 bg-red-50 text-red-800",
  approved: "border-[#48466e]/25 bg-[#48466e]/8 text-[#48466e]",
  ready: "border-[#347796]/25 bg-[#e8f8f8] text-[#285f7a]",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function ReelStatusBadge({ status, className }: { status: ReelDeliveryStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_TONES[status], className)}>
      {REEL_DELIVERY_STATUS_LABELS[status]}
    </Badge>
  );
}

export function formatReelDate(value: string | null, style: "short" | "long" = "short"): string {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", style === "long"
    ? { day: "2-digit", month: "long", year: "numeric" }
    : { day: "2-digit", month: "short" }
  ).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function formatReelDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

type PersonState = "approved" | "changes_requested" | "pending";

export function personDecisionState(personId: string, decisions: ReelDecision[]): PersonState {
  return decisions.find((d) => d.userId === personId)?.decision ?? "pending";
}

const STATE_META: Record<PersonState, { label: string; Icon: typeof Clock3; tone: string }> = {
  approved: { label: "Aprovou", Icon: CheckCircle2, tone: "text-emerald-700" },
  changes_requested: { label: "Pediu ajuste", Icon: MessageSquareWarning, tone: "text-red-700" },
  pending: { label: "Aguardando", Icon: Clock3, tone: "text-amber-700" },
};

/** Avatares empilhados com o estado de cada pessoa na versão atual. */
export function ParticipantStack({ people, decisions }: { people: ReelPerson[]; decisions: ReelDecision[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Quem gravou">
      {people.map((person) => {
        const meta = STATE_META[personDecisionState(person.id, decisions)];
        return (
          <li key={person.id} className="flex min-w-0 items-center gap-1.5 text-xs">
            <CollaboratorAvatar person={person} className="size-6" />
            <span className="max-w-[9rem] truncate font-medium text-slate-700">{person.name.split(" ")[0]}</span>
            <meta.Icon className={cn("size-3.5 shrink-0", meta.tone)} aria-label={meta.label} />
          </li>
        );
      })}
    </ul>
  );
}

export function DecisionLine({ person, decision }: { person: ReelPerson; decision: ReelDecision | undefined }) {
  const meta = STATE_META[decision?.decision ?? "pending"];
  return (
    <div className="flex items-start gap-3 py-2.5">
      <CollaboratorAvatar person={person} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium text-slate-900">{person.name}</span>
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.tone)}>
            <meta.Icon className="size-3.5" aria-hidden />
            {meta.label}
          </span>
        </p>
        {decision?.comment && (
          <p className="mt-1 whitespace-pre-wrap rounded-md bg-white px-2.5 py-1.5 text-sm leading-5 text-slate-700 ring-1 ring-[#dce9eb]">
            {decision.comment}
          </p>
        )}
        {decision && (
          <p className="mt-1 text-xs text-slate-500">
            {formatReelDateTime(decision.createdAt)}
            {decision.onBehalf && decision.recordedByName ? ` · registrado por ${decision.recordedByName}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/** Título da capa ou, enquanto não existe, quem gravou. */
export function reelDisplayTitle(delivery: { coverTitle: string | null; participants: ReelPerson[] }): string {
  if (delivery.coverTitle?.trim()) return delivery.coverTitle;
  const names = delivery.participants.map((p) => p.name.split(" ")[0]);
  return names.length ? `Reel de ${names.join(" e ")}` : "Reel sem título";
}
