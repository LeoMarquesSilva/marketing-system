"use client";

import type { ReactNode } from "react";
import { Archive, Check, Clock, Inbox, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappAgentAvatar } from "@/components/trafego-pago/whatsapp-agent-avatar";
import { leadOriginMeta } from "@/components/trafego-pago/whatsapp-lead-origin";
import { cn } from "@/lib/utils";
import type { LeadFilter, WhatsappAgent, WhatsappConversation } from "./whatsapp-crm-types";
import { leadDisplayName } from "./whatsapp-crm-utils";
import {
  INBOX_OWNER_TABS,
  INBOX_STATUS_TABS,
  STALE_CONVERSATION_DAYS,
  formatListTime,
  formatWaitingDuration,
  isLongWait,
  lastMessageIsOurs,
  waitingSince,
  type InboxOwnerTab,
  type InboxStatusTab,
  type InboxView,
} from "./whatsapp-inbox-view";

const LEAD_FILTERS: Array<{ id: LeadFilter; label: string }> = [
  { id: "all", label: "Todas as conversas" },
  { id: "unread", label: "Só não lidas" },
  { id: "meta_ads", label: "Anúncio Meta" },
  { id: "trafego_pago", label: "Tráfego pago" },
  { id: "site", label: "Site" },
  { id: "colaborador", label: "Colaborador" },
  { id: "grupo", label: "Grupos" },
];

interface LeadListProps {
  view: InboxView;
  totalConversations: number;
  selectedId: string | null;
  ownerTab: InboxOwnerTab;
  statusTab: InboxStatusTab;
  leadFilter: LeadFilter;
  searchQuery: string;
  agentsById: Map<string, WhatsappAgent>;
  staleCount: number;
  /** Indicador de conexão do WhatsApp, no canto do cabeçalho. */
  connectionSlot?: ReactNode;
  className?: string;
  onOwnerTabChange: (tab: InboxOwnerTab) => void;
  onStatusTabChange: (tab: InboxStatusTab) => void;
  onLeadFilterChange: (filter: LeadFilter) => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onResolveStale: () => void;
}

