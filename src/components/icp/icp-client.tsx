"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Check,
  CircleDollarSign,
  Crosshair,
  Database,
  DoorOpen,
  Factory,
  Layers,
  Linkedin,
  Lightbulb,
  MapPin,
  MessageCircle,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Globe,
  Handshake,
  Megaphone,
  NotebookPen,
  Package,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import type { IcpCount, IcpData, IcpGroupRow, IcpTierKey } from "@/lib/icp/compute";

type TabKey = "resumo" | "carteira" | "clientes" | "marketing" | "comercial";

const TABS: { key: TabKey; label: string }[] = [
  { key: "resumo", label: "Resumo" },
  { key: "carteira", label: "Carteira" },
  { key: "clientes", label: "Clientes" },
  { key: "marketing", label: "Marketing" },
  { key: "comercial", label: "Pauta comercial" },
];

const TIER_STYLE: Record<IcpTierKey, { bar: string; badge: string }> = {
  A: { bar: "bg-[#347796]", badge: "bg-[#347796] text-white" },
  B: { bar: "bg-[#47cdd0]", badge: "bg-[#47cdd0]/20 text-[#04202f]" },
  C: { bar: "bg-[#48466e]/50", badge: "bg-[#48466e]/12 text-[#48466e]" },
  D: { bar: "bg-slate-300", badge: "bg-slate-100 text-slate-600" },
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function money(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 10_000) return `R$ ${Math.round(value / 1_000).toLocaleString("pt-BR")} mil`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl.format(value);
}

function pct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

type SourceSystem = "vios" | "rd" | "orq";

type Source = { system: SourceSystem; detail: string };

const SOURCE_SYSTEM: Record<SourceSystem, { label: string; className: string }> = {
  vios: { label: "VIOS", className: "bg-[#48466e]/10 text-[#48466e]" },
  rd: { label: "RD Station", className: "bg-slate-100 text-slate-700" },
  orq: { label: "ORQESTRAI", className: "bg-[#47cdd0]/15 text-[#04202f]" },
};

/** Fontes usadas em cada bloco da tela. */
const SRC = {
  honorarios: { system: "vios", detail: "financeiro · honorários pagos" },
  atraso: { system: "vios", detail: "financeiro · parcelas vencidas em aberto" },
  departamento: { system: "vios", detail: "financeiro · departamento que faturou" },
  processos: { system: "vios", detail: "processos · primeiro processo do grupo" },
  pessoas: { system: "vios", detail: "cadastro de pessoas · cidade, UF e tipo" },
  setor: { system: "rd", detail: "campo Setor empresa, via Meus Clientes" },
  porte: { system: "rd", detail: "campo Número de colaboradores, via Meus Clientes" },
  npsCargo: { system: "orq", detail: "NPS · cargo de quem respondeu" },
  npsNota: { system: "orq", detail: "NPS · nota de recomendação" },
  npsTemas: { system: "orq", detail: "NPS · classificação dos comentários" },
  linkedin: { system: "orq", detail: "LinkedIn Insights · última importação" },
  ga4: { system: "orq", detail: "Analytics (GA4) · sessões por cidade" },
  whatsapp: { system: "orq", detail: "WhatsApp · origem e etapa das conversas" },
} satisfies Record<string, Source>;

function SourceChip({ source }: { source: Source }) {
  const system = SOURCE_SYSTEM[source.system];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs", system.className)}>
      <span className="font-semibold">{system.label}</span>
      <span className="opacity-80">· {source.detail}</span>
    </span>
  );
}

