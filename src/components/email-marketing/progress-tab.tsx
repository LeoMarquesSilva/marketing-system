"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, TrendingUp, UserX, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchEmailGroupResponsibles, type EmailContact, type EmailGroupResponsible, type EmailPerson } from "@/lib/email-marketing";
import { buildResponsibleProgress, type ResponsibleProgressRow } from "@/lib/email-marketing-progress";
import {
  ClientLogoStack,
  IconeArea,
  MetricBand,
  PersonPhoto,
  fetchTeam,
  type ClientRef,
  type TeamMember,
} from "./email-marketing-visuals";

interface ProgressTabProps {
  contacts: EmailContact[];
  people: EmailPerson[];
}

const SEM_AREA = "Sem área";

const pctOf = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

function tone(percent: number): string {
  return percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-500" : "bg-rose-500";
}

function Bar({ percent, className }: { percent: number; className?: string }) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-[#eaf2f5]", className)}>
      <span className={cn("block h-full rounded-full transition-[width]", tone(percent))} style={{ width: `${Math.max(percent, 2)}%` }} />
    </span>
  );
}

function Gap({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#f1f5f7] px-2 text-xs text-[#3b5560]">
      <strong className="font-semibold tabular-nums text-[#0d2a38]">{value}</strong> {label}
    </span>
  );
}

/** Nome que a linha do progresso usa (o mesmo de buildResponsibleProgress), para achar os clientes de cada linha. */
function rowKeyOf(row: EmailGroupResponsible, names: Map<string, string>): string {
  const userName = row.responsibleUserId
    ? names.get(row.responsibleUserId) ?? "Usuário removido"
    : row.advogadoResponsavelName
      ? `${row.advogadoResponsavelName} (não vinculado)`
      : "Sem responsável identificado";
  return `${row.responsibleUserId ?? userName}::${row.area ?? ""}`;
}

