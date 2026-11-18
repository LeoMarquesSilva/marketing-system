"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Globe, MousePointerClick, RefreshCcw, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { senderDomain, type SendingHealth } from "./use-sending-health";

export const DOMAIN_STATUS_LABEL: Record<string, string> = {
  verified: "Verificado",
  pending: "Verificando",
  not_started: "Aguardando DNS",
  failed: "Aguardando DNS",
  temporary_failure: "Falha temporária",
};

export function isDomainReady(status: string | undefined): boolean {
  return status === "verified";
}

function Segment({ icon: Icon, title, children }: { icon: typeof Globe; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#3e84a8]" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Faixa no topo das campanhas: o envio está liberado? Rastreio, retorno e uso do plano grátis. */
export function SendingHealthStrip({
  health,
  loading,
  error,
}: {
  health: SendingHealth | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && !health) {
    return <div className="h-[74px] animate-pulse rounded-lg border border-[#dce9eb] bg-white" />;
  }
  if (error || !health) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {error ?? "Não foi possível consultar o Resend."}
      </div>
    );
  }
  if (!health.configured) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />A chave do Resend não está configurada neste ambiente; o envio fica bloqueado.
      </div>
    );
  }

  const domain = senderDomain(health);
  const ready = isDomainReady(domain?.status);
  const tracking = Boolean(domain?.openTracking && domain?.clickTracking);
  const trackingRecord = domain?.records.find((r) => r.kind === "Tracking");
  const plan = health.plan;
  const usage = plan ? Math.min(100, Math.round((plan.contactsInResend / plan.marketingContactsLimit) * 100)) : 0;

  return (
    <div className="space-y-2">
      {!ready && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">O envio está bloqueado até o domínio ser verificado.</strong> Faltam os registros DNS de{" "}
              {domain?.name ?? "envio"} no Cloudflare. Dá para montar e revisar as campanhas enquanto isso.
            </span>
          </p>
          <Link
            href="/email-marketing/configuracoes"
            className="shrink-0 font-medium text-amber-950 underline underline-offset-2 hover:no-underline"
          >
            Ver registros DNS
          </Link>
        </div>
      )}
      <div className="grid divide-y divide-[#eaf2f5] rounded-lg border border-[#dce9eb] bg-white shadow-sm md:grid-cols-4 md:divide-x md:divide-y-0">
        <Segment icon={Globe} title="Domínio de envio">
          <p className="truncate text-sm font-medium">{domain?.name ?? "Nenhum domínio"}</p>
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium",
              ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
            )}
          >
            {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {DOMAIN_STATUS_LABEL[domain?.status ?? ""] ?? domain?.status ?? "—"}
          </span>
        </Segment>
        <Segment icon={MousePointerClick} title="Rastreio de abertura e clique">
          <p className="text-sm font-medium">{tracking ? "Ligado" : "Desligado"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {trackingRecord && trackingRecord.status !== "verified"
              ? "Começa a contar quando o DNS de rastreio for criado"
              : tracking
                ? `via ${domain?.trackingSubdomain}.${domain?.name}`
                : "Sem medir aberturas e cliques"}
          </p>
        </Segment>
        <Segment icon={Webhook} title="Retorno para o ORQESTRAI">
          <p className="text-sm font-medium">
            {health.webhook?.status === "enabled" && health.webhook.secretConfigured
              ? "Ativo"
              : health.webhook
                ? "Falta a chave no servidor"
                : "Não configurado"}
          </p>
          <p className="truncate text-xs text-muted-foreground">entregas, aberturas, cliques e descadastros</p>
        </Segment>
        <Segment icon={CheckCircle2} title="Plano grátis do Resend (Marketing)">
          <p className="text-sm font-medium tabular-nums">
            {plan ? `${plan.contactsInResend.toLocaleString("pt-BR")} de ${plan.marketingContactsLimit.toLocaleString("pt-BR")} contatos` : "—"}
          </p>
          <span className="mt-1 block h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-[#eaf2f5]">
            <span
              className={cn("block h-full rounded-full", usage >= 90 ? "bg-amber-500" : "bg-[#347796]")}
              style={{ width: `${Math.max(usage, plan?.contactsInResend ? 2 : 0)}%` }}
            />
          </span>
          <p className="text-xs text-muted-foreground">sem limite de envios por dia</p>
        </Segment>
      </div>
    </div>
  );
}
