"use client";

import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck, Info, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Peças visuais da Vistagem, no padrão do Orquestra (DESIGN.md e Facilities): superfície branca
 * com borda #dce9eb, cabeçalho de lista em #f7fbfc, linhas clicáveis com hover suave, selos
 * arredondados só para estado e contagem.
 */

/* ------------------------------------------------------------ superfícies */

/** Superfície da tela: lista, formulário ou detalhe. Seções internas usam divisores, não outro card. */
export function Painel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]", className)}
      {...props}
    />
  );
}

/** Faixa de título dentro do Painel: título curto, apoio e ações à direita. */
export function PainelTopo({
  titulo,
  id,
  descricao,
  children,
  className,
}: {
  titulo: ReactNode;
  id?: string;
  descricao?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e6eef0] px-4 py-3", className)}>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {titulo}
        </h2>
        {descricao ? <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Divisão de seções dentro do mesmo Painel. */
export function Secao({
  titulo,
  id,
  acao,
  children,
  className,
}: {
  titulo?: ReactNode;
  id?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={titulo ? id : undefined} className={cn("space-y-3 border-t border-[#e6eef0] px-4 py-4 first:border-t-0", className)}>
      {titulo ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={id} className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
            {titulo}
          </h3>
          {acao}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Cabeçalho de colunas de uma lista (só no desktop). */
export function CabecalhoLista({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

/** Linha clicável de lista, com o estado selecionado marcado à esquerda. */
export function linhaLista(selecionada = false): string {
  return cn(
    "relative w-full px-4 py-3 text-left transition-colors duration-150",
    "hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
    selecionada && "bg-[#47cdd0]/10 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[#347796] hover:bg-[#47cdd0]/10"
  );
}

/* --------------------------------------------------------------- barra */

/** Linha de comandos da aba: contexto à esquerda, filtros e ações à direita. Sem card. */
export function BarraAba({ resumo, children, className }: { resumo?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
      {resumo ? <div className="min-w-[min(100%,18rem)] flex-1 text-sm text-muted-foreground">{resumo}</div> : <div className="flex-1" />}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Busca({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" className="h-10 pl-9 text-sm" {...props} />
    </div>
  );
}

/** Controle nativo (select/date/time) com a mesma altura, borda e foco do Input. */
export const campoClasse = cn(
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none transition-[color,box-shadow]",
  "hover:border-[#3e84a8]/40 focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18",
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-400"
);

/** Rótulo de campo: texto curto acima do controle. */
export function Campo({ rotulo, dica, children, className }: { rotulo: ReactNode; dica?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-medium text-muted-foreground">{rotulo}</span>
      {children}
      {dica ? <span className="block text-xs text-muted-foreground">{dica}</span> : null}
    </label>
  );
}

/* ---------------------------------------------------------- indicadores */

/** Faixa de números da aba (padrão SideStat do Facilities). */
export function Indicadores({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-lg border border-[#dce9eb] bg-[#e6eef0] shadow-[0_1px_2px_rgba(16,41,58,0.05)] sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function Indicador({
  icone: Icone,
  rotulo,
  valor,
  tom = "neutro",
  children,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: ReactNode;
  tom?: "neutro" | "alerta" | "perigo" | "sucesso";
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icone className="size-3.5 text-[#3e84a8]" aria-hidden />
        {rotulo}
      </p>
      <p
        className={cn(
          "mt-1 text-[28px] font-semibold leading-8 tabular-nums",
          tom === "alerta" ? "text-amber-700" : tom === "perigo" ? "text-red-700" : tom === "sucesso" ? "text-emerald-700" : "text-[#10293a]"
        )}
      >
        {valor}
      </p>
      {children ? <div className="mt-1 text-xs text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- selos */

export type TomSelo = "neutro" | "marca" | "escuro" | "perigo" | "alerta" | "sucesso" | "ia";

const TOM_SELO: Record<TomSelo, string> = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  marca: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/30",
  escuro: "bg-[#183f50] text-white ring-[#183f50]",
  perigo: "bg-red-50 text-red-700 ring-red-200",
  alerta: "bg-amber-50 text-amber-800 ring-amber-200",
  sucesso: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  // Interface em índigo deriva de --orquestrai-indigo (DESIGN.md).
  ia: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/15",
};

/** Classe da tarefa, igual em todas as abas (vermelho, âmbar e verde ficam para estados). */
export const TOM_CLASSE: Record<"PRAZO" | "PROVIDENCIA" | "COMPROMISSO", TomSelo> = { PRAZO: "escuro", PROVIDENCIA: "marca", COMPROMISSO: "ia" };

/** Estado, classe ou contagem: o único uso de `rounded-full` além de avatar. */
export function Selo({ tom = "neutro", icone: Icone, className, children }: { tom?: TomSelo; icone?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TOM_SELO[tom], className)}>
      {Icone ? <Icone className="size-3 shrink-0" aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/* --------------------------------------------------- estados da tela */

export function Carregando({ rotulo = "Carregando", className }: { rotulo?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground", className)} role="status">
      <LoaderCircle className="size-5 animate-spin text-[#3e84a8]" aria-hidden />
      {rotulo}…
    </div>
  );
}

/** Lista vazia: ícone, frase e, se fizer sentido, a ação que resolve. */
export function Vazio({ icone: Icone, titulo, children, className }: { icone: LucideIcon; titulo: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-md bg-[#e8f8f8] text-[#3e84a8]">
        <Icone className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

const TOM_AVISO = {
  sucesso: { classe: "border-emerald-200 bg-emerald-50 text-emerald-900", icone: CircleCheck },
  erro: { classe: "border-red-200 bg-red-50 text-red-800", icone: CircleAlert },
  alerta: { classe: "border-amber-200 bg-amber-50 text-amber-900", icone: TriangleAlert },
  info: { classe: "border-[#47cdd0]/30 bg-[#f2fbfb] text-[#285f7a]", icone: Info },
} as const;

/** Mensagem de retorno (sucesso, erro, alerta ou informação) com ícone. */
export function Aviso({
  tom,
  titulo,
  children,
  acao,
  className,
}: {
  tom: keyof typeof TOM_AVISO;
  titulo?: ReactNode;
  children?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  const { classe, icone: Icone } = TOM_AVISO[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm", classe, className)}>
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {titulo ? <p className="font-medium">{titulo}</p> : null}
        {children ? <div className={cn(titulo && "mt-0.5", "whitespace-pre-wrap break-words")}>{children}</div> : null}
      </div>
      {acao}
    </div>
  );
}
