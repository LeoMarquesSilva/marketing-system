"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Reply, SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "🙏", "👀", "✅", "❗", "🔥"];

interface MessageActionsProps {
  canReply: boolean;
  /** Reação precisa do id da mensagem no WhatsApp. */
  canReact: boolean;
  fromMe?: boolean;
  messageText?: string;
  onReply: () => void;
  onReaction: (emoji: string) => void;
}

/** Ações que aparecem ao passar o mouse ou tocar na mensagem. */
export function MessageActions({
  canReply,
  canReact,
  fromMe = false,
  messageText,
  onReply,
  onReaction,
}: MessageActionsProps) {
  const [openReactions, setOpenReactions] = useState(false);
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(messageText?.trim());

  const copyMessage = async () => {
    const text = messageText?.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={cn(
        "absolute -top-9 z-30 flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100 group-focus-within/msg:opacity-100",
        openReactions && "opacity-100",
        fromMe ? "right-0" : "left-0"
      )}
    >
      <AnimatePresence>
        {openReactions && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className={cn(
              "absolute bottom-full mb-2 flex max-w-[min(300px,calc(100vw-3rem))] gap-1 overflow-x-auto rounded-full border bg-white p-1.5 shadow-lg dark:bg-card",
              fromMe ? "right-0" : "left-0"
            )}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReaction(emoji);
                  setOpenReactions(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-muted"
                aria-label={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {canReact && (
        <FloatingAction
          label="Reagir"
          onClick={() => setOpenReactions((value) => !value)}
          icon={<SmilePlus className="h-4 w-4" />}
        />
      )}
      {canReply && (
        <FloatingAction label="Responder" onClick={onReply} icon={<Reply className="h-4 w-4" />} />
      )}
      {canCopy && (
        <FloatingAction
          label={copied ? "Mensagem copiada" : "Copiar mensagem"}
          onClick={() => void copyMessage()}
          icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        />
      )}
    </div>
  );
}

function FloatingAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-muted-foreground shadow-sm transition-colors hover:text-foreground dark:bg-card"
    >
      {icon}
    </button>
  );
}
