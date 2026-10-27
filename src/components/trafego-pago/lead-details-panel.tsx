"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappAgentAvatar } from "@/components/trafego-pago/whatsapp-agent-avatar";
import { WhatsappConversationTags } from "@/components/trafego-pago/whatsapp-conversation-tags";
import { leadOriginMeta } from "@/components/trafego-pago/whatsapp-lead-origin";
import { formatMetaConversionApp } from "@/lib/evolution-meta-attribution";
import { cn } from "@/lib/utils";
import type { PipelineStage, WhatsappAgent, WhatsappConversation } from "./whatsapp-crm-types";
import { formatRelativeLeadTime, isMetaLead, isSiteLead, leadDisplayName, leadPhone } from "./whatsapp-crm-utils";
import { attendanceStatusLabel } from "./whatsapp-inbox-view";

const PIPELINE_STAGES: Array<{ value: PipelineStage; label: string }> = [
  { value: "lead_recebido", label: "Lead recebido" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta", label: "Proposta" },
  { value: "fechado", label: "Fechado" },
];

const QUALIFICATION_FIELDS: Array<{ key: "interesse" | "colaboradores" | "cipa" | "canal_denuncia"; label: string }> = [
  { key: "interesse", label: "Interesse" },
  { key: "colaboradores", label: "Funcionários" },
  { key: "cipa", label: "Possui CIPA" },
  { key: "canal_denuncia", label: "Canal de denúncia" },
];

interface LeadDetailsContentProps {
  conversation: WhatsappConversation;
  owner: WhatsappAgent | null;
  tagSuggestions: string[];
  savingTags: boolean;
  onSaveTags: (tags: string[]) => void;
  onUpdateCrm: (patch: Record<string, unknown>) => void;
}

/** Ficha do lead: usada na coluna da direita (telas largas) e no modal (demais). */
export function LeadDetailsContent({
  conversation,
  owner,
  tagSuggestions,
  savingTags,
  onSaveTags,
  onUpdateCrm,
}: LeadDetailsContentProps) {
  const name = leadDisplayName(conversation);
  const location = [conversation.city?.trim(), conversation.state?.trim()].filter(Boolean).join(" - ");
  const qualification = QUALIFICATION_FIELDS.filter((field) => conversation.qualification?.[field.key]?.trim());

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <WhatsappLeadAvatar name={name} avatarUrl={conversation.avatar_url} conversationId={conversation.id} className="size-16" />
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          <CopyablePhone conversation={conversation} />
          {location && <p className="text-xs text-muted-foreground">{location}</p>}
        </div>
      </div>

      <Section title="Atendimento">
        <Row label="Situação">{attendanceStatusLabel(conversation)}</Row>
        <Row label="Responsável">
          {owner ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <WhatsappAgentAvatar agent={owner} className="size-5" />
              <span className="truncate">{owner.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem responsável</span>
          )}
        </Row>
        {conversation.created_at && (
          <Row label="Primeiro contato">{new Date(conversation.created_at).toLocaleDateString("pt-BR")}</Row>
        )}
        <Row label="Última mensagem">{formatRelativeLeadTime(conversation.last_message_at)}</Row>
      </Section>

      <OriginSection conversation={conversation} />

      <Section title="Tags">
        <WhatsappConversationTags
          tags={conversation.tags ?? []}
          suggestions={tagSuggestions}
          saving={savingTags}
          onChange={onSaveTags}
        />
      </Section>

      <Section title="Etapa comercial">
        <Select
          value={conversation.pipeline_stage ?? "lead_recebido"}
          onValueChange={(pipeline_stage) => onUpdateCrm({ pipeline_stage })}
        >
          <SelectTrigger className="w-full" aria-label="Etapa comercial">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE_STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      {qualification.length > 0 && (
        <Section title="Qualificação">
          {qualification.map((field) => (
            <Row key={field.key} label={field.label}>
              {conversation.qualification?.[field.key]}
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

export function LeadDetailsPanel({
  className,
  ...props
}: Partial<LeadDetailsContentProps> & { className?: string }) {
  const { conversation } = props;
  return (
    <aside className={cn("min-h-0 flex-col border-l bg-white dark:bg-card", className)} aria-label="Detalhes do lead">
      {conversation ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <LeadDetailsContent
            conversation={conversation}
            owner={props.owner ?? null}
            tagSuggestions={props.tagSuggestions ?? []}
            savingTags={props.savingTags ?? false}
            onSaveTags={props.onSaveTags ?? (() => {})}
            onUpdateCrm={props.onUpdateCrm ?? (() => {})}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Os dados do lead aparecem aqui.
        </div>
      )}
    </aside>
  );
}

function OriginSection({ conversation }: { conversation: WhatsappConversation }) {
  const origin = leadOriginMeta(conversation);
  const OriginIcon = origin.icon;
  const app = formatMetaConversionApp(conversation.meta_conversion_app ?? null);

  return (
    <Section title="Origem">
      <p className="flex items-center gap-2 text-sm font-medium">
        <OriginIcon className="h-4 w-4 text-[#347796]" aria-hidden />
        {origin.origin === "outros" ? "Contato direto pelo WhatsApp" : origin.label}
      </p>
      {isMetaLead(conversation) && (
        <>
          {conversation.meta_campaign_name && <Row label="Campanha">{conversation.meta_campaign_name}</Row>}
          {conversation.meta_adset_name && <Row label="Conjunto">{conversation.meta_adset_name}</Row>}
          {conversation.meta_ad_title && <Row label="Anúncio">{conversation.meta_ad_title}</Row>}
          {app && <Row label="Veio pelo">{app}</Row>}
          {conversation.meta_ad_source_url && (
            <OriginLink href={conversation.meta_ad_source_url}>Ver anúncio</OriginLink>
          )}
        </>
      )}
      {isSiteLead(conversation) && conversation.site_lead_page_url && (
        <OriginLink href={conversation.site_lead_page_url}>
          {conversation.site_lead_page_title || "Página de origem"}
        </OriginLink>
      )}
    </Section>
  );
}

function CopyablePhone({ conversation }: { conversation: WhatsappConversation }) {
  const [copied, setCopied] = useState(false);
  const phone = leadPhone(conversation);
  if (!conversation.phone) return <p className="text-xs text-muted-foreground">{phone}</p>;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="h-7 text-muted-foreground"
      onClick={() => {
        void navigator.clipboard?.writeText(phone).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      aria-label={copied ? "Telefone copiado" : `Copiar telefone ${phone}`}
    >
      {phone}
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-4">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function OriginLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-sm text-[#347796] underline-offset-2 hover:underline"
    >
      <span className="truncate">{children}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  );
}