function SourceNote({ sources, className }: { sources: Source[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1">
        <Database className="h-3.5 w-3.5" />
        Fonte:
      </span>
      {sources.map((s) => (
        <SourceChip key={`${s.system}-${s.detail}`} source={s} />
      ))}
    </div>
  );
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
  className,
  action,
  sources,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  sources?: Source[];
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-[#347796]" />}
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
      {sources && sources.length > 0 && <SourceNote sources={sources} className="mt-4 border-t pt-3" />}
    </section>
  );
}

function BarRow({
  label,
  value,
  max,
  display,
  hint,
  barClassName = "bg-[#347796]",
  icon,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  display: string;
  hint?: string;
  barClassName?: string;
  icon?: React.ReactNode;
}) {
  const width = max > 0 ? Math.max(1.5, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-sm font-medium">{label}</span>
        {hint && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{hint}</span>}
      </div>
      <span className="text-right text-sm font-semibold tabular-nums">{display}</span>
      <div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function AreaBadge({ area, size = "md" }: { area: string; size?: "sm" | "md" }) {
  return (
    <span
      title={area}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md ring-1",
        size === "sm" ? "h-6 w-6" : "h-7 w-7",
        getAreaIconStyle(area)
      )}
    >
      <AreaIcon area={area} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  source,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  source: Source;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-[#347796]" />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Fonte: <span className="font-medium text-foreground/70">{SOURCE_SYSTEM[source.system].label}</span> ·{" "}
        {source.detail}
      </p>
    </div>
  );
}

function countOf(list: IcpCount[], label: string) {
  return list.find((c) => c.label === label)?.count ?? 0;
}

export function IcpClient({ data, error }: { data: IcpData | null; error: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("resumo");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/icp/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Não foi possível recalcular.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Não foi possível recalcular.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card px-4 py-8 text-center shadow-sm">
        <p className="text-sm font-medium">O ICP não pôde ser calculado.</p>
        <p className="mt-1 text-xs text-muted-foreground">{error ?? "Verifique a conexão com o VIOS e tente novamente."}</p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Seções do ICP" className="flex rounded-lg border bg-muted/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                tab === t.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Honorários pagos de {monthLabel(data.windowStart)} a {monthLabel(data.windowEnd)} · calculado em{" "}
            {new Date(data.generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Recalculando..." : "Recalcular"}
          </Button>
        </div>
      </div>

      {refreshError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {refreshError}
        </div>
      )}

      {tab === "resumo" && <ResumoTab data={data} />}
      {tab === "carteira" && <CarteiraTab data={data} />}
      {tab === "clientes" && <ClientesTab data={data} />}
      {tab === "marketing" && <MarketingTab data={data} />}
      {tab === "comercial" && <ComercialTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ Resumo */

function ResumoTab({ data }: { data: IcpData }) {
  const core = data.tiers.filter((t) => t.key === "A" || t.key === "B");
  const coreAvgMonthly =
    core.reduce((acc, t) => acc + t.revenue, 0) / Math.max(1, core.reduce((acc, t) => acc + t.groups, 0)) / 12;
  const coreAvgAreas =
    core.reduce((acc, t) => acc + t.avgAreas * t.groups, 0) / Math.max(1, core.reduce((acc, t) => acc + t.groups, 0));
  const topSector = data.sectors.core[0];
  const topEntry = data.entry.core[0];

  const traits: { icon: LucideIcon; label: string; value: string; source: string }[] = [
    { icon: Factory, label: "Segmento", value: topSector ? topSector.label : "—", source: "RD Station" },
    { icon: Users, label: "Porte", value: "50 a 1.000 colaboradores", source: "RD Station" },
    { icon: MapPin, label: "Região", value: "Interior de SP e RMC", source: "VIOS" },
    { icon: DoorOpen, label: "Entrada", value: topEntry ? topEntry.label : "—", source: "VIOS" },
    { icon: CircleDollarSign, label: "Contrato", value: `Mensal · ~${money(coreAvgMonthly)}/mês`, source: "VIOS" },
    {
      icon: Layers,
      label: "Áreas",
      value: `${coreAvgAreas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} em média`,
      source: "VIOS",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#03070c] to-[#04202f] p-5 text-[#f9f9f9] shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#47cdd0]/10 blur-3xl" aria-hidden />
        <p className="relative text-xs font-medium text-[#47cdd0]">O cliente ideal em uma frase</p>
        <p className="relative mt-2 max-w-3xl text-lg font-medium leading-relaxed sm:text-xl">
          {topSector?.label ?? "Empresa"} de médio porte do interior de São Paulo, comandada pelo dono, que chega por{" "}
          {topEntry?.label === "Insolvência" ? "insolvência ou reestruturação" : (topEntry?.label ?? "uma demanda").toLowerCase()},
          fecha honorário mensal e passa a usar três ou mais áreas.
        </p>
        <p className="relative mt-3 max-w-3xl text-sm text-white/70">
          Retrato dos {data.totals.coreGroups} grupos que pagaram R$ 60 mil ou mais em 12 meses: são{" "}
          {pct(data.totals.coreGroups / Math.max(1, data.totals.payingGroups))} da carteira pagante e geram{" "}
          {pct(data.totals.coreRevenueShare)} dos honorários.
        </p>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {traits.map((t) => (
            <div key={t.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <t.icon className="h-3.5 w-3.5 text-[#47cdd0]" />
                {t.label}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug">{t.value}</p>
              <p className="mt-1 text-xs text-white/50">Fonte: {t.source}</p>
            </div>
          ))}
        </div>
        <p className="relative mt-4 text-xs leading-relaxed text-white/60">
          Faturamento, áreas, entrada e região vêm do VIOS. Segmento e porte vêm do RD Station e estão preenchidos para
          clientes que somam {pct(data.sectors.coverageShare)} da receita. O decisor vem do NPS do ORQESTRAI.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={CircleDollarSign}
          label="Honorários em 12 meses"
          value={money(data.totals.revenue12m)}
          hint={`pagos por ${data.totals.payingGroups} grupos de clientes`}
          source={SRC.honorarios}
        />
        <Kpi
          icon={Crosshair}
          label="Concentração"
          value={`${data.totals.groupsFor50} grupos`}
          hint={`fazem metade da receita; ${data.totals.groupsFor80} fazem 80%`}
          source={SRC.honorarios}
        />
        <Kpi
          icon={Layers}
          label="Efeito de várias áreas"
          value={
            data.totals.breadthMultiplier
              ? `${data.totals.breadthMultiplier.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×`
              : "—"
          }
          hint="receita mediana de quem usa 3+ áreas frente a quem usa uma"
          source={SRC.departamento}
        />
        <Kpi
          icon={MessageSquareHeart}
          label="NPS"
          value={data.decisor.nps != null ? String(data.decisor.nps) : "—"}
          hint={`${data.decisor.responses} respostas; ${data.decisor.ownerResponses} de sócios ou donos`}
          source={SRC.npsNota}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={Factory}
          title="Segmento"
          description={`Receita dos grupos A e B com setor no CRM (${data.sectors.coreKnown} grupos)`}
          sources={[SRC.setor, SRC.honorarios]}
        >
          <div className="space-y-3">
            {data.sectors.core.map((s) => (
              <BarRow
                key={s.label}
                label={s.label}
                value={s.share}
                max={data.sectors.core[0]?.share ?? 1}
                display={pct(s.share)}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            O setor está preenchido para clientes que somam {pct(data.sectors.coverageShare)} da receita.
          </p>
        </Panel>

        <Panel
          icon={Building2}
          title="Porte"
          description={`Colaboradores dos grupos A e B (${data.sizes.coreKnown} com porte informado)`}
          sources={[SRC.porte, SRC.pessoas]}
        >
          <div className="grid grid-cols-4 gap-2">
            {data.sizes.core.map((s) => {
              const max = Math.max(...data.sizes.core.map((x) => x.count), 1);
              return (
                <div key={s.label} className="flex flex-col items-center gap-2">
                  <div className="flex h-28 w-full items-end justify-center rounded-md bg-muted/50 px-2">
                    <div
                      className={cn(
                        "w-full max-w-12 rounded-t-md",
                        s.label === "51 a 200" || s.label === "200+" ? "bg-[#347796]" : "bg-[#47cdd0]/50"
                      )}
                      style={{ height: `${Math.max(4, (s.count / max) * 100)}%` }}
                    />
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{s.count}</p>
                  <p className="text-center text-xs text-muted-foreground">{s.label}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {data.sizes.core51plus} de {data.sizes.coreKnown} têm mais de 50 colaboradores. Nos grupos A e B,{" "}
            {pct(data.legalEntityShare.core)} têm pessoa jurídica cadastrada.
          </p>
        </Panel>

        <Panel
          icon={MapPin}
          title="Região"
          description="Onde estão os grupos A e B e de onde vem a receita"
          sources={[SRC.pessoas, SRC.honorarios]}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Interior de SP", value: data.geography.coreInterior },
              { label: "Capital", value: data.geography.coreCapital },
              { label: "Outros estados", value: data.geography.coreOtherUf },
              { label: "Sem cidade", value: data.geography.coreUnknown },
            ].map((g) => (
              <div key={g.label} className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xl font-semibold tabular-nums">{g.value}</p>
                <p className="text-xs text-muted-foreground">{g.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2.5">
            {data.geography.topCities.slice(0, 5).map((c) => (
              <BarRow
                key={c.label}
                label={c.label}
                value={c.share}
                max={data.geography.topCities[0]?.share ?? 1}
                display={pct(c.share, 1)}
                barClassName="bg-[#3e84a8]"
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">São Paulo concentra {pct(data.geography.spShare)} da receita.</p>
        </Panel>

        <Panel
          icon={BadgeCheck}
          title="Decisor"
          description="Quem respondeu ao NPS em nome do cliente"
          sources={[SRC.npsCargo]}
        >
          <div className="space-y-3">
            {data.decisor.byRole.map((r) => (
              <BarRow
                key={r.label}
                label={r.label}
                value={r.count}
                max={data.decisor.byRole[0]?.count ?? 1}
                display={String(r.count)}
                barClassName={r.label === "Sócio ou proprietário" ? "bg-[#347796]" : "bg-[#48466e]/40"}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Quem contrata e avalia é o dono
            {data.decisor.ownerAvg != null &&
              ` (nota média ${data.decisor.ownerAvg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })})`}
            . Diretoria e financeiro aparecem como interlocutores do dia a dia.
          </p>
        </Panel>
      </div>

      <QualificationPanel data={data} />
    </div>
  );
}

function QualificationPanel({ data }: { data: IcpData }) {
  const tierD = data.tiers.find((t) => t.key === "D");
  const yes = [
    "Pessoa jurídica, de preferência grupo com várias empresas",
    "Indústria, logística ou construção, com mais de 50 colaboradores",
    "Sede no interior de SP, na RMC ou na capital",
    "Endividamento, recuperação judicial, passivo trabalhista volumoso ou crédito relevante em risco",
    "Decisão com o sócio ou dono",
    "Aceita honorário mensal e tem potencial para três ou mais áreas",
    "Ticket a partir de R$ 5 mil por mês",
  ];
  const no = [
    "Pessoa física em causa pontual, sobretudo reclamante trabalhista com honorário de êxito",
    "Demanda de uma área só, sem recorrência",
    "Ticket abaixo de R$ 1,7 mil por mês",
    tierD
      ? `A faixa D tem ${tierD.groups} grupos, ${pct(tierD.revenueShare)} da receita e atraso equivalente a ${pct(tierD.overdueRatio)} do que pagou em 12 meses`
      : null,
  ].filter(Boolean) as string[];

  return (
    <Panel
      icon={Crosshair}
      title="Critérios de qualificação"
      description="Use para priorizar prospecção e avaliar leads novos"
      sources={[SRC.honorarios, SRC.processos, SRC.pessoas, SRC.setor, SRC.porte, SRC.npsCargo]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Priorizar</p>
          <ul className="mt-3 space-y-2">
            {yes.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-emerald-950/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Fora do perfil</p>
          <ul className="mt-3 space-y-2">
            {no.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-amber-950/80">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Carteira */

function CarteiraTab({ data }: { data: IcpData }) {
  const maxArea = Math.max(...data.areaRevenue.map((a) => a.share), 0.01);
  const maxBreadth = Math.max(...data.breadth.map((b) => b.median), 1);
  const entryAreas = Array.from(new Set([...data.entry.core, ...data.entry.rest].map((e) => e.label)));
  const coreTotal = data.entry.core.reduce((acc, e) => acc + e.count, 0) || 1;
  const restTotal = data.entry.rest.reduce((acc, e) => acc + e.count, 0) || 1;

  return (
    <div className="flex flex-col gap-4">
      <Panel
        icon={Crosshair}
        title="Faixas da carteira"
        description="Grupos classificados pelos honorários pagos em 12 meses. A e B formam o ICP."
        sources={[SRC.honorarios, SRC.departamento, SRC.atraso]}
      >
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> % dos grupos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#347796]" /> % da receita
          </span>
        </div>
        <div className="space-y-4">
          {data.tiers.map((t) => (
            <div key={t.key} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_120px] sm:items-center">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", TIER_STYLE[t.key].badge)}>
                  {t.key}
                </span>
                <div>
                  <p className="text-sm font-medium">{t.range}</p>
                  <p className="text-xs text-muted-foreground">{t.groups} grupos</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-slate-300" style={{ width: `${t.groupShare * 100}%` }} />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#347796]" style={{ width: `${t.revenueShare * 100}%` }} />
                </div>
              </div>
              <p className="text-sm tabular-nums sm:text-right">
                <span className="text-muted-foreground">{pct(t.groupShare)}</span>
                <span className="mx-1.5 text-muted-foreground">→</span>
                <span className="font-semibold">{pct(t.revenueShare)}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto border-t pt-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Faixa</th>
                <th className="pb-2 text-right font-medium">Receita</th>
                <th className="pb-2 text-right font-medium">Ticket mensal médio</th>
                <th className="pb-2 text-right font-medium">Áreas por cliente</th>
                <th className="pb-2 text-right font-medium">Com honorário mensal</th>
                <th className="pb-2 text-right font-medium">Atraso / receita</th>
              </tr>
            </thead>
            <tbody>
              {data.tiers.map((t) => (
                <tr key={t.key} className="border-b last:border-0">
                  <td className="py-2.5 font-medium">{t.label}</td>
                  <td className="py-2.5 text-right tabular-nums">{money(t.revenue)}</td>
                  <td className="py-2.5 text-right tabular-nums">{money(t.avgMonthly)}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {t.avgAreas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{pct(t.retainerShare)}</td>
                  <td
                    className={cn(
                      "py-2.5 text-right tabular-nums",
                      t.overdueRatio >= 0.5 ? "font-semibold text-amber-700" : ""
                    )}
                  >
                    {pct(t.overdueRatio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={Layers}
          title="Receita por área"
          description="Honorários pagos em 12 meses, por departamento que faturou"
          sources={[SRC.departamento]}
        >
          <div className="space-y-3">
            {data.areaRevenue.map((a) => (
              <BarRow
                key={a.label}
                icon={a.label !== "Outros" ? <AreaBadge area={a.label} size="sm" /> : <span className="h-6 w-6 shrink-0" />}
                label={a.label}
                hint={money(a.value)}
                value={a.share}
                max={maxArea}
                display={pct(a.share, 1)}
                barClassName={a.label === "Outros" ? "bg-slate-300" : "bg-[#347796]"}
              />
            ))}
          </div>
        </Panel>

        <Panel
          icon={Layers}
          title="Quanto mais áreas, maior o cliente"
          description="Receita mediana em 12 meses pelo número de áreas que faturaram para o grupo"
          sources={[SRC.departamento]}
        >
          <div className="flex h-44 items-end gap-4 border-b pb-2">
            {data.breadth.map((b, i) => (
              <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-sm font-semibold tabular-nums">{money(b.median)}</span>
                <div
                  className={cn("w-full max-w-20 rounded-t-md", i === 2 ? "bg-[#347796]" : "bg-[#47cdd0]/50")}
                  style={{ height: `${Math.max(3, (b.median / maxBreadth) * 80)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4">
            {data.breadth.map((b) => (
              <div key={b.label} className="flex-1 text-center">
                <p className="text-sm font-medium">{b.label}</p>
                <p className="text-xs text-muted-foreground">{b.groups} grupos</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        icon={DoorOpen}
        title="Porta de entrada"
        description="Área do primeiro processo de cada grupo no VIOS"
        sources={[SRC.processos, SRC.honorarios]}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Área de entrada</th>
                  <th className="pb-2 text-right font-medium">Grupos A e B</th>
                  <th className="pb-2 text-right font-medium">Grupos C e D</th>
                </tr>
              </thead>
              <tbody>
                {entryAreas.map((area) => {
                  const c = countOf(data.entry.core, area);
                  const r = countOf(data.entry.rest, area);
                  return (
                    <tr key={area} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="flex items-center gap-2 font-medium">
                          <AreaBadge area={area} size="sm" />
                          {area}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        <span className="font-semibold">{c}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{pct(c / coreTotal)}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        <span>{r}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{pct(r / restTotal)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-[#47cdd0]/10 px-4 py-3">
              <p className="text-2xl font-semibold tabular-nums text-[#04202f]">
                {data.entry.coreViaInsolvency}
                <span className="text-sm font-medium text-muted-foreground"> de {data.totals.coreGroups}</span>
              </p>
              <p className="text-xs text-[#04202f]/80">grupos A e B entraram por Insolvência</p>
            </div>
            <div className="rounded-lg bg-[#47cdd0]/10 px-4 py-3">
              <p className="text-2xl font-semibold tabular-nums text-[#04202f]">
                {data.newCore.viaInsolvency}
                <span className="text-sm font-medium text-muted-foreground"> de {data.newCore.total}</span>
              </p>
              <p className="text-xs text-[#04202f]/80">clientes A e B conquistados desde 2025 entraram por Insolvência</p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- Clientes */

function ClientesTab({ data }: { data: IcpData }) {
  const [query, setQuery] = useState("");
  const [tiers, setTiers] = useState<Set<IcpTierKey>>(new Set(["A", "B"]));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.groups.filter(
      (g) =>
        tiers.has(g.tier) &&
        (!q ||
          g.grupo.toLowerCase().includes(q) ||
          (g.sector ?? "").toLowerCase().includes(q) ||
          (g.city ?? "").toLowerCase().includes(q))
    );
  }, [data.groups, query, tiers]);

  function toggleTier(key: IcpTierKey) {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Panel
      icon={Building2}
      title="Grupos de clientes"
      description="Use os grupos A e B como modelo de prospecção e como cases"
      sources={[SRC.honorarios, SRC.departamento, SRC.processos, SRC.pessoas, SRC.atraso, SRC.setor, SRC.porte]}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="icp-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar grupo, setor ou cidade"
            className="pl-8"
            aria-label="Buscar grupo, setor ou cidade"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por faixa">
          {data.tiers.map((t) => {
            const active = tiers.has(t.key);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTier(t.key)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                  active ? "border-[#347796] bg-[#347796]/10 text-[#04202f]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Faixa {t.key}
                <span className="tabular-nums text-muted-foreground">{t.groups}</span>
              </button>
            );
          })}
        </div>
        <p className="ml-auto text-xs text-muted-foreground">{rows.length} grupos</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Grupo</th>
              <ColumnHeader label="Setor" source="RD" />
              <ColumnHeader label="Porte" source="RD" />
              <ColumnHeader label="Cidade" source="VIOS" />
              <ColumnHeader label="Entrada" source="VIOS" />
              <ColumnHeader label="Áreas que faturaram" source="VIOS" />
              <ColumnHeader label="Média mensal" source="VIOS" align="right" />
              <ColumnHeader label="Atraso" source="VIOS" align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <GroupRow key={g.grupo} group={g} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum grupo com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ColumnHeader({ label, source, align }: { label: string; source: string; align?: "right" }) {
  return (
    <th className={cn("pb-2 font-medium", align === "right" && "text-right")}>
      {label}
      <span className="ml-1 font-normal text-muted-foreground/70">· {source}</span>
    </th>
  );
}

function GroupRow({ group: g }: { group: IcpGroupRow }) {
  return (
    <tr className="border-b align-middle last:border-0 hover:bg-muted/40">
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              TIER_STYLE[g.tier].badge
            )}
          >
            {g.tier}
          </span>
          <span className="font-medium">{g.grupo.replace(/^grupo\s+/i, "")}</span>
          {g.hasRetainer && (
            <span className="rounded-full bg-[#47cdd0]/15 px-2 py-0.5 text-xs font-medium text-[#04202f]">mensal</span>
          )}
        </div>
      </td>
      <td className="max-w-[200px] truncate py-2.5 pr-3 text-muted-foreground" title={g.sector ?? undefined}>
        {g.sectorBucket ?? "—"}
      </td>
      <td className="py-2.5 pr-3 text-muted-foreground">{g.sizeBucket ?? "—"}</td>
      <td className="py-2.5 pr-3 text-muted-foreground">
        {g.city ? `${g.city}${g.uf ? ` · ${g.uf}` : ""}` : (g.uf ?? "—")}
      </td>
      <td className="py-2.5 pr-3">
        {g.entryArea ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <AreaBadge area={/insolv/i.test(g.entryArea) ? "Insolvência" : g.entryArea} size="sm" />
            <span className="truncate">{/insolv/i.test(g.entryArea) ? "Insolvência" : g.entryArea}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex flex-wrap gap-1">
          {g.areas.map((a) => (
            <AreaBadge key={a} area={a} size="sm" />
          ))}
        </div>
      </td>
      <td className="py-2.5 text-right font-semibold tabular-nums">{money(g.monthly)}</td>
      <td className={cn("py-2.5 text-right tabular-nums", g.overdue > g.revenue12m * 0.5 ? "text-amber-700" : "text-muted-foreground")}>
        {g.overdue > 0 ? money(g.overdue) : "—"}
      </td>
    </tr>
  );
}

/* --------------------------------------------------------------- Marketing */

function MarketingTab({ data }: { data: IcpData }) {
  const m = data.marketing;
  const maxCity = Math.max(...m.ga4TopCities.map((c) => c.sessions), 1);
  const maxSource = Math.max(...m.whatsappBySource.map((s) => s.count), 1);
  const maxTheme = Math.max(...data.decisor.strengths.map((s) => s.count), ...data.decisor.pains.map((s) => s.count), 1);

  const steps = [
    {
      title: "Completar setor e porte dos grupos A e B",
      text: `Hoje só ${pct(data.sectors.coverageShare)} da receita tem setor no CRM. Dá para puxar CNAE e porte pelo CNPJ que já está no VIOS.`,
    },
    { title: "Pontuar leads com os critérios de ICP", text: "Criar no CRM os campos de setor, porte, gatilho, decisor e potencial de áreas." },
    {
      title: "Montar lista de empresas parecidas",
      text: "Indústrias de 50 a 1.000 colaboradores na RMC e no interior de SP, com sinais de crise (protestos, execuções, pedidos de RJ).",
    },
    { title: "Mudar o alvo do conteúdo e da mídia paga", text: "Falar com o dono e o CFO industrial: reestruturação, passivo trabalhista e crédito." },
    {
      title: "Plano de expansão para quem entra por Insolvência",
      text: data.totals.breadthMultiplier
        ? `Quem usa três ou mais áreas gera ${data.totals.breadthMultiplier.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× mais receita.`
        : "Quem usa três ou mais áreas gera mais receita.",
    },
    { title: "Qualificar os leads de WhatsApp", text: "Separar pessoa física de empresa no pipeline que já existe no ORQESTRAI." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-xl border border-[#47cdd0]/30 bg-[#47cdd0]/5 px-4 py-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#04202f]" />
        <p className="text-sm leading-relaxed text-[#04202f]">
          A região de atuação já coincide com o ICP. O público das redes e os leads que chegam, não: a audiência é de
          advogados e o inbound traz principalmente pessoas físicas.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={Linkedin}
          title="Quem segue a página no LinkedIn"
          description={`${m.linkedinFollowers.toLocaleString("pt-BR")} seguidores com setor informado`}
          sources={[SRC.linkedin]}
        >
          <div className="space-y-3">
            <BarRow label="Setor jurídico" value={m.linkedinLegalShare ?? 0} max={1} display={pct(m.linkedinLegalShare)} barClassName="bg-slate-400" />
            <BarRow label="Indústria" value={m.linkedinIndustryShare ?? 0} max={1} display={pct(m.linkedinIndustryShare)} />
            <BarRow
              label="Donos, dirigentes e diretores"
              value={m.linkedinDecisionShare ?? 0}
              max={1}
              display={pct(m.linkedinDecisionShare)}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">O conteúdo precisa mirar o dono e o CFO da indústria.</p>
        </Panel>

        <Panel
          icon={Globe}
          title="De onde vêm as visitas ao site"
          description="Sessões no Google Analytics em 12 meses"
          sources={[SRC.ga4]}
        >
          <div className="space-y-3">
            {m.ga4TopCities.map((c) => (
              <BarRow
                key={c.city}
                label={c.city}
                value={c.sessions}
                max={maxCity}
                display={c.sessions.toLocaleString("pt-BR")}
                barClassName="bg-[#3e84a8]"
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Campinas e São Paulo concentram o tráfego, como a carteira.</p>
        </Panel>

        <Panel
          icon={MessageCircle}
          title="Leads de WhatsApp"
          description={`${m.whatsappTotal} conversas individuais`}
          sources={[SRC.whatsapp]}
        >
          <div className="space-y-3">
            {m.whatsappBySource.map((s) => (
              <BarRow key={s.label} label={s.label} value={s.count} max={maxSource} display={String(s.count)} barClassName="bg-[#48466e]/60" />
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {m.whatsappUnqualified} de {m.whatsappTotal} ainda estão em &quot;lead recebido&quot;, sem qualificação registrada.
          </div>
        </Panel>

        <Panel
          icon={MessageSquareHeart}
          title="O que o cliente valoriza"
          description="Temas dos comentários do NPS"
          sources={[SRC.npsTemas]}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-emerald-700">Pontos fortes</p>
              {data.decisor.strengths.slice(0, 5).map((s) => (
                <BarRow key={s.label} label={s.label} value={s.count} max={maxTheme} display={String(s.count)} barClassName="bg-emerald-500" />
              ))}
            </div>
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-amber-700">Críticas</p>
              {data.decisor.pains.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma crítica classificada.</p>}
              {data.decisor.pains.slice(0, 5).map((s) => (
                <BarRow key={s.label} label={s.label} value={s.count} max={maxTheme} display={String(s.count)} barClassName="bg-amber-500" />
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel icon={Crosshair} title="Próximos passos" description="Como colocar o ICP em uso">
        <ol className="grid gap-3 md:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-lg bg-muted/40 px-3 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#347796] text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <details className="rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Como os números são calculados</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Receita: itens a receber do VIOS com plano de contas de honorários e pagamento registrado nos últimos 12 meses. Reembolsos e outras receitas ficam de fora.</li>
          <li>Clientes agrupados pelo grupo cliente do VIOS, a partir do nome do cliente no título.</li>
          <li>Faixas: A a partir de R$ 200 mil, B de R$ 60 a 200 mil, C de R$ 20 a 60 mil e D abaixo de R$ 20 mil em 12 meses.</li>
          <li>Setor e porte vêm do RD Station via Meus Clientes. Entrada é a área do primeiro processo do grupo.</li>
          <li>Atraso: parcelas vencidas em aberto no VIOS, inclusive valores antigos e renegociados.</li>
          <li>LinkedIn: último retrato importado. GA4 e WhatsApp: dados sincronizados no ORQESTRAI.</li>
        </ul>
      </details>
    </div>
  );
}

/* ---------------------------------------------------------- Pauta comercial */

const COMMERCIAL_AGENDA: { title: string; description: string; icon: LucideIcon; items: string[] }[] = [
  {
    title: "Área institucional",
    description: "Ações de marca e geração de demanda",
    icon: Megaphone,
    items: ["E-books", "Workshops", "Premiação por indicação", "Café com Cultura para clientes"],
  },
  {
    title: "Área de relacionamento",
    description: "Atendimento e acompanhamento dos clientes",
    icon: Handshake,
    items: ["Focal point", "Triagem dos leads online", "Triagem do NPS", "Controle de qualidade e satisfação"],
  },
  {
    title: "Produtos",
    description: "Ofertas que podem ser vendidas",
    icon: Package,
    items: ["E-books", "Cursos para profissionais", "Rec branca", "Consultoria"],
  },
];

function ComercialTab() {
  const repeated = new Set(
    COMMERCIAL_AGENDA.flatMap((g) => g.items).filter((item, i, all) => all.indexOf(item) !== i)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-xl border border-[#47cdd0]/30 bg-[#47cdd0]/5 px-4 py-3">
        <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-[#04202f]" />
        <p className="text-sm leading-relaxed text-[#04202f]">
          Anotações do Rafael (Comercial) para discutir na reunião, organizadas nas três frentes que ele propôs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COMMERCIAL_AGENDA.map((group) => (
          <Panel key={group.title} icon={group.icon} title={group.title} description={group.description}>
            <ul className="divide-y">
              {group.items.map((item) => {
                const others = repeated.has(item)
                  ? COMMERCIAL_AGENDA.filter((g) => g.title !== group.title && g.items.includes(item)).map((g) => g.title)
                  : [];
                return (
                  <li key={item} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span className="text-sm font-medium">{item}</span>
                    {others.length > 0 && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        também em {others.join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Fonte: anotações do Comercial (Rafael), trazidas para a reunião.</p>
    </div>
  );
}