export function ProgressTab({ contacts, people }: ProgressTabProps) {
  const [responsibles, setResponsibles] = useState<EmailGroupResponsible[]>([]);
  const [team, setTeam] = useState<Map<string, TeamMember>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchEmailGroupResponsibles(), fetchTeam()])
      .then(([resp, members]) => {
        setResponsibles(resp);
        setTeam(members);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar os responsáveis."))
      .finally(() => setLoading(false));
  }, []);

  const names = useMemo(() => new Map(Array.from(team.values()).map((m) => [m.id, m.name])), [team]);
  const rows = useMemo(() => buildResponsibleProgress(responsibles, contacts, people, names), [responsibles, contacts, people, names]);

  /** Clientes (grupos) de cada linha, com o nome do grupo vindo dos contatos e pessoas. */
  const clientsByRow = useMemo(() => {
    const groupName = new Map<string, string>();
    const groupOfCompany = new Map<string, string>();
    const contactsPerGroup = new Map<string, number>();
    for (const c of contacts) {
      if (c.clientGroupId && c.clientGroupName) groupName.set(c.clientGroupId, c.clientGroupName);
      if (c.clientGroupId) contactsPerGroup.set(c.clientGroupId, (contactsPerGroup.get(c.clientGroupId) ?? 0) + 1);
      if (c.companyId && c.clientGroupId) groupOfCompany.set(c.companyId, c.clientGroupId);
    }
    for (const p of people) if (p.clientGroupId && p.clientGroupName) groupName.set(p.clientGroupId, p.clientGroupName);

    const map = new Map<string, Map<string, ClientRef>>();
    for (const r of responsibles) {
      const groupId = r.clientGroupId ?? (r.companyId ? groupOfCompany.get(r.companyId) : undefined);
      const name = groupId ? groupName.get(groupId) : undefined;
      if (!groupId || !name) continue;
      const key = rowKeyOf(r, names);
      const clients = map.get(key) ?? new Map<string, ClientRef>();
      clients.set(groupId, { key: groupId, group: name, company: null, count: contactsPerGroup.get(groupId) ?? 0 });
      map.set(key, clients);
    }
    return new Map(Array.from(map.entries()).map(([key, clients]) => [key, Array.from(clients.values()).sort((a, b) => b.count - a.count)]));
  }, [responsibles, contacts, people, names]);

  const byArea = useMemo(() => {
    const map = new Map<string, ResponsibleProgressRow[]>();
    for (const row of rows) {
      const area = row.area ?? SEM_AREA;
      const list = map.get(area) ?? [];
      list.push(row);
      map.set(area, list);
    }
    return Array.from(map.entries())
      .map(([area, list]) => {
        const total = list.reduce((s, r) => s + r.stats.total, 0);
        const done = list.reduce((s, r) => s + r.stats.completo, 0);
        return {
          area,
          total,
          done,
          rows: list.slice().sort((a, b) => b.stats.total - b.stats.completo - (a.stats.total - a.stats.completo)),
        };
      })
      .sort((a, b) => (a.area === SEM_AREA ? 1 : b.area === SEM_AREA ? -1 : b.total - a.total));
  }, [rows]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.stats.total, 0);
    const done = rows.reduce((s, r) => s + r.stats.completo, 0);
    return {
      total,
      done,
      percent: pctOf(done, total),
      people: new Set(rows.filter((r) => r.matched).map((r) => r.userId)).size,
      unmatched: rows.filter((r) => !r.matched).length,
      semEmail: rows.reduce((s, r) => s + r.stats.semEmail, 0),
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-[104px] animate-pulse rounded-lg border border-[#dce9eb] bg-white" />
        {[1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-lg border border-[#dce9eb] bg-white" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MetricBand
        metrics={[
          { id: "geral", icon: TrendingUp, label: "Progresso geral", value: `${totals.percent}%`, hint: `${totals.done.toLocaleString("pt-BR")} de ${totals.total.toLocaleString("pt-BR")} cadastros completos` },
          { id: "pessoas", icon: Users, label: "Responsáveis", value: totals.people, hint: `em ${byArea.filter((a) => a.area !== SEM_AREA).length} áreas` },
          { id: "email", icon: UserX, label: "Sem e-mail", value: totals.semEmail.toLocaleString("pt-BR"), hint: "o que mais trava as campanhas", warn: totals.semEmail > 0 },
          {
            id: "vinculo",
            icon: AlertTriangle,
            label: "Advogados sem vínculo",
            value: totals.unmatched,
            hint: totals.unmatched ? "vincule em Configurações" : "todos vinculados",
            warn: totals.unmatched > 0,
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf2f5] text-[#285f7a]">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <p className="font-medium text-[#0d2a38]">Nenhum responsável ainda</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sincronize o SIOE em Configurações para trazer as áreas e os advogados de cada cliente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          {byArea.map((block) => {
            const percent = pctOf(block.done, block.total);
            return (
              <section key={block.area} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm">
                <header className="flex items-center gap-3 border-b border-[#eaf2f5] px-4 py-3">
                  {block.area === SEM_AREA ? (
                    <span className="flex size-8 items-center justify-center rounded-md bg-[#f1f5f7] text-[#8aa0aa]">
                      <Users className="size-4" />
                    </span>
                  ) : (
                    <IconeArea area={block.area} tamanho="md" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-[#0d2a38]">{block.area}</h2>
                    <p className="text-xs text-[#5a717b]">
                      {block.rows.length} responsáve{block.rows.length === 1 ? "l" : "is"} · {block.total} cadastros
                    </p>
                  </div>
                  <div className="w-28 shrink-0 text-right">
                    <p className="text-xl font-semibold tabular-nums text-[#0d2a38]">{percent}%</p>
                    <Bar percent={percent} />
                  </div>
                </header>
                <ul className="divide-y divide-[#eaf2f5]">
                  {block.rows.map((row) => {
                    const member = row.userId ? team.get(row.userId) : undefined;
                    const p = pctOf(row.stats.completo, row.stats.total);
                    const clients = clientsByRow.get(row.key) ?? [];
                    const displayName = row.matched ? member?.name ?? row.userName : row.userName.replace(/ \(não vinculado\)$/, "");
                    return (
                      <li key={row.key} className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <PersonPhoto name={displayName} photo={member?.photo} size="md" className={cn(!row.matched && "opacity-70")} />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-medium text-[#0d2a38]">{displayName}</p>
                              {!row.matched && (
                                <Link
                                  href="/email-marketing/configuracoes"
                                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                                >
                                  <AlertTriangle className="size-3" />
                                  vincular
                                </Link>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Gap label="sem e-mail" value={row.stats.semEmail} />
                              <Gap label="sem cargo" value={row.stats.semCargo} />
                              <Gap label="sem telefone" value={row.stats.semTelefone} />
                              {row.stats.incompleto === 0 && <span className="text-xs text-emerald-700">Tudo preenchido</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 pl-12 sm:block sm:pl-0">
                          <div className="flex items-baseline justify-between gap-2 sm:mb-1">
                            <span className="text-sm font-semibold tabular-nums text-[#0d2a38]">{p}%</span>
                            <span className="text-xs tabular-nums text-[#5a717b]">
                              {row.stats.completo}/{row.stats.total}
                            </span>
                          </div>
                          <Bar percent={p} className="w-24 sm:w-full" />
                          {clients.length > 0 && <ClientLogoStack clients={clients} max={4} size="xs" className="mt-2 hidden sm:flex" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
