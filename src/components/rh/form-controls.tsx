"use client";

import { useMemo, useState, type ReactNode } from "react";
import { addDays, format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { searchKey } from "@/lib/rh/registration/combo-search";
import { cn } from "@/lib/utils";
import { Hint } from "./hint";
import { AreaTile, PersonPhoto } from "./pdi/pdi-visuals";

/*
 * Controles de formulário das telas de Pessoas e Cultura (PDI, 1:1).
 * Nada de controle com cara de navegador: lista curta vira chips, pessoa vira
 * seletor com foto, data vira calendário do sistema, liga/desliga vira switch.
 */

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60";

/* ------------------------------------------------------------------ chips */

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Elemento antes do rótulo (foto, selo) no lugar do ícone. */
  leading?: ReactNode;
  hint?: string;
  count?: number;
}

/** Escolha única em chips (substitui o dropdown de lista curta). */
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Hint key={option.value} label={option.hint}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border text-left transition-colors",
                FOCUS,
                size === "sm"
                  ? "min-h-8 px-3 text-xs"
                  : "min-h-9 px-3.5 text-sm",
                selected
                  ? "border-[#47cdd0] bg-[#e8f8f8] font-semibold text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]"
                  : "border-[#dce9eb] bg-white text-[#3b5560] hover:border-[#47cdd0]/70 hover:bg-[#f4fafb]",
              )}
            >
              {option.leading ??
                (Icon ? (
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      selected ? "text-[#1f7f82]" : "text-[#7b929c]",
                    )}
                    aria-hidden
                  />
                ) : null)}
              <span className="min-w-0 truncate">{option.label}</span>
              {typeof option.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums",
                    selected
                      ? "bg-white text-[#1d5670]"
                      : "bg-[#eef5f7] text-[#3b5560]",
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          </Hint>
        );
      })}
    </div>
  );
}

