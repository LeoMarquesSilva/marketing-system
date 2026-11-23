"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Copy, Check, Loader2, Download, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Area } from "@/lib/areas";
import type { InstagramAccountStats, InstagramPost } from "@/lib/instagram-posts";
import {
  buildInstagramReport,
  downloadInstagramReportExcel,
  downloadInstagramReportText,
  reportFilenameBase,
  type TeamReportRow,
} from "@/lib/instagram-report";
import type { User } from "@/lib/users";

interface InstagramReportExportProps {
  posts: InstagramPost[];
  areas: Area[];
  users: User[];
  accountStats: InstagramAccountStats | null;
  filterDescription: string;
  focusArea?: string;
  compact?: boolean;
  /** Um botão "Exportar" com as opções (Excel, texto, ver escrito) num menu. */
  menu?: boolean;
  dialogTitle?: string;
  /** Título do relatório gerado (planilha e texto). */
  reportTitle?: string;
  /** Integrantes da equipe; habilita a aba Equipe mesmo sem posts. */
  team?: TeamReportRow[];
  filenameBase?: string;
  excelLabel?: string;
}

export function InstagramReportExport({
  posts,
  areas,
  users,
  accountStats,
  filterDescription,
  focusArea,
  compact = false,
  menu = false,
  dialogTitle,
  reportTitle,
  team,
  filenameBase: filenameBaseOverride,
  excelLabel = "Relatório da área",
}: InstagramReportExportProps) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const report = useMemo(
    () =>
      buildInstagramReport({
        posts,
        areas,
        users,
        accountStats,
        filterDescription,
        focusArea,
        title: reportTitle,
        team,
      }),
    [posts, areas, users, accountStats, filterDescription, focusArea, reportTitle, team]
  );

  const filenameBase = useMemo(
    () => filenameBaseOverride ?? reportFilenameBase(report, focusArea),
    [filenameBaseOverride, report, focusArea]
  );
  const disabled = posts.length === 0 && !team?.length;

  const handleExcel = async () => {
    if (disabled) return;
    setExportingExcel(true);
    try {
      await downloadInstagramReportExcel(report, { filenameBase });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const title =
    dialogTitle ??
    (focusArea ? `Relatório — ${focusArea}` : "Relatório Instagram por área");

  if (menu) {
    return (
      <>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled}>
              <Download className="size-4" aria-hidden />
              Exportar
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            <button type="button" onClick={handleExcel} disabled={exportingExcel} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#47cdd0]/10">
              {exportingExcel ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4 text-[#347796]" aria-hidden />}
              Planilha (Excel)
            </button>
            <button type="button" onClick={() => downloadInstagramReportText(report, { filenameBase })} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#47cdd0]/10">
              <FileText className="size-4 text-[#347796]" aria-hidden />
              Relatório em texto (.txt)
            </button>
            <button type="button" onClick={() => setDialogOpen(true)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#47cdd0]/10">
              <Copy className="size-4 text-[#347796]" aria-hidden />
              Ver e copiar o texto
            </button>
          </PopoverContent>
        </Popover>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {report.totalPosts} posts · gerado em {new Date(report.generatedAt).toLocaleString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <pre className="flex-1 overflow-auto rounded-md border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {report.narrative}
            </pre>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="rounded-xl bg-[#04202f] text-white hover:bg-[#04202f]/90 hover:text-white"
          disabled={disabled || exportingExcel}
          onClick={handleExcel}
        >
          {exportingExcel ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 mr-2" />
          )}
          {excelLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={disabled}
          onClick={() => downloadInstagramReportText(report, { filenameBase })}
        >
          <FileText className="h-4 w-4 mr-2" />
          .txt
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-xl" disabled={disabled}>
              Ver escrito
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {report.totalPosts} posts · gerado em{" "}
                {new Date(report.generatedAt).toLocaleString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
              <Button size="sm" onClick={handleExcel} disabled={exportingExcel}>
                Excel
              </Button>
            </div>
            <pre className="flex-1 overflow-auto rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {report.narrative}
            </pre>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={disabled || exportingExcel}
        onClick={handleExcel}
      >
        {exportingExcel ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        Exportar Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={disabled}
        onClick={() => downloadInstagramReportText(report, { filenameBase })}
      >
        <FileText className="h-4 w-4 mr-2" />
        Baixar relatório (.txt)
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={disabled}>
            <FileText className="h-4 w-4 mr-2" />
            Ver relatório escrito
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {report.totalPosts} posts · {report.areaRows.length} áreas · gerado em{" "}
              {new Date(report.generatedAt).toLocaleString("pt-BR")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? "Copiado!" : "Copiar texto"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadInstagramReportText(report, { filenameBase })}
            >
              Baixar .txt
            </Button>
            <Button size="sm" onClick={handleExcel} disabled={exportingExcel}>
              {exportingExcel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Excel
            </Button>
          </div>

          <pre className="flex-1 overflow-auto rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono">
            {report.narrative}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
