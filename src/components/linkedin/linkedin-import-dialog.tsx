"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  Clock3,
  CopyCheck,
  Eye,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Newspaper,
  Swords,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInt } from "@/lib/social-metrics/format";
import { daysInclusive, formatFullDate, todayInSaoPaulo } from "@/lib/social-metrics/period";
import type { LinkedinReportFreshness } from "@/lib/social-metrics/server";
import type { LinkedinReportType } from "@/lib/linkedin-types";

/** Depois disso o relatório é considerado desatualizado (importação mensal). */
export const LINKEDIN_STALE_DAYS = 35;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const LINKEDIN_REPORT_META: Record<LinkedinReportType, { label: string; icon: LucideIcon; what: string }> = {
  content: { label: "Conteúdo", icon: Newspaper, what: "impressões, cliques e publicações" },
  followers: { label: "Seguidores", icon: UserPlus, what: "novos seguidores e perfil de quem segue" },
  visitors: { label: "Visitantes", icon: Eye, what: "visitas à página e perfil de quem visita" },
  competitors: { label: "Concorrentes", icon: Swords, what: "comparativo com outros escritórios" },
};

export function linkedinReportType(value: string | null | undefined): LinkedinReportType {
  return value === "followers" || value === "visitors" || value === "competitors" ? value : "content";
}

/** "01/10/2026 14:32" no horário de São Paulo (importações atravessam anos). */
export function formatImportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

/** Dias desde o último dia com dado (0 = hoje). */
export function daysSince(date: string | null, today: string): number | null {
  if (!date) return null;
  return Math.max(0, daysInclusive(date, today) - 1);
}

/* ------------------------------------------------------------ situação dos 4 relatórios */

