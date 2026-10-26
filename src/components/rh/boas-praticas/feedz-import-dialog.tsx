"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  SearchCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  feedzManager,
  matchFeedzRows,
  parseFeedzSheet,
  type FeedzChange,
  type FeedzMatch,
  type FeedzRow,
} from "@/lib/rh/boas-praticas/feedz";
import type { FeedbackPerson, FeedzImportLog, GoodPracticeFeedback } from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { formatDate } from "./feedback-badges";
import { CategoryGlyph, PersonAvatar, useFeedbackPeople } from "./feedback-visuals";

const NO_LINK = "nao-ligar";

function dateTime(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

function ChangeBadge({ match, feedback }: { match: FeedzMatch; feedback: GoodPracticeFeedback | null }) {
  const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
  const change: FeedzChange | null = match.change;
  if (match.keptViewed) {
    return <span className={cn(base, "bg-slate-50 text-slate-600 ring-slate-200")}>Mantém visto</span>;
  }
  if (!change) {
    return (
      <span className={cn(base, "bg-slate-50 text-slate-600 ring-slate-200")}>
        <CircleCheck className="size-3" aria-hidden />
        Já está igual
      </span>
    );
  }
  const before = feedback?.viewed === true ? "Visto" : feedback?.viewed === false ? "Não visto" : "Sem dado";
  return change.viewed ? (
    <span className={cn(base, "bg-emerald-50 text-emerald-800 ring-emerald-200")}>
      <Eye className="size-3" aria-hidden />
      {before} → visto em {formatDate(change.viewedOn)}
    </span>
  ) : (
    <span className={cn(base, "bg-amber-50 text-amber-800 ring-amber-200")}>
      <EyeOff className="size-3" aria-hidden />
      {before} → não visto
    </span>
  );
}

function RecordSummary({ feedback }: { feedback: GoodPracticeFeedback }) {
  const { employee } = useFeedbackPeople(feedback);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar name={employee.name} person={employee.person} isTeam={employee.isTeam} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{employee.name}</span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <CategoryGlyph category={feedback.category} className="size-3 shrink-0 text-[#285f7a]" />
          <span className="truncate">{feedback.description}</span>
        </span>
      </span>
    </span>
  );
}

function FeedzSide({ row, people }: { row: FeedzRow; people: FeedbackPerson[] }) {
  const manager = feedzManager(row.to, people);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar name={manager?.short_name ?? row.to} person={manager} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">
          Para <span className="font-medium">{manager?.short_name ?? row.to}</span>
        </span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          enviado {dateTime(row.sentAt)} · {row.viewedAt ? `visto ${dateTime(row.viewedAt)}` : "não visto"}
        </span>
      </span>
    </span>
  );
}

