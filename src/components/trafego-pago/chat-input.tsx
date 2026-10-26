"use client";

import { useState } from "react";
import { Loader2, Maximize2, Minimize2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappMediaPicker } from "@/components/trafego-pago/whatsapp-media-picker";
import { WhatsappVoiceRecorder } from "@/components/trafego-pago/whatsapp-voice-recorder";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { WhatsappMessage, WhatsappReplyTarget } from "./whatsapp-crm-types";
import { ReplyPreview } from "./reply-preview";

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
  const [generatingAssistant, setGeneratingAssistant] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [inputExpanded, setInputExpanded] = useState(false);
  const canExpandInput =
    inputExpanded || draftMessage.length > 140 || draftMessage.includes("\n");

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
      }
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "Não foi possível sugerir uma resposta."
      );
    } finally {
      setGeneratingAssistant(false);
    }
  };

  return (
    <div className="min-w-0 shrink-0 border-t bg-[#f7f8fa] px-3 py-3 dark:bg-card sm:px-4">
      <ReplyPreview replyTo={replyTo} fallbackName={leadName} onCancel={onCancelReply} />

      {assistantError && (
        <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {assistantError}
        </p>
      )}

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

      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={generatingAssistant || !configured}
          onClick={() => void generateAssistantSuggestion()}
        >
          {generatingAssistant ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {generatingAssistant ? "Escrevendo sugestão…" : "Sugerir resposta"}
        </Button>
        <span className="hidden text-xs text-muted-foreground sm:inline">Enter envia · Shift + Enter quebra linha</span>
      </div>
    </div>
  );
}
