"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, SearchX, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";

export interface OpcaoBusca {
  id: string;
  nome: string;
  /** Foto da pessoa (campos de pessoa); sem ela, as iniciais. */
  foto?: string | null;
  /** Texto miúdo à direita do nome (ex.: a área de quem é de fora). */
  detalhe?: string | null;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filtrar(opcoes: OpcaoBusca[], busca: string): OpcaoBusca[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  return termos.length ? opcoes.filter((opcao) => termos.every((termo) => normalizar(opcao.nome).includes(termo))) : opcoes;
}

const MAX_RESULTADOS = 80;

/**
 * O nome com o primeiro trecho buscado em destaque ("revis" em "2. REVISAR"). Sem acento a contagem de letras é a
 * mesma, então a posição achada no texto normalizado vale no original.
 */
function Destaque({ texto, busca }: { texto: string; busca: string }) {
  const termo = normalizar(busca).split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)[0];
  const inicio = termo ? normalizar(texto).indexOf(termo) : -1;
  if (!termo || inicio < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, inicio)}
      <mark className="bg-transparent font-semibold text-[#183f50]">{texto.slice(inicio, inicio + termo.length)}</mark>
      {texto.slice(inicio + termo.length)}
    </>
  );
}

/** Foto da pessoa ou, sem ela (ou se não carregar), as iniciais: o mesmo visual da ficha da pasta. */
export function AvatarPessoa({ nome, foto, className }: { nome: string; foto?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-6 shrink-0 ring-1 ring-black/5", className)}>
      {foto ? <AvatarImage src={foto} alt="" /> : null}
      <AvatarFallback className="bg-[#e8f1f5] text-[10px] font-semibold text-[#315f73]">{getInitials(nome) || "?"}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Lista travada com busca: digite para filtrar e escolha uma opção. Texto que não
 * corresponde a uma opção não é aceito (volta para a escolha anterior).
 */
export function ComboboxBusca({
  opcoes,
  valor,
  onChange,
  placeholder,
  rotulo,
  permitirVazio = false,
  invalido = false,
  pessoas = false,
  ampliar = null,
  antes = null,
  titulo,
  icone = null,
  maxResultados = MAX_RESULTADOS,
}: {
  opcoes: OpcaoBusca[];
  valor: string;
  onChange: (nome: string) => void;
  placeholder: string;
  rotulo: string;
  permitirVazio?: boolean;
  invalido?: boolean;
  /** As opções são pessoas: foto (ou iniciais) em cada uma e na escolhida. */
  pessoas?: boolean;
  /**
   * `opcoes` traz só as pessoas da área; a última linha da lista abre todas (`todas`) para a exceção
   * (ex.: revisor de outra área) e volta. Ao fechar, a lista volta a ser a da área.
   */
  ampliar?: { todas: OpcaoBusca[]; area: string } | null;
  /** Já escolhidos (campo de vários valores) dentro do campo, antes da busca: o campo fica da altura dos outros. */
  antes?: ReactNode;
  /** Título da lista ("Tarefas de Prazo"); com `ampliar`, o título diz de quem são as pessoas. */
  titulo?: string;
  /** Ícone no campo, à esquerda (ex.: a classe da tarefa). */
  icone?: ReactNode;
  /** Quantas opções a lista mostra de uma vez (ex.: a lista toda, como no combo do VIOS). */
  maxResultados?: number;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [ampliado, setAmpliado] = useState(false);
  const lista = useRef<HTMLUListElement>(null);

  const filtradas = useMemo(
    () => filtrar(ampliado && ampliar ? ampliar.todas : opcoes, busca).slice(0, maxResultados),
    [ampliado, ampliar, busca, maxResultados, opcoes]
  );
  // Quantas pessoas de toda a lista batem com a busca: aparece na linha que abre a lista inteira.
  const naListaInteira = useMemo(() => (ampliar && !ampliado && busca.trim() ? filtrar(ampliar.todas, busca).length : null), [ampliado, ampliar, busca]);
  /** Índice da linha que alterna entre a área e todas as pessoas (depois das opções). */
  const indiceAlternar = ampliar ? filtradas.length : -1;
  const totalLinhas = filtradas.length + (ampliar ? 1 : 0);
  const escolhida = pessoas && valor ? [...opcoes, ...(ampliar?.todas ?? [])].find((opcao) => normalizar(opcao.nome) === normalizar(valor)) : undefined;
  const comAvatar = pessoas && Boolean(valor) && !aberto;

  function fechar() {
    setAberto(false);
    setBusca("");
    setAmpliado(false);
  }

  function escolher(nome: string) {
    onChange(nome);
    fechar();
  }

  function alternar() {
    setAmpliado((atual) => !atual);
    setAtivo(0);
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAberto(true);
      setAtivo((atual) => Math.min(atual + 1, totalLinhas - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === "Enter") {
      if (aberto && filtradas[ativo]) {
        evento.preventDefault();
        escolher(filtradas[ativo].nome);
      } else if (aberto && ativo === indiceAlternar) {
        evento.preventDefault();
        alternar();
      }
    } else if (evento.key === "Escape") {
      fechar();
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center rounded-md border bg-white shadow-xs transition-[color,box-shadow] hover:border-[#3e84a8]/40 focus-within:border-[#47cdd0] focus-within:ring-[3px] focus-within:ring-[#47cdd0]/18",
          antes ? "min-h-10 flex-wrap gap-1 py-1 pl-1" : "h-10",
          invalido ? "border-red-400" : "border-input"
        )}
      >
        {antes}
        {comAvatar ? <AvatarPessoa nome={valor} foto={escolhida?.foto} className="ml-2" /> : null}
        {icone && !pessoas ? <span className="ml-2 flex shrink-0">{icone}</span> : null}
        <input
          role="combobox"
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && ativo < totalLinhas ? `${id}-op-${ativo}` : undefined}
          className={cn(
            "h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70",
            (comAvatar || (icone && !pessoas)) && "pl-2",
            antes && "h-7 min-w-32 px-2"
          )}
          placeholder={valor || placeholder}
          value={aberto ? busca : valor}
          onFocus={() => {
            setAberto(true);
            setBusca("");
            setAtivo(0);
          }}
          onChange={(evento) => {
            setBusca(evento.target.value);
            setAberto(true);
            setAtivo(0);
          }}
          onBlur={fechar}
          onKeyDown={aoTeclar}
        />
        {permitirVazio && valor ? (
          <button
            type="button"
            className="px-2 text-muted-foreground hover:text-foreground"
            aria-label={`Limpar ${rotulo}`}
            onMouseDown={(evento) => {
              evento.preventDefault();
              escolher("");
            }}
          >
            <X className="size-4" />
          </button>
        ) : null}
        <ChevronDown className="mr-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      {aberto ? (
        // mouseDown sem tirar o foco do campo: clicar no título ou na linha de alternar não fecha a lista
        <div
          className="absolute z-30 mt-1 w-full min-w-64 overflow-hidden rounded-lg border border-[#dce9eb] bg-white text-sm shadow-[0_16px_40px_-18px_rgba(3,32,47,0.35)] animate-in fade-in-0 zoom-in-95"
          onMouseDown={(evento) => evento.preventDefault()}
        >
          {/* Título da lista e quantos itens ela mostra (no padrão dos filtros). */}
          {ampliar || titulo ? (
            <p className="flex items-center gap-2 border-b border-[#e6eef0] bg-[#fafcfc] px-3 py-1.5 text-[11px] font-semibold uppercase text-[#285f7a]">
              <span className="min-w-0 flex-1 truncate">{ampliar ? (ampliado ? "Todas as pessoas do VIOS" : `Pessoas de ${ampliar.area}`) : titulo}</span>
              <span className="shrink-0 rounded-full bg-[#eef4f6] px-1.5 py-px font-medium normal-case tabular-nums">{filtradas.length}</span>
            </p>
          ) : null}
          <ul id={`${id}-lista`} ref={lista} role="listbox" aria-label={rotulo} className="max-h-72 overflow-auto p-1">
            {filtradas.length === 0 ? (
              <li className="flex items-center gap-2 px-2.5 py-3 text-muted-foreground">
                <SearchX className="size-4 shrink-0 text-[#9fb8c2]" aria-hidden />
                {ampliar && !ampliado ? `Ninguém de ${ampliar.area} com esse nome.` : "Nada encontrado."}
              </li>
            ) : (
              filtradas.map((opcao, indice) => {
                const escolhidaNaLista = opcao.nome === valor;
                return (
                  <li
                    key={`${opcao.id}-${opcao.nome}`}
                    id={`${id}-op-${indice}`}
                    role="option"
                    aria-selected={escolhidaNaLista}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-foreground",
                      indice === ativo && "bg-[#47cdd0]/12",
                      escolhidaNaLista && "font-medium text-[#183f50]"
                    )}
                    onMouseEnter={() => setAtivo(indice)}
                    onMouseDown={(evento) => {
                      evento.preventDefault();
                      escolher(opcao.nome);
                    }}
                  >
                    {pessoas ? <AvatarPessoa nome={opcao.nome} foto={opcao.foto} /> : null}
                    {/* Pessoa cabe numa linha; nome de tarefa do VIOS pode ser longo e quebra em vez de cortar. */}
                    <span className={cn("min-w-0 flex-1", pessoas ? "truncate" : "break-words leading-snug")}>
                      <Destaque texto={opcao.nome} busca={busca} />
                    </span>
                    {opcao.detalhe ? (
                      <span className="shrink-0 rounded-full bg-[#eef4f6] px-1.5 py-px text-[11px] font-medium text-[#285f7a]">{opcao.detalhe}</span>
                    ) : null}
                    <span className="flex size-4 shrink-0 items-center justify-center text-[#285f7a]">
                      {escolhidaNaLista ? <Check className="size-4" aria-hidden /> : null}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
          {ampliar ? (
            // Fora da lista rolável: o atalho para a lista inteira fica sempre à vista, como rodapé.
            <button
              type="button"
              id={`${id}-op-${indiceAlternar}`}
              tabIndex={-1}
              className={cn(
                "flex w-full items-center gap-2 border-t border-[#e6eef0] bg-[#fafcfc] px-3 py-2 text-left text-xs font-medium text-[#285f7a] hover:bg-[#47cdd0]/10",
                ativo === indiceAlternar && "bg-[#47cdd0]/12"
              )}
              onMouseEnter={() => setAtivo(indiceAlternar)}
              onMouseDown={(evento) => {
                evento.preventDefault();
                alternar();
              }}
            >
              <Users className="size-4 shrink-0" aria-hidden />
              {ampliado
                ? `Voltar só para as pessoas de ${ampliar.area}`
                : `Mostrar todas as pessoas do VIOS${naListaInteira !== null ? ` (${naListaInteira} com esse nome)` : ""}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
