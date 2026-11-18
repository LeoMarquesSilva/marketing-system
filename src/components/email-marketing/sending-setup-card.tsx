"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, RefreshCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOMAIN_STATUS_LABEL, isDomainReady } from "./sending-health";
import { senderDomain, useSendingHealth, type SendingDomainRecord } from "./use-sending-health";

const RECORD_PURPOSE: Record<string, string> = {
  DKIM: "Assinatura (DKIM)",
  SPF: "Autorização de envio (SPF)",
  Receiving: "Recebimento",
  Tracking: "Rastreio de abertura e clique",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
    </Button>
  );
}

function RecordStatus({ status }: { status: string }) {
  const ok = status === "verified";
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium",
        ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? "Ok" : "Falta criar"}
    </span>
  );
}

function RecordRow({ record }: { record: SendingDomainRecord }) {
  return (
    <li className="grid gap-2 py-3 md:grid-cols-[180px_70px_minmax(0,1fr)_auto] md:items-center md:gap-3">
      <div>
        <p className="text-sm font-medium">{RECORD_PURPOSE[record.kind] ?? record.kind}</p>
        {record.kind === "Tracking" && <p className="text-xs text-muted-foreground">nuvem cinza (sem proxy)</p>}
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {record.type}
        {record.priority != null && ` · ${record.priority}`}
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1">
          <code className="truncate rounded bg-[#f4f6f8] px-1.5 py-0.5 text-xs">{record.name}</code>
          <CopyButton value={record.name} label="nome" />
        </div>
        <div className="flex items-center gap-1">
          <code className="truncate rounded bg-[#f4f6f8] px-1.5 py-0.5 text-xs" title={record.value}>
            {record.value}
          </code>
          <CopyButton value={record.value} label="conteúdo" />
        </div>
      </div>
      <RecordStatus status={record.status} />
    </li>
  );
}

/** Domínio de envio do Resend: registros DNS, verificação, rastreio, webhook e plano. */
export function SendingSetupCard() {
  const { health, loading, error, reload } = useSendingHealth();
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const domain = senderDomain(health);
  const ready = isDomainReady(domain?.status);
  const missing = domain?.records.filter((r) => r.status !== "verified") ?? [];

  const handleVerify = async () => {
    if (!domain) return;
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const res = await fetch("/api/email-marketing/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: domain.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao verificar.");
      setVerifyMessage("Verificação pedida. O Resend leva de alguns segundos a alguns minutos; a lista atualiza sozinha.");
      setTimeout(() => void reload(), 8000);
    } catch (err) {
      setVerifyMessage(err instanceof Error ? err.message : "Erro ao verificar.");
    } finally {
      setVerifying(false);
    }
  };

  const copyAll = () => {
    if (!domain) return;
    const lines = domain.records.map(
      (r) => `${r.type}\t${r.name}\t${r.value}${r.priority != null ? `\tprioridade ${r.priority}` : ""}`
    );
    void navigator.clipboard.writeText(
      `Registros DNS para ${domain.name} (zona bismarchipires.com.br, TTL automático, sem proxy):\n${lines.join("\n")}`
    );
    setVerifyMessage("Registros copiados. É só colar na mensagem para quem cuida do Cloudflare.");
  };

  return (
    <section className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-[#eaf2f5] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Envio de e-mails (Resend)</h2>
          <p className="text-sm text-muted-foreground">
            Campanhas saem pelo Marketing do Resend: grátis, sem limite por dia, até 1.000 contatos por mês.
          </p>
        </div>
        <a
          href="https://resend.com/domains"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[#285f7a] hover:underline"
        >
          Painel do Resend
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      {loading && !health ? (
        <div className="m-5 h-40 animate-pulse rounded-md bg-[#f4f6f8]" />
      ) : error || !health ? (
        <p className="px-5 py-4 text-sm text-red-700">{error ?? "Não foi possível consultar o Resend."}</p>
      ) : !health.configured ? (
        <p className="px-5 py-4 text-sm text-red-700">RESEND_API_KEY não configurada no ambiente.</p>
      ) : !domain ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum domínio cadastrado no Resend.</p>
      ) : (
        <>
          <div className="grid gap-4 border-b border-[#eaf2f5] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Domínio</p>
              <p className="truncate text-sm font-medium">{domain.name}</p>
              <span
                className={cn(
                  "mt-1 inline-flex h-6 items-center rounded-full px-2 text-xs font-medium",
                  ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                )}
              >
                {DOMAIN_STATUS_LABEL[domain.status] ?? domain.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remetente</p>
              <p className="truncate text-sm font-medium">{health.sender?.fromName}</p>
              <p className="truncate text-xs text-muted-foreground">{health.sender?.fromEmail || "não configurado"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rastreio e retorno</p>
              <p className="text-sm font-medium">
                {domain.openTracking && domain.clickTracking ? "Aberturas e cliques" : "Sem rastreio"}
              </p>
              <p className="text-xs text-muted-foreground">
                Webhook{" "}
                {health.webhook?.status === "enabled"
                  ? health.webhook.secretConfigured
                    ? "ativo"
                    : "criado, falta RESEND_WEBHOOK_SECRET no servidor"
                  : "não criado"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contatos no Marketing do Resend</p>
              <p className="text-sm font-medium tabular-nums">
                {health.plan?.contactsInResend ?? 0} de {health.plan?.marketingContactsLimit ?? 1000}
              </p>
              <p className="text-xs text-muted-foreground">{health.plan?.subscribedContacts ?? 0} inscritos na base</p>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Registros DNS no Cloudflare</h3>
                <p className="text-xs text-muted-foreground">
                  {missing.length === 0
                    ? "Todos os registros conferem."
                    : `${missing.length} de ${domain.records.length} ainda não foram encontrados. Todos ficam dentro de "news.", sem mexer no e-mail principal.`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={copyAll}>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar todos
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleVerify} disabled={verifying}>
                  <RefreshCcw className={cn("h-3.5 w-3.5", verifying && "animate-spin")} />
                  {verifying ? "Verificando..." : "Verificar agora"}
                </Button>
              </div>
            </div>
            <ul className="mt-2 divide-y divide-[#eaf2f5]">
              {domain.records.map((record) => (
                <RecordRow key={`${record.kind}-${record.type}-${record.name}`} record={record} />
              ))}
            </ul>
            {verifyMessage && (
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                {verifyMessage}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
