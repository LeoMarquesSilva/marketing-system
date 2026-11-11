"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Download,
  FileAudio,
  FileText,
  Film,
  GalleryHorizontalEnd,
  ImageOff,
  Images,
  LayoutGrid,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ARCHIVE_CATEGORIES,
  ARCHIVE_FIRST_YEAR,
  ARCHIVE_LAST_YEAR,
  ARCHIVE_STATUS_LABELS,
  ARCHIVE_USES,
  AUTHORIZATION_LABELS,
  archiveKindFromMime,
  formatBytes,
  normalizeForSearch,
  parseChapters,
  type ArchiveKind,
  type ArchiveStatus,
  type AuthorizationStatus,
  type DocArchiveItem,
  type DocArchivePerson,
  type DocBoard,
  type DocChapter,
} from "@/lib/documentario/types";
import { makeArchivePreview, uploadArchiveFile, type ArchivePreview } from "@/lib/documentario/upload-client";
import { CARD, EmptyState, FILM, Face, Feedback, SELECT, docRequest, formatDateTimeShort } from "./shared";

type View = "galeria" | "linha";
type YearFilter = "todos" | "antes" | "sem" | number;

const YEARS = Array.from({ length: ARCHIVE_LAST_YEAR - ARCHIVE_FIRST_YEAR + 1 }, (_, index) => ARCHIVE_FIRST_YEAR + index);

const STATUS_DOT: Record<ArchiveStatus, string> = {
  aprovado: "bg-emerald-500",
  pendente: "bg-amber-400",
  nao_utilizavel: "bg-rose-500",
};
const STATUS_PILL: Record<ArchiveStatus, string> = {
  aprovado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pendente: "bg-amber-50 text-amber-800 ring-amber-200",
  nao_utilizavel: "bg-rose-50 text-rose-700 ring-rose-200",
};
const KIND_ICON: Record<ArchiveKind, typeof Images> = { foto: Images, video: Film, audio: FileAudio, documento: FileText };

function yearLabel(item: DocArchiveItem): string {
  if (item.year == null) return "Sem ano";
  return `${item.year_approx ? "c. " : ""}${item.year}`;
}

/* ------------------------------------------------------------------ campos compartilhados */

interface FieldValues {
  year: string;
  year_approx: boolean;
  date_note: string;
  description: string;
  people: DocArchivePerson[];
  category: string;
  source: string;
  authorization_status: AuthorizationStatus;
  allowed_uses: string[];
  chapters: string[];
  status: ArchiveStatus;
  status_note: string;
}

function fieldsOf(item: DocArchiveItem | null): FieldValues {
  return {
    year: item?.year != null ? String(item.year) : "",
    year_approx: item?.year_approx ?? true,
    date_note: item?.date_note ?? "",
    description: item?.description ?? "",
    people: item?.people ?? [],
    category: item?.category ?? "",
    source: item?.source ?? "",
    authorization_status: item?.authorization_status ?? "pendente",
    allowed_uses: item?.allowed_uses ?? [],
    chapters: item?.chapters ?? [],
    status: item?.status ?? "pendente",
    status_note: item?.status_note ?? "",
  };
}

function toPayload(values: FieldValues) {
  const year = values.year.trim() ? Number(values.year) : null;
  return {
    year: year != null && Number.isInteger(year) ? year : null,
    year_approx: values.year_approx,
    date_note: values.date_note.trim() || null,
    description: values.description.trim() || null,
    people: values.people,
    category: values.category || null,
    source: values.source.trim() || null,
    authorization_status: values.authorization_status,
    allowed_uses: values.allowed_uses,
    chapters: values.chapters,
    status: values.status,
    status_note: values.status_note.trim() || null,
  };
}

