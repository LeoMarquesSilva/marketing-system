"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, PencilLine, Plus, Search, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { getAreaIconStyle } from "@/lib/area-icons";
import { filterOptions, searchKey } from "@/lib/rh/registration/combo-search";
import { businessDaysToResponse, suggestAreaFromDepartment, todayIso } from "@/lib/rh/boas-praticas/metrics";
import {
  FEEDBACK_AREAS,
  FEEDBACK_CATEGORIES,
  type FeedbackInput,
  type FeedbackPerson,
  type GoodPracticeFeedback,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { AreaGlyph, CategoryGlyph, PersonAvatar } from "./feedback-visuals";

const LEADER_POSITION = /s[oó]cio|gerente|coordenador|supervisor|diretor/i;

export function emptyFeedbackInput(): FeedbackInput {
  const today = todayIso();
  return {
    occurred_on: today,
    sent_on: today,
    employee_name: "",
    is_team: false,
    manager_name: "",
    area: "",
    category: "",
    description: "",
    manager_action: "",
    responded_on: "",
    viewed: null,
    viewed_on: "",
  };
}

export function feedbackToInput(item: GoodPracticeFeedback): FeedbackInput {
  return {
    occurred_on: item.occurred_on,
    sent_on: item.sent_on,
    employee_name: item.employee_name,
    is_team: item.is_team,
    manager_name: item.manager_name,
    area: item.area,
    category: item.category,
    description: item.description,
    manager_action: item.manager_action ?? "",
    responded_on: item.responded_on ?? "",
    viewed: item.viewed,
    viewed_on: item.viewed_on ?? "",
  };
}

/** Nome gravado: equipe vira "Equipe <área>". */
export function resolvedEmployeeName(form: FeedbackInput): string {
  return form.is_team ? (form.area ? `Equipe ${form.area}` : "") : form.employee_name.trim();
}

export function missingFields(form: FeedbackInput): string[] {
  return [
    !resolvedEmployeeName(form) && (form.is_team ? "a área da equipe" : "quem recebeu"),
    !form.area.trim() && !form.is_team && "a área",
    !form.manager_name.trim() && "o gestor",
    !form.category.trim() && "a categoria",
    !form.description.trim() && "a ocorrência",
    !form.occurred_on && "a data da ocorrência",
    !form.sent_on && "a data de envio",
  ].filter(Boolean) as string[];
}

/* --------------------------------------------------------- blocos */

function FormSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 px-6 py-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-[#3e84a8]" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-input bg-white p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-3 text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
              selected ? "bg-[#347796] font-medium text-white" : "text-muted-foreground hover:bg-[#47cdd0]/10 hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------- seletor de pessoa */

function PersonPicker({
  id,
  value,
  people,
  placeholder,
  leadersFirst = false,
  onChange,
}: {
  id: string;
  value: string;
  people: FeedbackPerson[];
  placeholder: string;
  leadersFirst?: boolean;
  onChange: (name: string, person: FeedbackPerson | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => {
    const rank = (person: FeedbackPerson) =>
      (person.is_active ? 0 : 2) + (leadersFirst && !LEADER_POSITION.test(person.position ?? "") ? 1 : 0);
    return [...people].sort((a, b) => rank(a) - rank(b) || a.full_name.localeCompare(b.full_name, "pt-BR"));
  }, [people, leadersFirst]);
  const byName = useMemo(() => new Map(people.map((person) => [person.full_name, person])), [people]);
  const selected = byName.get(value) ?? null;

  const visible = useMemo(() => {
    const options = ordered.map((person) => ({
      value: person.full_name,
      keywords: `${person.short_name} ${person.department ?? ""} ${person.position ?? ""}`,
    }));
    const found = filterOptions(query.trim(), options, 60).map((option) => ({ person: byName.get(option.value)!, custom: null }));
    const trimmed = query.trim();
    if (trimmed && !ordered.some((person) => searchKey(person.full_name) === searchKey(trimmed))) {
      return [...found, { person: null, custom: trimmed }];
    }
    return found;
  }, [ordered, query, byName]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(index: number) {
    const entry = visible[index];
    if (!entry) return;
    if (entry.person) onChange(entry.person.full_name, entry.person);
    else if (entry.custom) onChange(entry.custom, null);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          className="flex min-h-12 w-full items-center gap-3 rounded-md border border-input bg-white px-3 py-2 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] hover:border-[#3e84a8]/40 focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18"
        >
          {value ? (
            <>
              <PersonAvatar name={selected?.short_name ?? value} person={selected} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{value}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {selected
                    ? [selected.position, selected.department].filter(Boolean).join(" · ") || "Cadastro do RH"
                    : "Fora do cadastro do RH"}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-[#3e84a8]/35 text-[#3e84a8]">
                <UserRound className="size-4" aria-hidden />
              </span>
              <span className="flex-1 text-muted-foreground">{placeholder}</span>
            </>
          )}
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            placeholder="Buscar pelo nome ou área…"
            className="h-9 pl-8"
            autoComplete="off"
            aria-controls={`${id}-list`}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) => Math.min(current + 1, visible.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(active);
              }
            }}
          />
        </div>
        <div id={`${id}-list`} ref={listRef} role="listbox" className="mt-2 max-h-72 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Ninguém com esse nome no cadastro.</p>
          ) : (
            visible.map((entry, index) => (
              <button
                key={entry.person?.id ?? `custom-${entry.custom}`}
                type="button"
                role="option"
                aria-selected={entry.person ? entry.person.full_name === value : false}
                data-index={index}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
                  index === active ? "bg-[#eef6f8]" : "hover:bg-[#eef6f8]"
                )}
              >
                {entry.person ? (
                  <>
                    <PersonAvatar name={entry.person.short_name} person={entry.person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", entry.person.is_active ? "text-foreground" : "text-muted-foreground")}>
                        {entry.person.full_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.person.is_active
                          ? [entry.person.position, entry.person.department].filter(Boolean).join(" · ")
                          : "Ex-colaborador"}
                      </span>
                    </span>
                    {entry.person.full_name === value && <Check className="size-4 shrink-0 text-[#347796]" aria-hidden />}
                  </>
                ) : (
                  <>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef3f5] text-muted-foreground">
                      <PencilLine className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">Usar “{entry.custom}” (fora do cadastro)</span>
                  </>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------- áreas e categorias */

function CustomOption({
  value,
  known,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  known: readonly string[];
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const isCustom = !!value && !known.includes(value);
  const [editing, setEditing] = useState(isCustom);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          onChange("");
        }}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed border-[#3e84a8]/35 px-3 text-xs font-medium text-[#285f7a] transition-colors hover:bg-[#eef6f8]"
      >
        <Plus className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <Input
      autoFocus={!isCustom}
      value={isCustom ? value : known.includes(value) ? "" : value}
      placeholder={placeholder}
      className="h-8 w-full text-sm sm:w-64"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function AreaPicker({ value, areas, onChange }: { value: string; areas: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Área">
      {areas.map((area) => {
        const selected = value === area;
        return (
          <button
            key={area}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(area)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-medium ring-1 ring-inset transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
              selected ? "bg-[#10293a] text-white ring-[#10293a]" : "bg-white text-foreground ring-[#dce9eb] hover:ring-[#3e84a8]/40"
            )}
          >
            <span className={cn("grid size-6 place-items-center rounded-full", selected ? "bg-white/15 text-white" : getAreaIconStyle(area))}>
              <AreaGlyph area={area} className="size-3.5" />
            </span>
            {area}
          </button>
        );
      })}
      <CustomOption value={value} known={areas} label="Outra área" placeholder="Nome da área" onChange={onChange} />
    </div>
  );
}

function CategoryPicker({ value, categories, onChange }: { value: string; categories: string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Categoria">
        {categories.map((category) => {
          const selected = value === category;
          return (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(category)}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm ring-1 ring-inset transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                selected ? "bg-[#e8f8f8] text-[#10293a] ring-[#347796]" : "bg-white text-foreground ring-[#dce9eb] hover:bg-[#f6fafb]"
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md",
                  selected ? "bg-[#347796] text-white" : "bg-[#eef6f8] text-[#285f7a]"
                )}
              >
                <CategoryGlyph category={category} className="size-4" />
              </span>
              <span className="min-w-0 flex-1 leading-5">{category}</span>
              {selected && <Check className="size-4 shrink-0 text-[#347796]" aria-hidden />}
            </button>
          );
        })}
      </div>
      <CustomOption value={value} known={categories} label="Outra categoria" placeholder="Nome da categoria" onChange={onChange} />
    </div>
  );
}

type ViewedChoice = "sim" | "nao" | "sem_dado";

/* --------------------------------------------------------- formulário */

export function FeedbackForm({
  form,
  people,
  items,
  onChange,
}: {
  form: FeedbackInput;
  people: FeedbackPerson[];
  items: GoodPracticeFeedback[];
  onChange: (next: FeedbackInput) => void;
}) {
  const set = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) => onChange({ ...form, [key]: value });

  const areas = useMemo(() => [...new Set([...FEEDBACK_AREAS, ...items.map((entry) => entry.area)])], [items]);
  const categories = useMemo(() => [...new Set([...FEEDBACK_CATEGORIES, ...items.map((entry) => entry.category)])], [items]);
  const responseDays = form.responded_on ? businessDaysToResponse(form.sent_on, form.responded_on) : null;
  const teamName = resolvedEmployeeName({ ...form, is_team: true });

  /** Ao escolher a pessoa: área pelo último feedback ou cadastro, e o gestor do último feedback dela (ou da área). */
  function chooseEmployee(name: string, person: FeedbackPerson | null) {
    const previous = items.filter((entry) => entry.employee_name === name).sort((a, b) => b.sent_on.localeCompare(a.sent_on))[0];
    const area = form.area || previous?.area || suggestAreaFromDepartment(person?.department) || "";
    const sameArea = items.filter((entry) => entry.area === area).sort((a, b) => b.sent_on.localeCompare(a.sent_on))[0];
    onChange({
      ...form,
      employee_name: name,
      area,
      manager_name: form.manager_name || previous?.manager_name || sameArea?.manager_name || "",
    });
  }

  return (
    <div className="divide-y divide-[#e6eef0]">
      <FormSection icon={UsersRound} title="Quem e onde">
        <Field label="Quem recebeu" htmlFor="fb-employee">
          <div className="space-y-2">
            <Segmented
              label="Quem recebeu"
              value={form.is_team ? "equipe" : "pessoa"}
              options={[
                { value: "pessoa", label: "Colaborador", icon: UserRound },
                { value: "equipe", label: "Equipe inteira", icon: UsersRound },
              ]}
              onChange={(value) => set("is_team", value === "equipe")}
            />
            {form.is_team ? (
              <div className="flex min-h-12 items-center gap-3 rounded-md border border-dashed border-[#dce9eb] bg-[#fafcfc] px-3 py-2 text-sm">
                <PersonAvatar name={teamName || "Equipe"} isTeam />
                <span className="text-muted-foreground">
                  {teamName ? (
                    <>
                      Fica como <span className="font-medium text-foreground">{teamName}</span>, pela área escolhida abaixo.
                    </>
                  ) : (
                    "Escolha a área abaixo: o feedback fica para a equipe da área."
                  )}
                </span>
              </div>
            ) : (
              <PersonPicker
                id="fb-employee"
                value={form.employee_name}
                people={people}
                placeholder="Escolha o colaborador"
                onChange={chooseEmployee}
              />
            )}
          </div>
        </Field>
        <Field label="Área">
          <AreaPicker value={form.area} areas={areas} onChange={(value) => set("area", value)} />
        </Field>
        <Field label="Gestor que recebeu o feedback" htmlFor="fb-manager">
          <PersonPicker
            id="fb-manager"
            value={form.manager_name}
            people={people}
            placeholder="Escolha o gestor"
            leadersFirst
            onChange={(name) => set("manager_name", name)}
          />
        </Field>
      </FormSection>

      <FormSection icon={PencilLine} title="O que aconteceu">
        <Field label="Categoria">
          <CategoryPicker value={form.category} categories={categories} onChange={(value) => set("category", value)} />
        </Field>
        <Field label="Ocorrência" htmlFor="fb-description">
          <Textarea
            id="fb-description"
            rows={3}
            value={form.description}
            placeholder="O que aconteceu, onde e quando."
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data da ocorrência" htmlFor="fb-occurred">
            <DatePickerField id="fb-occurred" value={form.occurred_on} onChange={(value) => set("occurred_on", value)} />
          </Field>
          <Field label="Envio ao gestor" htmlFor="fb-sent">
            <DatePickerField id="fb-sent" value={form.sent_on} onChange={(value) => set("sent_on", value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={Check} title="Retorno do gestor">
        <Field label="Providências do gestor" htmlFor="fb-action">
          <Textarea
            id="fb-action"
            rows={2}
            value={form.manager_action}
            placeholder="O que o gestor respondeu ou fez (opcional)."
            onChange={(event) => set("manager_action", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Data do retorno"
            htmlFor="fb-responded"
            hint={
              responseDays === null
                ? form.responded_on
                  ? "O retorno está antes do envio."
                  : "Em branco enquanto o gestor não responder."
                : responseDays === 0
                  ? "No mesmo dia útil do envio"
                  : `${responseDays} ${responseDays === 1 ? "dia útil" : "dias úteis"} após o envio`
            }
          >
            <DatePickerField id="fb-responded" value={form.responded_on} onChange={(value) => set("responded_on", value)} />
          </Field>
          <Field label="Visualizado no Feedz">
            <Segmented<ViewedChoice>
              label="Visualizado no Feedz"
              value={form.viewed === true ? "sim" : form.viewed === false ? "nao" : "sem_dado"}
              options={[
                { value: "sim", label: "Sim" },
                { value: "nao", label: "Não" },
                { value: "sem_dado", label: "Sem dado" },
              ]}
              onChange={(value) => set("viewed", value === "sim" ? true : value === "nao" ? false : null)}
            />
          </Field>
        </div>
        {form.viewed === true && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de visualização" htmlFor="fb-viewed-on">
              <DatePickerField id="fb-viewed-on" value={form.viewed_on} onChange={(value) => set("viewed_on", value)} />
            </Field>
          </div>
        )}
      </FormSection>
    </div>
  );
}
