"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Mail,
  MailCheck,
  MousePointerClick,
  Plus,
  Reply,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EMAIL_CAMPAIGN_STATUS_LABEL,
  type EmailCampaign,
  type EmailCampaignStats,
  type EmailCampaignStatus,
  type EmailContact,
  type EmailList,
  type EmailRdEmail,
} from "@/lib/email-marketing";
import { CampaignFormDialog, type CampaignFormStep } from "./campaign-form-dialog";
import { CampaignDetailDialog } from "./campaign-detail-dialog";
import { RdEmailsSection } from "./rd-emails-section";
import { CampaignThumbnail } from "./campaign-thumbnail";
import { SendingHealthStrip } from "./sending-health";
import { useSendingHealth } from "./use-sending-health";

interface CampaignsTabProps {
  campaigns: EmailCampaign[];
  stats: Record<string, EmailCampaignStats>;
  rdEmails: EmailRdEmail[];
  lists: EmailList[];
  contacts: EmailContact[];
  onChanged: () => void | Promise<void>;
}

type Filter = "todas" | "rascunhos" | "agendadas" | "enviadas";

const FILTERS: { id: Filter; label: string; match: (s: EmailCampaignStatus) => boolean }[] = [
  { id: "todas", label: "Todas", match: () => true },
  { id: "rascunhos", label: "Rascunhos", match: (s) => s === "draft" || s === "failed" || s === "paused" },
  { id: "agendadas", label: "Agendadas e em envio", match: (s) => s === "scheduled" || s === "sending" },
  { id: "enviadas", label: "Enviadas", match: (s) => s === "sent" },
];

