"use client";

import { Contact, Forward, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantAction, AssistantVersion } from "@/lib/whatsapp-assistant-output";

const VERSION_LABEL: Record<AssistantVersion["kind"], string> = {
  curta: "Curta",
  completa: "Completa",
};

/**
 * Faixa logo acima do campo depois de uma sugestão da IA: troca entre a versão
 * curta e a completa e mostra as ações sugeridas (contato, encaminhar). Cada
 * ação só abre o modal certo; quem envia é o atendente.
 */
export function AssistantSuggestionBar({
  versions,
  activeIndex,
  actions,
  onPickVersion,
  onAction,
  onClose,
}: {
  versions: AssistantVersion[];
  activeIndex: number;
  actions: AssistantAction[];
  onPickVersion: (index: number) => void;
  onAction: (action: AssistantAction) => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#347796]/20 bg-white px-2 py-1.5 shadow-sm dark:bg-background">
      <span className="inline-flex items-center gap-1 pr-1 text-xs font-medium text-[#285f7a] dark:text-[#47cdd0]">
        <Sparkles className="size-3.5" aria-hidden />
        Sugestão da IA
      </span>

      {versions.length > 1 && (
        <span className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="Versão da sugestão">
          {versions.map((version, index) => (
            <button
              key={version.kind}
              type="button"
              aria-pressed={index === activeIndex}
              onClick={() => onPickVersion(index)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                index === activeIndex
                  ? "bg-white text-foreground shadow-sm dark:bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {VERSION_LABEL[version.kind]}
            </button>
          ))}
        </span>
      )}

      {actions.map((action) => (
        <Button
          key={`${action.type}:${action.contactId}`}
          type="button"
          variant="outline"
          size="xs"
          className="text-[#285f7a] dark:text-[#47cdd0]"
          onClick={() => onAction(action)}
        >
          {action.type === "send_contact" ? <Contact aria-hidden /> : <Forward aria-hidden />}
          {action.label}
        </Button>
      ))}

      <button
        type="button"
        onClick={onClose}
        className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Fechar sugestão da IA"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