export function FeedzImportDialog({
  items,
  people,
  onClose,
  onApplied,
}: {
  items: GoodPracticeFeedback[];
  people: FeedbackPerson[];
  onClose: () => void;
  onApplied: (result: { items: GoodPracticeFeedback[]; log: FeedzImportLog; unmatched: FeedzRow[] }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [matches, setMatches] = useState<FeedzMatch[] | null>(null);
  // Linha → registro escolhido (NO_LINK = não ligar).
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  async function readFile(file: File) {
    setReading(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
      const parsed = parseFeedzSheet(matrix);
      if (parsed.error) throw new Error(parsed.error);
      const found = matchFeedzRows(parsed.rows, items, people);
      setFileName(file.name);
      setMatches(found);
      setChoice(Object.fromEntries(found.map((match) => [match.row.line, match.feedbackId ?? NO_LINK])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo.");
    } finally {
      setReading(false);
    }
  }

  const selected = useMemo(() => {
    if (!matches) return [];
    return matches.filter((match) => choice[match.row.line] && choice[match.row.line] !== NO_LINK);
  }, [matches, choice]);

  // Mudança recalculada quando o RH troca o registro de uma linha.
  const effective = useMemo(() => {
    if (!matches) return [];
    return matches.map((match) => {
      const picked = choice[match.row.line];
      if (!picked || picked === NO_LINK || picked === match.feedbackId) return match;
      const target = byId.get(picked);
      if (!target) return match;
      const viewedOn = match.row.viewedAt?.slice(0, 10) ?? null;
      const change: FeedzChange | null = match.row.viewedAt
        ? target.viewed === true && target.viewed_on === viewedOn
          ? null
          : { viewed: true, viewedOn }
        : target.viewed === null
          ? { viewed: false, viewedOn: null }
          : null;
      return { ...match, feedbackId: picked, change, keptViewed: !match.row.viewedAt && target.viewed === true };
    });
  }, [matches, choice, byId]);

  const duplicateTargets = useMemo(() => {
    const seen = new Map<string, number>();
    for (const match of selected) seen.set(choice[match.row.line], (seen.get(choice[match.row.line]) ?? 0) + 1);
    return new Set([...seen].filter(([, count]) => count > 1).map(([id]) => id));
  }, [selected, choice]);

  const counts = useMemo(() => {
    const linked = effective.filter((match) => choice[match.row.line] && choice[match.row.line] !== NO_LINK);
    return {
      total: effective.length,
      changes: linked.filter((match) => match.change).length,
      check: effective.filter((match) => match.status === "confira").length,
      unmatched: effective.filter((match) => !choice[match.row.line] || choice[match.row.line] === NO_LINK).length,
      linked: linked.length,
    };
  }, [effective, choice]);

  async function apply() {
    if (!matches || !fileName) return;
    if (duplicateTargets.size) {
      setError("Duas linhas estão apontando para o mesmo registro. Escolha outro em uma delas ou marque “Não ligar”.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const links = effective
        .filter((match) => choice[match.row.line] && choice[match.row.line] !== NO_LINK)
        .map((match) => ({
          feedback_id: choice[match.row.line],
          key: match.row.key,
          sent_at: match.row.sentAt,
          viewed_at: match.row.viewedAt,
          message: match.row.message,
        }));
      const response = await fetch("/api/rh/boas-praticas/feedz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: fileName, rows_total: matches.length, rows_unmatched: counts.unmatched, links }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        items?: GoodPracticeFeedback[];
        log?: FeedzImportLog;
        error?: string;
      };
      if (!response.ok || !data.items || !data.log) throw new Error(data.error ?? "Não foi possível importar.");
      const unmatched = effective
        .filter((match) => !choice[match.row.line] || choice[match.row.line] === NO_LINK)
        .map((match) => match.row);
      onApplied({ items: data.items, log: data.log, unmatched });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar.");
    } finally {
      setSaving(false);
    }
  }

  const ordered = [...effective].sort((a, b) => {
    const rank = (match: FeedzMatch) =>
      match.status === "confira" ? 0 : choice[match.row.line] === NO_LINK ? 3 : match.change ? 1 : 2;
    return rank(a) - rank(b) || a.row.sentAt.localeCompare(b.row.sentAt);
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl" showCloseButton={!saving}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">Importar relatório do Feedz</DialogTitle>
          <DialogDescription>
            Atualiza a visualização dos feedbacks enviados aos gestores. Você confere cada linha antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!matches ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void readFile(file);
                }}
                disabled={reading}
                className={cn(
                  "flex w-full flex-col items-center gap-3 rounded-md border border-dashed px-6 py-12 text-center transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                  dragging ? "border-[#47cdd0] bg-[#e8f8f8]" : "border-[#3e84a8]/35 bg-[#fafcfc] hover:bg-[#f2f8f9]"
                )}
              >
                <span className="grid size-12 place-items-center rounded-full bg-[#e8f8f8] text-[#285f7a]">
                  {reading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-5" aria-hidden />}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {reading ? "Lendo o relatório…" : "Escolha ou arraste o relatório de feedbacks do Feedz"}
                </span>
                <span className="max-w-md text-xs text-muted-foreground">
                  Arquivo .xlsx exportado do Feedz, com as colunas De, Para, Feedback, Data e Data de Visualização do Feedback.
                  Nada é gravado antes da sua confirmação.
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-[#fafcfc] px-4 py-3 text-sm ring-1 ring-inset ring-[#e6eef0]">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <FileSpreadsheet className="size-4 text-[#3e84a8]" aria-hidden />
                  {fileName}
                </span>
                <span className="text-muted-foreground">
                  {counts.total} {counts.total === 1 ? "linha" : "linhas"} · {counts.linked} para ligar ·{" "}
                  <span className="font-medium text-foreground">{counts.changes} mudam a visualização</span>
                  {counts.check ? ` · ${counts.check} para conferir` : ""}
                  {counts.unmatched ? ` · ${counts.unmatched} sem registro` : ""}
                </span>
                <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" disabled={saving} onClick={() => setMatches(null)}>
                  Trocar arquivo
                </Button>
              </div>

              <ul className="divide-y divide-[#eef3f5] rounded-md ring-1 ring-inset ring-[#e6eef0]">
                {ordered.map((match) => {
                  const picked = choice[match.row.line];
                  const target = picked && picked !== NO_LINK ? byId.get(picked) ?? null : null;
                  // Opções = o que o cruzamento achou para a linha (não muda quando o RH troca a escolha).
                  const original = matches.find((entry) => entry.row.line === match.row.line) ?? match;
                  const options = [original.feedbackId, ...original.alternatives].filter(
                    (id, index, list): id is string => !!id && list.indexOf(id) === index
                  );
                  const duplicate = target ? duplicateTargets.has(target.id) : false;
                  return (
                    <li key={match.row.line} className={cn("space-y-2.5 px-4 py-3", match.status === "confira" && "bg-amber-50/40")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">Linha {match.row.line}</span>
                          {match.status === "confira" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                              <TriangleAlert className="size-3" aria-hidden />
                              Confira o registro
                            </span>
                          )}
                          {match.status === "ligado" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8f8] px-2 py-0.5 font-medium text-[#285f7a]">
                              <SearchCheck className="size-3" aria-hidden />
                              Já ligado antes
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          {target ? (
                            <ChangeBadge match={match} feedback={target} />
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                              <CircleDashed className="size-3" aria-hidden />
                              {match.status === "sem_registro" ? "Sem registro no módulo" : "Não será ligada"}
                            </span>
                          )}
                          {original.feedbackId && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                setChoice((current) => ({
                                  ...current,
                                  [match.row.line]: target ? NO_LINK : (original.feedbackId as string),
                                }))
                              }
                              className="text-xs font-medium text-[#285f7a] hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                              {target ? "Não ligar" : "Ligar de novo"}
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)]">
                        <FeedzSide row={match.row} people={people} />
                        <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                        {options.length > 1 || match.status === "confira" ? (
                          <Select
                            value={picked ?? NO_LINK}
                            onValueChange={(value) => setChoice((current) => ({ ...current, [match.row.line]: value }))}
                          >
                            <SelectTrigger className={cn("h-auto min-h-11 w-full py-1.5 text-left", duplicate && "border-red-300")} aria-label={`Registro da linha ${match.row.line}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((id) => {
                                const option = byId.get(id);
                                return option ? (
                                  <SelectItem key={id} value={id}>
                                    <RecordSummary feedback={option} />
                                  </SelectItem>
                                ) : null;
                              })}
                              <SelectItem value={NO_LINK}>Não ligar esta linha</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : target ? (
                          <RecordSummary feedback={target} />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Nenhum registro com esse gestor e essa data. Depois de importar, dá para registrar a partir desta linha.
                          </span>
                        )}
                      </div>
                      {duplicate && <p className="text-xs text-red-700">Outra linha também aponta para este registro.</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" className="gap-2" disabled={!matches || saving || !counts.linked} onClick={() => void apply()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {matches ? `Importar ${counts.linked} ${counts.linked === 1 ? "linha" : "linhas"}` : "Importar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
