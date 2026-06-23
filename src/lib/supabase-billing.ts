import { getTrackedSupabaseOrgs, type TrackedSupabaseOrg } from "@/lib/custos-projetos-config";
import {
  loadPaymentHistoryForProjects,
  type ProjectPaymentHistoryItem,
} from "@/lib/supabase-invoice-history";
import {
  loadInfraProjectProfiles,
  resolveProjectDisplayName,
  type InfraProjectProfile,
} from "@/lib/infra-project-profiles";

const MGMT_BASE = "https://api.supabase.com/v1";
const HOURS_PER_MONTH = 730;

/** Taxa fixa mensal do plano por organização (USD). */
const PLAN_MONTHLY_USD: Record<string, number> = {
  free: 0,
  pro: 25,
  team: 599,
};

export interface SupabaseOrgSummary {
  id: string;
  slug: string;
  name: string;
}

export interface SupabaseProjectAddon {
  name: string;
  type: string;
  priceDescription: string;
  estimatedMonthlyUsd: number;
}

export type { ProjectPaymentHistoryItem };

export interface SupabaseProjectBilling extends SupabaseProjectSummary {
  addons: SupabaseProjectAddon[];
  estimatedMonthlyUsd: number;
  paymentHistory: ProjectPaymentHistoryItem[];
  totalPaidUsd: number;
  totalPaidBrl: number;
  supabaseName: string;
  displayName: string;
  logoUrl: string | null;
  description: string | null;
  sortOrder: number;
  profile: InfraProjectProfile | null;
}

export interface SupabaseProjectSummary {
  id: number | string;
  ref: string;
  name: string;
  organization_id: string;
  organization_slug: string;
  region: string;
  status: string;
  category?: string;
}

export interface SupabaseInvoiceLine {
  description: string;
  amount: number;
  projectRef?: string;
}

export interface SupabaseOrgBilling {
  slug: string;
  name: string;
  plan: string | null;
  planName: string | null;
  planMonthlyUsd: number;
  invoiceTotal: number | null;
  currency: string;
  invoiceLines: SupabaseInvoiceLine[];
  projects: SupabaseProjectBilling[];
  /** Faturas a nível de organização (plano base), sem rateio entre projetos. */
  orgPaymentHistory: ProjectPaymentHistoryItem[];
  orgTotalPaidUsd: number;
  orgTotalPaidBrl: number;
}

export interface SupabaseBillingDashboard {
  configured: boolean;
  fetchedAt: string;
  currency: string;
  totalEstimated: number;
  totalPaidUsd: number;
  totalPaidBrl: number;
  organizations: SupabaseOrgBilling[];
  error?: string;
}

interface MgmtError {
  message?: string;
}

class SupabaseMgmtError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getAccessToken(): string | null {
  const token = process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim();
  return token || null;
}

async function mgmtFetch<T>(path: string, searchParams?: Record<string, string>): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new SupabaseMgmtError(
      "SUPABASE_MANAGEMENT_ACCESS_TOKEN não configurado. Crie um token em supabase.com/dashboard/account/tokens.",
      503
    );
  }

  const url = new URL(`${MGMT_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Erro ${res.status} na Management API do Supabase.`;
    try {
      const body = (await res.json()) as MgmtError;
      if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new SupabaseMgmtError(message, res.status);
  }

  return res.json() as Promise<T>;
}

async function listOrganizations(): Promise<SupabaseOrgSummary[]> {
  return mgmtFetch<SupabaseOrgSummary[]>("/organizations");
}

async function listProjects(): Promise<SupabaseProjectSummary[]> {
  return mgmtFetch<SupabaseProjectSummary[]>("/projects");
}

interface OrgDetailResponse {
  id: string;
  name: string;
  plan?: string;
}

