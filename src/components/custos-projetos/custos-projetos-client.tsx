"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authFetch } from "@/lib/auth-fetch";
import {
  formatUsd,
  type SupabaseBillingDashboard,
  type SupabaseOrgBilling,
  type SupabaseProjectBilling,
} from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { cn } from "@/lib/utils";
import { ProjetoCustoCard } from "@/components/custos-projetos/projeto-custo-card";
import {
  ProjetoCustoEditDialog,
  type ProjetoCustoFormValues,
} from "@/components/custos-projetos/projeto-custo-edit-dialog";
import { ServicoCustoCard } from "@/components/custos-projetos/servico-custo-card";
import { ServicoCustoEditDialog } from "@/components/custos-projetos/servico-custo-edit-dialog";
import { CustosPeriodFilterBar } from "@/components/custos-projetos/custos-period-filter-bar";
import {
  CustosProjetosTabs,
  type CustosTabId,
} from "@/components/custos-projetos/custos-projetos-tabs";
import type {
  InfraServicesDashboard,
  InfraServiceWithPayments,
} from "@/lib/infra-services";
import {
  collectAvailableYears,
  formatPeriodFilterLabel,
  isCurrentPeriod,
  sumFilteredPayments,
  type CustosPeriodFilter,
} from "@/lib/custos-period-filter";

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex flex-col gap-3",
        accent
          ? "border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40"
          : "border-border/50 bg-background/50 dark:bg-card/50 shadow-sm"
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div>
        <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function OrgSummary({ org }: { org: SupabaseOrgBilling }) {
  return (
    <Card className="border-border/60 bg-muted/10">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{org.name}</CardTitle>
            <CardDescription>
              {org.planName ? `Plano ${org.planName}` : "Plano não informado"}
              {org.planMonthlyUsd > 0 && (
                <> · {formatUsd(org.planMonthlyUsd)}/mês (assinatura org.)</>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatUsd(org.invoiceTotal)}
            </p>
            <p className="text-xs text-muted-foreground">estimativa mensal total</p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export function CustosProjetosClient() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<CustosTabId>("supabase");
  const [periodFilter, setPeriodFilter] = useState<CustosPeriodFilter>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [data, setData] = useState<SupabaseBillingDashboard | null>(null);
  const [servicesData, setServicesData] = useState<InfraServicesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<SupabaseProjectBilling | null>(null);
  const [editingService, setEditingService] = useState<InfraServiceWithPayments | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [supabaseRes, servicosRes] = await Promise.all([
        authFetch("/api/custos/supabase"),
        authFetch("/api/custos/servicos"),
      ]);
      const supabaseBody = await supabaseRes.json();
      const servicosBody = await servicosRes.json();

      if (!supabaseRes.ok) {
        setError(supabaseBody.error ?? "Erro ao carregar custos Supabase.");
        setData(null);
        setServicesData(null);
        return;
      }
      if (!servicosRes.ok) {
        setError(servicosBody.error ?? "Erro ao carregar serviços.");
        setData(null);
        setServicesData(null);
        return;
      }

      setData(supabaseBody as SupabaseBillingDashboard);
      setServicesData(servicosBody as InfraServicesDashboard);
    } catch {
      setError("Falha de rede ao carregar custos.");
      setData(null);
      setServicesData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleProjectSaved = (
    projectRef: string,
    values: ProjetoCustoFormValues & { logo_url: string | null }
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        organizations: prev.organizations.map((org) => ({
          ...org,
          projects: org.projects
            .map((p) =>
              p.ref === projectRef
                ? {
                    ...p,
                    displayName: values.display_name,
                    name: values.display_name,
                    category: values.category || undefined,
                    description: values.description || null,
                    logoUrl: values.logo_url,
                    sortOrder: values.sort_order,
                  }
                : p
            )
            .sort(
              (a, b) =>
                a.sortOrder - b.sortOrder ||
                a.displayName.localeCompare(b.displayName, "pt-BR")
            ),
        })),
      };
    });
  };

  const allProjects = data?.organizations.flatMap((o) => o.projects) ?? [];
  const projectCount = allProjects.length;

  const availableYears = useMemo(
    () => collectAvailableYears(data, servicesData),
    [data, servicesData]
  );

  const periodPaid = useMemo(
    () => sumFilteredPayments(data, servicesData, periodFilter),
    [data, servicesData, periodFilter]
  );

  const periodLabel = formatPeriodFilterLabel(periodFilter);
  const showCurrentEstimates = isCurrentPeriod(periodFilter);

  const totalEstUsd =
    (data?.totalEstimated ?? 0) + (servicesData?.totalEstimatedUsd ?? 0);
  const totalEstBrl = servicesData?.totalEstimatedBrl ?? 0;

  const cursorService = servicesData?.services.find((s) => s.slug === "cursor") ?? null;
  const n8nService = servicesData?.services.find((s) => s.slug === "n8n-vps") ?? null;

  const tabCounts: Partial<Record<CustosTabId, number>> = {
    supabase: projectCount,
    cursor: cursorService ? 1 : 0,
    n8n: n8nService ? 1 : 0,
  };

  const refreshServices = useCallback(async () => {
    const res = await authFetch("/api/custos/servicos");
    if (res.ok) {
      const body = (await res.json()) as InfraServicesDashboard;
      setServicesData(body);
      const current = editingService?.slug;
      if (current) {
        const updated = body.services.find((s) => s.slug === current);
        if (updated) setEditingService(updated);
      }
    }
  }, [editingService?.slug]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
          {activeTab === "supabase" && (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <a
                href="https://supabase.com/dashboard/org/_/billing"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir billing no Supabase
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
        {data?.fetchedAt && !loading && (
          <p className="text-xs text-muted-foreground">
            Atualizado {new Date(data.fetchedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      {loading && !data && (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando custos…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Não foi possível carregar</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {data && !data.configured && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 p-5">
          <p className="font-medium">Configuração necessária</p>
          <p className="text-sm text-muted-foreground mt-2">
            {data.error ??
              "Adicione SUPABASE_MANAGEMENT_ACCESS_TOKEN no .env do servidor."}
          </p>
        </div>
      )}

      {(data?.configured || servicesData) && (
        <>
          {data?.note && (
            <p className="text-sm text-muted-foreground rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
              {data.note}
            </p>
          )}

          {data?.invoiceSync?.needsSessionToken && (
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Histórico Supabase</p>
              <p className="mt-2">
                Configure{" "}
                <code className="text-xs bg-muted px-1 rounded">SUPABASE_BILLING_SESSION_TOKEN</code>{" "}
                no .env para sincronizar faturas passadas do Supabase.
              </p>
            </div>
          )}

          <CustosPeriodFilterBar
            filter={periodFilter}
            years={availableYears}
            onChange={setPeriodFilter}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={showCurrentEstimates ? "Custo mensal total (est.)" : "Custo mensal (referência)"}
              value={
                showCurrentEstimates
                  ? totalEstBrl > 0
                    ? formatBrl(totalEstBrl)
                    : formatUsd(totalEstUsd)
                  : "—"
              }
              sub={
                showCurrentEstimates
                  ? `${formatUsd(data?.totalEstimated ?? 0)} Supabase${
                      totalEstBrl > 0 ? ` · ${formatBrl(totalEstBrl)} serviços` : ""
                    }`
                  : "Estimativa vigente — selecione o mês atual"
              }
              accent={showCurrentEstimates}
            />
            <KpiCard
              label="Pago no período"
              value={
                periodPaid.brl > 0
                  ? formatBrl(periodPaid.brl)
                  : periodPaid.usd > 0
                    ? formatUsd(periodPaid.usd)
                    : formatBrl(0)
              }
              sub={
                periodPaid.usd > 0 && periodPaid.brl > 0
                  ? `${formatUsd(periodPaid.usd)} · ${periodLabel}`
                  : periodLabel
              }
            />
            <KpiCard
              label="Supabase"
              value={String(projectCount)}
              sub={`${formatUsd(data?.totalEstimated ?? 0)}/mês est.`}
            />
            <KpiCard
              label="Cursor + N8N"
              value={String((cursorService ? 1 : 0) + (n8nService ? 1 : 0))}
              sub={
                totalEstBrl > 0
                  ? `${formatBrl(totalEstBrl)}/mês est.`
                  : "Serviços externos"
              }
            />
          </div>

          <CustosProjetosTabs
            active={activeTab}
            onChange={setActiveTab}
            counts={tabCounts}
          />

          {activeTab === "supabase" && (
            <section
              role="tabpanel"
              id="custos-panel-supabase"
              aria-labelledby="custos-tab-supabase"
              className="space-y-6"
            >
              {!data?.configured ? (
                <p className="text-muted-foreground text-sm">
                  Configure o token de management do Supabase para ver os projetos.
                </p>
              ) : data.organizations.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum projeto Supabase encontrado.</p>
              ) : (
                data.organizations.map((org) => (
                  <div key={org.slug} className="space-y-4">
                    <OrgSummary org={org} />
                    <div className="space-y-5">
                      {org.projects.map((project) => (
                        <ProjetoCustoCard
                          key={project.ref}
                          project={project}
                          periodFilter={periodFilter}
                          onEdit={setEditingProject}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {activeTab === "cursor" && (
            <section
              role="tabpanel"
              id="custos-panel-cursor"
              aria-labelledby="custos-tab-cursor"
              className="space-y-5"
            >
              {cursorService ? (
                <ServicoCustoCard
                  service={cursorService}
                  periodFilter={periodFilter}
                  onEdit={setEditingService}
                />
              ) : (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                  Serviço Cursor não encontrado. Verifique o cadastro em{" "}
                  <code className="text-xs bg-muted px-1 rounded">infra_services</code>.
                </p>
              )}
            </section>
          )}

          {activeTab === "n8n" && (
            <section
              role="tabpanel"
              id="custos-panel-n8n"
              aria-labelledby="custos-tab-n8n"
              className="space-y-5"
            >
              {n8nService ? (
                <ServicoCustoCard
                  service={n8nService}
                  periodFilter={periodFilter}
                  onEdit={setEditingService}
                />
              ) : (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                  Serviço N8N (VPS) não encontrado. Verifique o cadastro em{" "}
                  <code className="text-xs bg-muted px-1 rounded">infra_services</code>.
                </p>
              )}
            </section>
          )}
        </>
      )}

      <ServicoCustoEditDialog
        service={editingService}
        open={editingService != null}
        onOpenChange={(open) => {
          if (!open) setEditingService(null);
        }}
        onSaved={() => void refreshServices()}
      />

      <ProjetoCustoEditDialog
        project={editingProject}
        open={editingProject != null}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null);
        }}
        onSaved={handleProjectSaved}
      />
    </div>
  );
}
