"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  blankQuestion,
  newId,
  questionNumber,
  type QuestionType,
  type SurveyQuestion,
} from "@/lib/pesquisas/types";
import { QUESTION_TYPE_ICONS, Toggle } from "./shared";

const HAS_OPTIONS: QuestionType[] = ["escolha_unica", "multipla", "ranking"];

/** Troca o tipo mantendo o que dá para aproveitar (texto, opções). */
function changeType(question: SurveyQuestion, type: QuestionType): SurveyQuestion {
  const fresh = blankQuestion(type);
  return {
    ...fresh,
    id: question.id,
    title: question.title,
    help: question.help,
    required: type === "secao" ? false : question.required,
    options: HAS_OPTIONS.includes(type) && question.options.length >= 2 ? question.options : fresh.options,
    allow_other: type === "ranking" ? false : question.allow_other,
  };
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-md text-[#315f73] transition-colors outline-none hover:bg-[#47cdd0]/10 focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 disabled:opacity-30",
        danger && "hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}

function OptionsEditor({ question, onChange }: { question: SurveyQuestion; onChange: (question: SurveyQuestion) => void }) {
  const setLabel = (id: string, label: string) =>
    onChange({ ...question, options: question.options.map((option) => (option.id === id ? { ...option, label } : option)) });
  const remove = (id: string) => onChange({ ...question, options: question.options.filter((option) => option.id !== id) });
  const add = () =>
    onChange({ ...question, options: [...question.options, { id: newId(), label: `Opção ${question.options.length + 1}` }] });

  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
          <Input
            value={option.label}
            onChange={(event) => setLabel(option.id, event.target.value)}
            maxLength={200}
            aria-label={`Opção ${index + 1}`}
            className="h-9"
          />
          <IconAction label={`Remover opção ${index + 1}`} onClick={() => remove(option.id)} disabled={question.options.length <= 2}>
            <X className="size-4" aria-hidden />
          </IconAction>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pl-7">
        <Button type="button" variant="ghost" size="sm" onClick={add} disabled={question.options.length >= 20}>
          <Plus className="size-4" aria-hidden />
          Adicionar opção
        </Button>
        {question.type !== "ranking" && (
          <Toggle
            checked={question.allow_other}
            onChange={(allow_other) => onChange({ ...question, allow_other })}
            label='Opção "Outro" com texto'
          />
        )}
      </div>
      {question.type === "multipla" && (
        <label className="flex items-center gap-2 pl-7 text-sm">
          Máximo de escolhas
          <Input
            type="number"
            min={1}
            max={question.options.length}
            value={question.max_choices ?? ""}
            placeholder="Sem limite"
            onChange={(event) => {
              const value = Number(event.target.value);
              onChange({ ...question, max_choices: event.target.value && value >= 1 ? Math.min(20, Math.round(value)) : null });
            }}
            className="h-9 w-28"
          />
        </label>
      )}
    </div>
  );
}

function ScaleEditor({ question, onChange }: { question: SurveyQuestion; onChange: (question: SurveyQuestion) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-2 text-sm">
        De
        <Select value={String(question.scale_min)} onValueChange={(value) => onChange({ ...question, scale_min: Number(value) })}>
          <SelectTrigger className="h-9 w-20" aria-label="Nota mínima">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        até
        <Select value={String(question.scale_max)} onValueChange={(value) => onChange({ ...question, scale_max: Number(value) })}>
          <SelectTrigger className="h-9 w-20" aria-label="Nota máxima">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={question.scale_min_label}
          onChange={(event) => onChange({ ...question, scale_min_label: event.target.value })}
          maxLength={60}
          placeholder={`Rótulo do ${question.scale_min}`}
          aria-label="Rótulo da nota mínima"
          className="h-9"
        />
        <Input
          value={question.scale_max_label}
          onChange={(event) => onChange({ ...question, scale_max_label: event.target.value })}
          maxLength={60}
          placeholder={`Rótulo do ${question.scale_max}`}
          aria-label="Rótulo da nota máxima"
          className="h-9"
        />
      </div>
    </div>
  );
}

function QuestionBlock({
  question,
  questions,
  index,
  answered,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  question: SurveyQuestion;
  questions: SurveyQuestion[];
  index: number;
  answered: boolean;
  onChange: (question: SurveyQuestion) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const section = question.type === "secao";
  const Icon = QUESTION_TYPE_ICONS[question.type];
  return (
    <li
      className={cn(
        "rounded-lg border bg-white shadow-[0_1px_3px_rgba(15,31,46,0.05)]",
        section ? "border-[#3e84a8]/30 bg-[#f7fbfb]" : "border-[#dce9eb]"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6eef0] px-3 py-2 sm:px-4">
        <span
          className={cn(
            "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums",
            section ? "bg-[#3e84a8] text-white" : "bg-[#e8f8f8] text-[#285f7a]"
          )}
        >
          {section ? <Icon className="size-4" aria-hidden /> : `P${questionNumber(questions, index)}`}
        </span>
        <Select value={question.type} onValueChange={(value) => onChange(changeType(question, value as QuestionType))}>
          <SelectTrigger className="h-9 w-full max-w-[13rem] text-sm" aria-label="Tipo da pergunta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((type) => {
              const TypeIcon = QUESTION_TYPE_ICONS[type];
              return (
                <SelectItem key={type} value={type}>
                  <TypeIcon className="size-4 text-[#3e84a8]" aria-hidden />
                  {QUESTION_TYPE_LABELS[type]}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {answered && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
            Já tem respostas
          </span>
        )}
        <div className="ml-auto flex items-center">
          <IconAction label="Subir" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="size-4" aria-hidden />
          </IconAction>
          <IconAction label="Descer" onClick={() => onMove(1)} disabled={index === questions.length - 1}>
            <ArrowDown className="size-4" aria-hidden />
          </IconAction>
          <IconAction label="Duplicar" onClick={onDuplicate}>
            <Copy className="size-4" aria-hidden />
          </IconAction>
          <IconAction label="Excluir" onClick={onRemove} danger>
            <Trash2 className="size-4" aria-hidden />
          </IconAction>
        </div>
      </div>
      <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        <Input
          value={question.title}
          onChange={(event) => onChange({ ...question, title: event.target.value })}
          maxLength={500}
          placeholder={section ? "Título da seção" : "Escreva a pergunta"}
          aria-label={section ? "Título da seção" : "Texto da pergunta"}
          className={cn("h-10 bg-white", section ? "text-base font-semibold" : "font-medium")}
        />
        <Input
          value={question.help}
          onChange={(event) => onChange({ ...question, help: event.target.value })}
          maxLength={1000}
          placeholder="Texto de apoio (opcional)"
          aria-label="Texto de apoio"
          className="h-9 bg-white text-sm"
        />
        {HAS_OPTIONS.includes(question.type) && <OptionsEditor question={question} onChange={onChange} />}
        {question.type === "escala" && <ScaleEditor question={question} onChange={onChange} />}
        {!section && (
          <Toggle checked={question.required} onChange={(required) => onChange({ ...question, required })} label="Obrigatória" />
        )}
      </div>
    </li>
  );
}

export function QuestionEditor({
  questions,
  answeredIds,
  onChange,
}: {
  questions: SurveyQuestion[];
  answeredIds: Set<string>;
  onChange: (questions: SurveyQuestion[]) => void;
}) {
  const update = (index: number, question: SurveyQuestion) =>
    onChange(questions.map((item, position) => (position === index ? question : item)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const duplicate = (index: number) => {
    const source = questions[index];
    const copy = { ...source, id: newId(), options: source.options.map((option) => ({ ...option, id: newId() })) };
    onChange([...questions.slice(0, index + 1), copy, ...questions.slice(index + 1)]);
  };

  const remove = (index: number) => {
    const question = questions[index];
    if (
      answeredIds.has(question.id) &&
      !window.confirm("Esta pergunta já tem respostas. Excluir tira ela dos resultados. Continuar?")
    ) {
      return;
    }
    onChange(questions.filter((_, position) => position !== index));
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhuma pergunta ainda. Escolha um tipo abaixo para começar.
        </p>
      ) : (
        <ol className="space-y-3">
          {questions.map((question, index) => (
            <QuestionBlock
              key={question.id}
              question={question}
              questions={questions}
              index={index}
              answered={answeredIds.has(question.id)}
              onChange={(next) => update(index, next)}
              onMove={(delta) => move(index, delta)}
              onDuplicate={() => duplicate(index)}
              onRemove={() => remove(index)}
            />
          ))}
        </ol>
      )}

      <div className="rounded-lg border border-dashed border-[#3e84a8]/30 bg-white p-3">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Adicionar</p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map((type) => {
            const Icon = QUESTION_TYPE_ICONS[type];
            return (
              <Button key={type} type="button" variant="secondary" size="sm" onClick={() => onChange([...questions, blankQuestion(type)])}>
                <Icon className="size-4" aria-hidden />
                {QUESTION_TYPE_LABELS[type]}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
