"use client";

import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailCampaign } from "@/lib/email-marketing";

/** Os quatro quadrados da Microsoft (Microsoft 365 / Outlook), desenhados em SVG. */
export function MicrosoftMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-3.5 shrink-0", className)}>
      <rect x="0" y="0" width="7.4" height="7.4" fill="#f25022" />
      <rect x="8.6" y="0" width="7.4" height="7.4" fill="#7fba00" />
      <rect x="0" y="8.6" width="7.4" height="7.4" fill="#00a4ef" />
      <rect x="8.6" y="8.6" width="7.4" height="7.4" fill="#ffb900" />
    </svg>
  );
}

/** Por onde a campanha sai: caixa do remetente (Microsoft 365) ou Resend. */
export function SendModeBadge({ mode, className }: { mode: EmailCampaign["sendMode"]; className?: string }) {
  const mailbox = mode === "mailbox";
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full bg-white px-2 text-xs text-[#3b5560] ring-1 ring-inset ring-[#dce9eb]",
        className
      )}
      title={mailbox ? "Sai da caixa Microsoft 365 do remetente, um e-mail por pessoa" : "Sai pelo Resend, em volume"}
    >
      {mailbox ? <MicrosoftMark /> : <Newspaper className="size-3.5 text-[#347796]" />}
      {mailbox ? "Caixa do remetente" : "Resend"}
    </span>
  );
}

/** Caixa do remetente: ~1 e-mail a cada 2,5 s (limite do Exchange). */
export const MAILBOX_SECONDS_PER_EMAIL = 2.5;

export function mailboxDuration(count: number): string {
  const minutes = Math.ceil((count * MAILBOX_SECONDS_PER_EMAIL) / 60);
  return minutes <= 1 ? "cerca de 1 minuto" : `cerca de ${minutes} minutos`;
}

/** Caixa que pode enviar pelo Microsoft 365 do escritório. */
export function isOfficeMailbox(email: string): boolean {
  return /^[^\s@]+@bismarchipires\.com\.br$/i.test(email.trim());
}
