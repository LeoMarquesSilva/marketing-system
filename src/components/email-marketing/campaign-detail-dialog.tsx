"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  CircleDashed,
  FlaskConical,
  Monitor,
  Pencil,
  Reply,
  Send,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import {
  cancelScheduledCampaign,
  EMAIL_RECIPIENT_STATUS_LABEL,
  fetchEmailCampaignRecipients,
  fetchEmailCampaignStats,
  sendEmailCampaign,
  type CampaignSendProgress,
  type EmailCampaign,
  type EmailCampaignRecipient,
  type EmailCampaignStats,
  type EmailContact,
  type EmailRecipientStatus,
} from "@/lib/email-marketing";
import { SAMPLE_MERGE_CONTEXT, unsupportedBroadcastTags } from "@/lib/email-marketing-merge-tags";

/** Variáveis que o envio pela caixa do remetente preenche: as do contato, o destinatário (links) e o descadastro. */
const MAILBOX_TAGS = new Set([...Object.keys(SAMPLE_MERGE_CONTEXT), "destinatario", "unsubscribe_url"]);

/** No envio pela caixa, só fica sem dado o que não é variável conhecida nem campo do RD (rd_…) do contato. */
function unsupportedMailboxTags(...textos: string[]): string[] {
  const tags = textos.flatMap((texto) => [...texto.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]));
  return [...new Set(tags.filter((tag) => !MAILBOX_TAGS.has(tag.toLowerCase()) && !tag.toLowerCase().startsWith("rd_")))];
}
import { CampaignStatusPill, useCampaignSender, type CampaignAudience } from "./campaigns-tab";
import { isOfficeMailbox, MAILBOX_SECONDS_PER_EMAIL, mailboxDuration, MicrosoftMark, SendModeBadge } from "./send-mode";
import { useCampaignPreviewDoc } from "./campaign-thumbnail";
import { isDomainReady } from "./sending-health";
import { senderDomain, type SendingHealth } from "./use-sending-health";
import { ClientLogo, ClientLogoStack, clientLabel, clientOf, PersonPhoto } from "./email-marketing-visuals";

interface CampaignDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: EmailCampaign | null;
  stats: EmailCampaignStats | null;
  health: SendingHealth | null;
  /** Tamanho do público antes do envio (contatos da lista ou inscritos). */
  audienceEstimate: number;
  /** Público já com os clientes (logos) que vão receber. */
  audience: CampaignAudience | null;
  /** Base de contatos, para mostrar o cliente de cada destinatário. */
  contacts: EmailContact[];
  onChanged: () => void | Promise<void>;
  onEdit: (campaign: EmailCampaign) => void;
}

type Stage = "idle" | "confirm" | "sending" | "done";

const pct = (value: number, base: number) => (base > 0 ? Math.round((value / base) * 100) : 0);

function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function ChecklistItem({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-emerald-100 text-emerald-700" : warn ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"
        )}
      >
        {ok ? <Check className="h-3.5 w-3.5" /> : warn ? <CircleDashed className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </span>
      <span className={cn(ok ? "text-foreground" : "text-foreground/90")}>{children}</span>
    </li>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 border-b border-[#eaf2f5] px-5 py-4 last:border-b-0", className)}>
      <h3 className="text-sm font-semibold text-[#0d2a38]">{title}</h3>
      {children}
    </section>
  );
}

const RECIPIENT_FILTERS: { id: string; label: string; match: (s: EmailRecipientStatus) => boolean }[] = [
  { id: "todos", label: "Todos", match: () => true },
  { id: "abriram", label: "Abriram", match: (s) => s === "opened" || s === "clicked" },
  { id: "clicaram", label: "Clicaram", match: (s) => s === "clicked" },
  { id: "problemas", label: "Problemas", match: (s) => ["bounced", "complained", "failed", "skipped"].includes(s) },
];

const RECIPIENT_TONE: Partial<Record<EmailRecipientStatus, string>> = {
  opened: "bg-[#47cdd0]/15 text-[#285f7a]",
  clicked: "bg-[#48466e]/10 text-[#48466e]",
  delivered: "bg-emerald-100 text-emerald-800",
  bounced: "bg-red-100 text-red-800",
  complained: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-amber-100 text-amber-900",
};

const OPENED: EmailRecipientStatus[] = ["opened", "clicked"];

