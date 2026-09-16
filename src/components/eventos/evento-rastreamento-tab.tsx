"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FileArchive, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventPublicCampaignSummary } from "@/lib/event-public";

function formatLastClick(value: string | null): string {
  if (!value) return "Nenhum clique registrado";
  return `Último clique em ${new Date(value).toLocaleString("pt-BR")}`;
}

export function EventoRastreamentoTab({
  campaign,
}: {
  campaign: EventPublicCampaignSummary;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-[var(--orquestrai-action)]" />
              <h3 className="font-semibold">Link para entrega dos materiais</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Exibe somente os anexos marcados como “Público” na aba Arquivos.
            </p>
          </div>
          {campaign.share && (
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void copy(campaign.share!.publicUrl, "share")}
              >
                {copied === "share" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "share" ? "Copiado" : "Copiar link"}
              </Button>
              <Button asChild>
                <a href={campaign.share.publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Abrir
                </a>
              </Button>
            </div>
          )}
        </div>
        {campaign.share ? (
          <code className="mt-4 block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
            {campaign.share.publicUrl}
          </code>
        ) : (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este evento ainda não possui um compartilhamento público.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h3 className="font-semibold">Links rastreáveis do estande</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada acesso é contado antes do redirecionamento ao canal de destino.
            </p>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-semibold tabular-nums">
              {campaign.links.reduce((sum, link) => sum + link.totalClicks, 0)}
            </span>
            <span className="text-xs text-muted-foreground">cliques totais</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {campaign.links.map((link) => (
            <article key={link.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <MousePointerClick className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="font-semibold">{link.label}</h4>
                    <p className="text-xs text-muted-foreground">{formatLastClick(link.lastClickedAt)}</p>
                  </div>
                </div>
                <strong className="text-2xl tabular-nums">{link.totalClicks}</strong>
              </div>
              <code className="mt-4 block overflow-x-auto rounded-md bg-muted px-2.5 py-2 text-[11px]">
                {link.trackingUrl}
              </code>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copy(link.trackingUrl, link.id)}
                >
                  {copied === link.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === link.id ? "Copiado" : "Copiar"}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={link.trackingUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Testar
                  </a>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        O rastreamento não guarda endereço IP. Acessos automáticos de plataformas podem
        aparecer na contagem; use os parâmetros UTM do site em conjunto com o GA4 para
        analisar sessões e conversões reais.
      </p>
    </div>
  );
}
