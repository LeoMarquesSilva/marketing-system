"use client";

import { Button } from "@/components/ui/button";
import {
  Check,
  Download,
  ExternalLink,
  Link2,
  Pencil,
  Send,
  TrendingUp,
} from "lucide-react";
import { PerformanceHint } from "@/components/conteudo/roteiro-card";

/** Prévia estática do fluxo ao abrir uma notícia — usada só durante o tutorial. */
export function ContentTourRoteiroDemo() {
  return (
    <section
      className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.02] p-4 sm:p-5 space-y-4"
      aria-label="Demonstração do fluxo de validação"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 uppercase tracking-wide">Tour</span>
        <span className="text-muted-foreground">Exemplo ao abrir uma notícia</span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="bg-gradient-to-br from-[#101f2e] to-[#0a141c] px-4 py-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-1">
            Trabalhista · A validar
          </p>
          <p className="text-sm font-semibold leading-snug">
            Exemplo: STF decide sobre prazo para ação trabalhista
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 border-b px-4 py-3 bg-muted/20"
          data-tour="demo-actions-bar"
        >
          <Button size="sm" variant="outline" className="gap-2 h-8 text-xs pointer-events-none">
            <ExternalLink className="h-3.5 w-3.5" />
            Conferir notícia
          </Button>
          <Button size="sm" variant="outline" className="gap-2 h-8 text-xs pointer-events-none">
            <Pencil className="h-3.5 w-3.5" />
            Editar texto
          </Button>
          <Button size="sm" variant="outline" className="gap-2 h-8 text-xs pointer-events-none">
            <Download className="h-3.5 w-3.5" />
            Baixar Word
          </Button>
          <Button
            size="sm"
            className="ml-auto gap-2 h-8 text-xs bg-emerald-600 pointer-events-none"
            data-tour="demo-approve-review"
          >
            <Check className="h-3.5 w-3.5" />
            Aprovar e enviar p/ revisão
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div data-tour="demo-insight">
            <PerformanceHint
              hint="Posts sobre prazos e decisões do STF na sua área costumam ter 23% mais alcance que a média do escritório."
              className="text-xs"
            />
          </div>

          <div
            className="rounded-xl border bg-muted/10 p-3 space-y-2"
            data-tour="demo-vios-link"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              Tarefa do VIOS vinculada
            </p>
            <div className="h-9 rounded-md border bg-background px-3 flex items-center text-sm text-muted-foreground">
              VIOS-1234 · Post LinkedIn — março
            </div>
            <p className="text-[11px] text-muted-foreground">
              Vincule sua tarefa do VIOS antes de enviar ao marketing — ela aparece no Planner.
            </p>
          </div>

          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-violet-200/60 bg-violet-50/50 dark:bg-violet-950/20 p-3"
            data-tour="demo-after-review"
          >
            <div className="flex-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Após o gestor revisar:</span> ele clica em
              &quot;Revisor aprovou&quot; e o post fica pronto para o marketing.
            </div>
            <Button
              size="sm"
              className="gap-2 h-8 text-xs bg-violet-600 shrink-0 pointer-events-none"
            >
              <Check className="h-3.5 w-3.5" />
              Revisor aprovou
            </Button>
          </div>

          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3"
            data-tour="demo-send-mkt"
          >
            <div className="flex-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Envio ao marketing:</span> um clique substitui
              o e-mail — a solicitação entra direto no Planner do time.
            </div>
            <Button
              size="sm"
              className="gap-2 h-8 text-xs bg-emerald-600 shrink-0 pointer-events-none"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar ao marketing
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        Na prática, clique em qualquer notícia da lista para ver este painel com dados reais.
      </p>
    </section>
  );
}