/** Abertura por cliente: quais clientes leram a campanha (relatório por conta, como nos CRMs B2B). */
function ByClient({ recipients, contactById }: { recipients: EmailCampaignRecipient[]; contactById: Map<string, EmailContact> }) {
  const rows = useMemo(() => {
    const map = new Map<string, { key: string; group: string | null; company: string | null; total: number; opened: number; clicked: number }>();
    for (const r of recipients) {
      const contact = contactById.get(r.contactId);
      const client = contact ? clientOf(contact) : null;
      if (!client) continue;
      const row = map.get(client.key) ?? { ...client, total: 0, opened: 0, clicked: 0 };
      row.total++;
      if (OPENED.includes(r.status)) row.opened++;
      if (r.status === "clicked") row.clicked++;
      map.set(client.key, row);
    }
    return Array.from(map.values())
      .sort((a, b) => b.opened - a.opened || b.total - a.total)
      .slice(0, 8);
  }, [recipients, contactById]);

  if (!rows.length) return null;
  return (
    <Section title="Por cliente">
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <ClientLogo group={row.group} company={row.company} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-[#0d2a38]">{clientLabel(row)}</span>
                <span className="shrink-0 text-xs tabular-nums text-[#5a717b]">
                  {row.opened} de {row.total} abriram
                  {row.clicked > 0 && ` · ${row.clicked} clicaram`}
                </span>
              </div>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#eaf2f5]">
                <span className="block h-full rounded-full bg-[#47cdd0]" style={{ width: `${pct(row.opened, row.total)}%` }} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ResultsPanel({ campaign, stats, contacts }: { campaign: EmailCampaign; stats: EmailCampaignStats | null; contacts: EmailContact[] }) {
  const [recipients, setRecipients] = useState<EmailCampaignRecipient[] | null>(null);
  const [filter, setFilter] = useState("todos");
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  useEffect(() => {
    let cancelled = false;
    fetchEmailCampaignRecipients(campaign.id)
      .then((rows) => !cancelled && setRecipients(rows))
      .catch(() => !cancelled && setRecipients([]));
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  const s = stats;
  const base = s?.sent || s?.total || 0;
  const rows = (recipients ?? []).filter((r) => RECIPIENT_FILTERS.find((f) => f.id === filter)!.match(r.status));
  const problems = s ? s.bounced + s.complained + s.failed + s.skipped : 0;

  return (
    <>
      <Section title="Resultado">
        {s ? (
          <div className="space-y-2.5">
            {[
              // Pela caixa do remetente não há "entregue": o funil é enviados → abriram → clicaram.
              campaign.sendMode === "mailbox"
                ? { label: "Enviados", value: s.sent, base: s.total || s.sent, tone: "bg-[#347796]" }
                : { label: "Entregues", value: s.delivered, base, tone: "bg-[#347796]" },
              { label: "Abriram", value: s.opened, base, tone: "bg-[#47cdd0]" },
              { label: "Clicaram", value: s.clicked, base, tone: "bg-[#48466e]" },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums">
                    <strong className="font-semibold">{pct(row.value, row.base)}%</strong>{" "}
                    <span className="text-muted-foreground">
                      · {row.value} de {row.base}
                    </span>
                  </span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-[#eaf2f5]">
                  <span className={cn("block h-full rounded-full", row.tone)} style={{ width: `${pct(row.value, row.base)}%` }} />
                </span>
              </div>
            ))}
            {campaign.sendMode === "mailbox" && (
              <p className="text-xs text-muted-foreground">
                Saiu da caixa de {campaign.fromEmail}: respostas e avisos de não entrega chegam lá, não aqui.
              </p>
            )}
            {problems > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                {s.bounced > 0 && <>{s.bounced} retornaram · </>}
                {s.complained > 0 && <>{s.complained} marcaram como spam · </>}
                {s.skipped > 0 && <>{s.skipped} descadastrados · </>}
                {s.failed > 0 && <>{s.failed} falharam</>}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Aberturas são estimadas: alguns leitores (Apple Mail, Outlook com imagens bloqueadas) mudam a contagem.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Os números aparecem assim que o Resend começar a devolver os eventos.</p>
        )}
      </Section>
      {recipients && <ByClient recipients={recipients} contactById={contactById} />}
      <Section title="Destinatários" className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap gap-1">
          {RECIPIENT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-8 rounded-md px-2.5 text-xs transition-colors",
                filter === f.id ? "bg-[#347796] font-medium text-white" : "bg-[#eaf2f5] text-[#285f7a] hover:bg-[#dcebef]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {recipients === null ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém neste filtro.</p>
        ) : (
          <ul className="divide-y divide-[#eaf2f5] overflow-y-auto">
            {rows.slice(0, 300).map((r) => {
              const contact = contactById.get(r.contactId);
              const client = contact ? clientOf(contact) : null;
              return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ClientLogo group={client?.group} company={client?.company} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#0d2a38]">{r.contactName || r.contactEmail}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {client ? clientLabel(client) : r.contactName ? r.contactEmail : "Sem cliente vinculado"}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs",
                    RECIPIENT_TONE[r.status] ?? "bg-[#eef2f4] text-[#4b5b66]"
                  )}
                  title={r.failedReason ?? undefined}
                >
                  {EMAIL_RECIPIENT_STATUS_LABEL[r.status]}
                  {r.clickCount > 1 && ` · ${r.clickCount}×`}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

export function CampaignDetailDialog({
  open,
  onOpenChange,
  campaign,
  stats: initialStats,
  health,
  audienceEstimate,
  audience: audienceInfo,
  contacts,
  onChanged,
  onEdit,
}: CampaignDetailDialogProps) {
  const sender = useCampaignSender(campaign);
  const [stats, setStats] = useState<EmailCampaignStats | null>(initialStats);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmail, setTestEmail] = useState("");
  const [testSentTo, setTestSentTo] = useState<string | null>(null);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<"test" | "cancel" | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<CampaignSendProgress | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open || !campaign) return;
    setMessage(null);
    setTestSentTo(null);
    setScheduleOn(false);
    setScheduledAt(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    setStage("idle");
    setProgress(null);
    setDevice("desktop");
    setStats(initialStats);
    fetchEmailCampaignStats(campaign.id).then(setStats).catch(() => undefined);
    supabase.auth.getUser().then(({ data }) => setTestEmail((current) => current || data.user?.email || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só ao abrir outra campanha
  }, [open, campaign?.id]);

  const previewDoc = useCampaignPreviewDoc(campaign?.htmlBody ?? "", campaign?.previewText ?? null);
  const unsupported = useMemo(() => {
    if (!campaign) return [];
    const textos = [campaign.subject, campaign.previewText ?? "", campaign.htmlBody];
    // Pela caixa do remetente o ORQESTRAI monta cada e-mail (inclusive {{destinatario}}); o Resend só conhece algumas.
    return campaign.sendMode === "mailbox" ? unsupportedMailboxTags(...textos) : unsupportedBroadcastTags(...textos);
  }, [campaign]);

  if (!campaign) return null;

  const domain = senderDomain(health);
  const isMailbox = campaign.sendMode === "mailbox";
  const mailboxOk = isOfficeMailbox(campaign.fromEmail);
  // Pela caixa do remetente (Microsoft 365) o DNS do Resend não importa: o que vale é a caixa ser do escritório.
  const domainReady = isMailbox ? mailboxOk : isDomainReady(domain?.status);
  const isSent = campaign.status === "sent";
  const isScheduled = campaign.status === "scheduled";
  const canSend = ["draft", "failed", "sending", "paused"].includes(campaign.status);
  const audience = stats?.total || campaign.totalRecipients || audienceEstimate;
  const sendBlocked = !domainReady || !campaign.subject.trim();
  // A caixa do remetente envia na hora (um por um); agendar é só pelo Resend.
  const willSchedule = scheduleOn && !isMailbox;

  const handleSendTest = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const email = testEmail.trim();
      if (!email) throw new Error("Informe um e-mail para o teste.");
      const res = await fetch(`/api/email-marketing/campaigns/${campaign.id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar o teste.");
      setTestSentTo(email);
      setMessage({ type: "success", text: `Teste enviado para ${email}. Confira na caixa de entrada (e no lixo eletrônico).` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao enviar o teste." });
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    setStage("sending");
    setMessage(null);
    try {
      const result = await sendEmailCampaign(campaign.id, {
        scheduledAt: willSchedule && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        onProgress: setProgress,
      });
      setStage("done");
      setMessage({
        type: "success",
        text:
          result.phase === "scheduled"
            ? `Agendada para ${new Date(scheduledAt).toLocaleString("pt-BR")}. O Resend dispara sozinho no horário.`
            : result.mode === "mailbox"
              ? `Enviada pela caixa de ${campaign.fromEmail} para ${result.sent ?? audience} contatos${
                  result.failed ? ` (${result.failed} não saíram)` : ""
                }. Respostas e avisos de não entrega chegam nessa caixa.`
              : `Enviada para ${result.synced ?? result.totalRecipients ?? audience} contatos. Os números chegam conforme as pessoas recebem e abrem.`,
      });
      await onChanged();
    } catch (err) {
      setStage("idle");
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao enviar a campanha." });
      await onChanged();
    }
  };

  const handleCancelSchedule = async () => {
    setBusy("cancel");
    setMessage(null);
    try {
      await cancelScheduledCampaign(campaign.id);
      setMessage({ type: "success", text: "Agendamento cancelado. A campanha voltou para rascunho." });
      await onChanged();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao cancelar." });
    } finally {
      setBusy(null);
    }
  };

  const progressDone = progress?.mode === "mailbox" ? (progress.sent ?? 0) + (progress.failed ?? 0) : progress?.synced ?? 0;
  const syncPercent = progress?.total ? pct(progressDone, progress.total) : 0;
  const mailboxLeft = progress?.mode === "mailbox" && progress.total ? Math.max(progress.total - progressDone, 0) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => stage !== "sending" && onOpenChange(next)}>
      <DialogContent
        showCloseButton={stage !== "sending"}
        className="!flex h-[90dvh] max-h-[90dvh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusPill status={campaign.status} />
            {isScheduled && campaign.scheduledAt && (
              <span className="text-xs text-muted-foreground">
                sai em {new Date(campaign.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
          </div>
          <DialogTitle className="truncate text-lg">{campaign.name}</DialogTitle>
          <DialogDescription className="truncate">
            {campaign.subject || "Sem assunto definido"}
          </DialogDescription>
        </DialogHeader>

        {/* Abaixo de 1024 px vira uma coluna só, que rola inteira (prévia com altura fixa e os blocos embaixo);
            no computador, prévia e blocos lado a lado, cada um com a própria rolagem. */}
        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
          {/* Prévia do e-mail */}
          <div className="flex flex-col border-b bg-[#f4f6f8] lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-white/70 px-4 py-2">
              <p className="text-xs text-muted-foreground">Prévia com dados de exemplo</p>
              <div className="flex gap-1" role="group" aria-label="Tamanho da prévia">
                <Button
                  type="button"
                  size="icon-xs"
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  onClick={() => setDevice("desktop")}
                  aria-label="Ver como computador"
                >
                  <Monitor />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  onClick={() => setDevice("mobile")}
                  aria-label="Ver como celular"
                >
                  <Smartphone />
                </Button>
              </div>
            </div>
            <div className="h-[460px] overflow-y-auto p-4 sm:p-6 lg:h-auto lg:min-h-0 lg:flex-1">
              <div
                className="mx-auto h-full min-h-[560px] overflow-hidden rounded-md border bg-white shadow-sm transition-[max-width]"
                style={{ maxWidth: device === "desktop" ? 680 : 390 }}
              >
                <iframe title="Prévia do e-mail" srcDoc={previewDoc} sandbox="" className="h-full min-h-[560px] w-full border-0" />
              </div>
            </div>
          </div>

          {/* Blocos do envio (dentro do Dialog centralizado) */}
          <div className="flex flex-col lg:min-h-0 lg:overflow-y-auto">
            <Section title="Quem assina">
              <div className="flex items-center gap-3">
                <PersonPhoto name={sender?.name ?? campaign.fromName} photo={sender?.photo} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#0d2a38]">{sender?.name ?? campaign.fromName}</p>
                  <p className="truncate text-xs text-muted-foreground">{campaign.fromEmail}</p>
                </div>
              </div>
              <SendModeBadge mode={campaign.sendMode} />
              {isMailbox ? (
                <>
                  <p className="text-xs text-[#3b5560]">
                    Um e-mail por pessoa, da caixa Microsoft 365 de quem assina. Respostas e avisos de não entrega chegam nessa caixa.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O e-mail sai pelo endereço principal dessa caixa no Microsoft 365, que pode ser outro apelido da mesma pessoa.
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-2 text-xs text-[#3b5560]">
                  <Reply className="h-3.5 w-3.5 shrink-0 text-[#3e84a8]" />
                  <span className="truncate">Respostas vão para {campaign.replyTo || campaign.fromEmail}</span>
                </p>
              )}
            </Section>

            <Section title="Público">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium leading-snug text-[#0d2a38]">{campaign.listName ?? "Todos os contatos inscritos"}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {audience > 0 ? `${audience.toLocaleString("pt-BR")} contatos` : "Sem contatos inscritos"}
                    {audienceInfo && audienceInfo.clients.length > 0 && ` · ${audienceInfo.clients.length} clientes`}
                  </p>
                </div>
              </div>
              {audienceInfo && audienceInfo.clients.length > 0 && (
                <div className="space-y-1.5 rounded-md bg-[#f7fafb] px-3 py-2.5">
                  <ClientLogoStack clients={audienceInfo.clients} max={8} size="sm" />
                  <p className="line-clamp-2 text-xs text-[#5a717b]">
                    <Building2 className="mr-1 inline size-3.5 align-[-2px] text-[#3e84a8]" />
                    {audienceInfo.clients
                      .slice(0, 4)
                      .map(clientLabel)
                      .join(", ")}
                    {audienceInfo.clients.length > 4 && ` e mais ${audienceInfo.clients.length - 4}`}
                  </p>
                </div>
              )}
            </Section>

            {campaign.lastError && !isSent && (
              <div className="mx-5 mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Última tentativa parou em: {campaign.lastError}</span>
              </div>
            )}

            {isSent ? (
              <ResultsPanel campaign={campaign} stats={stats} contacts={contacts} />
            ) : (
              <>
                {canSend && (
                  <Section title="Antes de enviar">
                    <ul className="space-y-2">
                      {isMailbox ? (
                        <ChecklistItem ok={mailboxOk}>
                          {mailboxOk
                            ? `Sai da caixa de ${campaign.fromEmail}`
                            : "O e-mail que envia precisa ser uma caixa @bismarchipires.com.br (edite a campanha)"}
                        </ChecklistItem>
                      ) : (
                        <ChecklistItem ok={domainReady}>
                          {domainReady ? "Domínio de envio verificado" : "Domínio de envio ainda sem os registros DNS"}
                        </ChecklistItem>
                      )}
                      <ChecklistItem ok={Boolean(campaign.subject.trim())}>Assunto preenchido</ChecklistItem>
                      <ChecklistItem ok={Boolean(campaign.previewText?.trim())} warn>
                        {campaign.previewText?.trim() ? "Texto de pré-visualização preenchido" : "Sem texto de pré-visualização (opcional)"}
                      </ChecklistItem>
                      <ChecklistItem ok={Boolean(testSentTo)} warn>
                        {testSentTo ? `Teste enviado para ${testSentTo}` : "Envie um teste e confira no celular"}
                      </ChecklistItem>
                      <ChecklistItem ok={unsupported.length === 0} warn>
                        {unsupported.length === 0
                          ? "Personalização compatível com o envio"
                          : `${isMailbox ? "Sem dado para preencher" : "Saem em branco"}: ${unsupported.map((t) => `{{${t}}}`).join(", ")}`}
                      </ChecklistItem>
                      <ChecklistItem ok>Link de descadastro incluído no rodapé</ChecklistItem>
                    </ul>
                  </Section>
                )}

                {canSend && (
                  <Section title="Enviar teste">
                    <div className="flex gap-2">
                      <Label htmlFor="campaign-test-email" className="sr-only">
                        E-mail para o teste
                      </Label>
                      <Input
                        id="campaign-test-email"
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="seu-email@bismarchipires.com.br"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0 gap-1.5"
                        onClick={handleSendTest}
                        disabled={busy === "test" || !domainReady}
                      >
                        <FlaskConical className="h-4 w-4" />
                        {busy === "test" ? "Enviando..." : "Testar"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isMailbox ? `Sai da caixa de ${campaign.fromEmail}, ` : ""}
                      com dados de exemplo no lugar do nome e &quot;[TESTE]&quot; no assunto.
                    </p>
                  </Section>
                )}

                {canSend && isMailbox && (
                  <Section title="Quando enviar">
                    <p className="text-sm text-[#0d2a38]">
                      Sai na hora, um e-mail a cada {String(MAILBOX_SECONDS_PER_EMAIL).replace(".", ",")} s (limite do Microsoft 365).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {audience > 0 ? `${audience.toLocaleString("pt-BR")} contatos levam ${mailboxDuration(audience)}. ` : ""}
                      Mantenha a janela aberta; se fechar, &quot;Continuar envio&quot; retoma de onde parou.
                    </p>
                  </Section>
                )}

                {canSend && !isMailbox && (
                  <Section title="Quando enviar">
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-[#eaf2f5] p-1" role="radiogroup" aria-label="Quando enviar">
                      {[
                        { on: false, label: "Agora" },
                        { on: true, label: "Agendar" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          role="radio"
                          aria-checked={scheduleOn === opt.on}
                          onClick={() => setScheduleOn(opt.on)}
                          className={cn(
                            "h-9 rounded text-sm transition-colors",
                            scheduleOn === opt.on ? "bg-white font-medium text-foreground shadow-sm" : "text-[#285f7a]"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {scheduleOn && (
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-schedule">Data e hora</Label>
                        <Input
                          id="campaign-schedule"
                          type="datetime-local"
                          value={scheduledAt}
                          min={toLocalInput(new Date())}
                          onChange={(e) => setScheduledAt(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Os contatos são preparados agora e o Resend dispara sozinho no horário.
                        </p>
                      </div>
                    )}
                  </Section>
                )}

                {isScheduled && (
                  <Section title="Agendamento">
                    <p className="flex items-center gap-2 text-sm">
                      <CalendarClock className="h-4 w-4 text-[#48466e]" />
                      {campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString("pt-BR") : "—"}
                    </p>
                    <Button variant="outline" onClick={handleCancelSchedule} disabled={busy === "cancel"}>
                      {busy === "cancel" ? "Cancelando..." : "Cancelar agendamento"}
                    </Button>
                  </Section>
                )}
              </>
            )}
          </div>
        </div>

        {/* Rodapé fixo: mensagens, confirmação e progresso */}
        <div className="shrink-0 space-y-3 border-t bg-white px-6 py-4">
          {message && (
            <p
              role={message.type === "error" ? "alert" : "status"}
              className={cn("text-sm", message.type === "error" ? "text-red-700" : "text-emerald-700")}
            >
              {message.text}
            </p>
          )}

          {stage === "sending" && (
            <div className="space-y-1.5" role="status">
              <div className="flex justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {isMailbox && <MicrosoftMark />}
                  <span className="truncate">
                    {isMailbox
                      ? `Enviando pela caixa de ${campaign.fromEmail}`
                      : progress?.phase === "syncing" || !progress
                        ? "Preparando os contatos no Resend..."
                        : "Disparando..."}
                  </span>
                </span>
                {progress?.total ? (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {progressDone} de {progress.total}
                  </span>
                ) : null}
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-[#eaf2f5]">
                <span className="block h-full rounded-full bg-[#347796] transition-[width]" style={{ width: `${Math.max(syncPercent, 4)}%` }} />
              </span>
              <p className="text-xs text-muted-foreground">
                {isMailbox && mailboxLeft !== null && mailboxLeft > 0 && `Faltam ${mailboxDuration(mailboxLeft)}. `}
                {isMailbox && progress?.failed ? `${progress.failed} não saíram até agora. ` : ""}
                Não feche esta janela até terminar
                {isMailbox ? "; se fechar, \"Continuar envio\" retoma de onde parou." : "."}
              </p>
            </div>
          )}

          {stage === "confirm" && (
            <div className="flex flex-col gap-3 rounded-md border border-[#347796]/30 bg-[#347796]/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {willSchedule ? "Agendar" : "Enviar agora"}
                {isMailbox && <> pela caixa de {campaign.fromEmail}</>} para{" "}
                <strong>{audience > 0 ? audience.toLocaleString("pt-BR") : "todos os"} contatos</strong>
                {willSchedule && scheduledAt && <> em {new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</>}?
                {isMailbox && audience > 0 && (
                  <span className="block text-xs text-[#3b5560]">Leva {mailboxDuration(audience)}; mantenha a janela aberta.</span>
                )}
                {!testSentTo && <span className="block text-xs text-amber-800">Você ainda não enviou um teste.</span>}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStage("idle")}>
                  Voltar
                </Button>
                <Button onClick={handleSend} className="gap-1.5">
                  <Send className="h-4 w-4" />
                  Confirmar
                </Button>
              </div>
            </div>
          )}

          {(stage === "idle" || stage === "done") && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {(campaign.status === "draft" || campaign.status === "failed") && (
                  <Button variant="secondary" className="gap-1.5" onClick={() => onEdit(campaign)}>
                    <Pencil className="h-4 w-4" />
                    Editar e-mail
                  </Button>
                )}
                {canSend && stage === "idle" && (
                  <Button
                    className="gap-1.5"
                    onClick={() => setStage("confirm")}
                    disabled={sendBlocked}
                    title={sendBlocked ? "Disponível quando o domínio estiver verificado e o assunto preenchido" : undefined}
                  >
                    {willSchedule ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {campaign.status === "sending" ? "Continuar envio" : willSchedule ? "Agendar envio" : "Enviar agora"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
