"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  type EmailRecipientStatus,
} from "@/lib/email-marketing";
import { unsupportedBroadcastTags } from "@/lib/email-marketing-merge-tags";
import { CampaignStatusPill } from "./campaigns-tab";
import { useCampaignPreviewDoc } from "./campaign-thumbnail";
import { isDomainReady } from "./sending-health";
import { senderDomain, type SendingHealth } from "./use-sending-health";

interface CampaignDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: EmailCampaign | null;
  stats: EmailCampaignStats | null;
  health: SendingHealth | null;
  /** Tamanho do público antes do envio (contatos da lista ou inscritos). */
  audienceEstimate: number;
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
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
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

function ResultsPanel({ campaign, stats }: { campaign: EmailCampaign; stats: EmailCampaignStats | null }) {
  const [recipients, setRecipients] = useState<EmailCampaignRecipient[] | null>(null);
  const [filter, setFilter] = useState("todos");

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
              { label: "Entregues", value: s.delivered, tone: "bg-[#347796]" },
              { label: "Abriram", value: s.opened, tone: "bg-[#47cdd0]" },
              { label: "Clicaram", value: s.clicked, tone: "bg-[#48466e]" },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums">
                    <strong className="font-semibold">{pct(row.value, base)}%</strong>{" "}
                    <span className="text-muted-foreground">· {row.value} de {base}</span>
                  </span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-[#eaf2f5]">
                  <span className={cn("block h-full rounded-full", row.tone)} style={{ width: `${pct(row.value, base)}%` }} />
                </span>
              </div>
            ))}
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
            {rows.slice(0, 300).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.contactName || r.contactEmail}</p>
                  {r.contactName && <p className="truncate text-xs text-muted-foreground">{r.contactEmail}</p>}
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
            ))}
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
  onChanged,
  onEdit,
}: CampaignDetailDialogProps) {
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
  const unsupported = useMemo(
    () => (campaign ? unsupportedBroadcastTags(campaign.subject, campaign.previewText ?? "", campaign.htmlBody) : []),
    [campaign]
  );

  if (!campaign) return null;

  const domain = senderDomain(health);
  const domainReady = isDomainReady(domain?.status);
  const isSent = campaign.status === "sent";
  const isScheduled = campaign.status === "scheduled";
  const canSend = ["draft", "failed", "sending", "paused"].includes(campaign.status);
  const audience = stats?.total || campaign.totalRecipients || audienceEstimate;
  const sendBlocked = !domainReady || !campaign.subject.trim();

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
        scheduledAt: scheduleOn && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        onProgress: setProgress,
      });
      setStage("done");
      setMessage({
        type: "success",
        text:
          result.phase === "scheduled"
            ? `Agendada para ${new Date(scheduledAt).toLocaleString("pt-BR")}. O Resend dispara sozinho no horário.`
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

  const syncPercent = progress?.total ? pct(progress.synced ?? 0, progress.total) : 0;

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

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Prévia do e-mail */}
          <div className="flex min-h-0 flex-col border-b bg-[#f4f6f8] lg:border-b-0 lg:border-r">
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
            <div className="min-h-[320px] flex-1 overflow-y-auto p-4 sm:p-6">
              <div
                className="mx-auto h-full min-h-[560px] overflow-hidden rounded-md border bg-white shadow-sm transition-[max-width]"
                style={{ maxWidth: device === "desktop" ? 680 : 390 }}
              >
                <iframe title="Prévia do e-mail" srcDoc={previewDoc} sandbox="" className="h-full min-h-[560px] w-full border-0" />
              </div>
            </div>
          </div>

          {/* Painel lateral do modal (dentro do Dialog centralizado) */}
          <div className="flex min-h-0 flex-col overflow-y-auto">
            <Section title="Envio">
              <dl className="space-y-2.5 text-sm">
                <div className="flex gap-2.5">
                  <Send className="mt-0.5 h-4 w-4 shrink-0 text-[#3e84a8]" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">De</dt>
                    <dd className="truncate">
                      {campaign.fromName} <span className="text-muted-foreground">&lt;{campaign.fromEmail}&gt;</span>
                    </dd>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Reply className="mt-0.5 h-4 w-4 shrink-0 text-[#3e84a8]" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Respostas vão para</dt>
                    <dd className="truncate">{campaign.replyTo || campaign.fromEmail}</dd>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#3e84a8]" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Público</dt>
                    <dd>
                      {campaign.listName ?? "Todos os contatos inscritos"}
                      {audience > 0 && <span className="text-muted-foreground"> · {audience.toLocaleString("pt-BR")} contatos</span>}
                    </dd>
                  </div>
                </div>
              </dl>
            </Section>

            {campaign.lastError && !isSent && (
              <div className="mx-5 mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Última tentativa parou em: {campaign.lastError}</span>
              </div>
            )}

            {isSent ? (
              <ResultsPanel campaign={campaign} stats={stats} />
            ) : (
              <>
                {canSend && (
                  <Section title="Antes de enviar">
                    <ul className="space-y-2">
                      <ChecklistItem ok={domainReady}>
                        {domainReady ? "Domínio de envio verificado" : "Domínio de envio ainda sem os registros DNS"}
                      </ChecklistItem>
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
                          : `Saem em branco: ${unsupported.map((t) => `{{${t}}}`).join(", ")}`}
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
                      O teste usa dados de exemplo no lugar do nome e chega com &quot;[TESTE]&quot; no assunto.
                    </p>
                  </Section>
                )}

                {canSend && (
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
              <div className="flex justify-between text-sm">
                <span>{progress?.phase === "syncing" || !progress ? "Preparando os contatos no Resend..." : "Disparando..."}</span>
                {progress?.total ? (
                  <span className="tabular-nums text-muted-foreground">
                    {progress.synced ?? 0} de {progress.total}
                  </span>
                ) : null}
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-[#eaf2f5]">
                <span className="block h-full rounded-full bg-[#347796] transition-[width]" style={{ width: `${Math.max(syncPercent, 4)}%` }} />
              </span>
              <p className="text-xs text-muted-foreground">Não feche esta janela até terminar.</p>
            </div>
          )}

          {stage === "confirm" && (
            <div className="flex flex-col gap-3 rounded-md border border-[#347796]/30 bg-[#347796]/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {scheduleOn ? "Agendar" : "Enviar agora"} para <strong>{audience > 0 ? audience.toLocaleString("pt-BR") : "todos os"} contatos</strong>
                {scheduleOn && scheduledAt && <> em {new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</>}?
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
                    {scheduleOn ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {campaign.status === "sending" ? "Continuar envio" : scheduleOn ? "Agendar envio" : "Enviar agora"}
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
