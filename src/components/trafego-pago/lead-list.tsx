"use client";

import { motion } from "framer-motion";
import { Filter, Megaphone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappTagList } from "@/components/trafego-pago/whatsapp-conversation-tags";
import { cn } from "@/lib/utils";
import type { LeadFilter, WhatsappConversation } from "./whatsapp-crm-types";
import {
  formatMessageTime,
  formatRelativeLeadTime,
  isGroupConversation,
  isHotLead,
  isMetaLead,
  isPaidTrafficLead,
  leadDisplayName,
} from "./whatsapp-crm-utils";

interface LeadListProps {
  conversations: WhatsappConversation[];
  filteredConversations: WhatsappConversation[];
  selectedId: string | null;
  searchQuery: string;
  activeFilter: LeadFilter;
  totalUnread: number;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: LeadFilter) => void;
  onSelect: (id: string) => void;
}

const filters: Array<{ id: LeadFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "Não lidas" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "trafego_pago", label: "Tráfego Pago" },
  { id: "site", label: "Site" },
  { id: "colaborador", label: "Colaborador" },
  { id: "grupo", label: "Grupos" },
];

export function LeadList({
  conversations,
  filteredConversations,
  selectedId,
  searchQuery,
  activeFilter,
  totalUnread,
  onSearchChange,
  onFilterChange,
  onSelect,
}: LeadListProps) {
  return (
    <aside className="flex min-h-0 h-full flex-col border-r bg-white dark:bg-card">
      <div className="space-y-3 border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            Leads
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {conversations.length}
            </span>
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg text-muted-foreground"
            aria-label="Filtros avançados"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar nome, telefone, tag..."
            className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 text-sm shadow-none focus-visible:bg-background"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              variant={activeFilter === filter.id ? "secondary" : "outline"}
              size="sm"
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "h-8 rounded-full px-3 text-xs",
                activeFilter === filter.id && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
              )}
            >
              {filter.label}
              {filter.id === "unread" && totalUnread > 0 && (
                <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {totalUnread}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Search className="h-5 w-5" />
            </div>
            {conversations.length === 0
              ? "Nenhuma mensagem ainda. Sincronize com a Evolution ou configure o webhook."
              : "Nenhuma conversa corresponde aos filtros aplicados."}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <LeadListCard
              key={conversation.id}
              conversation={conversation}
              selected={selectedId === conversation.id}
              onSelect={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function LeadListCard({
  conversation,
  selected,
  onSelect,
}: {
  conversation: WhatsappConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const unread = conversation.unread_count > 0;
  const hot = isHotLead(conversation);
  const meta = isMetaLead(conversation);
  const paidTraffic = isPaidTrafficLead(conversation);
  const isGroup = isGroupConversation(conversation);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full border-b px-4 py-3 text-left transition-all hover:bg-slate-50 dark:hover:bg-white/5",
        selected && "bg-emerald-50/70 dark:bg-emerald-950/20"
      )}
    >
      {selected && (
        <motion.span
          layoutId="active-lead-indicator"
          className="absolute bottom-0 left-0 top-0 w-1 rounded-r-full bg-emerald-500"
        />
      )}
      <div className="flex items-start gap-3">
        <WhatsappLeadAvatar
          name={leadDisplayName(conversation)}
          avatarUrl={conversation.avatar_url}
          conversationId={conversation.id}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("truncate text-sm font-semibold", unread && "text-foreground")}>
              {leadDisplayName(conversation)}
              {unread && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </p>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                unread ? "font-semibold text-emerald-600" : "text-muted-foreground"
              )}
            >
              {formatMessageTime(conversation.last_message_at)}
            </span>
          </div>

          <p
            className={cn(
              "mt-1 line-clamp-2 text-[13px] leading-snug",
              unread ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {conversation.last_message_preview || "Sem prévia da mensagem"}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {isGroup && <LeadChip tone="indigo" label="Grupo" />}
              {meta && <LeadChip tone="blue" label="Meta Ads" icon={<Megaphone className="h-3 w-3" />} />}
              {paidTraffic && !meta && <LeadChip tone="violet" label="Tráfego Pago" />}
              {hot && <LeadChip tone="rose" label="Lead quente" />}
              {unread && <LeadChip tone="emerald" label="Novo lead" />}
              <WhatsappTagList tags={conversation.tags ?? []} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {unread && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                  {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                </span>
              )}
            </div>
          </div>

          <p className="mt-1 text-[10px] text-muted-foreground">
            Entrou {formatRelativeLeadTime(conversation.last_message_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

function LeadChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "emerald" | "blue" | "violet" | "rose" | "indigo";
  icon?: React.ReactNode;
}) {
  const classes = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
    blue: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900",
    violet: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900",
    rose: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900",
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", classes[tone])}>
      {icon}
      {label}
    </span>
  );
}
