"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Loader2,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Reply,
  Send,
  Sparkles,
  Undo2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappMediaPicker } from "@/components/trafego-pago/whatsapp-media-picker";
import { WhatsappVoiceRecorder } from "@/components/trafego-pago/whatsapp-voice-recorder";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  fillQuickReply,
  firstPlaceholderRange,
  groupQuickReplies,
  insertQuickReply,
  matchQuickReplies,
  slashQuery,
  type QuickReply,
} from "@/lib/whatsapp-quick-replies";
import type { WhatsappMessage, WhatsappReplyTarget } from "./whatsapp-crm-types";
import { QuickRepliesManager } from "./quick-replies-manager";
import { QuickReplyPicker } from "./quick-reply-picker";
import { ReplyPreview } from "./reply-preview";
import { useQuickReplies } from "./use-quick-replies";
import { friendlyError } from "./whatsapp-inbox-view";

interface ChatInputProps {
  conversationId: string;
  leadName: string;
  /** Nome do WhatsApp do contato (sem telefone), para o {nome} das respostas prontas. */
  contactName?: string | null;
  /** Quem está atendendo, para o {atendente}. */
  attendantName?: string | null;
  configured: boolean;
  sending: boolean;
  draftMessage: string;
  replyTo: WhatsappReplyTarget | null;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onCancelReply: () => void;
  onSent: (message: WhatsappMessage) => void;
}

type AssistantMode = "suggest" | "reply" | "improve";

const ASSISTANT_ACTIONS: Record<
  AssistantMode,
  { label: string; working: string; title: string; icon: LucideIcon }
> = {
  suggest: {
    label: "Sugerir resposta",
    working: "Escrevendo…",
    title: "A IA lê a conversa inteira e sugere a próxima mensagem",
    icon: Sparkles,
  },
  reply: {
    label: "Responder só esta",
    working: "Respondendo…",
    title: "Resposta curta só para a mensagem marcada",
    icon: Reply,
  },
  improve: {
    label: "Melhorar meu texto",
    working: "Melhorando…",
    title: "Corrige e deixa mais claro o que você escreveu, sem mudar o sentido",
    icon: WandSparkles,
  },
};

