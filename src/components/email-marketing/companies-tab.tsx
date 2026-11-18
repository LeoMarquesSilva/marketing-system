"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Building2, ClipboardCheck, ClipboardList, Search, UserX, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EmailCompany, EmailContact, EmailPerson } from "@/lib/email-marketing";
import {
  computeEnrichmentStats,
  contactToEnrichable,
  personToEnrichable,
  type EnrichmentFilterId,
} from "@/lib/email-marketing-enrichment";
import { buildClientGroups, groupMatchesEnrichment, SEM_GRUPO, type ClientGroupBucket } from "./client-groups";
import { ClientGroupDialog } from "./client-group-dialog";
import {
  ClientLogo,
  IconeArea,
  MetricBand,
  PeopleStack,
  useClientGroupsMeta,
  useHasClientLogo,
  useTeam,
} from "./email-marketing-visuals";

interface CompaniesTabProps {
  companies: EmailCompany[];
  contacts: EmailContact[];
  people: EmailPerson[];
}

type Sort = "contatos" | "pendencias" | "nome";

const PAGE = 24;
const SEM_AREA = "__sem_area__";

function percentOf(group: ClientGroupBucket): number {
  return group.profiles ? Math.round((group.complete / group.profiles) * 100) : 0;
}

function ClientCard({ group, onOpen }: { group: ClientGroupBucket; onOpen: () => void }) {
  const team = useTeam();
  const responsibles = group.responsibleUserIds.map((id) => team.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const percent = percentOf(group);
  const pending = group.profiles - group.complete;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex h-full w-full flex-col rounded-lg border border-[#dce9eb] bg-white text-left shadow-sm transition",
        "hover:border-[#47cdd0]/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <ClientLogo group={group.key === SEM_GRUPO ? null : group.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug text-[#0d2a38] group-hover:text-[#285f7a]">{group.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#3b5560]">
            {group.area ? (
              <span className="inline-flex items-center gap-1">
                <IconeArea area={group.area} tamanho="xs" />
                {group.area}
              </span>
            ) : (
              <span className="text-muted-foreground">Sem área no SIOE</span>
            )}
            {group.inactive && <span className="rounded-full bg-[#eef2f4] px-1.5 text-[#4b5b66]">Inativo</span>}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 border-y border-[#eaf2f5] text-center">
        {[
          { label: "empresas", value: group.companies.length },
          { label: "inscritos", value: group.subscribed },
          { label: "pessoas", value: group.people.length },
        ].map((item, index) => (
          <div key={item.label} className={cn("px-2 py-2", index > 0 && "border-l border-[#eaf2f5]")}>
            <dt className="sr-only">{item.label}</dt>
            <dd className="text-base font-semibold tabular-nums text-[#0d2a38]">{item.value}</dd>
            <p className="text-xs text-[#5a717b]" aria-hidden>
              {item.label}
            </p>
          </div>
        ))}
      </dl>

      <div className="mt-auto space-y-2 p-4 pt-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[#3b5560]">
            Cadastro <strong className="font-semibold tabular-nums text-[#0d2a38]">{percent}%</strong>
          </span>
          {pending > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" />
              {pending} pendente{pending === 1 ? "" : "s"}
            </span>
          ) : group.profiles > 0 ? (
            <span className="text-emerald-700">Tudo preenchido</span>
          ) : (
            <span className="text-muted-foreground">Sem cadastros</span>
          )}
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full bg-[#eaf2f5]">
          <span
            className={cn("block h-full rounded-full", percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-500" : "bg-rose-500")}
            style={{ width: `${Math.max(percent, group.profiles ? 3 : 0)}%` }}
          />
        </span>
        <div className="flex min-h-7 items-center justify-between gap-2 pt-1">
          {responsibles.length ? (
            <>
              <PeopleStack people={responsibles} max={4} size="sm" />
              <span className="truncate text-xs text-[#5a717b]">
                {responsibles.length === 1 ? responsibles[0].name.split(" ")[0] : `${responsibles.length} responsáveis`}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sem responsável vinculado</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function CompaniesTab({ companies, contacts, people }: CompaniesTabProps) {
  const meta = useClientGroupsMeta();
  const hasLogo = useHasClientLogo();
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("__all__");
  const [pendencia, setPendencia] = useState<EnrichmentFilterId>("all");
  const [sort, setSort] = useState<Sort>("contatos");
  const [limit, setLimit] = useState(PAGE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groups = useMemo(() => buildClientGroups(companies, contacts, people, meta), [companies, contacts, people, meta]);
  const selected = groups.find((g) => g.key === selectedKey) ?? null;

  const stats = useMemo(() => {
    const enrichment = computeEnrichmentStats([...people.map(personToEnrichable), ...contacts.map(contactToEnrichable)]);
    return {
      groups: groups.filter((g) => g.key !== SEM_GRUPO).length,
      withLogo: groups.filter((g) => g.key !== SEM_GRUPO && hasLogo(g.name)).length,
      companies: companies.length,
      ...enrichment,
    };
  }, [groups, companies, contacts, people, hasLogo]);

  const areas = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of groups) {
      const key = g.area ?? SEM_AREA;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] === SEM_AREA ? 1 : b[0] === SEM_AREA ? -1 : b[1] - a[1]));
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = groups.filter((g) => {
      if (area !== "__all__" && (g.area ?? SEM_AREA) !== area) return false;
      if (!groupMatchesEnrichment(g, pendencia)) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.companies.some((c) => c.name.toLowerCase().includes(q) || (c.cnpj ?? "").includes(q) || (c.city ?? "").toLowerCase().includes(q)) ||
        g.contacts.some((c) => (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) ||
        g.people.some((p) => p.name.toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => {
      if (a.key === SEM_GRUPO) return 1;
      if (b.key === SEM_GRUPO) return -1;
      if (sort === "nome") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "pendencias") return b.profiles - b.complete - (a.profiles - a.complete) || a.name.localeCompare(b.name, "pt-BR");
      return b.contacts.length - a.contacts.length || a.name.localeCompare(b.name, "pt-BR");
    });
  }, [groups, search, area, pendencia, sort]);

  const visible = filtered.slice(0, limit);
  const hasFilters = search.trim() !== "" || area !== "__all__" || pendencia !== "all";

  const pick = (filter: EnrichmentFilterId) => {
    setPendencia((current) => (current === filter ? "all" : filter));
    setLimit(PAGE);
  };

  return (
    <div className="space-y-4">
      <MetricBand
        active={pendencia === "all" ? "all" : pendencia}
        onSelect={(id) => pick(id as EnrichmentFilterId)}
        metrics={[
          { id: "all", icon: Building2, label: "Clientes", value: stats.groups.toLocaleString("pt-BR"), hint: `${stats.companies} empresas · ${stats.withLogo} com logo` },
          { id: "sem_email", icon: UserX, label: "Pessoas sem e-mail", value: stats.semEmail.toLocaleString("pt-BR"), hint: "não recebem campanhas", warn: stats.semEmail > 0 },
          { id: "sem_cargo", icon: Users, label: "Sem cargo", value: stats.semCargo.toLocaleString("pt-BR"), hint: "atrapalha a segmentação", warn: stats.semCargo > 0 },
          { id: "incompleto", icon: ClipboardList, label: "Cadastro incompleto", value: stats.incompleto.toLocaleString("pt-BR"), hint: `de ${stats.total.toLocaleString("pt-BR")} cadastros` },
          { id: "completo", icon: ClipboardCheck, label: "Cadastro completo", value: stats.completo.toLocaleString("pt-BR"), hint: "e-mail, cargo, telefone e área" },
        ]}
      />

      <section className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, empresa, CNPJ ou pessoa"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE);
              }}
              className="pl-8"
              aria-label="Buscar clientes"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-full bg-white" aria-label="Ordenar clientes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contatos">Mais contatos primeiro</SelectItem>
              <SelectItem value="pendencias">Mais pendências primeiro</SelectItem>
              <SelectItem value="nome">Nome (A a Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Filtrar por área">
          {[["__all__", groups.length] as [string, number], ...areas].map(([key, count]) => {
            const active = area === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setArea(key);
                  setLimit(PAGE);
                }}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  active ? "border-[#347796] bg-[#347796] font-medium text-white" : "border-[#dce9eb] bg-white text-[#3b5560] hover:bg-[#eaf2f5]"
                )}
              >
                {key !== "__all__" && key !== SEM_AREA && <IconeArea area={key} tamanho="xs" className={cn(active && "bg-white ring-white/40")} />}
                {key === "__all__" ? "Todas as áreas" : key === SEM_AREA ? "Sem área" : key}
                <span className={cn("tabular-nums", active ? "text-white/80" : "text-muted-foreground")}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between gap-2 px-1 text-xs text-[#5a717b]">
        <span className="tabular-nums">
          {filtered.length} cliente{filtered.length === 1 ? "" : "s"}
          {pendencia !== "all" && " com essa pendência"}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setArea("__all__");
              setPendencia("all");
              setLimit(PAGE);
            }}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-[#285f7a] hover:bg-[#eaf2f5]"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf2f5] text-[#285f7a]">
            <Building2 className="h-5 w-5" />
          </span>
          <p className="font-medium text-[#0d2a38]">{groups.length === 0 ? "Nenhum cliente ainda" : "Nenhum cliente com esses filtros"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {groups.length === 0 ? "Sincronize os clientes ativos do SIOE em Configurações." : "Troque a área, a pendência ou limpe a busca."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((group) => (
            <li key={group.key}>
              <ClientCard group={group} onOpen={() => setSelectedKey(group.key)} />
            </li>
          ))}
        </ul>
      )}

      {filtered.length > visible.length && (
        <div className="flex flex-col items-center gap-1.5">
          <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE * 2)}>
            Mostrar mais {Math.min(PAGE * 2, filtered.length - visible.length)} clientes
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {visible.length} de {filtered.length}
          </span>
        </div>
      )}

      <ClientGroupDialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedKey(null)} group={selected} />
    </div>
  );
}