function PeopleField({ board, value, onChange }: { board: DocBoard; value: DocArchivePerson[]; onChange: (next: DocArchivePerson[]) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const term = normalizeForSearch(query.trim());
    if (term.length < 2) return [];
    return board.team.filter((member) => normalizeForSearch(member.name).includes(term) && !value.some((person) => person.user_id === member.user_id)).slice(0, 5);
  }, [query, board.team, value]);
  const avatar = (person: DocArchivePerson) => (person.user_id ? board.team.find((member) => member.user_id === person.user_id)?.avatar_url ?? null : null);
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((person, index) => (
            <span key={`${person.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f8fa] py-0.5 pl-0.5 pr-1 text-xs">
              <Face name={person.name} avatarUrl={avatar(person)} size="xs" />
              {person.name}
              <button type="button" aria-label={`Tirar ${person.name}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full p-0.5 hover:bg-black/5">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome de quem aparece (do escritório ou não)" aria-label="Pessoas retratadas" />
      {query.trim().length >= 2 && (
        <ul className="rounded-md border border-[#e6eef0] bg-white py-1 shadow-sm">
          {matches.map((member) => (
            <li key={member.user_id}>
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-[#f3f8fa]"
                onClick={() => {
                  onChange([...value, { name: member.name, user_id: member.user_id }]);
                  setQuery("");
                }}
              >
                <Face name={member.name} avatarUrl={member.avatar_url} size="xs" />
                {member.name}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm text-[#285f7a] hover:bg-[#f3f8fa]"
              onClick={() => {
                onChange([...value, { name: query.trim(), user_id: null }]);
                setQuery("");
              }}
            >
              <Plus className="size-4" aria-hidden />
              Adicionar “{query.trim()}”
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function ChipToggle({ options, value, onChange, label }: { options: { key: string; label: string }[]; value: string[]; onChange: (next: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((key) => key !== option.key) : [...value, option.key])}
            className={cn(
              "min-h-8 rounded-md border px-2.5 text-xs font-medium",
              on ? "border-[#347796] bg-[#347796] text-white" : "border-[#dce9eb] bg-white text-foreground/80 hover:border-[#47cdd0]/70",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ArchiveFields({
  board,
  chapters,
  values,
  onChange,
  compact,
}: {
  board: DocBoard;
  chapters: DocChapter[];
  values: FieldValues;
  onChange: (next: FieldValues) => void;
  compact?: boolean;
}) {
  const set = <K extends keyof FieldValues>(key: K, value: FieldValues[K]) => onChange({ ...values, [key]: value });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="acervo-ano">Ano estimado</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="acervo-ano" inputMode="numeric" value={values.year} onChange={(event) => set("year", event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="AAAA" className="w-24 font-mono" />
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="size-4 accent-[#347796]" checked={values.year_approx} onChange={(event) => set("year_approx", event.target.checked)} />
            aproximado
          </label>
          <Input value={values.date_note} onChange={(event) => set("date_note", event.target.value)} placeholder="Ex.: inauguração da sede, dez/2016" className="min-w-40 flex-1" aria-label="Observação sobre a data" />
        </div>
        <div className="flex flex-wrap gap-1">
          {YEARS.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => onChange({ ...values, year: String(year) })}
              className={cn("rounded px-1.5 py-0.5 text-xs font-medium tabular-nums", values.year === String(year) ? "bg-[#347796] text-white" : "bg-[#f3f8fa] text-[#285f7a] hover:bg-[#e6f1f4]")}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acervo-desc">Descrição</Label>
        <Textarea id="acervo-desc" rows={compact ? 2 : 3} value={values.description} onChange={(event) => set("description", event.target.value)} placeholder="O que aparece, onde, em que ocasião" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Pessoas retratadas</p>
        <PeopleField board={board} value={values.people} onChange={(next) => set("people", next)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acervo-categoria">Categoria</Label>
          <select id="acervo-categoria" className={SELECT} value={values.category} onChange={(event) => set("category", event.target.value)}>
            <option value="">Sem categoria</option>
            {ARCHIVE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acervo-fonte">Proprietário / fonte</Label>
          <Input id="acervo-fonte" value={values.source} onChange={(event) => set("source", event.target.value)} placeholder="Quem cedeu o arquivo" />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Capítulo possível</p>
        <ChipToggle label="Capítulos" options={chapters.map((chapter) => ({ key: chapter.key, label: chapter.label }))} value={values.chapters} onChange={(next) => set("chapters", next)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acervo-autorizacao">Autorização</Label>
          <select id="acervo-autorizacao" className={SELECT} value={values.authorization_status} onChange={(event) => set("authorization_status", event.target.value as AuthorizationStatus)}>
            {(Object.keys(AUTHORIZATION_LABELS) as AuthorizationStatus[]).map((status) => (
              <option key={status} value={status}>
                {AUTHORIZATION_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acervo-situacao">Situação da revisão</Label>
          <select id="acervo-situacao" className={SELECT} value={values.status} onChange={(event) => set("status", event.target.value as ArchiveStatus)}>
            {(Object.keys(ARCHIVE_STATUS_LABELS) as ArchiveStatus[]).map((status) => (
              <option key={status} value={status}>
                {ARCHIVE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Usos autorizados</p>
        <p className="text-xs text-muted-foreground">A autorização para a festa não vale para redes, site ou propostas: marque cada uso.</p>
        <ChipToggle label="Usos autorizados" options={ARCHIVE_USES} value={values.allowed_uses} onChange={(next) => set("allowed_uses", next)} />
      </div>
      {!compact && (
        <div className="space-y-1.5">
          <Label htmlFor="acervo-nota">Observação da revisão</Label>
          <Input id="acervo-nota" value={values.status_note} onChange={(event) => set("status_note", event.target.value)} placeholder="Ex.: foto tremida; pedir versão original" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ envio */

interface Pending {
  file: File;
  kind: ArchiveKind;
  preview: ArchivePreview | null;
  url: string | null;
  progress: number;
  state: "fila" | "enviando" | "ok" | "erro";
  error?: string;
}

function UploadDialog({
  board,
  chapters,
  files,
  onClose,
  onCreated,
}: {
  board: DocBoard;
  chapters: DocChapter[];
  files: File[];
  onClose: () => void;
  onCreated: (items: DocArchiveItem[]) => void;
}) {
  const [pending, setPending] = useState<Pending[]>(() => files.map((file) => ({ file, kind: archiveKindFromMime(file.type, file.name), preview: null, url: null, progress: 0, state: "fila" })));
  const [values, setValues] = useState<FieldValues>(fieldsOf(null));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = pending.every((item) => item.state === "ok" || item.state === "erro") && pending.some((item) => item.state !== "fila");

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      for (const [index, item] of files.entries()) {
        const kind = archiveKindFromMime(item.type, item.name);
        const preview = await makeArchivePreview(item, kind);
        if (cancelled) return;
        const url = preview.thumb ? URL.createObjectURL(preview.thumb) : null;
        if (url) urls.push(url);
        setPending((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, preview, url } : entry)));
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  async function start() {
    setRunning(true);
    setError(null);
    const created: DocArchiveItem[] = [];
    const ready: Record<string, unknown>[] = [];
    const flush = async () => {
      if (!ready.length) return;
      const batch = ready.splice(0, ready.length);
      const result = await docRequest<{ items: DocArchiveItem[] }>({ action: "archive.create", items: batch });
      created.push(...result.items);
    };
    try {
      for (const [index, item] of pending.entries()) {
        if (item.state === "ok") continue;
        setPending((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, state: "enviando", progress: 0 } : entry)));
        try {
          const preview = item.preview ?? (await makeArchivePreview(item.file, item.kind));
          const uploaded = await uploadArchiveFile(board.project.id, item.file, preview, (progress) =>
            setPending((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, progress } : entry))),
          );
          ready.push({
            ...toPayload(values),
            ...uploaded,
            file_name: item.file.name.slice(0, 300),
            mime_type: item.file.type || null,
            size_bytes: item.file.size,
            kind: item.kind,
            width: preview.width,
            height: preview.height,
          });
          if (ready.length >= 20) await flush();
          setPending((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, state: "ok", progress: 100 } : entry)));
        } catch (err) {
          setPending((current) =>
            current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, state: "erro", error: err instanceof Error ? err.message : "Falha no envio." } : entry)),
          );
        }
      }
      await flush();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar os arquivos.");
    } finally {
      setRunning(false);
      if (created.length) onCreated(created);
    }
  }

  const sent = pending.filter((item) => item.state === "ok").length;
  const failed = pending.filter((item) => item.state === "erro").length;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && !running && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-4xl">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">
            Enviar {files.length} {files.length === 1 ? "arquivo" : "arquivos"} ao acervo
          </DialogTitle>
          <DialogDescription className="text-sm">
            {formatBytes(totalSize)} · pasta privada. Os campos abaixo valem para todos; depois dá para ajustar um a um.
          </DialogDescription>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:overflow-hidden">
          <ul className="grid content-start grid-cols-3 gap-2 border-b border-[#e6eef0] p-4 sm:grid-cols-4 md:overflow-y-auto md:border-b-0 md:border-r">
            {pending.map((item, index) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={`${item.file.name}-${index}`} className="relative overflow-hidden rounded-md bg-[#eef4f6]" title={item.error ?? item.file.name}>
                  <div className="aspect-square">
                    {item.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center text-[#285f7a]">
                        <Icon className="size-5" aria-hidden />
                        <span className="line-clamp-2 break-all text-[11px] leading-tight">{item.file.name}</span>
                      </div>
                    )}
                  </div>
                  {item.state !== "fila" && (
                    <div className={cn("absolute inset-x-0 bottom-0 h-1.5", item.state === "erro" ? "bg-rose-500" : "bg-black/20")}>
                      {item.state !== "erro" && <div className="h-full bg-[#47cdd0] transition-[width]" style={{ width: `${item.progress}%` }} />}
                    </div>
                  )}
                  {item.state === "ok" && <span className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5 text-white"><ShieldCheck className="size-3" aria-label="Enviado" /></span>}
                </li>
              );
            })}
          </ul>
          <div className="p-4 md:overflow-y-auto">
            {error && <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            {failed > 0 && (
              <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {failed} {failed === 1 ? "arquivo falhou" : "arquivos falharam"}: {pending.find((item) => item.state === "erro")?.error}
              </p>
            )}
            <ArchiveFields board={board} chapters={chapters} values={values} onChange={setValues} compact />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {(running || finished) && (
            <p className="mr-auto text-sm text-muted-foreground">
              {sent} de {files.length} enviados{failed ? ` · ${failed} com erro` : ""}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={running}>
            {finished ? "Fechar" : "Cancelar"}
          </Button>
          {!finished || failed > 0 ? (
            <Button size="sm" disabled={running} onClick={() => void start()}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {failed > 0 && !running ? "Tentar de novo os que falharam" : `Enviar ${files.length}`}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ ficha */

function DetailDialog({
  board,
  chapters,
  item,
  onPrev,
  onNext,
  onClose,
  onSaved,
  onDeleted,
}: {
  board: DocBoard;
  chapters: DocChapter[];
  item: DocArchiveItem;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
  onSaved: (item: DocArchiveItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FieldValues>(fieldsOf(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chapterLabel = (key: string) => chapters.find((chapter) => chapter.key === key)?.label ?? key;
  const avatar = (person: DocArchivePerson) => (person.user_id ? board.team.find((member) => member.user_id === person.user_id)?.avatar_url ?? null : null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editing || (event.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (event.key === "ArrowLeft" && onPrev) onPrev();
      if (event.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onPrev, onNext]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await docRequest<{ items: DocArchiveItem[] }>({ action: "archive.update", id: item.id, fields: toPayload(values) });
      if (result.items[0]) onSaved(result.items[0]);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: ReactNode) => (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{value || <span className="text-muted-foreground">Não informado</span>}</dd>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-5xl">
        <div className="flex items-center gap-3 border-b border-[#e6eef0] px-5 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="font-mono text-sm text-[#3e84a8]">{item.code}</span>
              <span className="truncate">{item.description ? item.description.split("\n")[0].slice(0, 80) : item.file_name}</span>
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {item.file_name} · {formatBytes(item.size_bytes)}
              {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Anterior" disabled={!onPrev || editing} onClick={() => onPrev?.()}>
              <ArrowLeft className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Próximo" disabled={!onNext || editing} onClick={() => onNext?.()}>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:overflow-hidden">
          <div className="flex min-h-[260px] items-center justify-center bg-[#0b1620] md:min-h-0">
            {item.kind === "foto" && item.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.file_url} alt={item.description ?? item.file_name} className="max-h-[70dvh] w-full object-contain" />
            ) : item.kind === "video" && item.file_url ? (
              <video key={item.id} src={item.file_url} poster={item.thumb_url ?? undefined} controls preload="metadata" className="max-h-[70dvh] w-full" />
            ) : item.kind === "audio" && item.file_url ? (
              <audio src={item.file_url} controls className="w-[90%]" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/70">
                <FileText className="size-10" aria-hidden />
                <span className="text-sm">Sem pré-visualização</span>
              </div>
            )}
          </div>
          <div className="min-h-0 p-5 md:overflow-y-auto">
            {error && <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            {editing ? (
              <ArchiveFields board={board} chapters={chapters} values={values} onChange={setValues} />
            ) : (
              <dl className="divide-y divide-[#eef3f4]">
                {row(
                  "Situação",
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_PILL[item.status])}>{ARCHIVE_STATUS_LABELS[item.status]}</span>
                    {item.status_note && <span className="text-xs text-muted-foreground">{item.status_note}</span>}
                  </span>,
                )}
                {row("Ano", item.year != null ? `${yearLabel(item)}${item.date_note ? ` · ${item.date_note}` : ""}` : item.date_note)}
                {row("Descrição", item.description && <span className="whitespace-pre-wrap">{item.description}</span>)}
                {row(
                  "Pessoas",
                  item.people.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {item.people.map((person, index) => (
                        <span key={`${person.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f8fa] py-0.5 pl-0.5 pr-2 text-xs">
                          <Face name={person.name} avatarUrl={avatar(person)} size="xs" />
                          {person.name}
                        </span>
                      ))}
                    </span>
                  ),
                )}
                {row("Categoria", item.category)}
                {row("Fonte", item.source)}
                {row("Capítulo", item.chapters.map(chapterLabel).join(" · "))}
                {row("Autorização", AUTHORIZATION_LABELS[item.authorization_status])}
                {row("Usos", item.allowed_uses.map((key) => ARCHIVE_USES.find((use) => use.key === key)?.label ?? key).join(" · "))}
                {row("Enviado", `${item.created_by_name ? `${item.created_by_name} · ` : ""}${formatDateTimeShort(item.created_at)}`)}
              </dl>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {board.viewer.can_edit && !editing && (
            confirmDelete ? (
              <span className="mr-auto flex items-center gap-2 text-sm">
                Excluir o arquivo de vez?
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await docRequest({ action: "archive.delete", ids: [item.id] });
                      onDeleted(item.id);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Não
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="mr-auto text-rose-700" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                Excluir
              </Button>
            )
          )}
          {!editing && (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/documentario/arquivo?id=${item.id}&baixar=1`}>
                <Download className="size-4" />
                Baixar original
              </a>
            </Button>
          )}
          {editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setValues(fieldsOf(item));
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void save()}>
                Salvar
              </Button>
            </>
          ) : (
            board.viewer.can_edit && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                Editar
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ edição em lote */

function BulkBar({
  count,
  chapters,
  onApply,
  onDelete,
  onClear,
}: {
  count: number;
  chapters: DocChapter[];
  onApply: (fields: Record<string, unknown>, text: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [year, setYear] = useState("");
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-lg bg-[#04202f] px-4 py-2.5 text-sm text-white shadow-[0_8px_24px_-8px_rgba(3,7,12,0.5)]">
      <span className="font-semibold">{count} selecionados</span>
      <span className="h-5 w-px bg-white/20" aria-hidden />
      <label className="inline-flex items-center gap-1.5">
        Ano
        <input value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))} className="h-8 w-16 rounded bg-white/10 px-2 font-mono outline-none focus:ring-2 focus:ring-[#47cdd0]/60" aria-label="Ano para os selecionados" />
        <button type="button" disabled={year.length !== 4} onClick={() => onApply({ year: Number(year) }, `Ano ${year} aplicado.`)} className="h-8 rounded bg-white/15 px-2 text-xs font-semibold hover:bg-white/25 disabled:opacity-40">
          Aplicar
        </button>
      </label>
      <select
        aria-label="Capítulo para os selecionados"
        className="h-8 rounded bg-white/10 px-2 text-xs [&>option]:text-foreground"
        value=""
        onChange={(event) => event.target.value && onApply({ chapters: [event.target.value] }, "Capítulo aplicado.")}
      >
        <option value="">Capítulo…</option>
        {chapters.map((chapter) => (
          <option key={chapter.key} value={chapter.key}>
            {chapter.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Situação para os selecionados"
        className="h-8 rounded bg-white/10 px-2 text-xs [&>option]:text-foreground"
        value=""
        onChange={(event) => event.target.value && onApply({ status: event.target.value }, "Situação aplicada.")}
      >
        <option value="">Situação…</option>
        {(Object.keys(ARCHIVE_STATUS_LABELS) as ArchiveStatus[]).map((status) => (
          <option key={status} value={status}>
            {ARCHIVE_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <button type="button" onClick={onDelete} className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-rose-200 hover:bg-white/10">
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      <button type="button" onClick={onClear} className="ml-auto inline-flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-white/10">
        <X className="size-3.5" aria-hidden />
        Limpar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ página */

function Tile({
  item,
  selecting,
  selected,
  onOpen,
  onToggle,
  size = "md",
}: {
  item: DocArchiveItem;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  size?: "md" | "sm";
}) {
  const Icon = KIND_ICON[item.kind];
  return (
    <div className={cn("group relative", size === "sm" && "w-36 shrink-0 sm:w-40")}>
      <button
        type="button"
        onClick={selecting ? onToggle : onOpen}
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-md bg-[#e8eff2] outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/60",
          selected && "ring-[3px] ring-[#347796]",
        )}
        aria-label={`${item.code} · ${item.description ?? item.file_name}`}
      >
        {item.thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumb_url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-[#285f7a]">
            {item.kind === "foto" ? <ImageOff className="size-6" aria-hidden /> : <Icon className="size-6" aria-hidden />}
            <span className="max-w-[90%] truncate text-[11px]">{item.file_name.split(".").pop()?.toUpperCase()}</span>
          </span>
        )}
        {item.kind === "video" && (
          <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="size-4 fill-current" aria-hidden />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/65 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white">
          <span className="font-mono">{item.code}</span>
          <span>{yearLabel(item)}</span>
        </span>
        <span className={cn("absolute left-2 top-2 size-2.5 rounded-full ring-2 ring-white", STATUS_DOT[item.status])} title={ARCHIVE_STATUS_LABELS[item.status]} />
      </button>
      {selecting && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-white/90 text-[#347796]">
          {selected ? <CheckSquare className="size-5" aria-hidden /> : <Square className="size-5" aria-hidden />}
        </span>
      )}
      {size === "md" && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.description ?? item.file_name}</p>}
    </div>
  );
}

export function DocAcervoClient({ initialBoard, initialItems }: { initialBoard: DocBoard; initialItems: DocArchiveItem[] }) {
  const board = initialBoard;
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<View>("galeria");
  const [year, setYear] = useState<YearFilter>("todos");
  const [chapter, setChapter] = useState("");
  const [status, setStatus] = useState<ArchiveStatus | "">("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState<File[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erro"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = board.viewer.can_edit;
  const chapters = useMemo(() => parseChapters(board.sections.find((section) => section.slug === "estrutura")?.body ?? ""), [board.sections]);

  // Links assinados vencem em 2 h: renova a lista a cada 90 min com a tela aberta.
  const refresh = useCallback(async () => {
    const response = await fetch("/api/documentario/acervo", { cache: "no-store" });
    if (response.ok) setItems(((await response.json()) as { items: DocArchiveItem[] }).items);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 90 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const matchesYear = useCallback(
    (item: DocArchiveItem, filter: YearFilter) =>
      filter === "todos" ? true : filter === "sem" ? item.year == null : filter === "antes" ? item.year != null && item.year < ARCHIVE_FIRST_YEAR : item.year === filter,
    [],
  );
  const base = useMemo(() => {
    const term = normalizeForSearch(query.trim());
    return items.filter(
      (item) =>
        (!chapter || item.chapters.includes(chapter)) &&
        (!status || item.status === status) &&
        (!category || item.category === category) &&
        (!term || normalizeForSearch([item.code, item.description, item.file_name, item.source, item.date_note, ...item.people.map((person) => person.name)].join(" ")).includes(term)),
    );
  }, [items, chapter, status, category, query]);
  const filtered = useMemo(() => base.filter((item) => matchesYear(item, year)), [base, year, matchesYear]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.seq - b.seq),
    [filtered],
  );
  const openIndex = sorted.findIndex((item) => item.id === openId);
  const openItem = openIndex >= 0 ? sorted[openIndex] : null;

  const yearChips: { key: YearFilter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: base.length },
    { key: "antes", label: "Antes de 2016", count: base.filter((item) => matchesYear(item, "antes")).length },
    ...YEARS.map((value) => ({ key: value as YearFilter, label: String(value), count: base.filter((item) => item.year === value).length })),
    { key: "sem", label: "Sem ano", count: base.filter((item) => item.year == null).length },
  ];

  const maxYearCount = Math.max(1, ...YEARS.map((value) => base.filter((item) => item.year === value).length), base.filter((item) => item.year != null && item.year < ARCHIVE_FIRST_YEAR).length);
  const groups = useMemo(() => {
    const map = new Map<string, DocArchiveItem[]>();
    for (const item of sorted) {
      const key = item.year == null ? "Sem ano" : String(item.year);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [sorted]);

  function pickFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((file) => file.size > 0);
    if (files.length) setUploading(files.slice(0, 200));
    if (list && list.length > 200) setMessage({ type: "erro", text: "Envie no máximo 200 arquivos por vez." });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (canEdit) pickFiles(event.dataTransfer.files);
  }

  async function bulk(fields: Record<string, unknown>, text: string) {
    try {
      const result = await docRequest<{ items: DocArchiveItem[] }>({ action: "archive.bulk", ids: selected, fields });
      const byId = new Map(result.items.map((item) => [item.id, item]));
      setItems((current) => current.map((item) => byId.get(item.id) ?? item));
      setMessage({ type: "ok", text: `${text} (${result.items.length})` });
    } catch (err) {
      setMessage({ type: "erro", text: err instanceof Error ? err.message : "Não foi possível aplicar." });
    }
  }

  return (
    <div
      className="relative space-y-4"
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-[#347796] bg-[#f3fafb]/90">
          <p className="flex items-center gap-2 text-base font-semibold text-[#285f7a]">
            <Upload className="size-5" aria-hidden />
            Solte para enviar ao acervo
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-foreground">
            <span className="font-semibold">{items.length}</span> {items.length === 1 ? "item" : "itens"} no acervo
            {items.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {items.filter((item) => item.status === "aprovado").length} aprovados · {items.filter((item) => item.status === "pendente").length} pendentes ·{" "}
                {items.filter((item) => item.status === "nao_utilizavel").length} não utilizáveis
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Pasta privada: os links abrem só para quem tem acesso e expiram.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Visualização" className="inline-flex rounded-md bg-[#eef4f6] p-0.5 text-sm font-medium">
            {(
              [
                ["galeria", "Galeria", LayoutGrid],
                ["linha", "Linha do tempo", GalleryHorizontalEnd],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded px-3", view === id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          {canEdit && items.length > 0 && (
            <Button
              variant={selecting ? "secondary" : "outline"}
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
            >
              <CheckSquare className="size-4" />
              {selecting ? "Concluir seleção" : "Selecionar"}
            </Button>
          )}
          {canEdit && (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.heic,.heif"
                className="hidden"
                onChange={(event) => {
                  pickFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button onClick={() => inputRef.current?.click()}>
                <Upload className="size-4" />
                Enviar fotos e vídeos
              </Button>
            </>
          )}
        </div>
      </div>

      <Feedback message={message} onClose={() => setMessage(null)} />

      {items.length > 0 && (
        <div className={cn(CARD, "space-y-3 p-3")}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <div role="radiogroup" aria-label="Ano" className="flex min-w-max items-end gap-1">
              {yearChips.map((chip) => {
                const on = year === chip.key;
                const isYear = typeof chip.key === "number";
                const height = chip.count ? Math.max(6, Math.round((chip.count / maxYearCount) * 36)) : 2;
                return (
                  <button
                    key={String(chip.key)}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${chip.label}: ${chip.count} ${chip.count === 1 ? "item" : "itens"}`}
                    onClick={() => setYear(chip.key)}
                    disabled={chip.count === 0 && chip.key !== "todos"}
                    className={cn(
                      "group flex shrink-0 flex-col items-center gap-1 rounded-md px-2 pb-1.5 pt-1 outline-none disabled:cursor-default focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
                      isYear ? "w-14" : "px-3",
                      on ? "bg-[#e9f3f8]" : "enabled:hover:bg-[#f3f8fa]",
                    )}
                  >
                    {isYear ? (
                      <span className="flex h-9 items-end" aria-hidden>
                        <span className={cn("w-5 rounded-sm transition-colors", chip.count ? (on ? "bg-[#347796]" : "bg-[#9cc3d2] group-hover:bg-[#3e84a8]") : "bg-[#e3ebee]")} style={{ height }} />
                      </span>
                    ) : (
                      <span className="flex h-9 items-end text-xs tabular-nums text-muted-foreground">{chip.count}</span>
                    )}
                    <span className={cn("text-[13px] font-semibold tabular-nums", on ? "text-[#285f7a]" : chip.count || chip.key === "todos" ? "text-foreground" : "text-muted-foreground/50")}>
                      {chip.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar descrição, pessoa, código" className="pl-9" aria-label="Buscar no acervo" />
            </div>
            <select aria-label="Capítulo" className={SELECT} value={chapter} onChange={(event) => setChapter(event.target.value)}>
              <option value="">Todos os capítulos</option>
              {chapters.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} — {item.title}
                </option>
              ))}
            </select>
            <select aria-label="Situação" className={SELECT} value={status} onChange={(event) => setStatus(event.target.value as ArchiveStatus | "")}>
              <option value="">Todas as situações</option>
              {(Object.keys(ARCHIVE_STATUS_LABELS) as ArchiveStatus[]).map((value) => (
                <option key={value} value={value}>
                  {ARCHIVE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <select aria-label="Categoria" className={SELECT} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Todas as categorias</option>
              {ARCHIVE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-[#b9d3dc] bg-[#f8fbfc] px-6 py-14 text-center">
          <span className="flex -space-x-3" aria-hidden>
            <span className="grid size-14 -rotate-6 place-items-center rounded-md bg-white text-[#3e84a8] shadow-[0_2px_8px_rgba(3,32,47,0.08)]">
              <Images className="size-6" />
            </span>
            <span className="grid size-14 rotate-3 place-items-center rounded-md text-white shadow-[0_2px_8px_rgba(3,32,47,0.15)]" style={{ backgroundColor: FILM.navy }}>
              <Film className="size-6" style={{ color: FILM.gold }} />
            </span>
          </span>
          <p className="mt-5 text-lg font-semibold text-foreground">{canEdit ? "Arraste fotos e vídeos antigos para cá" : "O acervo ainda está vazio"}</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Das origens dos sócios, antes de 2016, até hoje. Ficam numa pasta privada; depois de enviar, você marca ano, pessoas, capítulo e autorização de cada um.
          </p>
          {canEdit && (
            <Button className="mt-5" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" />
              Escolher arquivos
            </Button>
          )}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Search} title="Nada com esses filtros" text="Troque o ano, o capítulo ou a busca." />
      ) : view === "galeria" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {sorted.map((item) => (
            <li key={item.id}>
              <Tile
                item={item}
                selecting={selecting}
                selected={selected.includes(item.id)}
                onOpen={() => setOpenId(item.id)}
                onToggle={() => setSelected((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-[47px] before:top-2 before:w-px before:bg-[#dce9eb] sm:before:left-[63px]">
          {groups.map(([label, list]) => (
            <li key={label} className="relative grid grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[128px_minmax(0,1fr)]">
              <div className="relative z-10 pt-1 text-center">
                <span className={cn("inline-block rounded-md bg-background px-1 font-semibold tabular-nums text-foreground", label === "Sem ano" ? "text-sm" : "text-2xl")}>{label}</span>
                <p className="text-xs text-muted-foreground">{list.length} {list.length === 1 ? "item" : "itens"}</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {list.map((item) => (
                  <Tile
                    key={item.id}
                    item={item}
                    size="sm"
                    selecting={selecting}
                    selected={selected.includes(item.id)}
                    onOpen={() => setOpenId(item.id)}
                    onToggle={() => setSelected((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))}
                  />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {selecting && selected.length > 0 && (
        <BulkBar
          count={selected.length}
          chapters={chapters}
          onApply={(fields, text) => void bulk(fields, text)}
          onClear={() => setSelected([])}
          onDelete={async () => {
            if (!window.confirm(`Excluir ${selected.length} arquivo(s) do acervo de vez?`)) return;
            try {
              const result = await docRequest<{ deleted: string[] }>({ action: "archive.delete", ids: selected });
              setItems((current) => current.filter((item) => !result.deleted.includes(item.id)));
              setSelected([]);
              setMessage({ type: "ok", text: `${result.deleted.length} arquivo(s) excluído(s).` });
            } catch (err) {
              setMessage({ type: "erro", text: err instanceof Error ? err.message : "Não foi possível excluir." });
            }
          }}
        />
      )}

      {uploading && (
        <UploadDialog
          board={board}
          chapters={chapters}
          files={uploading}
          onClose={() => setUploading(null)}
          onCreated={(created) => {
            setItems((current) => [...current, ...created]);
            setMessage({ type: "ok", text: `${created.length} ${created.length === 1 ? "arquivo enviado" : "arquivos enviados"} ao acervo.` });
          }}
        />
      )}
      {openItem && (
        <DetailDialog
          key={openItem.id}
          board={board}
          chapters={chapters}
          item={openItem}
          onPrev={openIndex > 0 ? () => setOpenId(sorted[openIndex - 1].id) : null}
          onNext={openIndex < sorted.length - 1 ? () => setOpenId(sorted[openIndex + 1].id) : null}
          onClose={() => setOpenId(null)}
          onSaved={(saved) => setItems((current) => current.map((item) => (item.id === saved.id ? saved : item)))}
          onDeleted={(id) => {
            setItems((current) => current.filter((item) => item.id !== id));
            setOpenId(null);
            setMessage({ type: "ok", text: "Arquivo excluído." });
          }}
        />
      )}
    </div>
  );
}
