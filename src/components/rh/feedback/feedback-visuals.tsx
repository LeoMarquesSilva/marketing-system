"use client";

import { ClipboardList, Eye, Globe2, HandHeart, Lock, MessageCircle, MessagesSquare, Sprout, UsersRound, Users, type LucideIcon } from "lucide-react";
import { CIVIL_LABELS, civilSealSrc } from "@/lib/rh/pdi/civil";
import type { FeedbackKind, FeedbackSummary, FeedbackValue, FeedbackVisibility } from "@/lib/rh/feedback/types";
import { cn } from "@/lib/utils";
import { Hint } from "../hint";
import { PersonPhoto, relativeDays } from "../pdi/pdi-visuals";

export const CARD = "rounded-2xl border border-[#e1ebee] bg-white shadow-[0_1px_3px_rgba(4,32,47,0.05)]";
export const INK = "text-[#0d2a38]";
export const MUTED = "text-[#5a717b]";
export const BODY = "text-[#3b5560]";

export const KIND_STYLE: Record<FeedbackKind, { label: string; icon: LucideIcon; className: string; tile: string }> = {
  reconhecimento: { label: "Reconhecimento", icon: HandHeart, className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", tile: "bg-emerald-50 text-emerald-700" },
  desenvolvimento: { label: "Desenvolvimento", icon: Sprout, className: "bg-[#e9eef8] text-[#34507e] ring-[#34507e]/15", tile: "bg-[#e9eef8] text-[#34507e]" },
  sem_tipo: { label: "Feedback", icon: MessagesSquare, className: "bg-[#eef3f5] text-[#3b5560] ring-[#cfdadd]", tile: "bg-[#eef3f5] text-[#3b5560]" },
  boa_pratica: { label: "Boas práticas", icon: ClipboardList, className: "bg-amber-50 text-amber-800 ring-amber-600/20", tile: "bg-amber-50 text-amber-700" },
};

export const VISIBILITY_STYLE: Record<FeedbackVisibility, { label: string; short: string; icon: LucideIcon; description: string }> = {
  privado: { label: "Só a pessoa", short: "Privado", icon: Lock, description: "Você e quem recebe." },
  gestor: { label: "Pessoa e gestor", short: "Com o gestor", icon: Users, description: "Quem recebe e quem lidera a pessoa." },
  publico: { label: "Mural", short: "Mural", icon: Globe2, description: "Todo mundo, no mural de reconhecimentos." },
};

export function KindBadge({ kind, className }: { kind: FeedbackKind; className?: string }) {
  const style = KIND_STYLE[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style.className, className)}>
      <style.icon className="size-3.5" aria-hidden />
      {style.label}
    </span>
  );
}

export function VisibilityTag({ visibility }: { visibility: FeedbackVisibility }) {
  const style = VISIBILITY_STYLE[visibility];
  return (
    <Hint label={style.description}>
      <span className={cn("inline-flex items-center gap-1 text-xs", MUTED)}>
        <style.icon className="size-3.5" aria-hidden />
        {style.short}
      </span>
    </Hint>
  );
}

/** Selo do valor CIVIL (o mesmo do BP Awards) numa base azul-marinho, para não sumir no fundo claro. */
export function ValueSeal({ value, size = "sm" }: { value: FeedbackValue; size?: "sm" | "md" }) {
  const src = civilSealSrc(value);
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-md bg-[#0f1f2e] p-0.5", size === "sm" ? "size-5" : "size-8")} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" className="size-full object-contain" />}
    </span>
  );
}

export function ValueChip({ value, rating }: { value: FeedbackValue; rating?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e1ebee] bg-white py-0.5 pl-0.5 pr-2.5 text-xs text-[#3b5560]">
      <ValueSeal value={value} />
      {CIVIL_LABELS[value]}
      {rating ? <span className="font-semibold tabular-nums text-[#9a6a2c]">{rating}/5</span> : null}
    </span>
  );
}

