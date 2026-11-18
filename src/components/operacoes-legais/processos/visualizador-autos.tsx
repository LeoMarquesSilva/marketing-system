"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { registrarVisualizador, type PdfParaAbrir } from "./processos-api";

/**
 * Visualizador dos autos dentro da ficha. O navegador embutido do app (e bloqueadores de pop-up) não abre
 * aba nova: o PDF abre aqui, já na página citada, com a opção de levar para uma aba.
 */
export function VisualizadorAutos() {
  const [pdf, setPdf] = useState<PdfParaAbrir | null>(null);

  useEffect(() => registrarVisualizador(setPdf), []);

  const endereco = pdf ? `${pdf.url}#page=${pdf.pagina ?? 1}&view=FitH` : "";
  return (
    <Dialog open={Boolean(pdf)} onOpenChange={(aberto) => (aberto ? null : setPdf(null))}>
      <DialogContent className="flex h-[92dvh] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="flex-row items-center gap-3 border-b border-[#e6eef0] px-4 py-3 pr-12 text-left">
          <FileText className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold">Autos do processo</DialogTitle>
            <DialogDescription className="text-xs">{pdf?.pagina ? `Aberto na página ${pdf.pagina}.` : "Primeira página."} O link vale por 10 minutos.</DialogDescription>
          </div>
          {pdf ? (
            <Button asChild size="sm" variant="outline">
              <a href={endereco} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Abrir em nova aba
              </a>
            </Button>
          ) : null}
        </DialogHeader>
        {pdf ? <iframe key={endereco} src={endereco} title="Autos do processo" className="min-h-0 w-full flex-1 bg-[#525659]" /> : null}
      </DialogContent>
    </Dialog>
  );
}
