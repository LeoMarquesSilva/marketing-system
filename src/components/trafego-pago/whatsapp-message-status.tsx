"use client";

import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsappMessageStatusProps {
  status?: string | null;
  fromMe?: boolean;
}

export function WhatsappMessageStatus({ status, fromMe }: WhatsappMessageStatusProps) {
  if (!fromMe) return null;

  const s = (status ?? "sent").toLowerCase();
  const isRead = s === "read" || s === "played";
  const isDelivered = isRead || s === "delivered";

  return (
    <span
      className={cn(
        "inline-flex items-center ml-1 align-middle",
        isRead ? "text-sky-400" : "text-white/50"
      )}
      title={
        isRead ? "Lida" : isDelivered ? "Entregue" : s === "pending" ? "Enviando" : "Enviada"
      }
    >
      {isDelivered ? (
        <CheckCheck className="h-3 w-3" />
      ) : (
        <Check className="h-3 w-3" />
      )}
    </span>
  );
}
