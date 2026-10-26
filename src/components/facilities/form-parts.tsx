"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FacilitiesPerson } from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { PersonAvatar, shortPersonName } from "./facilities-visuals";

export const NONE = "__none__";

export function FormSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-[#eef3f5] px-6 py-5 last:border-b-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-[#3e84a8]" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Liga/desliga com rótulo ao lado (não há Switch no kit de UI). */
export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 rounded-md border border-input bg-white px-3 py-2 text-left transition-colors hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-[#347796]" : "bg-slate-300"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
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
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-input bg-white p-0.5">
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

/** Select simples a partir de um dicionário de rótulos; NONE vira vazio. */
export function LabelSelect<T extends string>({
  id,
  value,
  labels,
  placeholder,
  allowEmpty = false,
  onChange,
}: {
  id?: string;
  value: T | "";
  labels: Record<T, string>;
  placeholder: string;
  allowEmpty?: boolean;
  onChange: (value: T | "") => void;
}) {
  return (
    <Select value={value || (allowEmpty ? NONE : undefined)} onValueChange={(next) => onChange(next === NONE ? "" : (next as T))}>
      <SelectTrigger id={id} className="h-10 w-full bg-white text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={NONE}>—</SelectItem>}
        {(Object.entries(labels) as [T, string][]).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PersonSelect({
  id,
  value,
  people,
  onChange,
}: {
  id?: string;
  value: string | null;
  people: FacilitiesPerson[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
      <SelectTrigger id={id} className="h-10 w-full bg-white text-sm">
        <SelectValue placeholder="Ninguém definido" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>Ninguém definido</SelectItem>
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>
            <span className="flex items-center gap-2">
              <PersonAvatar person={person} size="xs" />
              {shortPersonName(person.name)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
