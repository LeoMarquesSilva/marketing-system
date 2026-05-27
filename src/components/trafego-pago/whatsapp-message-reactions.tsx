"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🙏", "✅"];

interface WhatsappMessageReactionsProps {
  conversationId: string;
  waMessageId: string | null | undefined;
  fromMe?: boolean;
}

export function WhatsappMessageReactions({
  conversationId,
  waMessageId,
  fromMe,
}: WhatsappMessageReactionsProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!waMessageId || fromMe) return null;

  const react = async (emoji: string) => {
    if (sending) return;
    setSending(emoji);
    try {
      const res = await authFetch("/api/evolution/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          reaction: emoji,
          waMessageId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao reagir.");
      setSent(emoji);
    } catch {
      /* silencioso — reação é opcional */
    } finally {
      setSending(null);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity absolute -bottom-4 right-0 bg-background border shadow-md rounded-full px-1.5 py-1 z-20",
        sent && "hidden"
      )}
    >
      <AnimatePresence>
        {!sent && QUICK_REACTIONS.map((emoji, index) => (
          <motion.button
            key={emoji}
            initial={{ scale: 0, opacity: 0, y: 5 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            whileHover={{ scale: 1.3, originY: 1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 25, delay: index * 0.03 }}
            type="button"
            disabled={Boolean(sending)}
            onClick={() => void react(emoji)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-sm hover:bg-black/5 dark:hover:bg-white/10",
              sent === emoji && "bg-black/5 dark:bg-white/10"
            )}
            title="Reagir"
          >
            {sending === emoji ? (
              <Loader2 className="h-3 w-3 animate-spin mx-auto text-muted-foreground" />
            ) : (
              emoji
            )}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
