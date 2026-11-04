"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Scale, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultaProcessual } from "@/lib/vistagem/consulta-processual";
import { Selo } from "./ui";

/** Botões da faixa azul-marinho do título da publicação. */
export const NA_FAIXA = "text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-white/60 disabled:text-white/35";

/** Número do processo no título: abre a consulta do tribunal em nova aba (quando há endereço conhecido) e copia. */
function NumeroDoProcesso({ numero, tribunal, tituloId }: { numero: string; tribunal: string | null; tituloId: string }) {
  const [copiado, setCopiado] = useState(false);
  const consulta = consultaProcessual(tribunal, numero);
  return (
    <>
      <h2 id={tituloId} className="flex flex-wrap items-center gap-x-2.5 text-base font-bold tabular-nums text-white">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
          <Scale className="size-4 shrink-0" aria-hidden />
          Nº do processo
        </span>
        {consulta ? (
          // A lupa diz que o número pesquisa o processo no tribunal (como no VIOS).
          <a
            href={consulta.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Pesquisar ${consulta.onde}${consulta.preenchida ? " (o número já vai preenchido: falta consultar)" : ""}`}
            className="inline-flex items-center gap-1.5 rounded-sm text-white underline decoration-white/60 underline-offset-4 hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            {numero}
            <span className="sr-only">(pesquisa {consulta.onde}, em nova aba)</span>
          </a>
        ) : (
          numero
        )}
      </h2>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className={NA_FAIXA}
        title={copiado ? "Copiado" : "Copiar o número do processo"}
        aria-label="Copiar o número do processo"
        onClick={() => {
          void navigator.clipboard?.writeText(numero).then(() => {
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1500);
          });
        }}
      >
        {copiado ? <Check /> : <Copy />}
      </Button>
    </>
  );
}

/**
 * Faixa azul-marinho no topo da publicação, na vistagem do jurídico e na conferência da controladoria: o número
 * do processo (pesquisa no tribunal e copiar), o tribunal, outros selos e, à direita, o que a tela pedir.
 */
export function FaixaDoProcesso({
  numero,
  tribunal,
  tituloId,
  selos,
  children,
}: {
  numero: string;
  tribunal: string | null;
  tituloId: string;
  selos?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bg-[#10293a] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <NumeroDoProcesso numero={numero} tribunal={tribunal} tituloId={tituloId} />
        {tribunal ? (
          <Selo tom="escuro" className="bg-white/15 text-white ring-white/30">
            {tribunal}
          </Selo>
        ) : null}
        {selos}
        {children ? <div className="ml-auto flex flex-wrap items-center justify-end gap-1">{children}</div> : null}
      </div>
    </div>
  );
}
