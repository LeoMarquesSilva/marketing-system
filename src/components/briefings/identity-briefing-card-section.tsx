"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ClipboardCopy, ExternalLink, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdentityBriefingStatusBadge } from "@/components/briefings/identity-briefing-status-badge";

interface IdentityBriefingCardSectionProps {
  requestId: string;
  status: "pending" | "submitted" | null;
  submittedAt: string | null;
}

export function IdentityBriefingCardSection({
  requestId,
  status,
  submittedAt,
}: IdentityBriefingCardSectionProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const path = `/briefings/identidade-visual/${requestId}`;
  const submitted = status === "submitted";

  async function copyLink() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section
      aria-labelledby="identity-briefing-heading"
      className="space-y-3 rounded-lg border border-[#47cdd0]/35 bg-[#47cdd0]/[0.06] p-5 shadow-[0_1px_2px_rgba(3,32,47,0.05)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            id="identity-briefing-heading"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <FileQuestion className="h-4 w-4 shrink-0" aria-hidden />
            Briefing de identidade visual
          </h4>
          <p className="mt-2 text-sm text-foreground/80">
            {submitted
              ? "As respostas chegaram e a solicitação está pronta para ser iniciada."
              : "Envie o link ao solicitante e acompanhe a resposta por este card."}
          </p>
        </div>
        <IdentityBriefingStatusBadge status={status} />
      </div>

      {submittedAt && (
        <p className="text-xs text-muted-foreground">
          Última resposta em {format(new Date(submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
          {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden />}
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
        <Button type="button" size="sm" asChild>
          <Link href={path} target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            {submitted ? "Ver briefing completo" : "Abrir briefing"}
          </Link>
        </Button>
      </div>

      {copyError && (
        <p className="text-xs text-destructive" role="alert">
          Não foi possível copiar. Abra o briefing e copie o endereço do navegador.
        </p>
      )}
    </section>
  );
}
