"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Copy, Check, Loader2 } from "lucide-react";
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
  dialogTitle?: string;
}

export function InstagramReportExport({
  posts,
  areas,
  users,
  accountStats,
  filterDescription,
  focusArea,
  compact = false,
  dialogTitle,
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
      }),
    [posts, areas, users, accountStats, filterDescription, focusArea]
  );

  const filenameBase = useMemo(
    () => reportFilenameBase(report, focusArea),
    [report, focusArea]
  );

  const handleExcel = async () => {
    if (posts.length === 0) return;
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

  const disabled = posts.length === 0;
  const title =
    dialogTitle ??
    (focusArea ? `Relatório — ${focusArea}` : "Relatório Instagram por área");

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="rounded-xl bg-[#101f2e] hover:bg-[#101f2e]/90"
          disabled={disabled || exportingExcel}
          onClick={handleExcel}
        >
          {exportingExcel ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 mr-2" />
          )}
          Relatório da área
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
