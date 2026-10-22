"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { emptyListItem, type FieldValues, type ListItem, type OptionField, type StudioField, type TextField } from "@/lib/estudio/fields";
import { moveItem } from "@/lib/estudio/domain";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-white px-2 text-sm shadow-xs outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18";

function Counter({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.85;
  return (
    <span className={cn("text-[11px] tabular-nums", near ? "text-amber-700" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

function TextInput({ field, value, onChange }: { field: TextField; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 text-xs font-medium text-foreground">
        {field.label}
        <Counter value={value} max={field.max} />
      </span>
      {field.multilinha ? (
        <Textarea
          value={value}
          maxLength={field.max}
          rows={Math.min(4, Math.max(2, Math.ceil(field.max / 60)))}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-0 resize-y bg-white text-sm"
        />
      ) : (
        <Input value={value} maxLength={field.max} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className="h-9 bg-white text-sm" />
      )}
    </label>
  );
}

function OptionInput({ field, value, onChange }: { field: OptionField; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{field.label}</span>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {field.opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Formulário gerado a partir dos campos do modelo. */
export function FieldForm({ fields, values, onChange }: { fields: StudioField[]; values: FieldValues; onChange: (next: FieldValues) => void }) {
  const set = (key: string, value: FieldValues[string]) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.kind === "texto") {
          return <TextInput key={field.key} field={field} value={String(values[field.key] ?? "")} onChange={(v) => set(field.key, v)} />;
        }
        if (field.kind === "opcao") {
          return <OptionInput key={field.key} field={field} value={String(values[field.key] ?? field.padrao)} onChange={(v) => set(field.key, v)} />;
        }
        if (field.kind === "alternar") {
          return (
            <label key={field.key} className="flex items-center gap-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                checked={values[field.key] === true}
                onChange={(e) => set(field.key, e.target.checked)}
                className="h-4 w-4 accent-[#04202f]"
              />
              {field.label}
            </label>
          );
        }
        const list = (Array.isArray(values[field.key]) ? values[field.key] : []) as ListItem[];
        const update = (next: ListItem[]) => set(field.key, next);
        return (
          <fieldset key={field.key} className="space-y-2.5">
            <legend className="mb-1 flex w-full items-center justify-between text-xs font-medium text-foreground">
              {field.label}
              <span className="text-[11px] font-normal text-muted-foreground">
                {list.length}/{field.max}
              </span>
            </legend>
            {list.map((item, index) => (
              <div key={index} className="space-y-2.5 border border-black/[0.08] bg-[#f7f9fa] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">
                    {field.item} {index + 1}
                  </span>
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={index === 0} onClick={() => update(moveItem(list, index, index - 1))} aria-label="Subir">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={index === list.length - 1} onClick={() => update(moveItem(list, index, index + 1))} aria-label="Descer">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={list.length <= field.min} onClick={() => update(list.filter((_, i) => i !== index))} aria-label="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {field.campos.map((sub) =>
                  sub.kind === "texto" ? (
                    <TextInput key={sub.key} field={sub} value={item[sub.key] ?? ""} onChange={(v) => update(list.map((it, i) => (i === index ? { ...it, [sub.key]: v } : it)))} />
                  ) : (
                    <OptionInput key={sub.key} field={sub} value={item[sub.key] ?? sub.padrao} onChange={(v) => update(list.map((it, i) => (i === index ? { ...it, [sub.key]: v } : it)))} />
                  )
                )}
              </div>
            ))}
            {list.length < field.max && (
              <button
                type="button"
                onClick={() => update([...list, emptyListItem(field)])}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#347796] hover:text-[#04202f]"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar {field.item.toLowerCase()}
              </button>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