/** Notas por valor que vieram do Feedz (o rótulo lá era "C – Cliente no centro"). */
export function feedzRatings(ratings: Record<string, number> | null): Array<{ label: string; rating: number }> {
  if (!ratings) return [];
  return Object.entries(ratings).map(([label, rating]) => ({ label: label.replace(/^[A-Z]\s*[–-]\s*/, ""), rating: Number(rating) }));
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)).replace(".", "");
}

/** Cartão de feedback nas listas (recebidos, enviados, equipe, mural, gestão). */
export function FeedbackCard({
  item,
  perspective,
  onOpen,
}: {
  item: FeedbackSummary;
  /** De quem mostrar a foto em destaque: quem enviou (recebidos, mural) ou quem recebeu (enviados). */
  perspective: "from" | "to" | "both";
  onOpen: () => void;
}) {
  const main = perspective === "to" ? item.to : item.from;
  const unread = item.viewer === "destinatario" && !item.read_at;
  const ratings = feedzRatings(item.value_ratings);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        CARD,
        "group flex w-full gap-4 p-4 text-left outline-none transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(4,32,47,0.18)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
        unread && "border-[#9fd9da] shadow-[0_0_0_1px_#d3eff0]"
      )}
    >
      <span className="relative shrink-0">
        {perspective === "both" ? (
          <span className="flex">
            <PersonPhoto person={item.from} size="md" className="size-11 ring-2 ring-white" />
            <PersonPhoto person={item.to} size="md" className="-ml-3 size-11 ring-2 ring-white" />
          </span>
        ) : (
          <PersonPhoto person={main} size="md" className="size-11" />
        )}
        {unread && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#1f9ea1] ring-2 ring-white" aria-label="Não lido" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-[15px] font-semibold", INK)}>
            {perspective === "both" ? (
              <>
                {item.from.name.split(" ")[0]} <span className="font-normal text-[#7b929c]">para</span> {item.to.name}
              </>
            ) : perspective === "to" ? (
              <>
                <span className="font-normal text-[#7b929c]">Para</span> {item.to.name}
              </>
            ) : (
              item.from.name
            )}
          </span>
          {item.kind !== "sem_tipo" && <KindBadge kind={item.kind} />}
        </span>
        <span className={cn("mt-1 line-clamp-3 whitespace-pre-line text-sm leading-6 sm:line-clamp-2", BODY)}>{item.message || "Conteúdo privado."}</span>
        {(item.civil_values.length > 0 || ratings.length > 0) && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {item.civil_values.map((value) => (
              <ValueChip key={value} value={value} />
            ))}
            {item.civil_values.length === 0 &&
              ratings.slice(0, 3).map((entry) => (
                <span key={entry.label} className="rounded-full border border-[#e1ebee] px-2 py-0.5 text-xs text-[#3b5560]">
                  {entry.label} <span className="font-semibold tabular-nums text-[#9a6a2c]">{entry.rating}/5</span>
                </span>
              ))}
          </span>
        )}
        <span className={cn("mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", MUTED)}>
          <span className="tabular-nums">{formatWhen(item.created_at)}</span>
          <VisibilityTag visibility={item.visibility} />
          {item.in_person && (
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-3.5" aria-hidden />
              Conversado pessoalmente
            </span>
          )}
          {item.replies_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden />
              {item.replies_count} {item.replies_count === 1 ? "resposta" : "respostas"}
            </span>
          )}
          {item.viewer !== "destinatario" && item.kind !== "sem_tipo" && (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              {item.read_at ? `lido ${relativeDays(item.read_at)}` : "ainda não lido"}
            </span>
          )}
          {item.from_feedz && <span className="rounded bg-[#f1f5f6] px-1.5">do Feedz</span>}
        </span>
      </span>
    </button>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className={cn(CARD, "flex flex-col items-center px-6 py-12 text-center")}>
      <span className="grid size-12 place-items-center rounded-2xl bg-[#eaf4f6] text-[#1d7086]">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className={cn("mt-3 font-semibold", INK)}>{title}</p>
      <p className={cn("mt-1 max-w-md text-sm", MUTED)}>{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex h-9 items-center rounded-xl border border-[#d5e3e7] bg-white px-4 text-sm font-semibold text-[#1d5670] outline-none transition-colors hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
