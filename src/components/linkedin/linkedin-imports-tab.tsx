"use client";

import { FileSpreadsheet, FileUp, History, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { LINKEDIN_REPORT_META, LinkedinReportsStatus, formatImportDate, linkedinReportType } from "@/components/linkedin/linkedin-import-dialog";
import type { LinkedinMetricsUser } from "@/components/linkedin/linkedin-post-pieces";
import { formatInt } from "@/lib/social-metrics/format";
import { formatFullDate } from "@/lib/social-metrics/period";
import type { LinkedinReportFreshness } from "@/lib/social-metrics/server";
import type { LinkedinImportRecord } from "@/lib/linkedin-types";

const STATUS = {
  completed: { label: "Concluída", className: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  failed: { label: "Falhou", className: "bg-rose-50 text-rose-800", dot: "bg-rose-500" },
  processing: { label: "Processando", className: "bg-amber-50 text-amber-900", dot: "bg-amber-500" },
} as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function rowsText(item: LinkedinImportRecord): string {
  const parts: string[] = [];
  if (item.daily_rows > 0) parts.push(`${formatInt(item.daily_rows)} dias`);
  if (item.post_rows > 0) parts.push(`${formatInt(item.post_rows)} publicações`);
  if (item.demographic_rows > 0) parts.push(`${formatInt(item.demographic_rows)} recortes de público`);
  if (item.competitor_rows > 0) parts.push(`${formatInt(item.competitor_rows)} páginas`);
  return parts.join(" · ") || "Sem linhas";
}

export function LinkedinImportsTab({
  imports,
  reports,
  users,
  onImport,
}: {
  imports: LinkedinImportRecord[];
  reports: LinkedinReportFreshness[];
  users: LinkedinMetricsUser[];
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <MetricsSection
        title="Situação dos relatórios"
        icon={FileSpreadsheet}
        description="O LinkedIn não tem coleta automática: as planilhas são exportadas da página e importadas aqui, de preferência uma vez por mês."
        action={
          <Button size="sm" onClick={onImport}>
            <FileUp className="size-4" aria-hidden />
            Importar planilhas
          </Button>
        }
      >
        <LinkedinReportsStatus reports={reports} className="xl:grid-cols-4" />
      </MetricsSection>

      <MetricsSection title="Histórico de importações" icon={History} description={`Últimas ${imports.length} planilhas importadas, da mais nova para a mais antiga.`}>
        {imports.length === 0 ? (
          <MetricsEmpty icon={History} title="Nenhuma planilha importada" />
        ) : (
          <ul className="-mx-2 divide-y divide-[#edf3f5]">
            {imports.map((item) => {
              const type = linkedinReportType(item.report_type);
              const meta = LINKEDIN_REPORT_META[type];
              const Icon = meta.icon;
              const status = STATUS[item.status] ?? STATUS.processing;
              const user = item.imported_by ? users.find((person) => person.auth_id === item.imported_by || person.id === item.imported_by) : undefined;
              return (
                <li key={item.id} className="grid gap-x-4 gap-y-2 px-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]" title={meta.label}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-[#10232d]">{meta.label}</span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
                          <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
                          {status.label}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.filename}>{item.filename}</p>
                      <p className="mt-1 text-xs text-[#36505c]">
                        {item.date_from && item.date_to ? `${formatFullDate(item.date_from)} a ${formatFullDate(item.date_to)}` : "Sem período"} · {rowsText(item)}
                        {item.post_rows > 0 && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[#4a6470]">
                            · <Link2 className="size-3" aria-hidden /> {formatInt(item.matched_posts)} com post do Instagram
                          </span>
                        )}
                      </p>
                      {item.warnings?.length > 0 && <p className="mt-1 text-xs text-[#8a5a12]">{item.warnings[0]}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-12 text-xs text-muted-foreground md:pl-0">
                    {user && (
                      <Avatar className="size-6 ring-1 ring-[#dce9eb]" title={user.name}>
                        {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                        <AvatarFallback className="bg-[#e8f1f5] text-xs font-semibold text-[#315f73]">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                    )}
                    <span>
                      {user ? `${user.name.split(" ")[0]} · ` : ""}
                      {formatImportDate(item.imported_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </MetricsSection>
    </div>
  );
}
