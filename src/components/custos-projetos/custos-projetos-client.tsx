"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import {
  formatUsd,
  type SupabaseBillingDashboard,
  type SupabaseProjectBilling,
} from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { ProjetoCustoCard } from "@/components/custos-projetos/projeto-custo-card";
import {
  ProjetoCustoEditDialog,
  type ProjetoCustoFormValues,
} from "@/components/custos-projetos/projeto-custo-edit-dialog";
import { ServicoCustoCard } from "@/components/custos-projetos/servico-custo-card";
import { ServicoCustoEditDialog } from "@/components/custos-projetos/servico-custo-edit-dialog";
import { CustosPeriodFilterBar } from "@/components/custos-projetos/custos-period-filter-bar";
import { CustosTabSummary } from "@/components/custos-projetos/custos-tab-summary";
import {
  CustosProjetosTabs,
  type CustosTabId,
} from "@/components/custos-projetos/custos-projetos-tabs";
import type {
  InfraServicesDashboard,
  InfraServiceWithPayments,
} from "@/lib/infra-services";
import type { HostingerBillingDashboard } from "@/lib/hostinger-billing";
import {
  collectAvailableYears,
  isCurrentPeriod,
  matchesPeriodFilter,
  type CustosPeriodFilter,
} from "@/lib/custos-period-filter";

function formatDueDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

function sumSupabasePaid(
  data: SupabaseBillingDashboard | null,
  filter: CustosPeriodFilter
): { usd: number; brl: number } {
  let usd = 0;
  let brl = 0;
  for (const org of data?.organizations ?? []) {
    for (const project of org.projects) {
      for (const h of project.paymentHistory) {
        if (!matchesPeriodFilter(h.periodEnd, filter)) continue;
        usd += h.amountUsd;
        brl += h.amountBrl ?? 0;
      }
    }
  }
  return { usd, brl };
}

