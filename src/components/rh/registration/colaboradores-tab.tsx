"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Download, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { EmployeeFichaBadge, FichaProgress } from "@/components/rh/registration/employee-ficha-badge";
import { searchKey } from "@/lib/rh/registration/combo-search";
import {
  EMPLOYEE_FICHA_STATUS_LABEL,
  REGISTRATION_FIELD_LABEL,
  type EmployeeFichaStatus,
  type EmployeeRegistrationRow,
} from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | EmployeeFichaStatus;
type SituationFilter = "ativos" | "inativos" | "all";
type FillFilter = "all" | "completa" | "pendente";

const STATUS_ORDER: EmployeeFichaStatus[] = ["sem_envio", "aguardando", "devolvida", "para_revisar", "aprovada"];

const FILL_LABEL: Record<FillFilter, string> = {
  all: "Todo preenchimento",
  completa: "Completas",
  pendente: "Com pendências",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function isComplete(row: EmployeeRegistrationRow): boolean {
  return row.missingFields.length === 0;
}

async function downloadExport(employeeIds: string[]): Promise<string | null> {
  const response = await fetch("/api/rh/fichas-cadastrais/exportar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeIds }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return data.error ?? "Não foi possível gerar a planilha.";
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "fichas-cadastrais.xlsx";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

/**
 * Todos os colaboradores com a situação da ficha: quem não enviou, quem está
 * em revisão, o que falta. É também onde o RH exporta os dados cadastrais.
 */
export function isEmployeeFichaStatus(value: string | null): value is EmployeeFichaStatus {
  return !!value && (STATUS_ORDER as string[]).includes(value);
}

export function ColaboradoresTab({
  rows,
  initialStatus = "all",
  onOpenEmployee,
}: {
  rows: EmployeeRegistrationRow[];
  /** Filtro vindo do link (ex.: "Ver todas para revisar" no aviso do RH). */
  initialStatus?: StatusFilter;
  /** Linha clicada: abre a ficha enviada (se houver) ou o painel do colaborador. */
  onOpenEmployee: (row: EmployeeRegistrationRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [situation, setSituation] = useState<SituationFilter>("ativos");
  const [fill, setFill] = useState<FillFilter>("all");
  const [vinculo, setVinculo] = useState("all");
  const [area, setArea] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const bySituation = useMemo(
    () =>
      rows.filter((row) =>
        situation === "all" ? true : situation === "ativos" ? row.isActive : !row.isActive
      ),
    [rows, situation]
  );

  const vinculos = useMemo(
    () => [...new Set(bySituation.map((row) => row.vinculoLabel))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [bySituation]
  );
  const areas = useMemo(
    () =>
      [...new Set(bySituation.map((row) => row.department).filter((value): value is string => !!value))].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [bySituation]
  );

  const filtered = useMemo(() => {
    const term = searchKey(search);
    return bySituation.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (fill === "completa" && !isComplete(row)) return false;
      if (fill === "pendente" && isComplete(row)) return false;
      if (vinculo !== "all" && row.vinculoLabel !== vinculo) return false;
      if (area !== "all" && row.department !== area) return false;
      if (!term) return true;
      return [row.fullName, row.email, row.position, row.department]
        .filter(Boolean)
        .some((value) => searchKey(String(value)).includes(term));
    });
  }, [bySituation, status, fill, vinculo, area, search]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((key) => [key, 0])) as Record<EmployeeFichaStatus, number>;
    for (const row of bySituation) counts[row.status] += 1;
    return counts;
  }, [bySituation]);

  const hasFilters =
    !!search || status !== "all" || situation !== "ativos" || fill !== "all" || vinculo !== "all" || area !== "all";
  const emails = filtered.map((row) => row.email).filter((value): value is string => !!value);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    const error = await downloadExport(filtered.map((row) => row.employeeId)).catch(
      () => "Sem conexão. Tente de novo."
    );
    setExporting(false);
    setExportError(error);
  }

  async function copyEmails() {
    try {
      await navigator.clipboard.writeText(emails.join("; "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail, área ou cargo…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger className="h-9 w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ficha: todas</SelectItem>
              {STATUS_ORDER.map((key) => (
                <SelectItem key={key} value={key}>
                  {EMPLOYEE_FICHA_STATUS_LABEL[key]} ({statusCounts[key]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={situation} onValueChange={(value) => setSituation(value as SituationFilter)}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Ex-colaboradores</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setSituation("ativos");
                setFill("all");
                setVinculo("all");
                setArea("all");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              disabled={emails.length === 0}
              onClick={() => void copyEmails()}
              title="E-mails corporativos de quem está na lista, separados por ponto e vírgula (para colar no Outlook)"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "E-mails copiados" : `Copiar e-mails (${emails.length})`}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              disabled={exporting || filtered.length === 0}
              onClick={() => void handleExport()}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Exportar planilha ({filtered.length})
            </Button>
          </div>
        </div>
        {exportError && <p className="text-sm text-destructive">{exportError}</p>}

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILL_LABEL) as FillFilter[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={fill === key ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setFill(key)}
            >
              {FILL_LABEL[key]}
            </Button>
          ))}
        </div>

        {vinculos.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={vinculo === "all" ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setVinculo("all")}
            >
              Todos os vínculos
            </Button>
            {vinculos.map((label) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={vinculo === label ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setVinculo(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}

        {areas.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={area === "all" ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setArea("all")}
            >
              Todas as áreas
            </Button>
            {areas.map((label) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={area === label ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setArea(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[860px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Colaborador</TableHead>
                <TableHead className="w-[15%]">Vínculo</TableHead>
                <TableHead className="w-[16%]">Ficha</TableHead>
                <TableHead className="w-[17%]">Preenchimento</TableHead>
                <TableHead className="w-[12%]">Último envio</TableHead>
                <TableHead className="w-[10%]">
                  <span className="sr-only">Abrir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {rows.length === 0
                      ? "Nenhum colaborador no cadastro ainda."
                      : "Nenhum colaborador encontrado com esses filtros."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((row) => (
                <TableRow
                  key={row.employeeId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEmployee(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenEmployee(row);
                    }
                  }}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/40",
                    !row.isActive && "bg-muted/20 opacity-70"
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={row.fullName} avatarUrl={row.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{row.fullName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[row.position, row.department].filter(Boolean).join(" · ") || "Sem cargo informado"}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground">{row.vinculoLabel}</TableCell>
                  <TableCell>
                    <EmployeeFichaBadge status={row.status} />
                  </TableCell>
                  <TableCell
                    title={
                      row.missingFields.length
                        ? `Falta: ${row.missingFields.map((field) => REGISTRATION_FIELD_LABEL[field]).join(", ")}`
                        : undefined
                    }
                  >
                    <FichaProgress filled={row.filledCount} required={row.requiredCount} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatDate(row.submittedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#285f7a]">
                      {row.status === "para_revisar" ? "Revisar" : "Ver ficha"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A planilha leva os {filtered.length} colaboradores desta lista, com todos os dados da ficha. Ela contém dados
        pessoais e bancários: guarde só onde Pessoas e Cultura tem acesso.
      </p>
    </div>
  );
}