export function LeadList({
  view,
  totalConversations,
  selectedId,
  ownerTab,
  statusTab,
  leadFilter,
  searchQuery,
  agentsById,
  staleCount,
  connectionSlot,
  className,
  onOwnerTabChange,
  onStatusTabChange,
  onLeadFilterChange,
  onSearchChange,
  onSelect,
  onResolveStale,
}: LeadListProps) {
  const filtering = leadFilter !== "all" || searchQuery.trim().length > 0;
  const activeFilterLabel = LEAD_FILTERS.find((f) => f.id === leadFilter)?.label;

  return (
    <aside
      className={cn("flex min-h-0 flex-col border-r bg-white dark:bg-card", className)}
      aria-label="Conversas"
    >
      <div className="border-b px-3 pt-1">
        <div role="tablist" aria-label="Responsável" className="flex min-w-0 gap-1">
          {INBOX_OWNER_TABS.map((tab) => {
            const active = tab.id === ownerTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onOwnerTabChange(tab.id)}
                className={cn(
                  "relative flex h-10 items-center gap-1.5 whitespace-nowrap px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {view.ownerCounts[tab.id]}
                </span>
                {active && (
                  <span className="absolute inset-x-1 bottom-0 h-0.5 bg-[#347796]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-b px-3 py-2.5">
        <div
          role="tablist"
          aria-label="Situação do atendimento"
          className="flex gap-1 rounded-md bg-muted/60 p-1"
        >
          {INBOX_STATUS_TABS.map((tab) => {
            const active = tab.id === statusTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusTabChange(tab.id)}
                className={cn(
                  "flex h-8 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                  active
                    ? "bg-white text-foreground shadow-sm dark:bg-card"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.id === "waiting" ? "Aguardando" : tab.label}
                {tab.id !== "resolved" && (
                  <span className="tabular-nums text-muted-foreground">{view.statusCounts[tab.id]}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar nome, telefone ou tag"
              aria-label="Buscar conversas"
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={leadFilter === "all" ? "outline" : "secondary"}
                size="icon-sm"
                aria-label="Filtrar conversas"
                title="Filtrar"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              {LEAD_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onLeadFilterChange(filter.id)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                >
                  {filter.label}
                  {filter.id === leadFilter && <Check className="h-4 w-4 text-[#347796]" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {connectionSlot}
        </div>

        {leadFilter !== "all" && activeFilterLabel && (
          <button
            type="button"
            onClick={() => onLeadFilterChange("all")}
            className="inline-flex items-center gap-1 rounded-full bg-[#47cdd0]/15 px-2.5 py-1 text-xs font-medium text-[#1c1c1c] hover:bg-[#47cdd0]/25"
          >
            {activeFilterLabel}
            <X className="h-3.5 w-3.5" aria-label="Remover filtro" />
          </button>
        )}
      </div>

      {statusTab !== "resolved" && staleCount > 0 && (
        <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2.5">
          <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {staleCount === 1
              ? `1 conversa sem mensagem há mais de ${STALE_CONVERSATION_DAYS} dias`
              : `${staleCount} conversas sem mensagem há mais de ${STALE_CONVERSATION_DAYS} dias`}
          </p>
          <Button type="button" variant="outline" size="xs" onClick={onResolveStale}>
            Resolver
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view.conversations.length === 0 ? (
          <ListEmptyState
            ownerTab={ownerTab}
            statusTab={statusTab}
            filtering={filtering}
            hasConversations={totalConversations > 0}
            onClearFilters={() => {
              onLeadFilterChange("all");
              onSearchChange("");
            }}
          />
        ) : (
          <ul>
            {view.conversations.map((conversation) => (
              <li key={conversation.id}>
                <LeadListItem
                  conversation={conversation}
                  owner={conversation.owner_user_id ? agentsById.get(conversation.owner_user_id) : null}
                  selected={selectedId === conversation.id}
                  onSelect={() => onSelect(conversation.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function LeadListItem({
  conversation,
  owner,
  selected,
  onSelect,
}: {
  conversation: WhatsappConversation;
  owner: WhatsappAgent | null | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = leadDisplayName(conversation);
  const unread = conversation.unread_count > 0;
  const origin = leadOriginMeta(conversation);
  const OriginIcon = origin.icon;
  const since = waitingSince(conversation);
  const ours = lastMessageIsOurs(conversation);
  const tags = conversation.tags ?? [];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 border-b px-3 py-3 text-left outline-none transition-colors focus-visible:bg-[#47cdd0]/10",
        selected ? "bg-[#47cdd0]/12" : "hover:bg-muted/50"
      )}
    >
      <span className="relative shrink-0">
        <WhatsappLeadAvatar
          name={name}
          avatarUrl={conversation.avatar_url}
          conversationId={conversation.id}
          size="lg"
        />
        {origin.origin !== "outros" && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#04202f] text-white dark:border-card"
            title={origin.label}
          >
            <OriginIcon className="h-2.5 w-2.5" aria-hidden />
            <span className="sr-only">{origin.label}</span>
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{name}</span>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              unread ? "font-semibold text-[#285f7a]" : "text-muted-foreground"
            )}
          >
            {formatListTime(conversation.last_message_at)}
          </span>
        </span>

        <span
          className={cn(
            "mt-0.5 block truncate text-[13px]",
            unread ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {ours && <span className="text-muted-foreground">Você: </span>}
          {conversation.last_message_preview || "Sem prévia da mensagem"}
        </span>

        <span className="mt-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {since ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  isLongWait(since)
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Clock className="h-3 w-3" aria-hidden />
                esperando {formatWaitingDuration(since)}
              </span>
            ) : null}
            {tags.slice(0, since ? 1 : 2).map((tag) => (
              <span
                key={tag}
                className="truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {owner && <WhatsappAgentAvatar agent={owner} className="size-5" />}
            {unread && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#47cdd0] px-1.5 text-xs font-semibold text-[#1c1c1c]"
                aria-label={`${conversation.unread_count} não lidas`}
              >
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

function ListEmptyState({
  ownerTab,
  statusTab,
  filtering,
  hasConversations,
  onClearFilters,
}: {
  ownerTab: InboxOwnerTab;
  statusTab: InboxStatusTab;
  filtering: boolean;
  hasConversations: boolean;
  onClearFilters: () => void;
}) {
  let title: string;
  let description: string;
  if (!hasConversations) {
    title = "Nenhuma conversa ainda";
    description = "As mensagens que chegarem no WhatsApp do escritório aparecem aqui.";
  } else if (filtering) {
    title = "Nada encontrado";
    description = "Nenhuma conversa corresponde à busca ou ao filtro.";
  } else if (statusTab === "open") {
    title =
      ownerTab === "mine"
        ? "Nenhuma conversa aberta com você"
        : ownerTab === "unassigned"
          ? "Nenhuma conversa sem responsável"
          : "Caixa em dia";
    description =
      ownerTab === "mine"
        ? "Quando você responder um lead, ele passa a ser seu e aparece aqui."
        : "Nenhum cliente esperando resposta agora.";
  } else if (statusTab === "waiting") {
    title = "Ninguém aguardando o cliente";
    description = "Conversas em que respondemos por último aparecem aqui.";
  } else {
    title = "Nenhuma conversa resolvida";
    description = "Resolva uma conversa pelo botão no topo dela.";
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-[240px] text-xs text-muted-foreground">{description}</p>
      {filtering && (
        <Button type="button" variant="link" size="xs" onClick={onClearFilters}>
          Limpar busca e filtro
        </Button>
      )}
    </div>
  );
}
