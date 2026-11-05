"use client";

import type { ComponentProps, ReactNode } from "react";
import { InfoTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { EVENT_TERMS, type EventTermKey } from "@/lib/eventos-glossario";

/**
 * Ícone "?" ao lado de um termo financeiro dos eventos, com a explicação do
 * glossário. Traz o próprio provider para funcionar em qualquer tela ou modal.
 * Não usar dentro de outro botão (card clicável): seria botão dentro de botão.
 */
export function TermHint({
  term,
  title,
  side,
  className,
}: {
  term: EventTermKey;
  /** Troca só o título (ex.: "Previsão 2027"); a explicação continua a do glossário. */
  title?: string;
  side?: ComponentProps<typeof InfoTooltip>["side"];
  className?: string;
}) {
  const entry = EVENT_TERMS[term];
  return (
    <TooltipProvider delayDuration={150}>
      <InfoTooltip title={title ?? entry.title} description={entry.description} side={side} className={className} />
    </TooltipProvider>
  );
}

/** Rótulo + dica na mesma linha, para cabeçalhos e títulos de card. */
export function TermLabel({
  children,
  term,
  title,
  side,
  className,
}: {
  children: ReactNode;
  term: EventTermKey;
  title?: string;
  side?: ComponentProps<typeof InfoTooltip>["side"];
  className?: string;
}) {
  return (
    <span className={className ? `inline-flex items-center gap-1 ${className}` : "inline-flex items-center gap-1"}>
      {children}
      <TermHint term={term} title={title} side={side} />
    </span>
  );
}
