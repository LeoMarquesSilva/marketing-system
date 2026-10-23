"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { emptyListItem, type FieldValues, type ImageField, type ListItem, type OptionField, type StudioField, type TextField } from "@/lib/estudio/fields";
import { moveItem } from "@/lib/estudio/domain";
import { imageDisplayName, studioImageUrl } from "@/lib/estudio/images";

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

/** Galeria da coleção, carregada uma vez por pasta enquanto a página está aberta. */
const galleryCache = new Map<string, Promise<string[]>>();

function loadGallery(tag: string, pasta: string, fresh = false): Promise<string[]> {
  const key = `${tag}/${pasta}`;
  if (fresh) galleryCache.delete(key);
  let pending = galleryCache.get(key);
  if (!pending) {
    pending = fetch(`/api/estudio/imagens?tag=${encodeURIComponent(tag)}&pasta=${pasta}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { images: [] }))
      .then((body) => (body.images ?? []).map((i: { path: string }) => i.path));
    galleryCache.set(key, pending);
    pending.catch(() => galleryCache.delete(key));
  }
  return pending;
}

function ImageInput({ field, tag, value, onChange }: { field: ImageField; tag: string; value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadGallery(tag, field.pasta).then((paths) => alive && setGallery(paths));
    return () => {
      alive = false;
    };
  }, [tag, field.pasta]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      form.append("tag", tag);
      form.append("pasta", field.pasta);
      const res = await fetch("/api/estudio/imagens", { method: "POST", body: form, credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível enviar a imagem.");
      onChange(body.path);
      setGallery(await loadGallery(tag, field.pasta, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-foreground">{field.label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-black/[0.1] bg-[repeating-conic-gradient(#eef1f3_0%_25%,#fff_0%_50%)] bg-[length:12px_12px]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={studioImageUrl(value)} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 border border-black/[0.12] bg-white px-2.5 py-1 text-xs font-medium hover:border-[#347796]/50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {value ? "Trocar" : "Enviar"}
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" /> Tirar
              </button>
            )}
          </div>
          {gallery.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && onChange(e.target.value)}
              className={cn(selectClass, "h-8 text-xs")}
              aria-label={`Escolher ${field.label.toLowerCase()} da galeria`}
            >
              <option value="">Escolher da galeria ({gallery.length})…</option>
              {gallery.map((path) => (
                <option key={path} value={path}>
                  {imageDisplayName(path)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {field.pasta === "fotos" && !value && <p className="text-[11px] text-muted-foreground">Use PNG sem fundo, com o nome da pessoa no arquivo.</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/** Formulário gerado a partir dos campos do modelo. */
export function FieldForm({ fields, values, tag, onChange }: { fields: StudioField[]; values: FieldValues; tag: string; onChange: (next: FieldValues) => void }) {
  const set = (key: string, value: FieldValues[string]) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.kind === "imagem") {
          return <ImageInput key={field.key} field={field} tag={tag} value={String(values[field.key] ?? "")} onChange={(v) => set(field.key, v)} />;
        }
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
