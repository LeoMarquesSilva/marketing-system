import { upsertInfraService } from "@/lib/infra-services";
import { getUsdBrlRate } from "@/lib/usd-brl-ptax";

const API_BASE = "https://developers.hostinger.com";

export interface HostingerSubscription {
  id: string;
  name: string;
  status: string;
  billingPeriod: number;
  billingPeriodUnit: string;
  currencyCode: string;
  totalPrice: number;
  renewalPrice: number;
  isAutoRenewed: boolean;
  createdAt: string;
  expiresAt: string | null;
  nextBillingAt: string | null;
}

export interface HostingerVps {
  id: number;
  subscriptionId: string;
  plan: string;
  hostname: string;
  state: string;
  ipv4: string | null;
  templateName: string | null;
  cpus: number;
  memoryMb: number;
  diskMb: number;
  createdAt: string;
}

export interface HostingerBillingDashboard {
  configured: boolean;
  fetchedAt: string;
  error?: string;
  subscription: HostingerSubscription | null;
  vps: HostingerVps | null;
  allSubscriptions: HostingerSubscription[];
  sync?: {
    synced: boolean;
    error?: string;
  };
}

class HostingerApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getApiToken(): string | null {
  return process.env.HOSTINGER_API_TOKEN?.trim() || null;
}

function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function normalizeSubscription(raw: Record<string, unknown>): HostingerSubscription {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    status: String(raw.status ?? ""),
    billingPeriod: Number(raw.billing_period) || 0,
    billingPeriodUnit: String(raw.billing_period_unit ?? ""),
    currencyCode: String(raw.currency_code ?? "BRL"),
    totalPrice: centsToAmount(Number(raw.total_price) || 0),
    renewalPrice: centsToAmount(Number(raw.renewal_price) || 0),
    isAutoRenewed: Boolean(raw.is_auto_renewed),
    createdAt: String(raw.created_at ?? ""),
    expiresAt: raw.expires_at ? String(raw.expires_at) : null,
    nextBillingAt: raw.next_billing_at ? String(raw.next_billing_at) : null,
  };
}

function normalizeVps(raw: Record<string, unknown>): HostingerVps {
  const ipv4List = raw.ipv4 as { address?: string }[] | undefined;
  const template = raw.template as { name?: string } | undefined;

  return {
    id: Number(raw.id),
    subscriptionId: String(raw.subscription_id ?? ""),
    plan: String(raw.plan ?? ""),
    hostname: String(raw.hostname ?? ""),
    state: String(raw.state ?? ""),
    ipv4: ipv4List?.[0]?.address ?? null,
    templateName: template?.name ?? null,
    cpus: Number(raw.cpus) || 0,
    memoryMb: Number(raw.memory) || 0,
    diskMb: Number(raw.disk) || 0,
    createdAt: String(raw.created_at ?? ""),
  };
}

function unwrapList<T>(data: unknown, map: (row: Record<string, unknown>) => T): T[] {
  if (Array.isArray(data)) {
    return data.map((row) => map(row as Record<string, unknown>));
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = obj.data ?? obj.subscriptions ?? obj.virtual_machines;
    if (Array.isArray(list)) {
      return list.map((row) => map(row as Record<string, unknown>));
    }
  }
  return [];
}

