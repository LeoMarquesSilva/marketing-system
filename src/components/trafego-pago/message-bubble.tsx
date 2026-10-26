"use client";

import { motion } from "framer-motion";
import { WhatsappAudioPlayer } from "@/components/trafego-pago/whatsapp-audio-player";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { WhatsappMediaBubble } from "@/components/trafego-pago/whatsapp-media-bubble";
import { WhatsappMessageStatus } from "@/components/trafego-pago/whatsapp-message-status";
import { cn } from "@/lib/utils";
import { isAudioMessageType, isMediaMessageType, formatWhatsappMessageDisplay } from "@/lib/evolution-leads";
import type { WhatsappConversation, WhatsappMessage } from "./whatsapp-crm-types";
import { formatMessageTime, leadDisplayName } from "./whatsapp-crm-utils";
import { MessageActions } from "./message-actions";

interface MessageBubbleProps {
  message: WhatsappMessage;
  conversation: WhatsappConversation;
  reaction?: string;
  onReply: () => void;
  onReaction: (emoji: string) => void;
  onTranscript: (text: string) => void;
}

export function MessageBubble({
  message,
  conversation,
  reaction,
  onReply,
  onReaction,
  onTranscript,
}: MessageBubbleProps) {
  const fromLead = !message.from_me;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      layout="position"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn("flex w-full gap-2 group/msg", message.from_me ? "justify-end" : "justify-start")}
    >
      {fromLead && (
        <div className="mt-auto hidden shrink-0 sm:block">
          <WhatsappLeadAvatar
            name={leadDisplayName(conversation)}
            avatarUrl={conversation.avatar_url}
            conversationId={conversation.id}
            size="sm"
          />
        </div>
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
        <MessageActions
          canReply={Boolean(message.wa_message_id)}
          canReact={Boolean(message.wa_message_id)}
          fromMe={message.from_me}
          messageText={formatWhatsappMessageDisplay(message.body, message.message_type)}
          onReply={onReply}
          onReaction={onReaction}
        />

        {conversation.is_group && fromLead && message.participant_name && (
          <p className="mb-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {message.participant_name}
          </p>
        )}

        {message.quoted_body && (
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

        {isAudioMessageType(message.message_type, message.body) ? (
          <WhatsappAudioPlayer
            messageId={message.id}
            fromMe={message.from_me}
            transcript={message.audio_transcript}
            onTranscript={onTranscript}
          />
        ) : isMediaMessageType(message.message_type, message.body) ? (
          <WhatsappMediaBubble
            messageId={message.id}
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
          <WhatsappMessageStatus status={message.wa_status} fromMe={message.from_me} />
        </div>

        {(reaction || message.reaction_emoji) && (
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
}