function sumServicePaid(
  service: InfraServiceWithPayments | null,
  filter: CustosPeriodFilter
): { usd: number; brl: number } {
  let usd = 0;
  let brl = 0;
  if (!service) return { usd, brl };
  for (const p of service.payments) {
    if (!matchesPeriodFilter(p.period_month, filter)) continue;
    usd += Number(p.amount_usd) || 0;
    brl += Number(p.amount_brl) || 0;
  }
  return { usd, brl };
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
  const [hostingerData, setHostingerData] = useState<HostingerBillingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<SupabaseProjectBilling | null>(null);
  const [editingService, setEditingService] = useState<InfraServiceWithPayments | null>(null);

  const loadHostinger = useCallback(async (sync = false) => {
    try {
      const url = sync ? "/api/custos/hostinger?sync=1" : "/api/custos/hostinger";
      const res = await authFetch(url);
      const body = (await res.json()) as HostingerBillingDashboard & { error?: string };
      if (res.ok) {
        setHostingerData(body);
        if (sync && body.sync?.synced) {
          const servicosRes = await authFetch("/api/custos/servicos");
          if (servicosRes.ok) {
            setServicesData((await servicosRes.json()) as InfraServicesDashboard);
          }
        }
      } else {
        setHostingerData({
          configured: false,
          fetchedAt: new Date().toISOString(),
          error: body.error ?? "Erro ao carregar dados da Hostinger.",
          subscription: null,
          vps: null,
          allSubscriptions: [],
        });
      }
    } catch {
      setHostingerData(null);
    }
  }, []);

  const load = useCallback(async (syncHostinger = false) => {
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
      if (syncHostinger) {
        await loadHostinger(true);
      } else {
        void loadHostinger(false);
      }
    } catch {
      setError("Falha de rede ao carregar custos.");
      setData(null);
      setServicesData(null);
    } finally {
      setLoading(false);
    }
  }, [loadHostinger]);

  useEffect(() => {
    void load(true);
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

  const availableYears = useMemo(
    () => collectAvailableYears(data, servicesData),
    [data, servicesData]
  );

  const showCurrentEstimates = isCurrentPeriod(periodFilter);
  const cursorService = servicesData?.services.find((s) => s.slug === "cursor") ?? null;
  const n8nService = servicesData?.services.find((s) => s.slug === "n8n-vps") ?? null;

  const tabMetrics = useMemo(() => {
    if (activeTab === "supabase") {
      const paid = sumSupabasePaid(data, periodFilter);
      return {
        monthlyLabel: showCurrentEstimates
          ? formatUsd(data?.totalEstimated ?? 0)
          : "—",
        monthlyHint: showCurrentEstimates
          ? `${data?.organizations.flatMap((o) => o.projects).length ?? 0} projetos`
          : "Selecione o mês atual",
        paidBrl: paid.brl,
        paidUsd: paid.usd,
        nextDue: null as string | null,
      };
    }

    if (activeTab === "cursor") {
      const paid = sumServicePaid(cursorService, periodFilter);
      const monthlyUsd = cursorService?.estimatedMonthlyUsd ?? Number(cursorService?.monthly_amount_usd) ?? 0;
      return {
        monthlyLabel: showCurrentEstimates && monthlyUsd > 0 ? formatUsd(monthlyUsd) : "—",
        monthlyHint: showCurrentEstimates ? "Plano Pro+" : undefined,
        paidBrl: paid.brl,
        paidUsd: paid.usd,
        nextDue: null as string | null,
      };
    }

    const paid = sumServicePaid(n8nService, periodFilter);
    const hostSub = hostingerData?.subscription;
    const monthlyBrl =
      hostSub?.renewalPrice ??
      n8nService?.estimatedMonthlyBrl ??
      Number(n8nService?.monthly_amount_brl) ??
      0;

    return {
      monthlyLabel:
        showCurrentEstimates && monthlyBrl > 0 ? formatBrl(monthlyBrl) : "—",
      monthlyHint: hostSub?.name ?? undefined,
      paidBrl: paid.brl,
      paidUsd: paid.usd,
      nextDue: formatDueDate(hostSub?.nextBillingAt ?? hostSub?.expiresAt),
    };
  }, [
    activeTab,
    data,
    periodFilter,
    showCurrentEstimates,
    cursorService,
    n8nService,
    hostingerData,
  ]);

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

  const configWarning =
    data && !data.configured
      ? data.error ?? "Configure SUPABASE_MANAGEMENT_ACCESS_TOKEN no .env."
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(activeTab === "n8n")}
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
                Billing Supabase
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {activeTab === "cursor" && (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <a
                href="https://cursor.com/dashboard/billing"
                target="_blank"
                rel="noopener noreferrer"
              >
                Billing Cursor
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {activeTab === "n8n" && (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <a
                href="https://hpanel.hostinger.com/billing/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
              >
                hPanel Hostinger
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
        <div className="flex min-h-[24vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {configWarning && (
        <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200/50 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2">
          {configWarning}
        </p>
      )}

      {(data?.configured || servicesData) && (
        <>
          <CustosProjetosTabs active={activeTab} onChange={setActiveTab} />

          <CustosPeriodFilterBar
            filter={periodFilter}
            years={availableYears}
            onChange={setPeriodFilter}
          />

          <CustosTabSummary
            activeTab={activeTab}
            periodFilter={periodFilter}
            monthlyLabel={tabMetrics.monthlyLabel}
            monthlyHint={tabMetrics.monthlyHint}
            paidBrl={tabMetrics.paidBrl}
            paidUsd={tabMetrics.paidUsd}
            nextDue={tabMetrics.nextDue}
          />

          {activeTab === "supabase" && (
            <section
              role="tabpanel"
              id="custos-panel-supabase"
              aria-labelledby="custos-tab-supabase"
              className="space-y-4"
            >
              {!data?.configured ? (
                <p className="text-muted-foreground text-sm">
                  Configure o token de management do Supabase para ver os projetos.
                </p>
              ) : data.organizations.every((o) => o.projects.length === 0) ? (
                <p className="text-muted-foreground text-sm">Nenhum projeto encontrado.</p>
              ) : (
                data.organizations.flatMap((org) =>
                  org.projects.map((project) => (
                    <ProjetoCustoCard
                      key={project.ref}
                      project={project}
                      onEdit={setEditingProject}
                    />
                  ))
                )
              )}
            </section>
          )}

          {activeTab === "cursor" && (
            <section
              role="tabpanel"
              id="custos-panel-cursor"
              aria-labelledby="custos-tab-cursor"
            >
              {cursorService ? (
                <ServicoCustoCard service={cursorService} onEdit={setEditingService} />
              ) : (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                  Serviço Cursor não cadastrado.
                </p>
              )}
            </section>
          )}

          {activeTab === "n8n" && (
            <section
              role="tabpanel"
              id="custos-panel-n8n"
              aria-labelledby="custos-tab-n8n"
            >
              {n8nService ? (
                <ServicoCustoCard
                  service={n8nService}
                  onEdit={setEditingService}
                  hostingerLive={hostingerData}
                  hostingerError={
                    hostingerData?.configured === false
                      ? hostingerData.error ?? "HOSTINGER_API_TOKEN não configurado."
                      : null
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                  Serviço N8N não cadastrado.
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