async function hostingerFetch<T>(path: string): Promise<T> {
  const token = getApiToken();
  if (!token) {
    throw new HostingerApiError(
      "HOSTINGER_API_TOKEN não configurada. Gere em hpanel.hostinger.com/profile/api e adicione ao .env.",
      503
    );
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Erro ${res.status} na API da Hostinger.`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // ignore
    }
    if (res.status === 401) {
      message = "HOSTINGER_API_TOKEN inválido ou expirado.";
    }
    throw new HostingerApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

function isVpsSubscription(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("kvm") || n.includes("vps");
}

function formatBillingPeriod(sub: HostingerSubscription): string {
  if (sub.billingPeriod === 1) {
    return sub.billingPeriodUnit === "year" ? "anual" : "mensal";
  }
  return `a cada ${sub.billingPeriod} ${sub.billingPeriodUnit}`;
}

function formatDatePt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function fetchSubscriptions(): Promise<HostingerSubscription[]> {
  const data = await hostingerFetch<unknown>("/api/billing/v1/subscriptions");
  return unwrapList(data, normalizeSubscription);
}

async function fetchVirtualMachines(): Promise<HostingerVps[]> {
  const data = await hostingerFetch<unknown>("/api/vps/v1/virtual-machines");
  return unwrapList(data, normalizeVps);
}

function resolveVpsBillingPair(
  subscriptions: HostingerSubscription[],
  vpsList: HostingerVps[]
): { subscription: HostingerSubscription | null; vps: HostingerVps | null } {
  const configuredId = process.env.HOSTINGER_VPS_SUBSCRIPTION_ID?.trim();
  const configuredVmId = process.env.HOSTINGER_VPS_ID?.trim();

  let vps: HostingerVps | null = null;
  if (configuredVmId) {
    vps = vpsList.find((vm) => String(vm.id) === configuredVmId) ?? null;
  }
  if (!vps && vpsList.length === 1) {
    vps = vpsList[0];
  }
  if (!vps) {
    vps =
      vpsList.find((vm) =>
        (vm.templateName ?? "").toLowerCase().includes("easypanel")
      ) ?? vpsList[0] ?? null;
  }

  let subscription: HostingerSubscription | null = null;
  if (configuredId) {
    subscription = subscriptions.find((s) => s.id === configuredId) ?? null;
  }
  if (!subscription && vps) {
    subscription =
      subscriptions.find((s) => s.id === vps!.subscriptionId) ?? null;
  }
  if (!subscription) {
    subscription =
      subscriptions.find(
        (s) => s.status === "active" && isVpsSubscription(s.name)
      ) ?? null;
  }

  return { subscription, vps };
}

export async function syncHostingerToInfraService(
  dashboard: Pick<HostingerBillingDashboard, "subscription" | "vps">
): Promise<{ error?: string }> {
  const { subscription, vps } = dashboard;
  if (!subscription) {
    return { error: "Nenhuma assinatura VPS encontrada na Hostinger." };
  }

  try {
    const renewalBrl =
      subscription.currencyCode === "BRL"
        ? subscription.renewalPrice
        : null;

    let monthlyUsd: number | null = null;
    if (subscription.currencyCode !== "BRL" && subscription.renewalPrice > 0) {
      monthlyUsd = subscription.renewalPrice;
    } else if (renewalBrl && renewalBrl > 0) {
      const rate = await getUsdBrlRate(new Date().toISOString().slice(0, 10));
      if (rate) monthlyUsd = Math.round((renewalBrl / rate) * 100) / 100;
    }

    const parts = [
      `Plano ${subscription.name} (${formatBillingPeriod(subscription)})`,
      `Renovação em ${formatDatePt(subscription.nextBillingAt)}`,
      subscription.isAutoRenewed ? "Renovação automática ativa" : "Renovação manual",
    ];
    if (vps) {
      parts.push(`${vps.hostname} · ${vps.state}`);
      if (vps.ipv4) parts.push(`IP ${vps.ipv4}`);
    }

    await upsertInfraService("n8n-vps", {
      provider: "Hostinger",
      monthly_amount_brl: renewalBrl,
      monthly_amount_usd: monthlyUsd,
      description: parts.join(" · "),
      billing_url: "https://hpanel.hostinger.com/billing/subscriptions",
    });

    return {};
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao sincronizar serviço N8N.";
    return { error: msg };
  }
}

export async function fetchHostingerBillingDashboard(options?: {
  sync?: boolean;
}): Promise<HostingerBillingDashboard> {
  const fetchedAt = new Date().toISOString();
  const token = getApiToken();

  if (!token) {
    return {
      configured: false,
      fetchedAt,
      error:
        "HOSTINGER_API_TOKEN não configurada. Use o mesmo token da API gerado no hPanel.",
      subscription: null,
      vps: null,
      allSubscriptions: [],
    };
  }

  try {
    const [subscriptions, vpsList] = await Promise.all([
      fetchSubscriptions(),
      fetchVirtualMachines(),
    ]);

    const { subscription, vps } = resolveVpsBillingPair(subscriptions, vpsList);

    const dashboard: HostingerBillingDashboard = {
      configured: true,
      fetchedAt,
      subscription,
      vps,
      allSubscriptions: subscriptions,
    };

    if (options?.sync) {
      const syncResult = await syncHostingerToInfraService(dashboard);
      dashboard.sync = {
        synced: !syncResult.error,
        error: syncResult.error,
      };
    }

    if (!subscription) {
      dashboard.error =
        "Nenhuma assinatura VPS ativa encontrada. Configure HOSTINGER_VPS_SUBSCRIPTION_ID se necessário.";
    }

    return dashboard;
  } catch (err) {
    const message =
      err instanceof HostingerApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Erro ao consultar API da Hostinger.";

    return {
      configured: true,
      fetchedAt,
      error: message,
      subscription: null,
      vps: null,
      allSubscriptions: [],
    };
  }
}
