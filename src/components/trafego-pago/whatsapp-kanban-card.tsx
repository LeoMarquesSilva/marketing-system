"use client";

import { useDraggable } from "@dnd-kit/core";
import { MessageCircle, Clock } from "lucide-react";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import {
  leadDisplayName,
  leadOrigin,
  formatRelativeLeadTime,
  messageTextPreview,
} from "./whatsapp-crm-utils";
import { cn } from "@/lib/utils";

interface WhatsappKanbanCardProps {
  conversation: WhatsappConversation;
  onClick: () => void;
}

export function WhatsappKanbanCard({ conversation, onClick }: WhatsappKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversation.id,
    data: { conversation },
  });
  const origin = leadOrigin(conversation);
  const hasUnread = conversation.unread_count > 0;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab space-y-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg",
        hasUnread && "border-[#47cdd0]/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{leadDisplayName(conversation)}</p>
        {hasUnread && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#47cdd0] px-1 text-[10px] font-semibold text-white">
            {conversation.unread_count}
          </span>
        )}
      </div>

      <p className="line-clamp-2 text-xs text-muted-foreground">
        {conversation.last_message_preview || messageTextPreview(null)}
      </p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span
          className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", origin.colorClass)}
        >
          {origin.label}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatRelativeLeadTime(conversation.last_message_at)}
        </span>
      </div>
    </div>
  );
}

export function WhatsappKanbanCardOverlay({ conversation }: { conversation: WhatsappConversation }) {
  const origin = leadOrigin(conversation);
  return (
    <div className="w-64 space-y-2 rounded-lg border bg-card p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5 text-[#47cdd0]" />
        <p className="truncate text-sm font-medium">{leadDisplayName(conversation)}</p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", origin.colorClass)}>
        {origin.label}
      </span>
    </div>
  );
}
