"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import { WhatsappKanbanCard } from "./whatsapp-kanban-card";

interface WhatsappKanbanColumnProps {
  id: string;
  title: string;
  conversations: WhatsappConversation[];
  onCardClick: (conversation: WhatsappConversation) => void;
}

export function WhatsappKanbanColumn({
  id,
  title,
  conversations,
  onCardClick,
}: WhatsappKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
        isOver && "ring-2 ring-[#47cdd0] ring-offset-2"
      )}
    >
      <div className="flex items-center gap-2 border-b p-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {conversations.length}
        </span>
      </div>
      <div className="flex min-h-[160px] flex-col gap-2 overflow-y-auto p-3">
        {conversations.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Nada aqui</p>
        ) : (
          conversations.map((c) => (
            <WhatsappKanbanCard key={c.id} conversation={c} onClick={() => onCardClick(c)} />
          ))
        )}
      </div>
    </div>
  );
}
