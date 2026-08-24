"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { WhatsappKanbanColumn } from "./whatsapp-kanban-column";
import { WhatsappKanbanCardOverlay } from "./whatsapp-kanban-card";
import { ATTENDANCE_STATUS_COLUMNS, type AttendanceStatus } from "./whatsapp-crm-utils";
import type { WhatsappConversation } from "./whatsapp-crm-types";

interface WhatsappKanbanBoardProps {
  conversations: WhatsappConversation[];
  onCardClick: (conversation: WhatsappConversation) => void;
  onMove: (conversationId: string, status: AttendanceStatus) => Promise<void> | void;
}

export function WhatsappKanbanBoard({
  conversations,
  onCardClick,
  onMove,
}: WhatsappKanbanBoardProps) {
  const [activeConversation, setActiveConversation] = useState<WhatsappConversation | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const byColumn = useMemo(() => {
    const map: Record<AttendanceStatus, WhatsappConversation[]> = {
      nao_respondido: [],
      em_atendimento: [],
      aguardando_cliente: [],
      resolvido: [],
    };
    for (const c of conversations) {
      const status = (c.attendance_status as AttendanceStatus) || "nao_respondido";
      (map[status] ?? map.nao_respondido).push(c);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    }
    return map;
  }, [conversations]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const conv = conversations.find((c) => c.id === event.active.id);
      if (conv) setActiveConversation(conv);
    },
    [conversations]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveConversation(null);
      if (!over) return;

      const targetStatus = over.id as AttendanceStatus;
      const validIds = ATTENDANCE_STATUS_COLUMNS.map((c) => c.id);
      if (!validIds.includes(targetStatus)) return;

      const conversationId = active.id as string;
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv || conv.attendance_status === targetStatus) return;

      try {
        await onMove(conversationId, targetStatus);
        setMoveError(null);
      } catch {
        setMoveError("Não foi possível mover a conversa. Tente de novo.");
      }
    },
    [conversations, onMove]
  );

  return (
    <div>
      {moveError && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {moveError}
        </div>
      )}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ATTENDANCE_STATUS_COLUMNS.map((col) => (
            <WhatsappKanbanColumn
              key={col.id}
              id={col.id}
              title={col.label}
              conversations={byColumn[col.id]}
              onCardClick={onCardClick}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeConversation ? <WhatsappKanbanCardOverlay conversation={activeConversation} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
