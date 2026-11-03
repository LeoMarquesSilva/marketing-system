"use client";

import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  OTHER_OPTION_ID,
  SHORT_TEXT_MAX,
  TEXT_MAX,
  type AnswerValue,
  type SurveyQuestion,
} from "@/lib/pesquisas/types";

type InputProps = {
  question: SurveyQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  invalid?: boolean;
  /** "brand": página de resposta com a identidade do escritório (papel, dourado e marinho). */
  tone?: "system" | "brand";
};

const TONES = {
  system: {
    selected: "border-[#347796] bg-[#347796]/6 text-foreground",
    idle: "border-[#dce9eb] bg-white hover:border-[#47cdd0]/60",
    mark: "border-[#347796] bg-[#347796] text-white",
    field: "bg-white",
  },
  brand: {
    selected: "border-[#0d1e2e] bg-[#0d1e2e]/[0.04] text-[#0d1e2e]",
    idle: "border-[#e4d6b8] bg-white/80 hover:border-[#b8893f]/60",
    mark: "border-[#0d1e2e] bg-[#0d1e2e] text-white",
    field:
      "rounded-xl border-[#e4d6b8] bg-white/85 text-[15px] text-[#1f2328] shadow-none placeholder:text-[#a39a8a] hover:border-[#d4b06a] focus-visible:border-[#b8893f] focus-visible:ring-[#d4b06a]/25 md:text-[15px]",
  },
} as const;

const OPTION_BASE =
  "flex min-h-11 w-full items-center gap-3 rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 disabled:cursor-not-allowed disabled:opacity-50";

function ChoiceInput({ question, value, onChange, invalid, tone = "system" }: InputProps) {
  const style = TONES[tone];
  const multiple = question.type === "multipla";
  const choices = value?.choices ?? [];
  const limit = multiple ? question.max_choices : 1;
  const reached = limit !== null && choices.length >= limit;
  const options = question.allow_other ? [...question.options, { id: OTHER_OPTION_ID, label: "Outro" }] : question.options;

  const toggle = (id: string) => {
    if (!multiple) {
      onChange({ ...value, choices: choices[0] === id ? [] : [id] });
      return;
    }
    if (choices.includes(id)) onChange({ ...value, choices: choices.filter((item) => item !== id) });
    else if (!reached) onChange({ ...value, choices: [...choices, id] });
  };

  return (
    <div className="space-y-2" role={multiple ? "group" : "radiogroup"} aria-invalid={invalid || undefined}>
      {options.map((option) => {
        const selected = choices.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            disabled={multiple && !selected && reached}
            onClick={() => toggle(option.id)}
            className={cn(
              OPTION_BASE,
              selected ? style.selected : style.idle
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center border transition-colors",
                multiple ? "rounded" : "rounded-full",
                selected ? style.mark : "border-slate-300 bg-white"
              )}
              aria-hidden
            >
              {selected && (multiple ? <Check className="size-3.5" /> : <span className="size-2 rounded-full bg-white" />)}
            </span>
            <span className="flex-1">{option.label}</span>
          </button>
        );
      })}
      {choices.includes(OTHER_OPTION_ID) && (
        <Input
          autoFocus
          value={value?.other ?? ""}
          onChange={(event) => onChange({ ...value, other: event.target.value })}
          maxLength={SHORT_TEXT_MAX}
          placeholder="Qual?"
          aria-label="Outro: qual?"
          className={style.field}
        />
      )}
      {multiple && limit !== null && (
        <p className="text-xs text-muted-foreground">
          {choices.length} de {limit} escolhidas
        </p>
      )}
    </div>
  );
}

function ScaleInput({ question, value, onChange, invalid, tone = "system" }: InputProps) {
  const style = TONES[tone];
  const values: number[] = [];
  for (let item = question.scale_min; item <= question.scale_max; item += 1) values.push(item);
  return (
    <div className="space-y-2" role="radiogroup" aria-invalid={invalid || undefined}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((item) => {
          const selected = value?.number === item;
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Nota ${item}`}
              onClick={() => onChange({ number: item })}
              className={cn(
                "h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                selected ? style.mark : style.idle
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
      {(question.scale_min_label || question.scale_max_label) && (
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <span>{question.scale_min_label}</span>
          <span className="text-right">{question.scale_max_label}</span>
        </div>
      )}
    </div>
  );
}

/** Toque na ordem de prioridade; os escolhidos sobem numerados e podem mudar de posição. */
function RankingInput({ question, value, onChange, invalid, tone = "system" }: InputProps) {
  const style = TONES[tone];
  const ranking = (value?.ranking ?? []).filter((id) => question.options.some((option) => option.id === id));
  const label = (id: string) => question.options.find((option) => option.id === id)?.label ?? "";
  const rest = question.options.filter((option) => !ranking.includes(option.id));

  const move = (index: number, delta: number) => {
    const next = [...ranking];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ranking: next });
  };

  return (
    <div className="space-y-3" aria-invalid={invalid || undefined}>
      {ranking.length > 0 && (
        <ol className="space-y-1.5">
          {ranking.map((id, index) => (
            <li key={id} className={cn("flex items-center gap-2 rounded-md border py-1.5 pl-2 pr-1.5", style.selected)}>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums", style.mark)}>
                {index + 1}
              </span>
              <span className="flex-1 text-sm">{label(id)}</span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${label(id)}`}
                className="flex size-8 items-center justify-center rounded text-[#285f7a] hover:bg-white disabled:opacity-30"
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === ranking.length - 1}
                aria-label={`Descer ${label(id)}`}
                className="flex size-8 items-center justify-center rounded text-[#285f7a] hover:bg-white disabled:opacity-30"
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange({ ranking: ranking.filter((item) => item !== id) })}
                aria-label={`Tirar ${label(id)} da ordem`}
                className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-white hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {ranking.length === 0 ? "Toque na mais importante primeiro, depois na seguinte…" : "Toque para incluir na ordem:"}
          </p>
          {rest.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ ranking: [...ranking, option.id] })}
              className={cn(OPTION_BASE, "border-dashed", style.idle)}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-muted-foreground">
                {ranking.length + 1}
              </span>
              <span className="flex-1">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionInput(props: InputProps) {
  const { question, value, onChange, invalid, tone = "system" } = props;
  const style = TONES[tone];
  switch (question.type) {
    case "secao":
      return null;
    case "texto_longo": {
      const text = value?.text ?? "";
      return (
        <div className="space-y-1">
          <Textarea
            value={text}
            onChange={(event) => onChange({ text: event.target.value })}
            maxLength={TEXT_MAX}
            rows={4}
            aria-invalid={invalid || undefined}
            aria-label={question.title}
            className={cn("min-h-28 text-[0.95rem] leading-6", style.field, tone === "brand" && "min-h-40 px-4 py-3")}
            placeholder="Escreva com suas palavras"
          />
          {text.length > TEXT_MAX * 0.8 && (
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {text.length}/{TEXT_MAX}
            </p>
          )}
        </div>
      );
    }
    case "texto_curto":
      return (
        <Input
          value={value?.text ?? ""}
          onChange={(event) => onChange({ text: event.target.value })}
          maxLength={SHORT_TEXT_MAX}
          aria-invalid={invalid || undefined}
          aria-label={question.title}
          className={style.field}
        />
      );
    case "escolha_unica":
    case "multipla":
      return <ChoiceInput {...props} />;
    case "escala":
      return <ScaleInput {...props} />;
    case "ranking":
      return <RankingInput {...props} />;
  }
}
