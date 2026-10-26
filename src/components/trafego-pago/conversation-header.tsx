"use client";

import { useState } from "react";
import { ArrowLeft, Check, Info, Loader2, RotateCcw, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappAgentAvatar, firstName } from "@/components/trafego-pago/whatsapp-agent-avatar";
import { leadOriginMeta } from "@/components/trafego-pago/whatsapp-lead-origin";
import type { WhatsappAgent, WhatsappConversation } from "./whatsapp-crm-types";
import { leadDisplayName, leadPhone } from "./whatsapp-crm-utils";
import { statusTabOf } from "./whatsapp-inbox-view";

interface ConversationHeaderProps {
  conversation: WhatsappConversation;
  owner: WhatsappAgent | null;
  agents: WhatsappAgent[];
  myUserId: string | null;
  /** Status ou responsável sendo salvo. */
  updating: boolean;
  onBack: () => void;
  onAssign: (userId: string | null) => void;
  onResolve: () => void;
  onReopen: () => void;
  onOpenDetails: () => void;
}

export function ConversationHeader({
  conversation,
  owner,
  agents,
  myUserId,
  updating,
  onBack,
  onAssign,
  onResolve,
  onReopen,
  onOpenDetails,
}: ConversationHeaderProps) {
  const name = leadDisplayName(conversation);
  const origin = leadOriginMeta(conversation);
  const resolved = statusTabOf(conversation) === "resolved";

  return (
    <header className="flex items-center gap-2 border-b bg-white px-2 py-2 dark:bg-card sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onBack}
        aria-label="Voltar para as conversas"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <WhatsappLeadAvatar name={name} avatarUrl={conversation.avatar_url} conversationId={conversation.id} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold sm:text-base">{name}</h2>
        <p className="truncate text-xs text-muted-foreground">
          {origin.label} · {leadPhone(conversation)}
        </p>
      </div>

      <OwnerPicker
        owner={owner}
        agents={agents}
        myUserId={myUserId}
        disabled={updating}
        onAssign={onAssign}
      />

      {resolved ? (
        <Button type="button" variant="outline" size="sm" disabled={updating} onClick={onReopen}>
          {updating ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          <span className="hidden sm:inline">Reabrir</span>
        </Button>
      ) : (
        <Button type="button" size="sm" disabled={updating} onClick={onResolve}>
          {updating ? <Loader2 className="animate-spin" /> : <Check />}
          Resolver
        </Button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="xl:hidden"
        onClick={onOpenDetails}
        aria-label="Detalhes do lead"
        title="Detalhes do lead"
      >
        <Info className="h-5 w-5" />
      </Button>
    </header>
  );
}

function OwnerPicker({
  owner,
  agents,
  myUserId,
  disabled,
  onAssign,
}: {
  owner: WhatsappAgent | null;
  agents: WhatsappAgent[];
  myUserId: string | null;
  disabled: boolean;
  onAssign: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const me = agents.find((agent) => agent.id === myUserId) ?? null;
  const others = agents.filter((agent) => agent.id !== myUserId);

  const choose = (userId: string | null) => {
    setOpen(false);
    if (userId !== (owner?.id ?? null)) onAssign(userId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={owner ? `Responsável: ${owner.name}. Trocar` : "Atribuir responsável"}
        >
          {owner ? <WhatsappAgentAvatar agent={owner} className="size-5" /> : <UserPlus />}
          <span className="hidden max-w-24 truncate sm:inline">
            {owner ? firstName(owner.name) : "Atribuir"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">Responsável</p>
        {me && <AgentOption agent={me} label={`${me.name} (você)`} selected={owner?.id === me.id} onSelect={choose} />}
        {others.map((agent) => (
          <AgentOption key={agent.id} agent={agent} label={agent.name} selected={owner?.id === agent.id} onSelect={choose} />
        ))}
        {owner && (
          <button
            type="button"
            onClick={() => choose(null)}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md border-t px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <UserMinus className="h-4 w-4" aria-hidden />
            Tirar responsável
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AgentOption({
  agent,
  label,
  selected,
  onSelect,
}: {
  agent: WhatsappAgent;
  label: string;
  selected: boolean;
  onSelect: (userId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
    >
      <WhatsappAgentAvatar agent={agent} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && <Check className="h-4 w-4 text-[#347796]" aria-hidden />}
    </button>
  );
}