export function LinkedinReportsStatus({ reports, className }: { reports: LinkedinReportFreshness[]; className?: string }) {
  const [today] = React.useState(() => todayInSaoPaulo());
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {reports.map((report) => {
        const type = linkedinReportType(report.reportType);
        const meta = LINKEDIN_REPORT_META[type];
        const Icon = meta.icon;
        const age = daysSince(report.dataUntil, today);
        const tone = !report.importedAt ? "danger" : age !== null && age > LINKEDIN_STALE_DAYS ? "warning" : "ok";
        return (
          <li key={report.reportType} className="flex min-w-0 items-start gap-3 rounded-md border border-[#dce9eb] bg-white px-3 py-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between gap-2 text-sm font-semibold text-[#10232d]">
                {report.label || meta.label}
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    tone === "ok" && "bg-emerald-50 text-emerald-800",
                    tone === "warning" && "bg-amber-50 text-amber-900",
                    tone === "danger" && "bg-rose-50 text-rose-800"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      tone === "ok" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-rose-500"
                    )}
                    aria-hidden
                  />
                  {tone === "danger" ? "Nunca importado" : tone === "warning" ? `${age} dias sem dado` : "Em dia"}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.what}</p>
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Importado em</dt>
                  <dd className="font-medium text-[#10232d]">{report.importedAt ? formatImportDate(report.importedAt) : "—"}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Dados até</dt>
                  <dd className="font-medium text-[#10232d]">{report.dataUntil ? formatFullDate(report.dataUntil) : "—"}</dd>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------ fila de arquivos */

interface ImportResult {
  duplicate: boolean;
  reportType: LinkedinReportType;
  dailyRows: number;
  postRows: number;
  demographicRows: number;
  competitorRows: number;
  matchedPosts: number;
  warnings: string[];
}

type ItemStatus = "aguardando" | "enviando" | "importado" | "repetido" | "erro";

interface ImportItem {
  id: number;
  file: File | null;
  name: string;
  size: number;
  status: ItemStatus;
  result?: ImportResult;
  error?: string;
}

export interface LinkedinImportSummary {
  imported: number;
  duplicates: number;
  failed: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function resultText(result: ImportResult): string {
  const parts = [LINKEDIN_REPORT_META[result.reportType].label];
  if (result.dailyRows > 0) parts.push(`${formatInt(result.dailyRows)} dias`);
  if (result.postRows > 0) parts.push(`${formatInt(result.postRows)} publicações (${formatInt(result.matchedPosts)} com capa do Instagram)`);
  if (result.demographicRows > 0) parts.push(`${formatInt(result.demographicRows)} recortes de público`);
  if (result.competitorRows > 0) parts.push(`${formatInt(result.competitorRows)} páginas`);
  return parts.join(" · ");
}

const STATUS_STYLE: Record<ItemStatus, { icon: LucideIcon; className: string; label: string }> = {
  aguardando: { icon: Clock3, className: "text-[#7f97a1]", label: "Na fila" },
  enviando: { icon: Loader2, className: "animate-spin text-[#347796]", label: "Enviando e lendo a planilha…" },
  importado: { icon: CircleCheck, className: "text-emerald-600", label: "Importado" },
  repetido: { icon: CopyCheck, className: "text-[#3e84a8]", label: "Já estava importado" },
  erro: { icon: CircleX, className: "text-rose-600", label: "Não importado" },
};

export function LinkedinImportDialog({
  open,
  onOpenChange,
  reports,
  disabledReason,
  onBusyChange,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: LinkedinReportFreshness[];
  disabledReason?: string | null;
  onBusyChange?: (busy: { done: number; total: number } | null) => void;
  onFinished?: (summary: LinkedinImportSummary) => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<ImportItem[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const queueRef = React.useRef<ImportItem[]>([]);
  const runningRef = React.useRef(false);
  const nextId = React.useRef(1);
  const batchRef = React.useRef<LinkedinImportSummary & { total: number }>({ imported: 0, duplicates: 0, failed: 0, total: 0 });

  const update = React.useCallback((id: number, patch: Partial<ImportItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const reportProgress = React.useCallback(() => {
    const batch = batchRef.current;
    onBusyChange?.({ done: batch.imported + batch.duplicates + batch.failed, total: batch.total });
  }, [onBusyChange]);

  const drain = React.useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    reportProgress();
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift() as ImportItem;
      update(item.id, { status: "enviando" });
      try {
        const formData = new FormData();
        formData.append("file", item.file as File);
        const response = await fetch("/api/linkedin-insights/import", { method: "POST", body: formData });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Não foi possível importar a planilha.");
        const result: ImportResult = {
          duplicate: Boolean(json.duplicate),
          reportType: linkedinReportType(json.reportType),
          dailyRows: Number(json.dailyRows ?? 0),
          postRows: Number(json.postRows ?? 0),
          demographicRows: Number(json.demographicRows ?? 0),
          competitorRows: Number(json.competitorRows ?? 0),
          matchedPosts: Number(json.matchedPosts ?? 0),
          warnings: Array.isArray(json.warnings) ? json.warnings : [],
        };
        update(item.id, { status: result.duplicate ? "repetido" : "importado", result, file: null });
        if (result.duplicate) batchRef.current.duplicates += 1;
        else batchRef.current.imported += 1;
      } catch (error) {
        update(item.id, { status: "erro", error: error instanceof Error ? error.message : "Erro ao importar.", file: null });
        batchRef.current.failed += 1;
      }
      reportProgress();
    }
    runningRef.current = false;
    setBusy(false);
    const { imported, duplicates, failed } = batchRef.current;
    batchRef.current = { imported: 0, duplicates: 0, failed: 0, total: 0 };
    onBusyChange?.(null);
    onFinished?.({ imported, duplicates, failed });
    if (imported > 0) router.refresh();
  }, [onBusyChange, onFinished, reportProgress, router, update]);

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    const added: ImportItem[] = files.map((file) => {
      const id = nextId.current++;
      if (!/\.xlsx?$/i.test(file.name)) {
        return { id, file: null, name: file.name, size: file.size, status: "erro", error: "Envie a planilha exportada do LinkedIn (.xls ou .xlsx)." };
      }
      if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        return { id, file: null, name: file.name, size: file.size, status: "erro", error: "O arquivo deve ter no máximo 10 MB." };
      }
      return { id, file, name: file.name, size: file.size, status: "aguardando" };
    });
    const valid = added.filter((item) => item.status === "aguardando");
    setItems((prev) => [...prev, ...added]);
    if (valid.length > 0) {
      queueRef.current.push(...valid);
      batchRef.current.total += valid.length;
      void drain();
    }
  };

  const disabled = Boolean(disabledReason);
  const finished = items.filter((item) => item.status !== "aguardando" && item.status !== "enviando").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#dce9eb] px-6 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-[#347796]" aria-hidden />
            Importar planilhas do LinkedIn
          </DialogTitle>
          <DialogDescription>
            Na página da empresa no LinkedIn, em Análises, abra Conteúdo, Seguidores, Visitantes e Concorrentes e use Exportar em cada um. O
            sistema reconhece sozinho o tipo de cada planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {disabledReason && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">{disabledReason}</p>
          )}

          <div
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!disabled) addFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
              dragging ? "border-[#347796] bg-[#eef6f8]" : "border-[#c8dde2] bg-[#fbfdfd]",
              disabled && "opacity-60"
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-[#eef6f8] text-[#347796]">
              <FileUp className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-[#10232d]">{dragging ? "Solte para importar" : "Arraste as planilhas para cá"}</p>
            <p className="text-xs text-muted-foreground">Pode soltar os 4 relatórios de uma vez. Arquivos .xls ou .xlsx de até 10 MB.</p>
            <Button type="button" variant="outline" size="sm" className="mt-1" disabled={disabled} onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet className="size-4" aria-hidden />
              Escolher arquivos
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              tabIndex={-1}
              aria-hidden
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {items.length > 0 && (
            <section aria-live="polite" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#4a6470]">
                  {busy ? `Importando: ${finished} de ${items.length} arquivo(s) prontos` : `${items.length} arquivo(s) nesta importação`}
                </p>
                {!busy && (
                  <button type="button" onClick={() => setItems([])} className="text-xs font-medium text-[#347796] hover:underline">
                    Limpar lista
                  </button>
                )}
              </div>
              {busy && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[#eef3f5]" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={finished}>
                  <div className="h-full rounded-full bg-[#347796] transition-all" style={{ width: `${Math.max(6, (finished / items.length) * 100)}%` }} />
                </div>
              )}
              <ul className="divide-y divide-[#edf3f5] rounded-md border border-[#dce9eb]">
                {items.map((item) => {
                  const style = STATUS_STYLE[item.status];
                  const StatusIcon = style.icon;
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                      <StatusIcon className={cn("mt-0.5 size-4 shrink-0", style.className)} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-[#10232d]" title={item.name}>{item.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatSize(item.size)}</span>
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            item.status === "erro" ? "text-rose-700" : item.status === "importado" ? "text-emerald-800" : "text-[#4a6470]"
                          )}
                        >
                          {item.status === "erro"
                            ? item.error
                            : item.result
                              ? `${style.label}: ${resultText(item.result)}`
                              : style.label}
                        </p>
                        {item.result?.warnings.map((warning) => (
                          <p key={warning} className="mt-0.5 text-xs text-[#8a5a12]">{warning}</p>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-xs font-semibold text-[#4a6470]">Os 4 relatórios da página</p>
            <LinkedinReportsStatus reports={reports} />
            <p className="text-xs text-muted-foreground">
              Exporte sempre o período desde a última importação. Dias repetidos são substituídos, não somados.
            </p>
          </section>
        </div>

        <DialogFooter className="border-t border-[#dce9eb] px-6 py-3">
          <Button type="button" variant={busy ? "outline" : "default"} onClick={() => onOpenChange(false)}>
            {busy ? "Continuar em segundo plano" : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
