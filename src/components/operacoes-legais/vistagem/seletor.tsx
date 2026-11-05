"use client";

import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  /** Ícone da área, logo do grupo…: aparece na lista e no campo. Use o tamanho dos ícones de área (size-5). */
  icone?: ReactNode;
  /** Linha de apoio, só na lista (ex.: "2ª Região · São Paulo", "quarta-feira · hoje"). */
  descricao?: string | null;
  contagem?: number;
}

/** Opção "vazia" que fica na lista ("Todas as áreas"); o valor dela é "". */
export type OpcaoTodos = Omit<OpcaoSeletor, "valor">;

const VAZIO = "__vazio";

/** Ícone solto num quadrado do tamanho dos ícones de área, para a lista ficar alinhada (opção "Todos", datas…). */
export function IconeOpcao({ icone: Icone, className }: { icone: LucideIcon; className?: string }) {
  return (
    <span
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded bg-[#e8f8f8] text-[#3e84a8] ring-1 ring-[#47cdd0]/25", className)}
      aria-hidden
    >
      <Icone className="size-3 text-current" />
    </span>
  );
}

/** No campo: ícone, rótulo e a contagem em cinza. */
function Conteudo({ opcao }: { opcao: OpcaoTodos }) {
  return (
    <>
      {opcao.icone}
      <span className="truncate">{opcao.rotulo}</span>
      {opcao.contagem !== undefined ? <span className="text-xs tabular-nums text-muted-foreground">{opcao.contagem}</span> : null}
    </>
  );
}

/** Contagem na lista: pílula alinhada à direita. */
function Contagem({ valor }: { valor: number }) {
  return <span className="shrink-0 rounded-full bg-[#eef4f6] px-1.5 py-px text-[11px] font-medium tabular-nums text-[#285f7a]">{valor}</span>;
}

/** Classe da linha da lista, igual no Seletor e no SeletorBusca. */
const LINHA = "relative flex w-full cursor-default select-none items-center gap-2.5 rounded-md py-1.5 pl-2 pr-2 text-sm text-foreground outline-none";

/**
 * Linha da lista: ícone (coluna fixa), rótulo com a descrição embaixo, contagem à direita e, por último, o ✓ da
 * escolhida. `texto` é o rótulo já embrulhado (no Seletor, o ItemText do Radix, que serve à busca por teclado).
 */
function MioloDaLinha({ opcao, texto, marca }: { opcao: OpcaoTodos; texto: ReactNode; marca: ReactNode }) {
  return (
    <>
      {opcao.icone ? <span className="flex w-5 shrink-0 justify-center">{opcao.icone}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{texto}</span>
        {opcao.descricao ? <span className="block truncate text-xs text-muted-foreground">{opcao.descricao}</span> : null}
      </span>
      {opcao.contagem !== undefined ? <Contagem valor={opcao.contagem} /> : null}
      <span className="flex size-4 shrink-0 items-center justify-center text-[#285f7a]">{marca}</span>
    </>
  );
}

function ItemSeletor({ valor, opcao }: { valor: string; opcao: OpcaoTodos }) {
  return (
    <SelectPrimitive.Item
      value={valor}
      className={cn(
        LINHA,
        "data-[highlighted]:bg-[#47cdd0]/12 data-[state=checked]:font-medium data-[state=checked]:text-[#183f50] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      )}
    >
      <MioloDaLinha
        opcao={opcao}
        texto={<SelectPrimitive.ItemText>{opcao.rotulo}</SelectPrimitive.ItemText>}
        marca={
          <SelectPrimitive.ItemIndicator>
            <Check className="size-4" aria-hidden />
          </SelectPrimitive.ItemIndicator>
        }
      />
    </SelectPrimitive.Item>
  );
}

/** Título pequeno no topo da lista dos filtros ("Tribunal", "Data Publicação"). */
const TITULO_LISTA = "px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase text-[#285f7a]";
const SEPARADOR = "-mx-1 my-1 h-px bg-[#e6eef0]";

/**
 * Dropdown da Vistagem (no lugar do select nativo). Na lista: ícone, rótulo com a descrição embaixo e a contagem
 * em pílula; com `todos` (filtros), o título do filtro no topo e um separador depois de "Todos". No campo: ícone,
 * rótulo e contagem. Sem `todos`, valor "" mostra o placeholder.
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
  rotuloVazio,
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
  /** No campo, no lugar da opção `todos` quando nada está escolhido (ex.: "Data Publicação"); a lista continua com `todos`. */
  rotuloVazio?: ReactNode;
}) {
  // O campo mostra o que a tela monta (ícone, rótulo, contagem), não o texto da linha da lista, que tem a descrição.
  const atual = valor ? (opcoes.find((opcao) => opcao.valor === valor) ?? { rotulo: valor }) : null;
  const noCampo = atual ? <Conteudo opcao={atual} /> : rotuloVazio ?? (todos ? <Conteudo opcao={todos} /> : null);
  return (
    <Select value={valor || (todos ? VAZIO : "")} onValueChange={(novo) => onChange(novo === VAZIO ? "" : novo)} disabled={desabilitado}>
      <SelectTrigger aria-label={rotulo} aria-invalid={invalido || undefined} className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder}>{noCampo}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80 min-w-64">
        <SelectPrimitive.Group>
          {todos ? (
            <>
              <SelectPrimitive.Label className={TITULO_LISTA}>{rotulo}</SelectPrimitive.Label>
              <ItemSeletor valor={VAZIO} opcao={todos} />
              {opcoes.length ? <SelectPrimitive.Separator className={SEPARADOR} /> : null}
            </>
          ) : null}
          {opcoes.map((opcao) => (
            <ItemSeletor key={opcao.valor} valor={opcao.valor} opcao={opcao} />
          ))}
        </SelectPrimitive.Group>
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
  rotuloVazio,
}: {
  valor: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  todos?: OpcaoTodos;
  placeholder?: string;
  buscaPlaceholder?: string;
  rotulo: string;
  className?: string;
  /** No campo, no lugar da opção `todos` quando nada está escolhido; a lista continua com `todos`. */
  rotuloVazio?: ReactNode;
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
            {!valor && rotuloVazio ? rotuloVazio : atual ? <Conteudo opcao={atual} /> : placeholder}
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
              // Separador depois de "Todos", como no Seletor.
              const depoisDoTodos = indice === 1 && !itens[0].valor;
              return (
                <Fragment key={item.valor || VAZIO}>
                  {depoisDoTodos ? <li role="presentation" className={SEPARADOR} /> : null}
                  <li
                    id={`${id}-${indice}`}
                    role="option"
                    aria-selected={escolhido}
                    data-indice={indice}
                    onMouseEnter={() => setAtivo(indice)}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => escolher(item.valor)}
                    className={cn(LINHA, indice === ativo && "bg-[#47cdd0]/12", escolhido && "font-medium text-[#183f50]")}
                  >
                    <MioloDaLinha opcao={item} texto={item.rotulo} marca={escolhido ? <Check className="size-4" aria-hidden /> : null} />
                  </li>
                </Fragment>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
