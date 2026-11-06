"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Copy, Scale, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { consultaProcessual } from "@/lib/vistagem/consulta-processual";
import { AvatarPessoa } from "./combobox-busca";
import { formatarDataHora } from "./publicacao-ui";
import { Selo } from "./ui";

/** Botões da faixa azul-marinho do título da publicação. */
export const NA_FAIXA = "text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-white/60 disabled:text-white/35";

/** Botões de ação na faixa: o contornado em branco e o principal em ciano, para se destacar do fundo. */
export const BOTAO_FAIXA = "border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/50 dark:bg-transparent";
export const BOTAO_FAIXA_PRINCIPAL = "bg-[#47cdd0] font-semibold text-[#10293a] hover:bg-[#6ad8da] focus-visible:ring-white/60";

/** "04/11, 12:00" → "04/11 às 12:00". */
const dataEHora = (iso: string | null) => formatarDataHora(iso).replace(", ", " às ");

/**
 * Quem vistou, conferiu ou checou, na faixa do processo: foto, o papel e quando em cima, o nome em destaque embaixo.
 * (Mesmo desenho da Autoria da Conferência, que pode passar a usar esta.)
 */
export function AutoriaNaFaixa({ papel, nome, quando, fotos }: { papel: string; nome: string | null; quando: string | null; fotos: Record<string, string> }) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:ml-1 sm:border-l sm:border-white/20 sm:pl-3">
      <AvatarPessoa nome={nome ?? "?"} foto={nome ? fotos[chaveNome(nome)] : null} className="size-8 ring-2 ring-white/25" />
      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-1 text-[11px] text-white/65">
          <span className="font-medium uppercase">{papel}</span>
          <CalendarClock className="ml-0.5 size-3" aria-hidden />
          <span className="tabular-nums">{dataEHora(quando)}</span>
        </p>
        <p className="truncate text-sm font-semibold text-white" title={nome ?? undefined}>
          {nome ?? "Não identificado"}
        </p>
      </div>
    </div>
  );
}

/** Posição na fila, para andar entre as publicações sem abrir a lista. */
export interface NavegacaoNaFila {
  posicao: number;
  total: number;
  anterior: string | null;
  proxima: string | null;
}

/** Setas "‹ 3 de 12 ›" na faixa do processo. `separada`: com ações antes, ganha um divisor à esquerda. */
export function SetasDaFila({ navegacao, onAbrir, separada = false }: { navegacao: NavegacaoNaFila; onAbrir: (id: string) => void; separada?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1", separada && "ml-2 border-l border-white/20 pl-2")}>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={NA_FAIXA}
        disabled={!navegacao.anterior}
        onClick={() => navegacao.anterior && onAbrir(navegacao.anterior)}
        aria-label="Publicação anterior"
        title="Publicação anterior"
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-14 text-center text-xs tabular-nums text-white/80">
        {navegacao.posicao} de {navegacao.total}
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={NA_FAIXA}
        disabled={!navegacao.proxima}
        onClick={() => navegacao.proxima && onAbrir(navegacao.proxima)}
        aria-label="Próxima publicação"
        title="Próxima publicação"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Número do processo no título: abre a consulta do tribunal em nova aba (quando há endereço conhecido) e copia. */
function NumeroDoProcesso({ numero, tribunal, tituloId }: { numero: string; tribunal: string | null; tituloId: string }) {
  const [copiado, setCopiado] = useState(false);
  const consulta = consultaProcessual(tribunal, numero);
  const copiar = (texto: string) =>
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    });
  // Consulta só por formulário (ou com login): o clique abre a página e já copia o número para colar no campo.
  const dica = consulta
    ? consulta.copiar
      ? `Abrir ${consulta.onde}: o número (${consulta.copiar}) vai copiado, é só colar no campo do processo`
      : `Pesquisar ${consulta.onde}${consulta.preenchida ? " (o número já vai preenchido: falta consultar)" : ""}`
    : "";
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
            title={dica}
            onClick={() => {
              if (consulta.copiar) void copiar(consulta.copiar);
            }}
            className="inline-flex items-center gap-1.5 rounded-sm text-white underline decoration-white/60 underline-offset-4 hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            {numero}
            <span className="sr-only">
              ({consulta.copiar ? `abre ${consulta.onde} em nova aba e copia o número para colar` : `pesquisa ${consulta.onde}, em nova aba`})
            </span>
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
        onClick={() => void copiar(numero)}
      >
        {copiado ? <Check /> : <Copy />}
      </Button>
    </>
  );
}

/**
 * Faixa azul-marinho no topo da publicação, na vistagem do jurídico e na conferência da controladoria: o número
 * do processo (pesquisa no tribunal e copiar), o tribunal, outros selos e, à direita, o que a tela pedir.
 * `antes` fica à esquerda do número (ex.: o botão da fila, com o próprio divisor). Demanda de risco pinta a faixa de vermelho-escuro,
 * com o selo, para a pessoa ler com mais cautela; `seloDeRisco={false}` tira o selo quando a tela já o mostra logo abaixo.
 */
export function FaixaDoProcesso({
  numero,
  tribunal,
  tituloId,
  selos,
  antes,
  risco = false,
  seloDeRisco = true,
  children,
}: {
  numero: string;
  tribunal: string | null;
  tituloId: string;
  selos?: ReactNode;
  antes?: ReactNode;
  risco?: boolean;
  seloDeRisco?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("px-4 py-2.5 transition-colors", risco ? "bg-[#8f1d26]" : "bg-[#10293a]")}>
      <div className="flex flex-wrap items-center gap-2">
        {antes}
        <NumeroDoProcesso numero={numero} tribunal={tribunal} tituloId={tituloId} />
        {risco && seloDeRisco ? (
          <Selo tom="escuro" icone={ShieldAlert} className="bg-white text-[#8f1d26] ring-white">
            Demanda de risco
          </Selo>
        ) : null}
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
