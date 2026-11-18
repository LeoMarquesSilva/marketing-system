"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Ban } from "lucide-react";
import { WhatsappAudioPlayer } from "@/components/trafego-pago/whatsapp-audio-player";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappMediaBubble } from "@/components/trafego-pago/whatsapp-media-bubble";
import { WhatsappMessageStatus } from "@/components/trafego-pago/whatsapp-message-status";
import { cn } from "@/lib/utils";
import { isAudioMessageType, isMediaMessageType, formatWhatsappMessageDisplay } from "@/lib/evolution-leads";
import { whatsappMessageDeleteBlock, WHATSAPP_DELETED_TEXT } from "@/lib/whatsapp-message-delete";
import type { WhatsappConversation, WhatsappMessage } from "./whatsapp-crm-types";
import { formatMessageTime, leadDisplayName } from "./whatsapp-crm-utils";
import { MessageActions } from "./message-actions";
import {
  participantColor,
  participantInitials,
  participantKey,
  participantLabel,
} from "./whatsapp-participant";

interface MessageBubbleProps {
  message: WhatsappMessage;
  conversation: WhatsappConversation;
  /** Em grupo: primeira mensagem de uma sequência da mesma pessoa (mostra nome e iniciais). */
  startsRun?: boolean;
  reaction?: string;
  onReply: (message: WhatsappMessage) => void;
  onReaction: (message: WhatsappMessage, emoji: string) => void;
  onDelete: (message: WhatsappMessage) => void;
  onTranscript: (messageId: string, text: string) => void;
}

/**
 * Memorizada: digitar no campo de mensagem redesenha o inbox, e sem isso cada
 * tecla refazia todas as bolhas da conversa.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  conversation,
  startsRun = true,
  reaction,
  onReply,
  onReaction,
  onDelete,
  onTranscript,
}: MessageBubbleProps) {
  const deleted = Boolean(message.deleted_at);
  const fromLead = !message.from_me;
  const groupSender = Boolean(conversation.is_group) && fromLead;
  const senderLabel = groupSender ? participantLabel(message) : null;
  const senderColor = groupSender ? participantColor(participantKey(message) || senderLabel || "") : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "flex w-full gap-2 group/msg",
        message.from_me ? "justify-end" : "justify-start",
        groupSender && !startsRun && "-mt-2"
      )}
    >
      {groupSender ? (
        // Em grupo, a foto do grupo ao lado de cada mensagem confundia quem escreveu.
        <div className="mt-0.5 hidden w-8 shrink-0 sm:block" aria-hidden>
          {startsRun && (
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                senderColor?.circle
              )}
              title={senderLabel ?? undefined}
            >
              {participantInitials(senderLabel ?? "")}
            </span>
          )}
        </div>
      ) : (
        fromLead && (
          <div className="mt-auto hidden shrink-0 sm:block">
            <WhatsappLeadAvatar
              name={leadDisplayName(conversation)}
              avatarUrl={conversation.avatar_url}
              conversationId={conversation.id}
              size="sm"
            />
          </div>
        )
      )}

      <div
        className={cn(
          "relative max-w-[86%] px-4 py-2 text-[15px] leading-relaxed shadow-sm sm:max-w-[74%]",
          message.from_me
            ? "rounded-lg rounded-tr-md bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
            : "rounded-lg rounded-tl-md border border-black/5 bg-white text-[#111b21] dark:border-white/5 dark:bg-[#202c33] dark:text-[#e9edef]"
        )}
        // Focável para as ações aparecerem com um toque no celular.
        tabIndex={0}
      >
        {!deleted && (
          <MessageActions
            canReply={Boolean(message.wa_message_id)}
            canReact={Boolean(message.wa_message_id)}
            canDelete={whatsappMessageDeleteBlock(message) === null}
            fromMe={message.from_me}
            messageText={formatWhatsappMessageDisplay(message.body, message.message_type)}
            onReply={() => onReply(message)}
            onReaction={(emoji) => onReaction(message, emoji)}
            onDelete={() => onDelete(message)}
          />
        )}

        {groupSender && startsRun && (
          <p className={cn("mb-0.5 text-[13px] font-semibold dark:brightness-150", senderColor?.text)}>
            {senderLabel}
          </p>
        )}

        {!deleted && message.quoted_body && (
          <div
            className={cn(
              "mb-2 rounded-lg border-l-2 px-2 py-1 text-xs opacity-90",
              message.from_me
                ? "border-emerald-700 bg-black/5 dark:border-emerald-300 dark:bg-white/10"
                : "border-emerald-500 bg-muted/60 dark:bg-white/5"
            )}
          >
            {message.quoted_body}
          </div>
        )}

        {deleted ? (
          <p className="flex items-center gap-1.5 italic text-[#667781] dark:text-[#aebac1]">
            <Ban className="h-4 w-4 shrink-0" aria-hidden />
            {WHATSAPP_DELETED_TEXT}
          </p>
        ) : isAudioMessageType(message.message_type, message.body) ? (
          <WhatsappAudioPlayer
            messageId={message.id}
            mediaUrl={message.media_url}
            fromMe={message.from_me}
            transcript={message.audio_transcript}
            onTranscript={(text) => onTranscript(message.id, text)}
          />
        ) : isMediaMessageType(message.message_type, message.body) ? (
          <WhatsappMediaBubble
            messageId={message.id}
            mediaUrl={message.media_url}
            mediaExpired={Boolean(message.media_expired_at)}
            messageType={message.message_type}
            body={message.body}
            fromMe={message.from_me}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {formatWhatsappMessageDisplay(message.body, message.message_type)}
          </p>
        )}

        <div className="mt-1 flex items-center justify-end gap-1 pl-6 text-xs tabular-nums text-[#667781] dark:text-[#aebac1]">
          {formatMessageTime(message.message_timestamp)}
          {!deleted && <WhatsappMessageStatus status={message.wa_status} fromMe={message.from_me} />}
        </div>

        {!deleted && (reaction || message.reaction_emoji) && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-3 -right-2 inline-flex rounded-full border bg-white px-1.5 py-0.5 text-sm shadow-sm dark:bg-card"
            title="Reação"
          >
            {reaction || message.reaction_emoji}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
});
