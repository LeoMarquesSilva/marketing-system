"use client";

import { useState } from "react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  Loader2,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Send,
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappMediaPicker } from "@/components/trafego-pago/whatsapp-media-picker";
import { WhatsappVoiceRecorder } from "@/components/trafego-pago/whatsapp-voice-recorder";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { WhatsappMessage, WhatsappReplyTarget } from "./whatsapp-crm-types";
import { ReplyPreview } from "./reply-preview";

type QuickAction = "quickReplies" | "checklist" | "schedule";

const EMPTY_ACTION_COPY: Record<QuickAction, { title: string; description: string }> = {
  quickReplies: {
    title: "Respostas rápidas",
    description: "Nenhuma resposta rápida cadastrada ainda.",
  },
  checklist: {
    title: "Checklist",
    description: "Nenhum checklist configurado ainda.",
  },
  schedule: {
    title: "Agendar reunião",
    description: "Nenhum fluxo de agendamento configurado ainda.",
  },
};

interface ChatInputProps {
  conversationId: string;
  leadName: string;
  configured: boolean;
  sending: boolean;
  draftMessage: string;
  replyTo: WhatsappReplyTarget | null;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onCancelReply: () => void;
  onSent: (message: WhatsappMessage) => void;
}

export function ChatInput({
  conversationId,
  leadName,
  configured,
  sending,
  draftMessage,
  replyTo,
  onDraftChange,
  onSubmit,
  onCancelReply,
  onSent,
}: ChatInputProps) {
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [generatingAssistant, setGeneratingAssistant] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [inputExpanded, setInputExpanded] = useState(false);
  const canExpandInput =
    inputExpanded || draftMessage.length > 140 || draftMessage.includes("\n");

  const toggleAction = (action: QuickAction) => {
    setActiveAction((current) => (current === action ? null : action));
  };

  const generateAssistantSuggestion = async () => {
    if (generatingAssistant) return;
    setGeneratingAssistant(true);
    setAssistantError(null);
    try {
      const res = await authFetch("/api/evolution/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          draftMessage,
          replyTo,
        }),
      });
      const json = (await res.json()) as { suggestion?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar sugestão.");
      if (json.suggestion?.trim()) {
        const current = draftMessage.trim();
        onDraftChange(
          current ? `${current}\n${json.suggestion.trim()}` : json.suggestion.trim()
        );
        setActiveAction(null);
      }
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "Erro ao gerar sugestão com IA."
      );
    } finally {
      setGeneratingAssistant(false);
    }
  };

  return (
    <div className="min-w-0 shrink-0 border-t bg-[#f7f8fa] px-3 py-3 dark:bg-card sm:px-4">
      <ReplyPreview replyTo={replyTo} fallbackName={leadName} onCancel={onCancelReply} />

      {activeAction && <QuickActionPanel action={activeAction} />}
      {assistantError && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {assistantError}
        </p>
      )}

      <div className="mb-2 flex min-w-0 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <ActionChip
          active={activeAction === "quickReplies"}
          icon={<MessageSquareText />}
          label="Respostas rápidas"
          onClick={() => toggleAction("quickReplies")}
        />
        <ActionChip
          icon={<Bot />}
          label={generatingAssistant ? "Gerando..." : "Assistente IA"}
          onClick={generateAssistantSuggestion}
          loading={generatingAssistant}
        />
        <ActionChip
          active={activeAction === "checklist"}
          icon={<CheckSquare />}
          label="Checklist"
          onClick={() => toggleAction("checklist")}
        />
        <ActionChip
          active={activeAction === "schedule"}
          icon={<CalendarDays />}
          label="Agendar reunião"
          onClick={() => toggleAction("schedule")}
        />
      </div>

      <form
        className={cn(
          "flex min-w-0 gap-1 rounded-lg border bg-white p-2 shadow-sm dark:bg-background sm:gap-2",
          inputExpanded ? "items-start" : "items-end"
        )}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <WhatsappMediaPicker
          conversationId={conversationId}
          disabled={sending || !configured}
          quotedWaMessageId={replyTo?.waMessageId}
          quotedBody={replyTo?.body}
          onSent={(message) => onSent(message as WhatsappMessage)}
        />

        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Emoji"
          onClick={() => toggleAction("quickReplies")}
        >
          <Smile className="h-4 w-4" />
        </button>

        <textarea
          value={draftMessage}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Digite sua mensagem..."
          rows={1}
          disabled={sending || !configured}
          className={cn(
            "min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none transition-[height,max-height]",
            inputExpanded ? "h-36 max-h-[42dvh] overflow-y-auto" : "max-h-32 overflow-y-auto",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />

        {canExpandInput && (
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={inputExpanded ? "Reduzir campo de texto" : "Aumentar campo de texto"}
            title={inputExpanded ? "Reduzir campo" : "Aumentar campo"}
            onClick={() => setInputExpanded((value) => !value)}
          >
            {inputExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        )}

        {draftMessage.trim() ? (
          <Button
            type="submit"
            size="icon"
            disabled={sending || !configured}
            className="h-10 w-10 rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        ) : (
          <WhatsappVoiceRecorder
            conversationId={conversationId}
            disabled={sending || !configured}
            quotedWaMessageId={replyTo?.waMessageId}
            quotedBody={replyTo?.body}
            onSent={(message) => onSent(message as WhatsappMessage)}
          />
        )}
      </form>

      <div className="mt-1 flex justify-between px-2 text-[10px] text-muted-foreground">
        <span>Enter envia</span>
        <span>Shift + Enter quebra linha</span>
      </div>
    </div>
  );
}

function ActionChip({
  icon,
  label,
  active = false,
  loading = false,
  onClick,
  className,
}: {
  icon: React.ReactElement;
  label: string;
  active?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "h-8 shrink-0 rounded-lg border-dashed bg-white text-xs font-medium dark:bg-background",
        active && "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
        className
      )}
    >
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      </span>
      {label}
    </Button>
  );
}

function QuickActionPanel({ action }: { action: QuickAction }) {
  const selected = EMPTY_ACTION_COPY[action];

  return (
    <div className="mb-2 rounded-xl border bg-white p-3 text-xs shadow-sm dark:bg-background">
      <p className="font-semibold text-foreground">{selected.title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{selected.description}</p>
    </div>
  );
}
