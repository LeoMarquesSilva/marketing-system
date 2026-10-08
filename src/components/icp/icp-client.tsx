"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Check,
  CircleDollarSign,
  Clock,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import {
  sizeBuckets,
  type IcpCount,
  type IcpData,
  type IcpGroupRow,
  type IcpSizeBucket,
  type IcpSizeBucketKey,
  type IcpTierKey,
} from "@/lib/icp/compute";

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

/** Explica a receita deixada fora do ICP por não ser de cliente. */
function excludedRevenueNote(data: IcpData): string {
  const { excludedPayers, excludedRevenue } = data.totals;
  if (!excludedPayers) return "";
  return `Não inclui ${money(excludedRevenue)} pagos por ${excludedPayers} pagadores que não são clientes no VIOS (parte contrária, fornecedor ou sem cadastro), em geral honorários de sucumbência e de êxito.`;
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

type SourceSystem = "vios" | "rf" | "orq";

type Source = { system: SourceSystem; detail: string };

const SOURCE_SYSTEM: Record<SourceSystem, { label: string; className: string }> = {
  vios: { label: "VIOS", className: "bg-[#48466e]/10 text-[#48466e]" },
  orq: { label: "ORQESTRAI", className: "bg-[#47cdd0]/15 text-[#04202f]" },
  rf: { label: "Receita Federal", className: "bg-[#347796]/10 text-[#04202f]" },
};

/** Fontes usadas em cada bloco da tela. */
const SRC = {
  honorarios: { system: "vios", detail: "financeiro · honorários pagos" },
  atraso: { system: "vios", detail: "financeiro · parcelas vencidas em aberto" },
  timesheet: { system: "vios", detail: "timesheet · horas apontadas por área" },
  custoPessoal: { system: "vios", detail: "financeiro · custo de pessoal por departamento" },
  departamento: { system: "vios", detail: "financeiro · departamento que faturou" },
  processos: { system: "vios", detail: "processos · primeiro processo do grupo" },
  pessoas: { system: "vios", detail: "cadastro de pessoas · cidade, UF e tipo" },
  cnae: { system: "rf", detail: "CNAE da empresa de referência do grupo" },
  sede: { system: "rf", detail: "município da sede da empresa de referência" },
  socios: { system: "rf", detail: "quadro de sócios e administradores (QSA)" },
  npsCargo: { system: "orq", detail: "NPS · cargo de quem respondeu" },
  npsNota: { system: "orq", detail: "NPS · nota de recomendação" },
  npsTemas: { system: "orq", detail: "NPS · classificação dos comentários" },
  linkedin: { system: "orq", detail: "LinkedIn Insights · última importação" },
  ga4: { system: "orq", detail: "Analytics (GA4) · sessões por cidade" },
  whatsapp: { system: "orq", detail: "WhatsApp · origem e etapa das conversas" },
} satisfies Record<string, Source>;

/** Rodapé de fontes: mostra os sistemas e lista o detalhe de cada dado num tooltip. */
function SourceNote({ sources, className }: { sources: Source[]; className?: string }) {
  const systems = Array.from(new Set(sources.map((s) => s.system)));
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1">
        <Database className="h-3.5 w-3.5" />
        Fonte:
      </span>
      {systems.map((system) => (
        <span key={system} className={cn("rounded-md px-2 py-0.5 font-semibold", SOURCE_SYSTEM[system].className)}>
          {SOURCE_SYSTEM[system].label}
        </span>
      ))}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded-md px-1.5 py-0.5 text-[#3e84a8] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/40"
          >
            detalhes
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <p className="text-sm font-semibold text-[#b7f0f1]">De onde vêm os dados</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-white/80">
            {sources.map((source) => (
              <li key={`${source.system}-${source.detail}`}>
                <span className="font-semibold text-white">{SOURCE_SYSTEM[source.system].label}</span> · {source.detail}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
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
  info,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  sources?: Source[];
  /** Explicação curta mostrada num tooltip ao lado do título. */
  info?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-[#347796]" />}
            <h2 className="text-sm font-semibold">{title}</h2>
            {info && <InfoTooltip title={title} description={info} />}
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
  info,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  source: Source;
  info?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {label}
          {info && <InfoTooltip title={label} description={info} />}
        </p>
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
    <TooltipProvider delayDuration={150}>
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
    </TooltipProvider>
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
  const coreCount = data.totals.coreGroups;
  const { geography: geo, decisor, cnpjCoverage } = data;
  const regions = [
    { key: "interior", label: "Interior de SP", value: geo.coreInterior, phrase: "sediada no interior de São Paulo" },
    { key: "capital", label: "Capital de SP", value: geo.coreCapital, phrase: "sediada na capital paulista" },
    { key: "outros", label: "Outros estados", value: geo.coreOtherUf, phrase: "sediada fora de São Paulo" },
  ].sort((a, b) => b.value - a.value);
  const topRegion = regions[0].value > 0 ? regions[0] : null;
  const topCities = geo.coreTopCities.slice(0, 3).map((c) => c.label);
  const topAdminRole = decisor.adminRoles[0];
  const receitaDate = cnpjCoverage.fetchedAt
    ? new Date(cnpjCoverage.fetchedAt).toLocaleDateString("pt-BR")
    : null;

  const traits: { icon: LucideIcon; label: string; value: string; hint?: string; source?: Source }[] = [
    {
      icon: Factory,
      label: "Segmento",
      value: topSector ? topSector.label : "—",
      hint: topSector ? `${pct(topSector.share)} da receita A e B com segmento` : undefined,
      source: SRC.cnae,
    },
    {
      icon: Building2,
      label: "Porte",
      value: "Em avaliação",
      hint: "estamos avaliando a fonte do número de colaboradores",
    },
    {
      icon: MapPin,
      label: "Região",
      value: topRegion ? topRegion.label : "—",
      hint: topRegion
        ? `${topRegion.value} de ${coreCount} grupos${topRegion.key === "interior" && topCities.length ? `; ${topCities.join(", ")}` : ""}`
        : undefined,
      source: geo.coreFromReceita > coreCount / 2 ? SRC.sede : SRC.pessoas,
    },
    {
      icon: BadgeCheck,
      label: "Decisor",
      value: topAdminRole ? topAdminRole.label : "—",
      hint: `${decisor.coreWithAdmins} de ${coreCount} grupos com sócio que administra`,
      source: SRC.socios,
    },
    {
      icon: DoorOpen,
      label: "1ª área com processo",
      value: topEntry ? topEntry.label : "—",
      hint: "ordem de cadastro, não a contratação",
      source: SRC.processos,
    },
    {
      icon: CircleDollarSign,
      label: "Contrato",
      value: `Mensal · ~${money(coreAvgMonthly)}/mês`,
      hint: `${pct(data.retainer.core)} dos A e B têm honorário mensal`,
      source: SRC.honorarios,
    },
    {
      icon: Layers,
      label: "Áreas",
      value: `${coreAvgAreas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} em média`,
      hint: "áreas que faturaram em 12 meses",
      source: SRC.departamento,
    },
  ];

  const sentence = [
    topSector ? topSector.label : "Empresa",
    topRegion ? `, ${topRegion.phrase}` : "",
    topAdminRole ? ", comandada pelo sócio-administrador" : "",
    topEntry
      ? `, cujo primeiro processo costuma ser de ${topEntry.label === "Insolvência" ? "insolvência ou reestruturação" : topEntry.label.toLowerCase()}`
      : "",
    ", com honorário mensal e três ou mais áreas.",
  ].join("");

  return (
    <div className="flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#03070c] to-[#04202f] p-5 text-[#f9f9f9] shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#47cdd0]/10 blur-3xl" aria-hidden />
        <p className="relative text-xs font-medium text-[#47cdd0]">O cliente ideal em uma frase</p>
        <p className="relative mt-2 max-w-3xl text-lg font-medium leading-relaxed sm:text-xl">{sentence}</p>
        <p className="relative mt-3 max-w-3xl text-sm text-white/70">
          Retrato dos {data.totals.coreGroups} grupos que pagaram R$ 60 mil ou mais em 12 meses: são{" "}
          {pct(data.totals.coreGroups / Math.max(1, data.totals.payingGroups))} da carteira pagante e geram{" "}
          {pct(data.totals.coreRevenueShare)} dos honorários.
        </p>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {traits.map((t) => (
            <div key={t.label} className="flex flex-col rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <t.icon className="h-3.5 w-3.5 text-[#47cdd0]" />
                {t.label}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug">{t.value}</p>
              {t.hint && <p className="mt-0.5 text-xs leading-snug text-white/60">{t.hint}</p>}
              {t.source && (
                <p className="mt-auto pt-2 text-[11px] leading-snug text-white/45">
                  Fonte: <span className="text-white/70">{SOURCE_SYSTEM[t.source.system].label}</span> · {t.source.detail}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="relative mt-4 space-y-1 text-xs leading-relaxed text-white/60">
          <p>
            <span className="text-white/80">Receita Federal</span>: segmento (CNAE), sede e sócios da empresa de
            referência de cada grupo, pelos dados abertos do CNPJ (OpenCNPJ, com a BrasilAPI de reserva)
            {receitaDate ? `, consultados em ${receitaDate}` : ""}. Cobre {cnpjCoverage.coreWithCompany} dos{" "}
            {cnpjCoverage.coreGroups} grupos A e B e {cnpjCoverage.companies} empresas; grupo sem CNPJ consultado fica sem
            segmento, e a cidade vem do cadastro do VIOS.
          </p>
          <p>
            <span className="text-white/80">VIOS</span>: honorários, áreas, contrato e primeiro processo.{" "}
              {excludedRevenueNote(data)}{" "}
            <span className="text-white/80">ORQESTRAI</span>: NPS. Segmento identificado para clientes que somam{" "}
            {pct(data.sectors.coverageShare)} da receita.
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={CircleDollarSign}
          label="Honorários em 12 meses"
          value={money(data.totals.revenue12m)}
          hint={`pagos por ${data.totals.payingGroups} grupos de clientes`}
          source={SRC.honorarios}
          info={`Honorários pagos por clientes nos últimos 12 meses. ${excludedRevenueNote(data)}`.trim()}
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
          description={`Receita dos grupos A e B por segmento do CNAE (${data.sectors.coreKnown} de ${data.totals.coreGroups} grupos com CNPJ consultado)`}
          sources={[SRC.cnae, SRC.honorarios]}
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
            O segmento está identificado para clientes que somam {pct(data.sectors.coverageShare)} da receita.
          </p>
        </Panel>

        <Panel
          icon={Building2}
          title="Porte"
          description="Número de colaboradores das empresas do grupo"
        >
          <div className="rounded-lg bg-muted/50 px-4 py-6 text-center">
            <p className="text-sm font-semibold">Em avaliação</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Estamos avaliando a fonte do número de colaboradores. O porte da Receita (ME, EPP e Demais) segue o
              faturamento declarado, coloca quase todos os grupos A e B na mesma categoria e por isso não é usado.
            </p>
          </div>
        </Panel>

        <Panel
          icon={MapPin}
          title="Região"
          description={`Sede dos grupos A e B (${data.geography.coreFromReceita} pela Receita) e receita por cidade`}
          sources={[SRC.sede, SRC.pessoas, SRC.honorarios]}
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
          <p className="mt-4 text-xs text-muted-foreground">
            São Paulo concentra {pct(data.geography.spShare)} da receita. Cidade da sede da empresa de referência na
            Receita ({data.cnpjCoverage.withCompany} de {data.cnpjCoverage.groups} grupos); sem CNPJ consultado, a cidade
            mais frequente no cadastro do VIOS.
          </p>
        </Panel>

        <Panel
          icon={BadgeCheck}
          title="Decisor"
          description="Quem administra a empresa na Receita e quem respondeu ao NPS"
          sources={[SRC.socios, SRC.npsCargo]}
        >
          <div className="mb-4 rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{data.decisor.coreWithAdmins}</span>
              <span className="text-muted-foreground">
                {" "}
                de {data.totals.coreGroups} grupos A e B têm sócio com poder de administração no quadro de sócios
              </span>
            </p>
            {data.decisor.adminRoles.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {data.decisor.adminRoles
                  .slice(0, 4)
                  .map((r) => `${r.label}: ${r.count}`)
                  .join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Mostra quem assina pela empresa; quem contrata o jurídico ainda precisa ser confirmado com os responsáveis.
              Os nomes estão na aba Clientes.
            </p>
          </div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Cargo de quem respondeu ao NPS</p>
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
  // Segmentos que somam pelo menos 75% da receita A e B.
  const mainSectors: string[] = [];
  let covered = 0;
  for (const s of data.sectors.core) {
    if (covered >= 0.75 || mainSectors.length >= 3) break;
    mainSectors.push(s.label);
    covered += s.share;
  }
  const geo = data.geography;
  const yes = [
    "Pessoa jurídica, de preferência grupo com várias empresas",
    mainSectors.length
      ? `${mainSectors.join(", ").replace(/, ([^,]*)$/, " ou $1")} (${pct(covered)} da receita A e B)`
      : null,
    `Sede no interior de SP ou na capital (${geo.coreInterior + geo.coreCapital} de ${data.totals.coreGroups} grupos A e B)`,
    "Endividamento, recuperação judicial, passivo trabalhista volumoso ou crédito relevante em risco",
    "Decisão com o sócio-administrador ou dono",
    "Aceita honorário mensal e tem potencial para três ou mais áreas",
    "Ticket a partir de R$ 5 mil por mês",
  ].filter(Boolean) as string[];
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
      sources={[SRC.honorarios, SRC.cnae, SRC.sede, SRC.socios, SRC.processos, SRC.npsCargo]}
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

/** Textos dos tooltips da aba Carteira. */
const INFO = {
  receita:
    "Honorários pagos pelo grupo nos últimos 12 meses, pelo financeiro do VIOS (plano de contas de honorários). Só conta quem está cadastrado como cliente; reembolsos e outras receitas ficam de fora.",
  icp: "Grupos que pagaram R$ 60 mil ou mais em 12 meses (faixas A e B). São o modelo de cliente ideal.",
  margemEscritorio:
    "Receita menos custo de entrega, dividido pela receita, somando todos os grupos que tiveram horas apontadas. Não desconta sócios, estrutura e despesas gerais.",
  atraso:
    "Parcelas de honorários vencidas e não pagas até hoje, de qualquer data de vencimento, dos grupos que pagaram algo em 12 meses.",
  faixa: "Grupos classificados pelo honorário pago em 12 meses: A a partir de R$ 200 mil, B de R$ 60 a 200 mil, C de R$ 20 a 60 mil e D abaixo de R$ 20 mil.",
  participacao: "Barra cinza: quanto a faixa representa do número de grupos pagantes. Barra azul: quanto representa da receita.",
  ticket: "Receita de 12 meses dividida por 12 e pelo número de clientes.",
  areasPorCliente: "Média de departamentos que faturaram honorários para o grupo nos últimos 12 meses.",
  mensal: "Parte dos grupos com pelo menos um pagamento de honorário mensal (recorrente) em 12 meses.",
  atrasoReceita: "Valor vencido em aberto hoje dividido pela receita de 12 meses. Acima de 50% fica em âmbar.",
  horas: "Horas lançadas no timesheet do VIOS para o grupo nos últimos 12 meses.",
  receitaHora: "Receita de 12 meses dividida pelas horas apontadas. Mostra quanto rendeu cada hora de trabalho.",
  custo:
    "Horas apontadas × custo por hora da área. O custo por hora é a folha da área (remuneração, encargos e benefícios) dividida por todas as horas que a área apontou.",
  margem:
    "(Receita − custo de entrega) ÷ receita. É margem de contribuição: não desconta sócios, estrutura e despesas gerais. Abaixo de 30% fica em âmbar.",
  segmento: "Macrossetor do CNAE principal da empresa de referência do grupo, no cadastro da Receita Federal.",
  receitaArea: "Honorários pagos em 12 meses, separados pelo departamento que emitiu a cobrança.",
  amplitude: "Receita mediana de 12 meses dos grupos, separados pelo número de áreas que faturaram para eles.",
  entrada:
    "Área do primeiro processo cadastrado para o grupo no VIOS. Mostra a ordem de cadastro, não necessariamente a primeira contratação.",
} as const;

function LabelWithInfo({ label, info, className }: { label: string; info: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      <InfoTooltip title={label} description={info} />
    </span>
  );
}

function CarteiraTab({ data }: { data: IcpData }) {
  const withHours = data.groups.filter((g) => g.hours12m > 0);
  const revenueWithHours = withHours.reduce((acc, g) => acc + g.revenue12m, 0);
  const costWithHours = withHours.reduce((acc, g) => acc + g.deliveryCost, 0);
  const officeMargin = revenueWithHours > 0 ? (revenueWithHours - costWithHours) / revenueWithHours : null;
  const overdue = data.groups.reduce((acc, g) => acc + g.overdue, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={CircleDollarSign}
          label="Receita em 12 meses"
          value={money(data.totals.revenue12m)}
          hint={
            data.totals.excludedPayers
              ? `${data.totals.payingGroups} grupos de clientes; sem ${money(data.totals.excludedRevenue)} de não clientes`
              : `${data.totals.payingGroups} grupos pagaram honorários`
          }
          source={SRC.honorarios}
          info={`${INFO.receita} ${excludedRevenueNote(data)}`.trim()}
        />
        <Kpi
          icon={Crosshair}
          label="ICP (faixas A e B)"
          value={`${data.totals.coreGroups} grupos`}
          hint={`${pct(data.totals.coreRevenueShare)} da receita`}
          source={SRC.honorarios}
          info={INFO.icp}
        />
        <Kpi
          icon={Layers}
          label="Margem de contribuição"
          value={pct(officeMargin)}
          hint={`${withHours.length} grupos com horas apontadas`}
          source={SRC.custoPessoal}
          info={INFO.margemEscritorio}
        />
        <Kpi
          icon={Clock}
          label="Em atraso hoje"
          value={money(overdue)}
          hint={`${pct(ratio(overdue, data.totals.revenue12m))} da receita de 12 meses`}
          source={SRC.atraso}
          info={INFO.atraso}
        />
      </div>

      <TierPanel data={data} />
      <SizeComparisonPanel data={data} />
      <AreasPanel data={data} />
      <EntryPanel data={data} />
    </div>
  );
}

function ShareBar({ value, label, strong }: { value: number; label: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", strong ? "bg-[#347796]" : "bg-slate-300")}
          style={{ width: `${Math.max(1.5, value * 100)}%` }}
        />
      </div>
      <span className={cn("text-xs tabular-nums", strong ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {pct(value)} {label}
      </span>
    </div>
  );
}

function TierPanel({ data }: { data: IcpData }) {
  return (
    <Panel
      icon={Crosshair}
      title="Faixas da carteira"
      description="Quantos grupos há em cada faixa de honorários e quanto da receita eles geram"
      info={INFO.faixa}
      sources={[SRC.honorarios, SRC.departamento, SRC.atraso]}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">
                <LabelWithInfo label="Faixa" info={INFO.faixa} />
              </th>
              <th className="w-[30%] pb-2 font-medium">
                <LabelWithInfo label="Grupos e receita" info={INFO.participacao} />
              </th>
              <th className="pb-2 text-right font-medium">
                <LabelWithInfo label="Ticket mensal" info={INFO.ticket} className="justify-end" />
              </th>
              <th className="pb-2 text-right font-medium">
                <LabelWithInfo label="Áreas por cliente" info={INFO.areasPorCliente} className="justify-end" />
              </th>
              <th className="pb-2 text-right font-medium">
                <LabelWithInfo label="Com mensal" info={INFO.mensal} className="justify-end" />
              </th>
              <th className="pb-2 text-right font-medium">
                <LabelWithInfo label="Atraso / receita" info={INFO.atrasoReceita} className="justify-end" />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.tiers.map((t) => {
              const core = t.key === "A" || t.key === "B";
              return (
                <tr key={t.key} className={cn("border-b last:border-0", core && "bg-[#47cdd0]/[0.06]")}>
                  <td className="py-3 pl-2 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          TIER_STYLE[t.key].badge
                        )}
                      >
                        {t.key}
                      </span>
                      <div>
                        <p className="font-medium">{t.range}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.groups} grupos{core ? " · ICP" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="space-y-1.5 py-3 pr-4">
                    <ShareBar value={t.groupShare} label="dos grupos" />
                    <ShareBar value={t.revenueShare} label="da receita" strong />
                  </td>
                  <td className="py-3 text-right tabular-nums">{money(t.avgMonthly)}</td>
                  <td className="py-3 text-right tabular-nums">
                    {t.avgAreas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-3 text-right tabular-nums">{pct(t.retainerShare)}</td>
                  <td
                    className={cn(
                      "py-3 pr-2 text-right tabular-nums",
                      t.overdueRatio >= 0.5 ? "font-semibold text-amber-700" : ""
                    )}
                  >
                    {pct(t.overdueRatio)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const SIZE_BUCKET_LABEL: Record<IcpSizeBucketKey, { title: string; hint: string }> = {
  maiores: { title: "10 maiores", hint: "maior receita em 12 meses" },
  medios: { title: "10 médios", hint: "em volta da mediana" },
  menores: { title: "10 menores", hint: "menor receita entre os pagantes" },
};

function hoursLabel(value: number): string {
  return `${Math.round(value).toLocaleString("pt-BR")} h`;
}

function ratio(value: number, base: number): number | null {
  return base > 0 ? value / base : null;
}

/** Margem só faz sentido quando houve horas apontadas para o cliente. */
function marginOf(revenue: number, cost: number, hours: number): number | null {
  return hours > 0 && revenue > 0 ? (revenue - cost) / revenue : null;
}

function predominant(values: (string | null)[]): { label: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [label, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return label ? { label, count: count! } : null;
}

type MetricCell = { value: string; sub?: string; bar?: number | null; warn?: boolean };

type MetricRow = { label: string; info: string; cells: (b: IcpSizeBucket) => MetricCell };

/** Barra fina de 0 a 100% usada na margem e no atraso. */
function MiniBar({ value, warn }: { value: number; warn?: boolean }) {
  return (
    <div className="mt-1.5 h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", warn ? "bg-amber-500" : "bg-[#347796]")}
        style={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }}
      />
    </div>
  );
}

const SIZE_METRIC_SECTIONS: { title: string; rows: MetricRow[] }[] = [
  {
    title: "Tamanho",
    rows: [
      {
        label: "Receita em 12 meses",
        info: INFO.receita,
        cells: (b) => ({
          value: money(b.revenue),
          sub: b.groups.length
            ? `${money(b.groups[b.groups.length - 1].revenue)} a ${money(b.groups[0].revenue)} por cliente`
            : undefined,
        }),
      },
      {
        label: "Ticket mensal médio",
        info: INFO.ticket,
        cells: (b) => ({ value: b.groups.length ? money(b.revenue / b.groups.length / 12) : "—" }),
      },
    ],
  },
  {
    title: "Esforço e rentabilidade",
    rows: [
      {
        label: "Horas por cliente",
        info: INFO.horas,
        cells: (b) => ({
          value: b.groups.length ? hoursLabel(b.hours / b.groups.length) : "—",
          sub: `${hoursLabel(b.hours)} no total`,
        }),
      },
      {
        label: "Receita por hora",
        info: INFO.receitaHora,
        cells: (b) => ({ value: b.hours > 0 ? money(b.revenue / b.hours) : "—" }),
      },
      {
        label: "Custo de entrega",
        info: INFO.custo,
        cells: (b) => ({ value: money(b.cost), sub: b.hours > 0 ? `${money(b.cost / b.hours)} por hora` : undefined }),
      },
      {
        label: "Margem de contribuição",
        info: INFO.margem,
        cells: (b) => {
          const m = marginOf(b.revenue, b.cost, b.hours);
          return { value: pct(m), bar: m == null ? null : Math.max(0, m), warn: m != null && m < 0.3 };
        },
      },
    ],
  },
  {
    title: "Risco",
    rows: [
      {
        label: "Em atraso hoje",
        info: INFO.atraso,
        cells: (b) => {
          const r = ratio(b.overdue, b.revenue);
          return {
            value: money(b.overdue),
            sub: `${pct(r)} da receita de 12 meses`,
            bar: r == null ? null : Math.min(1, r),
            warn: r != null && r >= 0.5,
          };
        },
      },
    ],
  },
  {
    title: "Perfil",
    rows: [
      {
        label: "Segmento mais comum",
        info: INFO.segmento,
        cells: (b) => {
          const s = predominant(b.groups.map((g) => g.group.sectorBucket));
          return { value: s?.label ?? "—", sub: s ? `${s.count} de ${b.groups.length} clientes` : undefined };
        },
      },
    ],
  },
];

const ALL_AREAS = "__todas__";

function SizeComparisonPanel({ data }: { data: IcpData }) {
  const [area, setArea] = useState<string | null>(null);
  const [selected, setSelected] = useState<IcpSizeBucketKey>("maiores");
  const areaOptions = data.areaRevenue.filter((a) => a.label !== "Outros").map((a) => a.label);
  const buckets = useMemo(() => sizeBuckets(data.groups, area), [data.groups, area]);
  const current = buckets.find((b) => b.key === selected) ?? buckets[0];
  const { delivery } = data;

  return (
    <Panel
      icon={Users}
      title="Maiores, médios e menores clientes"
      description={`10 que mais pagaram, 10 em volta da mediana e 10 que menos pagaram em 12 meses${area ? ` em ${area}` : " no escritório"}`}
      info="Compara tamanho, esforço, rentabilidade, risco e perfil dos clientes por faixa de tamanho. Escolha uma área para ver só a receita, as horas e o atraso daquele departamento."
      sources={[SRC.honorarios, SRC.timesheet, SRC.custoPessoal, SRC.atraso, SRC.cnae]}
      action={
        <Select value={area ?? ALL_AREAS} onValueChange={(v) => setArea(v === ALL_AREAS ? null : v)}>
          <SelectTrigger size="sm" className="w-48 text-xs" aria-label="Filtrar por área">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL_AREAS}>Escritório todo</SelectItem>
            {areaOptions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* Comparativo: uma coluna por bloco, métricas agrupadas por tema. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="w-[28%]" />
              {buckets.map((b) => (
                <th key={b.key} scope="col" className="px-2 pb-2 text-left align-bottom">
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <span className="block text-sm font-semibold">{SIZE_BUCKET_LABEL[b.key].title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{SIZE_BUCKET_LABEL[b.key].hint}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {SIZE_METRIC_SECTIONS.map((section) => (
            <tbody key={section.title}>
              <tr>
                <th
                  colSpan={4}
                  scope="colgroup"
                  className="pb-1 pt-4 text-left text-[11px] font-semibold uppercase tracking-wide text-[#347796]"
                >
                  {section.title}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label} className="border-t border-dashed first:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left align-top text-xs font-normal text-muted-foreground">
                    <LabelWithInfo label={row.label} info={row.info} />
                  </th>
                  {buckets.map((b) => {
                    const cell = row.cells(b);
                    return (
                      <td key={b.key} className="px-2 py-2.5 align-top">
                        <div className="px-3">
                          <span className={cn("font-semibold tabular-nums", cell.warn && "text-amber-700")}>{cell.value}</span>
                          {cell.sub && <span className="block text-[11px] leading-snug text-muted-foreground">{cell.sub}</span>}
                          {cell.bar != null && <MiniBar value={cell.bar} warn={cell.warn} />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Lista: um bloco por vez. */}
      <div className="mt-6 border-t pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Quem está em cada bloco</p>
          <div className="flex rounded-lg border bg-muted/40 p-1" role="tablist" aria-label="Bloco de clientes">
            {buckets.map((b) => (
              <button
                key={b.key}
                type="button"
                role="tab"
                aria-selected={current?.key === b.key}
                onClick={() => setSelected(b.key)}
                className={cn(
                  "min-h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                  current?.key === b.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {SIZE_BUCKET_LABEL[b.key].title}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Grupo</th>
                <th className="pb-2 text-right font-medium">
                  <LabelWithInfo label="Receita 12 meses" info={INFO.receita} className="justify-end" />
                </th>
                <th className="pb-2 text-right font-medium">
                  <LabelWithInfo label="Horas" info={INFO.horas} className="justify-end" />
                </th>
                <th className="pb-2 text-right font-medium">
                  <LabelWithInfo label="Receita por hora" info={INFO.receitaHora} className="justify-end" />
                </th>
                <th className="pb-2 pl-6 font-medium">
                  <LabelWithInfo label="Margem" info={INFO.margem} />
                </th>
                <th className="pb-2 text-right font-medium">
                  <LabelWithInfo label="Em atraso" info={INFO.atraso} className="justify-end" />
                </th>
              </tr>
            </thead>
            <tbody>
              {(current?.groups ?? []).map((g, i) => {
                const margin = marginOf(g.revenue, g.cost, g.hours);
                const profile = [g.group.sectorBucket].filter(Boolean);
                return (
                  <tr key={g.grupo} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="max-w-[280px] py-2.5 pr-3">
                      <div className="flex items-baseline gap-2">
                        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={g.grupo}>
                            {g.grupo.replace(/^grupo\s+/i, "")}
                          </p>
                          <p className="truncate text-xs text-muted-foreground" title={g.group.sector ?? undefined}>
                            {profile.length ? profile.join(" · ") : "Sem CNPJ consultado"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className="font-semibold">{money(g.revenue)}</span>
                      <span className="block text-xs text-muted-foreground">{money(g.revenue / 12)}/mês</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{g.hours > 0 ? hoursLabel(g.hours) : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums">{g.hours > 0 ? money(g.revenue / g.hours) : "—"}</td>
                    <td className="py-2.5 pl-6" title={g.hours > 0 ? `Custo de entrega: ${money(g.cost)}` : "Sem horas apontadas"}>
                      {margin == null ? (
                        <span className="text-xs text-muted-foreground">sem horas</span>
                      ) : g.hours < 10 ? (
                        <span className="text-xs text-muted-foreground" title="Menos de 10 horas apontadas: a margem não é confiável">
                          {pct(margin)} · poucas horas
                        </span>
                      ) : (
                        <>
                          <span className={cn("tabular-nums", margin < 0.3 && "font-semibold text-amber-700")}>{pct(margin)}</span>
                          <MiniBar value={Math.max(0, margin)} warn={margin < 0.3} />
                        </>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {g.overdue > 0 ? (
                        <>
                          <span className={cn(g.overdue > g.revenue * 0.5 && "font-semibold text-amber-700")}>{money(g.overdue)}</span>
                          <span className="block text-xs text-muted-foreground">{pct(g.overdue / g.revenue)} da receita</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(current?.groups.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum cliente neste bloco.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details className="group mt-5 rounded-lg bg-muted/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-[#347796]" />
          Custo por hora de cada área e horas consideradas
          <span className="ml-auto text-[11px] group-open:hidden">mostrar</span>
          <span className="ml-auto hidden text-[11px] group-open:inline">ocultar</span>
        </summary>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>{INFO.custo} Áreas sem folha própria usam a média do escritório.</p>
            <p>
              {pct(ratio(delivery.clientHours, delivery.hours))} das {hoursLabel(delivery.hours)} apontadas no período foram
              para clientes que pagaram honorários; o restante é trabalho interno, prospecção ou clientes sem pagamento em
              12 meses. Cliente sem hora apontada fica sem margem: honorário de êxito ou hora não lançada.
            </p>
          </div>
          <ul className="space-y-1.5">
            {delivery.rates.map((r) => (
              <li key={r.area} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  {r.area !== "Outros" ? <AreaBadge area={r.area} size="sm" /> : <span className="h-6 w-6 shrink-0" />}
                  <span className="truncate">{r.area}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="font-semibold">{money(r.rate)}/h</span>
                  <span className="ml-1.5 text-muted-foreground">{r.fallback ? "média" : hoursLabel(r.hours)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </Panel>
  );
}

function AreasPanel({ data }: { data: IcpData }) {
  const maxArea = Math.max(...data.areaRevenue.map((a) => a.share), 0.01);
  const maxBreadth = Math.max(...data.breadth.map((b) => b.median), 1);
  const multiplier = data.totals.breadthMultiplier;

  return (
    <Panel
      icon={Layers}
      title="Áreas"
      description="De onde vem a receita e quanto vale um cliente que usa várias áreas"
      sources={[SRC.departamento]}
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:divide-x">
        <div>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            <LabelWithInfo label="Receita por área" info={INFO.receitaArea} />
          </p>
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
        </div>

        <div className="flex flex-col lg:pl-6">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            <LabelWithInfo label="Receita mediana por número de áreas" info={INFO.amplitude} />
          </p>
          <div className="flex h-52 items-end gap-4 border-b pb-2">
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
          {multiplier != null && (
            <p className="mt-auto rounded-lg bg-[#47cdd0]/10 px-4 py-3 text-sm text-[#04202f]">
              Quem usa 3 ou mais áreas paga{" "}
              <span className="font-semibold">{multiplier.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</span> o
              que paga quem usa uma área só.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function EntryPanel({ data }: { data: IcpData }) {
  const entryAreas = Array.from(new Set([...data.entry.core, ...data.entry.rest].map((e) => e.label)));
  const coreTotal = data.entry.core.reduce((acc, e) => acc + e.count, 0) || 1;
  const restTotal = data.entry.rest.reduce((acc, e) => acc + e.count, 0) || 1;

  return (
    <Panel
      icon={DoorOpen}
      title="1ª área com processo"
      description="Área do primeiro processo cadastrado de cada grupo, nos grupos do ICP e nos demais"
      info={INFO.entrada}
      sources={[SRC.processos, SRC.honorarios]}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Área do 1º processo</th>
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
            <p className="text-xs text-[#04202f]/80">grupos A e B têm o primeiro processo em Insolvência</p>
          </div>
          <div className="rounded-lg bg-[#47cdd0]/10 px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-[#04202f]">
              {data.newCore.viaInsolvency}
              <span className="text-sm font-medium text-muted-foreground"> de {data.newCore.total}</span>
            </p>
            <p className="text-xs text-[#04202f]/80">grupos A e B com primeiro processo desde 2025 começaram por Insolvência</p>
          </div>
        </div>
      </div>
    </Panel>
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
          (g.sectorBucket ?? "").toLowerCase().includes(q) ||
          (g.referenceCompany?.razaoSocial ?? "").toLowerCase().includes(q) ||
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
      sources={[SRC.honorarios, SRC.departamento, SRC.processos, SRC.pessoas, SRC.atraso, SRC.cnae, SRC.sede, SRC.socios]}
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
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Grupo</th>
              <ColumnHeader label="Segmento" source="Receita" />
              <ColumnHeader label="Sede" source="Receita/VIOS" />
              <ColumnHeader label="Sócios administradores" source="Receita" />
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
      <td
        className="max-w-[200px] truncate py-2.5 pr-3 text-muted-foreground"
        title={[g.sector, g.referenceCompany?.razaoSocial].filter(Boolean).join(" · ") || undefined}
      >
        {g.sectorBucket ?? "—"}
      </td>
      <td className="py-2.5 pr-3 text-muted-foreground">
        {g.city ? `${g.city}${g.uf ? ` · ${g.uf}` : ""}` : (g.uf ?? "—")}
      </td>
      <td
        className="max-w-[220px] truncate py-2.5 pr-3 text-muted-foreground"
        title={g.decisionMakers.map((d) => `${d.nome} (${d.qualificacao ?? "sem qualificação"})`).join("\n") || undefined}
      >
        {g.decisionMakers.length
          ? `${g.decisionMakers[0].nome}${g.decisionMakers.length > 1 ? ` +${g.decisionMakers.length - 1}` : ""}`
          : "—"}
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
      title: "Completar o segmento dos grupos sem CNPJ",
      text: `O segmento já vem da Receita para clientes que somam ${pct(data.sectors.coverageShare)} da receita. Falta cadastrar no VIOS o CNPJ dos demais grupos. A fonte do número de colaboradores está em avaliação.`,
    },
    { title: "Pontuar leads com os critérios de ICP", text: "Criar no CRM os campos de setor, porte, gatilho, decisor e potencial de áreas." },
    {
      title: "Montar lista de empresas parecidas",
      text: "Indústrias na RMC e no interior de SP, com sinais de crise (protestos, execuções, pedidos de RJ).",
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
              <p className="text-xs font-medium text-amber-700">Pontos de atenção</p>
              {data.decisor.pains.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum ponto de atenção classificado.</p>
              )}
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
          <li>Segmento (CNAE) e sede vêm do cadastro da Receita Federal, pelo CNPJ das empresas do grupo no VIOS. Porte por colaboradores está em avaliação. Primeira área com processo é a área do primeiro processo do grupo.</li>
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
