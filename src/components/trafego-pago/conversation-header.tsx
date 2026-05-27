"use client";

import { CalendarPlus, Clock, MapPin, Megaphone, MoreVertical, PanelRightOpen, Phone, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappConversationTags } from "@/components/trafego-pago/whatsapp-conversation-tags";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import {
  formatRelativeLeadTime,
  isMetaLead,
  leadCampaign,
  leadDisplayName,
  leadLocation,
  leadPhone,
  leadResponsible,
} from "./whatsapp-crm-utils";

interface ConversationHeaderProps {
  conversation: WhatsappConversation;
  tagSuggestions: string[];
  savingTags: boolean;
  detailsOpen?: boolean;
  onSaveTags: (conversationId: string, tags: string[]) => void;
  onToggleDetails?: () => void;
}

export function ConversationHeader({
  conversation,
  tagSuggestions,
  savingTags,
  detailsOpen = true,
  onSaveTags,
  onToggleDetails,
}: ConversationHeaderProps) {
  const name = leadDisplayName(conversation);
  const location = leadLocation(conversation);
  const responsible = leadResponsible(conversation);
  const stage = conversation.pipeline_stage ?? "lead_recebido";

  return (
    <header className="z-10 border-b bg-white px-5 py-4 shadow-sm dark:bg-card">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <WhatsappLeadAvatar name={name} avatarUrl={conversation.avatar_url} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold tracking-tight">{name}</h2>
              {isMetaLead(conversation) && (
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Novo lead
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {leadPhone(conversation)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Entrou {formatRelativeLeadTime(conversation.last_message_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {onToggleDetails && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg xl:inline-flex"
              onClick={onToggleDetails}
            >
              <PanelRightOpen className="h-4 w-4" />
              {detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled
            title="Em breve: mover etapa no CRM"
          >
            <Route className="h-4 w-4" />
            Mover etapa
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled
            title="Em breve: criar tarefa vinculada ao lead"
          >
            <CalendarPlus className="h-4 w-4" />
            Criar tarefa
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-lg"
            aria-label="Mais opções"
            disabled
            title="Em breve: mais ações do lead"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {isMetaLead(conversation) && (
          <InfoPill>
            <Megaphone className="h-3 w-3" />
            Origem: Meta Ads
          </InfoPill>
        )}
        <InfoPill>Campanha: {leadCampaign(conversation)}</InfoPill>
        <InfoPill>Responsável: {responsible}</InfoPill>
        <InfoPill>Etapa: {stage}</InfoPill>
        <WhatsappConversationTags
          compact
          tags={conversation.tags ?? []}
          suggestions={tagSuggestions}
          saving={savingTags}
          onChange={(tags) => onSaveTags(conversation.id, tags)}
        />
      </div>
    </header>
  );
}

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
      {children}
    </span>
  );
}