/** Opções grandes com ícone e explicação (ex.: quem lê as anotações). */
export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: Array<{
    value: T;
    title: string;
    description: string;
    icon: LucideIcon;
  }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-2", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              FOCUS,
              selected
                ? "border-[#347796] bg-[#f1f8fa]"
                : "border-[#e6eff1] bg-white hover:border-[#47cdd0]/60 hover:bg-[#fafdfd]",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                selected
                  ? "bg-[#d7f2f2] text-[#1f7f82]"
                  : "bg-[#eef5f7] text-[#3e84a8]",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#0d2a38]">
                {option.title}
              </span>
              <span className="block text-xs leading-5 text-[#5a717b]">
                {option.description}
              </span>
            </span>
            <span
              className={cn(
                "mt-1 grid size-5 shrink-0 place-items-center rounded-full border",
                selected
                  ? "border-[#347796] bg-[#347796] text-white"
                  : "border-[#c9d8dc] bg-white",
              )}
              aria-hidden
            >
              {selected && <Check className="size-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- switch */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        FOCUS,
        checked ? "bg-[#347796]" : "bg-[#cfdadd]",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Linha clicável com título, explicação e switch. */
export function SwitchRow({
  checked,
  onChange,
  label,
  hint,
  icon: Icon,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <Icon className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[#0d2a38]">
            {label}
          </span>
          {hint && <span className="block text-xs text-[#5a717b]">{hint}</span>}
        </span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/* ---------------------------------------------------------------- stepper */

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div
      className="inline-flex h-10 items-center rounded-lg border border-[#dce9eb] bg-white"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Diminuir ${label.toLowerCase()}`}
        className={cn(
          "grid h-full w-9 place-items-center rounded-l-lg text-[#285f7a] hover:bg-[#f4fafb] disabled:text-[#c3d0d4]",
          FOCUS,
        )}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span
        className="min-w-16 border-x border-[#eef3f5] px-2 text-center text-sm font-semibold tabular-nums text-[#0d2a38]"
        aria-live="polite"
      >
        {value}
        {suffix ? (
          <span className="ml-1 font-normal text-[#5a717b]">{suffix}</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Aumentar ${label.toLowerCase()}`}
        className={cn(
          "grid h-full w-9 place-items-center rounded-r-lg text-[#285f7a] hover:bg-[#f4fafb] disabled:text-[#c3d0d4]",
          FOCUS,
        )}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- pessoa */

/** Seletor de pessoa com foto, área e busca (substitui o dropdown de nomes). */
export function PersonPicker({
  value,
  people,
  onChange,
  placeholder = "Escolher pessoa",
  emptyLabel,
  label,
  invalid,
  disabled,
  className,
}: {
  value: string | null;
  people: PdiPerson[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Opção para deixar sem ninguém (ex.: "Sem gestor direto"). */
  emptyLabel?: string;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value
    ? (people.find((person) => person.id === value) ?? null)
    : null;
  const term = searchKey(query);
  const visible = useMemo(
    () =>
      term
        ? people.filter((person) =>
            searchKey(
              `${person.full_name} ${person.name} ${person.department ?? ""} ${person.position ?? ""}`,
            ).includes(term),
          )
        : people,
    [people, term],
  );

  function pick(next: string | null) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            "flex h-11 w-full items-center gap-2.5 rounded-lg border bg-white px-2.5 text-left transition-colors hover:border-[#47cdd0]/70 disabled:opacity-60",
            FOCUS,
            invalid ? "border-amber-300 bg-amber-50/50" : "border-[#dce9eb]",
            className,
          )}
        >
          {selected ? (
            <>
              <PersonPhoto person={selected} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[#0d2a38]">
                  {selected.name}
                </span>
                <span className="block truncate text-xs text-[#5a717b]">
                  {selected.position ?? selected.department ?? ""}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="grid size-8 place-items-center rounded-full border border-dashed border-[#b9cbd0] text-[#7b929c]">
                <UserRound className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-[#5a717b]">
                {emptyLabel && value === null ? emptyLabel : placeholder}
              </span>
            </>
          )}
          <ChevronDown className="size-4 shrink-0 text-[#7b929c]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 p-1.5"
      >
        <div className="relative mb-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou área"
            aria-label="Buscar pessoa"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <ul
          className="max-h-72 overflow-y-auto overscroll-contain [scrollbar-color:#c9d6da_transparent] [scrollbar-width:thin]"
          role="listbox"
          aria-label={label}
        >
          {emptyLabel && !term && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-[#5a717b] hover:bg-[#f4fafb]",
                  FOCUS,
                )}
              >
                <span className="grid size-8 place-items-center rounded-full border border-dashed border-[#b9cbd0]">
                  <UserRound className="size-4" aria-hidden />
                </span>
                <span className="flex-1">{emptyLabel}</span>
                {value === null && (
                  <Check className="size-4 text-[#347796]" aria-hidden />
                )}
              </button>
            </li>
          )}
          {visible.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                role="option"
                aria-selected={person.id === value}
                onClick={() => pick(person.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[#f4fafb]",
                  FOCUS,
                  person.id === value && "bg-[#eef7f8]",
                )}
              >
                <PersonPhoto person={person} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#0d2a38]">
                    {person.name}
                  </span>
                  <span className="flex min-w-0 items-center gap-1 text-xs text-[#5a717b]">
                    {person.department && (
                      <AreaTile
                        area={person.department}
                        className="size-4 rounded [&_svg]:size-3"
                      />
                    )}
                    <span className="truncate">
                      {person.position ?? person.department ?? ""}
                    </span>
                  </span>
                </span>
                {person.id === value && (
                  <Check
                    className="size-4 shrink-0 text-[#347796]"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-[#5a717b]">
              Ninguém com esse nome.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------- data */

function toDate(iso: string | null | undefined): Date | undefined {
  if (!iso || iso.length !== 10) return undefined;
  const date = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(date) ? date : undefined;
}

const toIso = (date: Date) => format(date, "yyyy-MM-dd");

function CalendarPopoverBody({
  value,
  min,
  max,
  onPick,
  presets,
}: {
  value: string;
  min?: string;
  max?: string;
  onPick: (iso: string) => void;
  presets?: Array<{ label: string; value: string }>;
}) {
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];
  return (
    <div>
      <Calendar
        mode="single"
        locale={ptBR}
        selected={selected}
        defaultMonth={selected ?? minDate}
        onSelect={(date) => date && onPick(toIso(date))}
        disabled={disabled}
        className="p-3"
      />
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[#eef3f5] px-3 py-2.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onPick(preset.value)}
              className={cn(
                "rounded-full border border-[#dce9eb] px-2.5 py-1 text-xs text-[#285f7a] hover:border-[#47cdd0]/70 hover:bg-[#f4fafb]",
                FOCUS,
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Campo de data: botão com a data por extenso que abre o calendário do sistema. */
export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Escolher data",
  label,
  presets,
  clearable,
  size = "md",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  label: string;
  presets?: Array<{ label: string; value: string }>;
  clearable?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-[#dce9eb] bg-white px-3 text-left text-sm transition-colors hover:border-[#47cdd0]/70",
            FOCUS,
            size === "sm" ? "h-9" : "h-10",
            className,
          )}
        >
          <CalendarDays
            className="size-4 shrink-0 text-[#3e84a8]"
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              date ? "text-[#0d2a38]" : "text-[#7b929c]",
            )}
          >
            {date
              ? format(
                  date,
                  size === "sm" ? "dd/MM/yyyy" : "EEE, d 'de' MMM 'de' yyyy",
                  { locale: ptBR },
                )
              : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#7b929c]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <CalendarPopoverBody
          value={value}
          min={min}
          max={max}
          presets={[
            ...(presets ?? []),
            ...(clearable && value ? [{ label: "Sem data", value: "" }] : []),
          ]}
          onPick={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Próximos dias úteis em cartões + "Outra data" no calendário (para marcar reunião). */
export function DayStrip({
  value,
  onChange,
  from,
  days = 10,
}: {
  value: string;
  onChange: (value: string) => void;
  from: string;
  days?: number;
}) {
  const [open, setOpen] = useState(false);
  const start = toDate(from) ?? new Date();
  const list: Date[] = [];
  for (let cursor = start; list.length < days; cursor = addDays(cursor, 1)) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) list.push(cursor);
  }
  const isos = list.map(toIso);
  const outside = value && !isos.includes(value) ? toDate(value) : undefined;

  const card = (date: Date, key: string) => {
    const iso = toIso(date);
    const selected = iso === value;
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onChange(iso)}
        className={cn(
          "flex min-w-0 flex-col items-center rounded-lg border py-1.5 transition-colors",
          FOCUS,
          selected
            ? "border-[#47cdd0] bg-[#e8f8f8] text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]"
            : "border-[#dce9eb] bg-white text-[#0d2a38] hover:border-[#47cdd0]/70 hover:bg-[#f4fafb]",
        )}
      >
        <span
          className={cn(
            "text-xs capitalize",
            selected ? "font-semibold text-[#1f7f82]" : "text-[#5a717b]",
          )}
        >
          {format(date, "EEE", { locale: ptBR }).replace(".", "")}
        </span>
        <span className="text-lg font-semibold leading-6 tabular-nums">
          {format(date, "d")}
        </span>
        <span
          className={cn(
            "text-xs",
            selected ? "text-[#1f7f82]" : "text-[#5a717b]",
          )}
        >
          {format(date, "MMM", { locale: ptBR }).replace(".", "")}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-1.5">
      <div
        className="grid grid-cols-5 gap-1.5"
        role="radiogroup"
        aria-label="Dia"
      >
        {list.map((date) => card(date, toIso(date)))}
      </div>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition-colors",
              FOCUS,
              outside
                ? "border-[#47cdd0] bg-[#e8f8f8] font-semibold text-[#1d5670]"
                : "border-[#b9cbd0] bg-white text-[#285f7a] hover:border-[#47cdd0] hover:bg-[#f4fafb]",
            )}
          >
            <CalendarDays className="size-4" aria-hidden />
            {outside
              ? format(outside, "EEEE, d 'de' MMMM", { locale: ptBR })
              : "Outra data no calendário"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <CalendarPopoverBody
            value={value}
            min={from}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* --------------------------------------------------------------- excluir */

/**
 * Lixeira que pergunta antes de apagar, na própria linha ("Excluir? Sim · Não").
 * `idleClassName` controla a lixeira parada (ex.: só aparecer no hover da linha).
 */
export function InlineDelete({
  label,
  question = "Excluir?",
  onConfirm,
  idleClassName,
}: {
  label: string;
  question?: string;
  onConfirm: () => Promise<unknown> | void;
  idleClassName?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setAsking(true)}
        className={cn("rounded p-1 text-[#9fb1b8] transition-colors hover:text-red-700", FOCUS, idleClassName)}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-red-50 py-0.5 pl-2 pr-0.5 text-xs" role="group" aria-label={label}>
      <span className="font-medium text-red-700">{question}</span>
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
        className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-red-700 hover:bg-red-100", FOCUS)}
      >
        {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
        Sim
      </button>
      <button type="button" disabled={busy} onClick={() => setAsking(false)} className={cn("rounded-md px-2 py-0.5 text-[#3b5560] hover:bg-white", FOCUS)}>
        Não
      </button>
    </span>
  );
}
