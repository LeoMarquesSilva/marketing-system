"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  PieChart,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { searchKey } from "@/lib/rh/registration/combo-search";
import {
  applyPeopleFilters,
  averageAge,
  countActiveFilters,
  filterLabel,
  NOT_INFORMED,
  PEOPLE_FILTERS,
  peopleFilterOptions,
  profileDistribution,
  STATUS_ORDER,
  type PeopleFilterKey,
  type PeopleFilterSelection,
} from "@/lib/rh/registration/people-filters";
import {
  REGISTRATION_FIELD_LABEL,
  type EmployeeFichaStatus,
  type EmployeeRegistrationRow,
} from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

type SituationFilter = "ativos" | "inativos" | "all";

/** Recortes do "Perfil da equipe" (como nos painéis de diversidade de RH). */
const PROFILE_KEYS: { key: PeopleFilterKey; title: string }[] = [
  { key: "gender", title: "Gênero" },
  { key: "race", title: "Raça/cor" },
  { key: "age", title: "Faixa etária" },
  { key: "tenure", title: "Tempo de casa" },
];

export function isEmployeeFichaStatus(value: string | null): value is EmployeeFichaStatus {
  return !!value && (STATUS_ORDER as string[]).includes(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function percent(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

async function downloadExport(employeeIds: string[], filters: string): Promise<string | null> {
  const response = await fetch("/api/rh/fichas-cadastrais/exportar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeIds, filters }),
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

/** Botão de filtro com menu de múltipla escolha e contagem por opção. */
function FilterMenu({
  filterKey,
  label,
  rows,
  selection,
  onToggle,
  onClear,
}: {
  filterKey: PeopleFilterKey;
  label: string;
  rows: EmployeeRegistrationRow[];
  selection: PeopleFilterSelection;
  onToggle: (key: PeopleFilterKey, value: string) => void;
  onClear: (key: PeopleFilterKey) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = selection[filterKey] ?? [];
  const options = useMemo(() => peopleFilterOptions(filterKey, rows, selection), [filterKey, rows, selection]);
  const searchable = options.length > 8;
  const visible = query
    ? options.filter((option) => searchKey(option.label).includes(searchKey(query)))
    : options;

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs font-medium",
            selected.length > 0 && "border-[#47cdd0] bg-[#e8f8f8] text-[#285f7a] hover:bg-[#dcf4f4]"
          )}
        >
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-[#347796] px-1.5 text-[11px] font-semibold leading-4 text-white tabular-nums">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        {searchable && (
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}`}
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
        <div className="max-h-72 overflow-y-auto" role="group" aria-label={label}>
          {visible.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nada encontrado.</p>}
          {visible.map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={active}
                onClick={() => onToggle(filterKey, option.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    active ? "border-[#347796] bg-[#347796] text-white" : "border-input bg-white"
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
                {filterKey === "area" && option.value !== NOT_INFORMED && (
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded ring-1", getAreaIconStyle(option.value))}>
                    <AreaIcon area={option.value} className="h-3 w-3" />
                  </span>
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    option.value === NOT_INFORMED && "text-muted-foreground",
                    option.count === 0 && !active && "text-muted-foreground"
                  )}
                >
                  {option.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{option.count}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="mt-1 border-t pt-1">
            <button
              type="button"
              onClick={() => onClear(filterKey)}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#285f7a] hover:bg-muted"
            >
              Limpar {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Distribuição do que está filtrado (gênero, raça/cor, faixa etária, tempo de
 * casa). Clicar numa barra filtra a lista por aquele grupo.
 */
function TeamProfile({
  rows,
  selection,
  onToggle,
}: {
  rows: EmployeeRegistrationRow[];
  selection: PeopleFilterSelection;
  onToggle: (key: PeopleFilterKey, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = rows.length;
  const women = rows.filter((row) => row.gender === "feminino").length;
  const blackOrBrown = rows.filter((row) => row.raceColor === "preta" || row.raceColor === "parda").length;
  const genderMissing = rows.filter((row) => !row.gender).length;
  const raceMissing = rows.filter((row) => !row.raceColor).length;
  const age = averageAge(rows);

  const highlights = [
    `${total} ${total === 1 ? "pessoa" : "pessoas"}`,
    age !== null ? `idade média ${age} anos` : null,
    total ? `${percent(women, total)}% mulheres` : null,
    total ? `${percent(blackOrBrown, total)}% pretas ou pardas` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-lg border border-[#dce9eb] bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-md bg-[#e8f8f8] p-1.5 text-[#285f7a]">
            <PieChart className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Perfil da equipe</h3>
            <p className="truncate text-xs text-muted-foreground">{highlights.join(" · ")}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Ocultar" : "Mostrar"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </Button>
      </header>

      {open && (
        <div className="border-t border-[#eef4f5]">
          <div className="grid divide-y divide-[#eef4f5] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
            {PROFILE_KEYS.map(({ key, title }) => {
              const buckets = profileDistribution(key, rows);
              const selected = selection[key] ?? [];
              return (
                <div key={key} className="space-y-2 px-4 py-3.5">
                  <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
                  {buckets.length === 0 && <p className="text-xs text-muted-foreground">Sem pessoas no recorte.</p>}
                  <ul className="space-y-1">
                    {buckets.map((bucket) => {
                      const active = selected.includes(bucket.value);
                      const missing = bucket.value === NOT_INFORMED;
                      return (
                        <li key={bucket.value}>
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => onToggle(key, bucket.value)}
                            title={`Filtrar: ${title} — ${bucket.label}`}
                            className={cn(
                              "group w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/70",
                              active && "bg-[#e8f8f8] hover:bg-[#dcf4f4]"
                            )}
                          >
                            <span className="flex items-baseline justify-between gap-2 text-xs">
                              <span className={cn("truncate", missing ? "text-muted-foreground" : "text-foreground", active && "font-semibold text-[#285f7a]")}>
                                {bucket.label}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {bucket.count} · {bucket.percent}%
                              </span>
                            </span>
                            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                              <span
                                className={cn(
                                  "block h-full rounded-full",
                                  missing ? "bg-slate-300" : active ? "bg-[#347796]" : "bg-[#3e84a8]/70 group-hover:bg-[#3e84a8]"
                                )}
                                style={{ width: `${bucket.percent}%` }}
                              />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          {(genderMissing > 0 || raceMissing > 0) && (
            <p className="border-t border-[#eef4f5] px-4 py-2.5 text-xs text-muted-foreground">
              {[
                genderMissing ? `${genderMissing} sem gênero` : null,
                raceMissing ? `${raceMissing} sem raça/cor` : null,
              ]
                .filter(Boolean)
                .join(" e ")}{" "}
              informados: os percentuais mudam conforme as fichas forem atualizadas.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Todos os colaboradores com a situação da ficha, filtros de perfil (gênero,
 * raça/cor, idade, tempo de casa…) e a planilha do que estiver filtrado.
 */
export function ColaboradoresTab({
  rows,
  initialStatus = "all",
  onOpenEmployee,
}: {
  rows: EmployeeRegistrationRow[];
  /** Filtro vindo do link (ex.: "Ver todas para revisar" no aviso do RH). */
  initialStatus?: "all" | EmployeeFichaStatus;
  /** Linha clicada: abre a ficha enviada (se houver) ou o painel do colaborador. */
  onOpenEmployee: (row: EmployeeRegistrationRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [situation, setSituation] = useState<SituationFilter>("ativos");
  const [selection, setSelection] = useState<PeopleFilterSelection>(
    initialStatus === "all" ? {} : { status: [initialStatus] }
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const scoped = useMemo(
    () => rows.filter((row) => (situation === "all" ? true : situation === "ativos" ? row.isActive : !row.isActive)),
    [rows, situation]
  );

  const searched = useMemo(() => {
    const term = searchKey(search);
    if (!term) return scoped;
    return scoped.filter((row) =>
      [row.fullName, row.email, row.position, row.department]
        .filter(Boolean)
        .some((value) => searchKey(String(value)).includes(term))
    );
  }, [scoped, search]);

  const filtered = useMemo(() => applyPeopleFilters(searched, selection), [searched, selection]);

  const activeCount = countActiveFilters(selection);
  const hasFilters = activeCount > 0 || !!search || situation !== "ativos";
  const emails = filtered.map((row) => row.email).filter((value): value is string => !!value);

  function toggle(key: PeopleFilterKey, value: string) {
    setSelection((current) => {
      const values = current[key] ?? [];
      const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [key]: next };
    });
  }

  function clear(key: PeopleFilterKey) {
    setSelection((current) => ({ ...current, [key]: [] }));
  }

  function clearAll() {
    setSelection({});
    setSearch("");
    setSituation("ativos");
  }

  /** "Gênero: Feminino; Área: Cível" — vai no cabeçalho da planilha. */
  function describeFilters(): string {
    const parts = PEOPLE_FILTERS.filter((def) => selection[def.key]?.length).map(
      (def) => `${def.label}: ${(selection[def.key] ?? []).map((value) => filterLabel(def.key, value)).join(", ")}`
    );
    if (situation !== "ativos") parts.unshift(situation === "inativos" ? "Ex-colaboradores" : "Ativos e ex-colaboradores");
    if (search.trim()) parts.push(`Busca: "${search.trim()}"`);
    return parts.join("; ");
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    const error = await downloadExport(
      filtered.map((row) => row.employeeId),
      describeFilters()
    ).catch(() => "Sem conexão. Tente de novo.");
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
      <div className="space-y-2.5">
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtrar por
          </span>
          {PEOPLE_FILTERS.map((def) => (
            <FilterMenu
              key={def.key}
              filterKey={def.key}
              label={def.label}
              rows={searched}
              selection={selection}
              onToggle={toggle}
              onClear={clear}
            />
          ))}
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {PEOPLE_FILTERS.filter((def) => selection[def.key]?.length).map((def) => (
              <span
                key={def.key}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#bfeaec] bg-[#eefdfe] py-0.5 pl-2.5 pr-1 text-xs text-[#174f58]"
              >
                <span className="truncate">
                  <span className="font-semibold">{def.label}:</span>{" "}
                  {(selection[def.key] ?? []).map((value) => filterLabel(def.key, value)).join(", ")}
                </span>
                <button
                  type="button"
                  onClick={() => clear(def.key)}
                  aria-label={`Remover filtro de ${def.label.toLowerCase()}`}
                  className="rounded-full p-0.5 hover:bg-[#d9f3f4]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={clearAll}>
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <TeamProfile rows={filtered} selection={selection} onToggle={toggle} />

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
                    {rows.length === 0 ? (
                      "Nenhum colaborador no cadastro ainda."
                    ) : (
                      <span className="inline-flex flex-col items-center gap-2">
                        Nenhum colaborador com esses filtros.
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={clearAll}>
                          Limpar filtros
                        </Button>
                      </span>
                    )}
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
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {row.department && (
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1",
                                getAreaIconStyle(row.department)
                              )}
                            >
                              <AreaIcon area={row.department} className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <span className="truncate">
                            {[row.position, row.department].filter(Boolean).join(" · ") || "Sem cargo informado"}
                          </span>
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
        A planilha leva os {filtered.length} colaboradores desta lista, com todos os dados da ficha e os filtros usados
        no cabeçalho. Gênero, raça/cor e dados de saúde são dados sensíveis (LGPD): guarde só onde Pessoas e Cultura tem
        acesso.
      </p>
    </div>
  );
}
