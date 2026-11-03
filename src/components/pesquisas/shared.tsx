"use client";

import {
  AlignLeft,
  CircleDot,
  Gauge,
  Heading2,
  ListChecks,
  ListOrdered,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";
import type { QuestionType, SurveyPerson, SurveyStatus } from "@/lib/pesquisas/types";
import { SURVEY_STATUS_LABELS } from "@/lib/pesquisas/types";

/** Chamada às rotas das pesquisas: devolve o JSON ou lança a mensagem de erro da API. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "Não foi possível concluir. Tente de novo.");
  return data as T;
}

const SUPABASE_PUBLIC_OBJECT = /^(https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1)\/object\/public\/(.+)$/i;

/** As fotos institucionais do bucket têm ~4000 px; o Supabase devolve a versão reduzida. */
function facePhotoUrl(url: string | null, pixels: number): string | null {
  if (!url) return null;
  const match = url.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return url;
  const [path, query = ""] = match[2].split("?");
  const params = new URLSearchParams(query);
  params.set("width", String(pixels));
  params.set("height", String(pixels));
  params.set("resize", "cover");
  params.set("quality", "75");
  return `${match[1]}/render/image/public/${path}?${params.toString()}`;
}

const FACE_SIZES = {
  sm: { className: "size-8 text-xs", pixels: 96 },
  md: { className: "size-11 text-sm", pixels: 128 },
} as const;

export const QUESTION_TYPE_ICONS: Record<QuestionType, LucideIcon> = {
  secao: Heading2,
  texto_longo: AlignLeft,
  texto_curto: TextCursorInput,
  escolha_unica: CircleDot,
  multipla: ListChecks,
  escala: Gauge,
  ranking: ListOrdered,
};

const STATUS_STYLE: Record<SurveyStatus, string> = {
  rascunho: "bg-slate-50 text-slate-700 ring-slate-200",
  aberta: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  encerrada: "bg-[#48466e]/8 text-[#48466e] ring-[#48466e]/20",
};

export function SurveyStatusBadge({ status, className }: { status: SurveyStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
        className
      )}
    >
      {status === "aberta" && <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />}
      {SURVEY_STATUS_LABELS[status]}
    </span>
  );
}

/** Interruptor acessível (o sistema não tem um componente de switch). */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
          checked ? "bg-[#347796]" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs leading-5 text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

/** Foto do colaborador com iniciais quando não há foto. */
export function PersonFace({
  person,
  size = "sm",
}: {
  person: Pick<SurveyPerson, "short_name" | "avatar_url">;
  size?: keyof typeof FACE_SIZES;
}) {
  const src = facePhotoUrl(person.avatar_url, FACE_SIZES[size].pixels);
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-black/5", FACE_SIZES[size].className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-[#e8f1f5] font-semibold text-[#315f73]">{getInitials(person.short_name)}</AvatarFallback>
    </Avatar>
  );
}

/** Pilha de fotos com "+N" (quem respondeu na lista e nos cards). */
export function FaceStack({ people, max = 6 }: { people: SurveyPerson[]; max?: number }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  return (
    <div className="flex items-center">
      {shown.map((person) => (
        <span key={person.user_id} className="-ml-2 rounded-full ring-2 ring-white first:ml-0" title={person.short_name}>
          <PersonFace person={person} />
        </span>
      ))}
      {people.length > max && (
        <span className="-ml-2 flex size-8 items-center justify-center rounded-full bg-[#e8f8f8] text-xs font-semibold text-[#285f7a] ring-2 ring-white">
          +{people.length - max}
        </span>
      )}
    </div>
  );
}

/** Texto com *negrito* no estilo do WhatsApp (a abertura costuma vir colada de lá). */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, index) =>
        /^\*[^*\n]+\*$/.test(part) ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(1, -1)}
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Barra de progresso fina (respostas x público). */
export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const share = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[#e6eef0]", className)} aria-hidden>
      <div className="h-full rounded-full bg-[#3e84a8] transition-[width]" style={{ width: `${share * 100}%` }} />
    </div>
  );
}
