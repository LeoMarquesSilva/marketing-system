"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Users, X } from "lucide-react";
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
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [ampliado, setAmpliado] = useState(false);
  const lista = useRef<HTMLUListElement>(null);

  const filtradas = useMemo(
    () => filtrar(ampliado && ampliar ? ampliar.todas : opcoes, busca).slice(0, MAX_RESULTADOS),
    [ampliado, ampliar, busca, opcoes]
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
        <input
          role="combobox"
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && ativo < totalLinhas ? `${id}-op-${ativo}` : undefined}
          className={cn(
            "h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70",
            comAvatar && "pl-2",
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
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-[#dce9eb] bg-white text-sm shadow-[0_12px_32px_-12px_rgba(16,41,58,0.28)]"
          onMouseDown={(evento) => evento.preventDefault()}
        >
          {ampliar ? (
            <p className="border-b border-[#e6eef0] bg-[#f7fbfc] px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              {ampliado ? "Todas as pessoas do VIOS" : `Pessoas de ${ampliar.area}`}
            </p>
          ) : null}
          <ul id={`${id}-lista`} ref={lista} role="listbox" aria-label={rotulo} className="max-h-72 overflow-auto py-1">
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">
                {ampliar && !ampliado ? `Ninguém de ${ampliar.area} com esse nome.` : "Nada encontrado."}
              </li>
            ) : (
              filtradas.map((opcao, indice) => (
                <li
                  key={`${opcao.id}-${opcao.nome}`}
                  id={`${id}-op-${indice}`}
                  role="option"
                  aria-selected={opcao.nome === valor}
                  className={cn(
                    "cursor-pointer px-3 py-1.5",
                    pessoas && "flex items-center gap-2",
                    indice === ativo && "bg-[#47cdd0]/15",
                    opcao.nome === valor && "font-medium text-[#285f7a]"
                  )}
                  onMouseEnter={() => setAtivo(indice)}
                  onMouseDown={(evento) => {
                    evento.preventDefault();
                    escolher(opcao.nome);
                  }}
                >
                  {pessoas ? (
                    <>
                      <AvatarPessoa nome={opcao.nome} foto={opcao.foto} />
                      <span className="min-w-0 flex-1 truncate">{opcao.nome}</span>
                      {opcao.detalhe ? <span className="shrink-0 text-[11px] font-normal text-muted-foreground">{opcao.detalhe}</span> : null}
                    </>
                  ) : (
                    opcao.nome
                  )}
                </li>
              ))
            )}
            {ampliar ? (
              <li
                id={`${id}-op-${indiceAlternar}`}
                role="option"
                aria-selected={false}
                className={cn(
                  "mt-1 flex cursor-pointer items-center gap-2 border-t border-[#e6eef0] px-3 py-2 text-xs font-medium text-[#285f7a]",
                  ativo === indiceAlternar && "bg-[#47cdd0]/15"
                )}
                onMouseEnter={() => setAtivo(indiceAlternar)}
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  alternar();
                }}
              >
                <Users className="size-4 shrink-0" aria-hidden />
                {ampliado
                  ? `Só pessoas de ${ampliar.area}`
                  : `Mostrar todas as pessoas${naListaInteira !== null ? ` (${naListaInteira} com esse nome)` : ""}`}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
