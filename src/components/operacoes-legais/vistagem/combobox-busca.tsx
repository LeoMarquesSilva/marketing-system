"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpcaoBusca {
  id: string;
  nome: string;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const MAX_RESULTADOS = 80;

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
}: {
  opcoes: OpcaoBusca[];
  valor: string;
  onChange: (nome: string) => void;
  placeholder: string;
  rotulo: string;
  permitirVazio?: boolean;
  invalido?: boolean;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  const filtradas = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    const resultado = termos.length ? opcoes.filter((opcao) => termos.every((termo) => normalizar(opcao.nome).includes(termo))) : opcoes;
    return resultado.slice(0, MAX_RESULTADOS);
  }, [busca, opcoes]);

  function escolher(nome: string) {
    onChange(nome);
    setAberto(false);
    setBusca("");
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAberto(true);
      setAtivo((atual) => Math.min(atual + 1, filtradas.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === "Enter") {
      if (aberto && filtradas[ativo]) {
        evento.preventDefault();
        escolher(filtradas[ativo].nome);
      }
    } else if (evento.key === "Escape") {
      setAberto(false);
      setBusca("");
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-10 items-center rounded-md border bg-white shadow-xs transition-[color,box-shadow] hover:border-[#3e84a8]/40 focus-within:border-[#47cdd0] focus-within:ring-[3px] focus-within:ring-[#47cdd0]/18",
          invalido ? "border-red-400" : "border-input"
        )}
      >
        <input
          role="combobox"
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && filtradas[ativo] ? `${id}-op-${ativo}` : undefined}
          className="h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70"
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
          onBlur={() => {
            setAberto(false);
            setBusca("");
          }}
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
        <ul
          id={`${id}-lista`}
          ref={lista}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[#dce9eb] bg-white py-1 text-sm shadow-[0_12px_32px_-12px_rgba(16,41,58,0.28)]"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Nada encontrado.</li>
          ) : (
            filtradas.map((opcao, indice) => (
              <li
                key={`${opcao.id}-${opcao.nome}`}
                id={`${id}-op-${indice}`}
                role="option"
                aria-selected={opcao.nome === valor}
                className={cn(
                  "cursor-pointer px-3 py-1.5",
                  indice === ativo && "bg-[#47cdd0]/15",
                  opcao.nome === valor && "font-medium text-[#285f7a]"
                )}
                onMouseEnter={() => setAtivo(indice)}
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  escolher(opcao.nome);
                }}
              >
                {opcao.nome}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