async function getOrganization(slug: string): Promise<OrgDetailResponse | null> {
  try {
    return await mgmtFetch<OrgDetailResponse>(`/organizations/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

interface AddonPrice {
  description?: string;
  amount?: number;
  interval?: string;
  type?: string;
}

interface ProjectAddonsResponse {
  selected_addons?: {
    type?: string;
    variant?: {
      id?: string;
      name?: string;
      price?: AddonPrice;
    };
  }[];
}

function estimateMonthlyUsd(price: AddonPrice | undefined): number {
  if (!price?.amount) return 0;
  if (price.interval === "hourly") return price.amount * HOURS_PER_MONTH;
  if (price.interval === "monthly") return price.amount;
  return price.amount;
}

async function getProjectAddons(ref: string): Promise<SupabaseProjectAddon[]> {
  try {
    const data = await mgmtFetch<ProjectAddonsResponse>(
      `/projects/${encodeURIComponent(ref)}/billing/addons`
    );
    return (data.selected_addons ?? []).map((addon) => {
      const variant = addon.variant;
      const price = variant?.price;
      return {
        name: variant?.name ?? addon.type ?? "Addon",
        type: addon.type ?? "addon",
        priceDescription: price?.description ?? "—",
        estimatedMonthlyUsd: estimateMonthlyUsd(price),
      };
    });
  } catch {
    return [];
  }
}

function resolveOrganizations(
  allOrgs: SupabaseOrgSummary[],
  allProjects: SupabaseProjectSummary[],
  tracked: TrackedSupabaseOrg[]
): SupabaseOrgSummary[] {
  const slugs = new Set(tracked.map((t) => t.slug).filter(Boolean));
  if (slugs.size > 0) {
    return allOrgs.filter((o) => slugs.has(o.slug));
  }

  const trackedRefs = new Set(
    tracked.flatMap((t) => t.projects?.map((p) => p.ref) ?? [])
  );
  if (trackedRefs.size === 0) {
    const slugsWithProjects = new Set(allProjects.map((p) => p.organization_slug));
    return allOrgs.filter((o) => slugsWithProjects.has(o.slug));
  }

  const orgSlugsWithProjects = new Set(
    allProjects.filter((p) => trackedRefs.has(p.ref)).map((p) => p.organization_slug)
  );
  return allOrgs.filter((o) => orgSlugsWithProjects.has(o.slug));
}

function resolveProjectsForOrg(
  allProjects: SupabaseProjectSummary[],
  org: SupabaseOrgSummary,
  tracked: TrackedSupabaseOrg[]
): SupabaseProjectSummary[] {
  const orgProjects = allProjects.filter(
    (p) => p.organization_slug === org.slug || p.organization_id === org.id
  );

  const orgConfig = tracked.find((t) => t.slug === org.slug || t.slug === "");
  if (!orgConfig?.projects?.length) return orgProjects;

  const refs = new Set(orgConfig.projects.map((p) => p.ref));
  const categoryByRef = new Map(orgConfig.projects.map((p) => [p.ref, p.category]));
  const nameByRef = new Map(orgConfig.projects.map((p) => [p.ref, p.name]));

  return orgProjects
    .filter((p) => refs.has(p.ref))
    .map((p) => ({
      ...p,
      name: nameByRef.get(p.ref) ?? p.name,
      category: categoryByRef.get(p.ref),
    }));
}

function planDisplayName(planId: string | null | undefined): string | null {
  if (!planId) return null;
  const names: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    team: "Team",
    enterprise: "Enterprise",
  };
  return names[planId] ?? planId;
}

export async function fetchSupabaseBillingDashboard(): Promise<SupabaseBillingDashboard> {
  const token = getAccessToken();
  if (!token) {
    return {
      configured: false,
      fetchedAt: new Date().toISOString(),
      currency: "USD",
      totalEstimated: 0,
      totalPaidUsd: 0,
      totalPaidBrl: 0,
      organizations: [],
      error:
        "Configure SUPABASE_MANAGEMENT_ACCESS_TOKEN no .env (token em supabase.com/dashboard/account/tokens).",
    };
  }

  const tracked = getTrackedSupabaseOrgs();
  const [allOrgs, allProjects] = await Promise.all([listOrganizations(), listProjects()]);
  const orgs = resolveOrganizations(allOrgs, allProjects, tracked);

  const organizations: SupabaseOrgBilling[] = [];
  let totalEstimated = 0;
  let totalPaidUsd = 0;
  let totalPaidBrl = 0;

  const allProjectRefs: string[] = [];

  for (const org of orgs) {
    const orgDetail = await getOrganization(org.slug);
    const planId = orgDetail?.plan ?? null;
    const planMonthlyUsd = planId ? PLAN_MONTHLY_USD[planId] ?? 0 : 0;

    const projectSummaries = resolveProjectsForOrg(allProjects, org, tracked);
    allProjectRefs.push(...projectSummaries.map((p) => p.ref));
    const projects: SupabaseProjectBilling[] = [];

    for (const project of projectSummaries) {
      const addons = await getProjectAddons(project.ref);
      const estimatedMonthlyUsd = addons.reduce((sum, a) => sum + a.estimatedMonthlyUsd, 0);
      projects.push({
        ...project,
        addons,
        estimatedMonthlyUsd,
        paymentHistory: [],
        totalPaidUsd: 0,
        totalPaidBrl: 0,
        supabaseName: project.name,
        displayName: project.name,
        logoUrl: null,
        description: null,
        sortOrder: 0,
        profile: null,
      });
    }

    const invoiceLines: SupabaseInvoiceLine[] = [];

    if (planMonthlyUsd > 0) {
      invoiceLines.push({
        description: `Plano ${planDisplayName(planId)} (organização)`,
        amount: planMonthlyUsd,
      });
    }

    for (const project of projects) {
      for (const addon of project.addons) {
        invoiceLines.push({
          description: `${project.name} — ${addon.name}`,
          amount: addon.estimatedMonthlyUsd,
          projectRef: project.ref,
        });
      }
      if (project.addons.length === 0) {
        invoiceLines.push({
          description: `${project.name} — sem addons pagos (plano incluso)`,
          amount: 0,
          projectRef: project.ref,
        });
      }
    }

    const projectsTotal = projects.reduce((sum, p) => sum + p.estimatedMonthlyUsd, 0);
    const invoiceTotal = planMonthlyUsd + projectsTotal;
    totalEstimated += invoiceTotal;

    const orgLabel =
      tracked.find((t) => t.slug === org.slug || t.slug === "")?.label ??
      orgDetail?.name ??
      org.name;

    organizations.push({
      slug: org.slug,
      name: orgLabel,
      plan: planId,
      planName: planDisplayName(planId),
      planMonthlyUsd,
      invoiceTotal,
      currency: "USD",
      invoiceLines,
      projects,
      orgPaymentHistory: [],
      orgTotalPaidUsd: 0,
      orgTotalPaidBrl: 0,
    });
  }

  const profiles = await loadInfraProjectProfiles(allProjectRefs);

  for (const org of organizations) {
    const { byProject: historyByProject, orgLevel } =
      await loadPaymentHistoryForProjects(
        org.slug,
        org.projects.map((p) => p.ref)
      );

    org.orgPaymentHistory = orgLevel;
    org.orgTotalPaidUsd = orgLevel.reduce((s, h) => s + h.amountUsd, 0);
    org.orgTotalPaidBrl = orgLevel.reduce((s, h) => s + (h.amountBrl ?? 0), 0);
    totalPaidUsd += org.orgTotalPaidUsd;
    totalPaidBrl += org.orgTotalPaidBrl;

    org.projects = org.projects
      .map((project) => {
        const profile = profiles.get(project.ref);
        const paymentHistory = historyByProject.get(project.ref) ?? [];
        const totalPaidUsdProject = paymentHistory.reduce((s, h) => s + h.amountUsd, 0);
        const totalPaidBrlProject = paymentHistory.reduce(
          (s, h) => s + (h.amountBrl ?? 0),
          0
        );
        totalPaidUsd += totalPaidUsdProject;
        totalPaidBrl += totalPaidBrlProject;
        const displayName = resolveProjectDisplayName(project.name, profile);
        return {
          ...project,
          name: displayName,
          supabaseName: project.name,
          displayName,
          logoUrl: profile?.logo_url ?? null,
          description: profile?.description ?? null,
          category: profile?.category ?? project.category,
          sortOrder: profile?.sort_order ?? 0,
          profile: profile ?? null,
          paymentHistory,
          totalPaidUsd: totalPaidUsdProject,
          totalPaidBrl: totalPaidBrlProject,
        };
      })
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.displayName.localeCompare(b.displayName, "pt-BR")
      );
  }

  return {
    configured: true,
    fetchedAt: new Date().toISOString(),
    currency: "USD",
    totalEstimated,
    totalPaidUsd,
    totalPaidBrl,
    organizations,
  };
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