export function ChatInput({
  conversationId,
  leadName,
  contactName,
  attendantName,
  configured,
  sending,
  draftMessage,
  replyTo,
  onDraftChange,
  onSubmit,
  onCancelReply,
  onSent,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quickReplyListId = useId();
  const [assistantMode, setAssistantMode] = useState<AssistantMode | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  /** Texto de antes da IA, para o "Desfazer". Some quando a pessoa volta a digitar. */
  const [draftBeforeAssistant, setDraftBeforeAssistant] = useState<string | null>(null);
  const [inputExpanded, setInputExpanded] = useState(false);
  const canExpandInput =
    inputExpanded || draftMessage.length > 140 || draftMessage.includes("\n");
  /** Texto de verdade (um "/atalho" sozinho não conta para "Melhorar meu texto"). */
  const hasDraft = draftMessage.trim().length > 0 && !/^\/[\p{L}\d_-]*$/u.test(draftMessage.trim());

  // Respostas prontas: "/" no campo ou o botão.
  const quickReplies = useQuickReplies();
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  /** Esc fecha a lista da "/" até o texto mudar. */
  const [slashDismissedFor, setSlashDismissedFor] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [managerOpen, setManagerOpen] = useState(false);

  const slash = slashQuery(draftMessage);
  const slashOpen = !browseOpen && slash !== null && slashDismissedFor !== draftMessage;
  const pickerOpen = browseOpen || slashOpen;
  const pickerQuery = browseOpen ? browseQuery : slash?.query ?? "";
  const pickerItems = useMemo(
    () =>
      pickerQuery.trim()
        ? matchQuickReplies(quickReplies.replies, pickerQuery)
        : groupQuickReplies(quickReplies.replies).flatMap((group) => group.replies),
    [quickReplies.replies, pickerQuery]
  );
  const safeActiveIndex = Math.min(activeIndex, Math.max(pickerItems.length - 1, 0));

  const previewQuickReply = (reply: QuickReply) =>
    fillQuickReply(reply.body, { contactName, attendantName });

  const closePicker = useCallback(() => {
    setBrowseOpen(false);
    setBrowseQuery("");
    if (slashQuery(draftMessage)) setSlashDismissedFor(draftMessage);
  }, [draftMessage]);

  // Clique fora da lista (e fora do botão que a abre) fecha.
  const pickerAreaRef = useRef<HTMLDivElement>(null);
  const pickerToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (pickerAreaRef.current?.contains(target) || pickerToggleRef.current?.contains(target)) return;
      closePicker();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen, closePicker]);

  const pickQuickReply = (reply: QuickReply) => {
    const text = previewQuickReply(reply);
    const next = insertQuickReply(draftMessage, text);
    const insertedAt = next.length - text.length;
    const placeholder = firstPlaceholderRange(text);
    setDraftBeforeAssistant(null);
    setBrowseOpen(false);
    setBrowseQuery("");
    setActiveIndex(0);
    onDraftChange(next);
    quickReplies.markUsed(reply.id);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      if (placeholder) {
        textarea.setSelectionRange(insertedAt + placeholder.start, insertedAt + placeholder.end);
      } else {
        textarea.setSelectionRange(next.length, next.length);
      }
    });
  };

  /** Setas, Enter/Tab e Esc quando a lista está aberta. Devolve true se tratou a tecla. */
  const handlePickerKey = (event: KeyboardEvent<HTMLElement>): boolean => {
    if (!pickerOpen) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (pickerItems.length === 0) return true;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((safeActiveIndex + step + pickerItems.length) % pickerItems.length);
      return true;
    }
    if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      const reply = pickerItems[safeActiveIndex];
      if (!reply) return false;
      event.preventDefault();
      pickQuickReply(reply);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      textareaRef.current?.focus();
      return true;
    }
    return false;
  };

  const visibleModes: AssistantMode[] = [
    "suggest",
    ...(replyTo ? (["reply"] as const) : []),
    ...(hasDraft ? (["improve"] as const) : []),
  ];

  const runAssistant = async (mode: AssistantMode) => {
    if (assistantMode) return;
    setAssistantMode(mode);
    setAssistantError(null);
    const before = draftMessage;
    try {
      const res = await authFetch("/api/evolution/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, draftMessage, replyTo, mode }),
      });
      const json = (await res.json().catch(() => ({}))) as { suggestion?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível usar a IA agora.");
      const suggestion = json.suggestion?.trim();
      if (!suggestion) throw new Error("A IA não devolveu texto. Tente de novo.");
      setDraftBeforeAssistant(before);
      onDraftChange(suggestion);
    } catch (error) {
      setAssistantError(friendlyError(error, "Não foi possível usar a IA agora."));
    } finally {
      setAssistantMode(null);
    }
  };

  const undoAssistant = () => {
    if (draftBeforeAssistant === null) return;
    onDraftChange(draftBeforeAssistant);
    setDraftBeforeAssistant(null);
  };

  return (
    <div className="min-w-0 shrink-0 border-t bg-[#f7f8fa] px-3 py-3 dark:bg-card sm:px-4">
      <ReplyPreview replyTo={replyTo} fallbackName={leadName} onCancel={onCancelReply} />

      {assistantError && (
        <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {assistantError}
        </p>
      )}

      <div ref={pickerAreaRef} className="relative">
        {pickerOpen && (
          <QuickReplyPicker
            listId={quickReplyListId}
            items={pickerItems}
            grouped={!pickerQuery.trim()}
            activeIndex={safeActiveIndex}
            loaded={quickReplies.loaded}
            search={
              browseOpen
                ? {
                    value: browseQuery,
                    onChange: (value) => {
                      setBrowseQuery(value);
                      setActiveIndex(0);
                    },
                    onKeyDown: (event) => {
                      handlePickerKey(event);
                    },
                  }
                : undefined
            }
            slashText={browseOpen ? undefined : slash?.query}
            canManage={quickReplies.canManage}
            preview={previewQuickReply}
            onActiveIndexChange={setActiveIndex}
            onPick={pickQuickReply}
            onClose={() => {
              closePicker();
              textareaRef.current?.focus();
            }}
            onManage={() => {
              closePicker();
              setManagerOpen(true);
            }}
          />
        )}

        <form
          className={cn(
            "flex min-w-0 gap-1 rounded-lg border bg-white p-2 shadow-sm dark:bg-background sm:gap-2",
            inputExpanded ? "items-start" : "items-end"
          )}
          onSubmit={(event) => {
            event.preventDefault();
            setDraftBeforeAssistant(null);
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
            ref={textareaRef}
            value={draftMessage}
            onChange={(event) => {
              setDraftBeforeAssistant(null);
              setActiveIndex(0);
              onDraftChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (handlePickerKey(event)) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                setDraftBeforeAssistant(null);
                onSubmit();
              }
            }}
            placeholder={assistantMode ? "A IA está escrevendo…" : "Digite sua mensagem ou / para respostas prontas"}
            rows={1}
            disabled={sending || !configured || assistantMode !== null}
            role="combobox"
            aria-controls={quickReplyListId}
            aria-expanded={pickerOpen}
            aria-autocomplete="list"
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
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <Button
            ref={pickerToggleRef}
            type="button"
            variant="ghost"
            size="xs"
            title="Mensagens prontas do manual de atendimento (atalho: /)"
            aria-pressed={browseOpen}
            disabled={sending || !configured}
            className={cn(browseOpen && "bg-muted")}
            onClick={() => {
              if (browseOpen) {
                closePicker();
                return;
              }
              setActiveIndex(0);
              setBrowseOpen(true);
            }}
          >
            <MessageSquareText />
            Respostas prontas
          </Button>
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          {visibleModes.map((mode) => {
            const action = ASSISTANT_ACTIONS[mode];
            const Icon = action.icon;
            const running = assistantMode === mode;
            return (
              <Button
                key={mode}
                type="button"
                variant="ghost"
                size="xs"
                title={action.title}
                disabled={assistantMode !== null || sending || !configured}
                onClick={() => void runAssistant(mode)}
              >
                {running ? <Loader2 className="animate-spin" /> : <Icon />}
                {running ? action.working : action.label}
              </Button>
            );
          })}
          {draftBeforeAssistant !== null && !assistantMode && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              title="Volta ao texto de antes da IA"
              onClick={undoAssistant}
            >
              <Undo2 />
              Desfazer
            </Button>
          )}
        </div>
        <span className="hidden shrink-0 text-xs text-muted-foreground 2xl:inline">Enter envia · Shift + Enter quebra linha</span>
      </div>

      {quickReplies.canManage && (
        <QuickRepliesManager
          open={managerOpen}
          onOpenChange={setManagerOpen}
          replies={quickReplies.replies}
          contactName={contactName}
          attendantName={attendantName}
          onSaved={quickReplies.upsertLocal}
          onRemoved={quickReplies.removeLocal}
        />
      )}
    </div>
  );
}
