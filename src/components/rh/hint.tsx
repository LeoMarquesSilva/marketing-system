"use client";

import type { ComponentProps, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Dica do sistema ao passar o mouse, no lugar do `title` nativo do navegador.
 * `wrap` envolve o filho num span: necessário quando ele é um botão desabilitado
 * (botão desabilitado não dispara eventos de mouse).
 */
export function Hint({
  label,
  children,
  side = "top",
  wrap = false,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
  wrap?: boolean;
}) {
  if (label === null || label === undefined || label === "" || label === false) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{wrap ? <span className="inline-flex">{children}</span> : children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-72">
          <span className="block text-xs leading-relaxed">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
