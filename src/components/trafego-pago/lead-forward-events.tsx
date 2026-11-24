"use client";

import { Forward } from "lucide-react";
import {
  brazilPhoneVariants,
  formatBrazilPhone,
  type LeadForwardRecord,
} from "@/lib/whatsapp-lead-forward-format";
import type { WhatsappConversation } from "./whatsapp-crm-types";

/**
 * Aviso na conversa do lead de que ele foi encaminhado, com atalho para a
 * conversa de quem recebeu (onde ficam o resumo e o cartão enviados).
 */
export function LeadForwardEvents({
  forwards,
  conversations,
  onOpenConversation,
}: {
  forwards: LeadForwardRecord[];
  conversations: WhatsappConversation[];
  onOpenConversation: (conversationId: string) => void;
}) {
  return (
    <>
      {forwards.map((forward) => {
        const variants = brazilPhoneVariants(forward.recipientPhone);
        const target = conversations.find(
          (conversation) => !conversation.is_group && conversation.phone && variants.includes(conversation.phone)
        );
        const who = forward.recipientName ?? formatBrazilPhone(forward.recipientPhone);
        const by = forward.sentByName?.trim().split(/\s+/)[0];
        const time = new Date(forward.createdAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        });
        return (
          <div key={forward.id} className="flex justify-center">
            <span className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-xl bg-[#347796]/10 px-3 py-1.5 text-center text-xs text-[#285f7a] dark:bg-[#47cdd0]/10 dark:text-[#47cdd0]">
              <Forward className="size-3.5 shrink-0" aria-hidden />
              <span>
                Lead encaminhado para <strong className="font-semibold">{who}</strong>
                {by ? ` por ${by}` : ""} · {time}
              </span>
              {target ? (
                <button
                  type="button"
                  onClick={() => onOpenConversation(target.id)}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Ver conversa
                </button>
              ) : null}
            </span>
          </div>
        );
      })}
    </>
  );
}
