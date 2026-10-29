"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  /** Ícone da área, logo do grupo…: aparece na lista e no campo. */
  icone?: ReactNode;
  contagem?: number;
}

/** Opção "vazia" que fica na lista ("Todas as áreas"); o valor dela é "". */
export type OpcaoTodos = Omit<OpcaoSeletor, "valor">;

const VAZIO = "__vazio";

function Conteudo({ opcao }: { opcao: OpcaoTodos }) {
  return (
    <>
      {opcao.icone}
      <span className="truncate">{opcao.rotulo}</span>
      {opcao.contagem !== undefined ? <span className="text-xs tabular-nums text-muted-foreground">{opcao.contagem}</span> : null}
    </>
  );
}

/**
 * Dropdown da Vistagem (no lugar do select nativo): ícone, rótulo e contagem na lista e no campo.
 * Sem `todos`, valor "" mostra o placeholder.
 */
export function Seletor({
  valor,
  onChange,
  opcoes,
  todos,
  placeholder,
  rotulo,
  className,
  invalido = false,
  desabilitado = false,
}: {
  valor: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  todos?: OpcaoTodos;
  placeholder?: string;
  /** Nome acessível do campo. */
  rotulo: string;
  className?: string;
  invalido?: boolean;
  desabilitado?: boolean;
}) {
  return (
    <Select value={valor || (todos ? VAZIO : "")} onValueChange={(novo) => onChange(novo === VAZIO ? "" : novo)} disabled={desabilitado}>
      <SelectTrigger aria-label={rotulo} aria-invalid={invalido || undefined} className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {todos ? (
          <SelectItem value={VAZIO}>
            <Conteudo opcao={todos} />
          </SelectItem>
        ) : null}
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.valor} value={opcao.valor}>
            <Conteudo opcao={opcao} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Dropdown com busca, para listas longas (grupos de clientes). Mesmo visual do Seletor. */
export function SeletorBusca({
  valor,
  onChange,
  opcoes,
  todos,
  placeholder = "Escolha…",
  buscaPlaceholder = "Buscar…",
  rotulo,
  className,
}: {
  valor: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  todos?: OpcaoTodos;
  placeholder?: string;
  buscaPlaceholder?: string;
  rotulo: string;
  className?: string;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  const itens = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    const filtradas = termos.length ? opcoes.filter((opcao) => termos.every((termo) => normalizar(opcao.rotulo).includes(termo))) : opcoes;
    return [...(todos && !termos.length ? [{ ...todos, valor: "" }] : []), ...filtradas];
  }, [busca, opcoes, todos]);

  const atual = valor ? opcoes.find((opcao) => opcao.valor === valor) : todos ? { ...todos, valor: "" } : undefined;

  function escolher(novo: string) {
    onChange(novo);
    setAberto(false);
  }

  function mover(passo: number) {
    if (!itens.length) return;
    const proximo = (ativo + passo + itens.length) % itens.length;
    setAtivo(proximo);
    lista.current?.querySelector<HTMLElement>(`[data-indice="${proximo}"]`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(abrir) => {
        setAberto(abrir);
        if (abrir) {
          setBusca("");
          setAtivo(Math.max(0, itens.findIndex((item) => item.valor === valor)));
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          className={cn(
            "flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow]",
            "hover:border-[#3e84a8]/40 focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18",
            className
          )}
        >
          <span className={cn("flex min-w-0 flex-1 items-center gap-2", !atual && "text-muted-foreground")}>
            {atual ? <Conteudo opcao={atual} /> : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-(--radix-popover-trigger-width) min-w-72 overflow-hidden rounded-md border-[#dce9eb] p-0 shadow-[0_16px_40px_-18px_rgba(3,32,47,0.35)]">
        <div className="relative border-b border-[#e6eef0]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value);
              setAtivo(0);
            }}
            onKeyDown={(evento) => {
              if (evento.key === "ArrowDown") {
                evento.preventDefault();
                mover(1);
              } else if (evento.key === "ArrowUp") {
                evento.preventDefault();
                mover(-1);
              } else if (evento.key === "Enter" && itens[ativo]) {
                evento.preventDefault();
                escolher(itens[ativo].valor);
              }
            }}
            placeholder={buscaPlaceholder}
            aria-label={`Buscar em ${rotulo.toLowerCase()}`}
            aria-controls={`${id}-lista`}
            aria-activedescendant={itens[ativo] ? `${id}-${ativo}` : undefined}
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul ref={lista} id={`${id}-lista`} role="listbox" aria-label={rotulo} className="max-h-72 overflow-y-auto p-1">
          {itens.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">Nada encontrado.</li>
          ) : (
            itens.map((item, indice) => {
              const escolhido = item.valor === valor;
              return (
                <li
                  key={item.valor || VAZIO}
                  id={`${id}-${indice}`}
                  role="option"
                  aria-selected={escolhido}
                  data-indice={indice}
                  onMouseEnter={() => setAtivo(indice)}
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => escolher(item.valor)}
                  className={cn(
                    "flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-2 text-sm",
                    indice === ativo && "bg-[#47cdd0]/12"
                  )}
                >
                  <Conteudo opcao={item} />
                  {escolhido ? <Check className="ml-auto size-4 shrink-0 text-[#285f7a]" aria-hidden /> : null}
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