export const STATUS_STYLE: Record<EmailCampaignStatus, string> = {
  draft: "bg-[#eef2f4] text-[#4b5b66]",
  scheduled: "bg-[#48466e]/10 text-[#48466e]",
  sending: "bg-sky-100 text-sky-800",
  sent: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

export function CampaignStatusPill({ status }: { status: EmailCampaignStatus }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", STATUS_STYLE[status])}>
      {EMAIL_CAMPAIGN_STATUS_LABEL[status]}
    </span>
  );
}

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return `hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function campaignMoment(c: EmailCampaign): string {
  if (c.status === "sent") return `Enviada ${formatWhen(c.sentAt ?? c.updatedAt)}`;
  if (c.status === "scheduled") return `Agendada para ${formatWhen(c.scheduledAt)}`;
  if (c.status === "sending") return "Preparando o envio";
  return `Editada ${formatWhen(c.updatedAt)}`;
}

const pct = (value: number, base: number) => (base > 0 ? Math.round((value / base) * 100) : 0);

function FunnelBar({ label, value, base, tone }: { label: string; value: number; base: number; tone: string }) {
  const percent = pct(value, base);
  return (
    <div className="grid grid-cols-[72px_1fr_64px] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[#eaf2f5]">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${percent}%` }} />
      </span>
      <span className="text-right tabular-nums text-foreground">
        {percent}% <span className="text-muted-foreground">({value})</span>
      </span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof Mail; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#dce9eb] bg-white px-4 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#47cdd0]/12 text-[#285f7a]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function CampaignsTab({ campaigns, stats, rdEmails, lists, contacts, onChanged }: CampaignsTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formInitialStep, setFormInitialStep] = useState<CampaignFormStep>("setup");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const { health, loading: healthLoading, error: healthError, reload: reloadHealth } = useSendingHealth();

  const viewing = campaigns.find((c) => c.id === viewingId) ?? null;
  const subscribed = useMemo(() => contacts.filter((c) => c.status === "subscribed").length, [contacts]);

  const totals = useMemo(() => {
    const sent = campaigns.filter((c) => c.status === "sent");
    const sum = sent.reduce(
      (acc, c) => {
        const s = stats[c.id];
        if (!s) return acc;
        acc.delivered += s.delivered;
        acc.opened += s.opened;
        acc.clicked += s.clicked;
        acc.base += s.sent;
        return acc;
      },
      { delivered: 0, opened: 0, clicked: 0, base: 0 }
    );
    return { sentCount: sent.length, ...sum };
  }, [campaigns, stats]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, campaigns.filter((c) => f.match(c.status)).length])) as Record<Filter, number>,
    [campaigns]
  );
  const visible = campaigns.filter((c) => FILTERS.find((f) => f.id === filter)!.match(c.status));

  const openCampaignForm = (campaign: EmailCampaign | null, step: CampaignFormStep) => {
    setEditing(campaign);
    setFormInitialStep(step);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <SendingHealthStrip health={health} loading={healthLoading} error={healthError} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Contatos inscritos" value={subscribed.toLocaleString("pt-BR")} hint="podem receber campanhas" />
        <StatTile icon={Send} label="Campanhas enviadas" value={String(totals.sentCount)} hint={`${campaigns.length} no total`} />
        <StatTile
          icon={MailCheck}
          label="Abertura média"
          value={totals.base ? `${pct(totals.opened, totals.base)}%` : "—"}
          hint={totals.base ? `${totals.opened} de ${totals.base} e-mails` : "aparece depois do 1º envio"}
        />
        <StatTile
          icon={MousePointerClick}
          label="Cliques"
          value={totals.base ? `${pct(totals.clicked, totals.base)}%` : "—"}
          hint={totals.base ? `${totals.clicked} pessoas clicaram` : "aparece depois do 1º envio"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-[#dce9eb] bg-white p-1" role="tablist" aria-label="Filtrar campanhas">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                filter === f.id ? "bg-[#347796] font-medium text-white" : "text-muted-foreground hover:bg-[#eaf2f5] hover:text-foreground"
              )}
            >
              {f.label}
              {counts[f.id] > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    filter === f.id ? "bg-white/20 text-white" : "bg-[#eaf2f5] text-[#285f7a]"
                  )}
                >
                  {counts[f.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button className="gap-2 self-start sm:self-auto" onClick={() => openCampaignForm(null, "setup")}>
          <Plus className="h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#47cdd0]/12 text-[#285f7a]">
            <Inbox className="h-5 w-5" />
          </span>
          <p className="font-medium">{campaigns.length === 0 ? "Nenhuma campanha ainda" : "Nada neste filtro"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {campaigns.length === 0
              ? "Monte a primeira campanha: escolha um modelo, o público e envie um teste antes de disparar."
              : "Troque o filtro para ver as outras campanhas."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((campaign) => {
            const s = stats[campaign.id];
            const audience = campaign.totalRecipients || s?.total || 0;
            const showFunnel = campaign.status === "sent" && s && s.sent > 0;
            return (
              <li key={campaign.id}>
                <button
                  type="button"
                  onClick={() => {
                    setViewingId(campaign.id);
                    setDetailOpen(true);
                  }}
                  className={cn(
                    "group flex w-full items-stretch gap-4 rounded-lg border border-[#dce9eb] bg-white p-3 text-left shadow-sm transition",
                    "hover:border-[#47cdd0]/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                  )}
                >
                  <CampaignThumbnail html={campaign.htmlBody} previewText={campaign.previewText} className="hidden sm:block" />
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CampaignStatusPill status={campaign.status} />
                      <span className="text-xs text-muted-foreground">{campaignMoment(campaign)}</span>
                    </div>
                    <p className="mt-1.5 truncate font-semibold text-foreground group-hover:text-[#285f7a]">{campaign.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {campaign.subject.trim() || <span className="italic">Sem assunto definido</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {campaign.listName ?? "Todos os inscritos"}
                        {audience > 0 && <> · {audience.toLocaleString("pt-BR")} contatos</>}
                      </span>
                      {campaign.replyTo && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Reply className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">respostas para {campaign.replyTo}</span>
                        </span>
                      )}
                    </div>
                    {campaign.lastError && campaign.status !== "sent" && (
                      <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-red-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {campaign.lastError}
                      </p>
                    )}
                  </div>
                  <div className="hidden w-[280px] shrink-0 flex-col justify-center gap-1.5 border-l border-[#eaf2f5] pl-4 md:flex">
                    {showFunnel ? (
                      <>
                        <FunnelBar label="Entregues" value={s.delivered} base={s.sent} tone="bg-[#347796]" />
                        <FunnelBar label="Abriram" value={s.opened} base={s.sent} tone="bg-[#47cdd0]" />
                        <FunnelBar label="Clicaram" value={s.clicked} base={s.sent} tone="bg-[#48466e]" />
                      </>
                    ) : campaign.status === "scheduled" ? (
                      <p className="inline-flex items-center gap-2 text-sm text-[#48466e]">
                        <CalendarClock className="h-4 w-4" />
                        Sai sozinha no horário marcado
                      </p>
                    ) : campaign.status === "sent" ? (
                      <p className="inline-flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Enviada; os números chegam em instantes
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Abra para revisar, enviar um teste e disparar.</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Precisa ajustar o domínio de envio ou ver os registros DNS?{" "}
        <Link href="/email-marketing/configuracoes" className="font-medium text-[#285f7a] underline-offset-2 hover:underline">
          Abrir configurações
        </Link>
      </p>

      <CampaignFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setFormInitialStep("setup");
          }
        }}
        campaign={editing}
        lists={lists}
        contacts={contacts}
        initialStep={formInitialStep}
        onSaved={onChanged}
      />
      <CampaignDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        campaign={viewing}
        stats={viewing ? stats[viewing.id] ?? null : null}
        health={health}
        audienceEstimate={
          viewing?.listId ? lists.find((l) => l.id === viewing.listId)?.contactCount ?? 0 : subscribed
        }
        onChanged={async () => {
          await onChanged();
          await reloadHealth();
        }}
        onEdit={(campaign) => {
          setDetailOpen(false);
          openCampaignForm(campaign, "editor");
        }}
      />

      <div className="border-t pt-8">
        <RdEmailsSection emails={rdEmails} />
      </div>
    </div>
  );
}
