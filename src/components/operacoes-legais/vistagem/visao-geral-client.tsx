"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCheck,
  ClipboardCheck,
  Copy,
  FolderSearch,
  Inbox,
  Layers,
  RefreshCw,
  Scale,
  ShieldAlert,
  Table2,
  UserRoundCheck,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { papelVistagem } from "@/lib/access-control";
import { authFetch } from "@/lib/auth-fetch";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";
import {
  OUTROS_GRUPOS_VISAO,
  SEM_AREA_VISAO,
  SEM_GRUPO_VISAO,
  type EscopoDaVisao,
  type GrupoDaVisao,
  type PessoaDaVisao,
  type AreaDaVisao,
  type DiaDeChegada,
  type EtapaVisao,
  type PeriodoVisao,
  type VisaoGeral,
  type VistadorDaVisao,
} from "@/lib/vistagem/visao-geral";
import { ROTULO_DEMANDA } from "@/lib/vistagem/vistadores";
import { FaixaArquivoDoDia, useArquivoDoDia } from "./aviso-arquivo-do-dia";
import { IconeArea, LogoGrupo } from "./marcas";
import { formatarData } from "./publicacao-ui";
import { Aviso, BarraAba, Carregando, Painel, PainelTopo, Selo, Vazio } from "./ui";

/* ------------------------------------------------------------------ formatos */

const numero = (valor: number) => valor.toLocaleString("pt-BR");

const DIA_DA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const DIA_POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

const dataUtc = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
};
/** "qui" */
const diaDaSemana = (data: string) => DIA_DA_SEMANA.format(dataUtc(data)).replace(".", "");
/** "quinta-feira, 05/11" */
const diaLongo = (data: string) => DIA_POR_EXTENSO.format(dataUtc(data));

/** Partículas que não servem de sobrenome no nome curto. */
const PARTICULAS = new Set(["de", "da", "do", "dos", "das", "e"]);

/**
 * Primeiro e último nome, sem as partículas: "Francisco de Assis Barbosa Campos Zanin" → "Francisco Zanin" (o nome
 * inteiro fica no title).
 */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((parte) => !PARTICULAS.has(parte.toLocaleLowerCase("pt-BR")));
  if (partes.length === 0) return nome.trim();
  return partes.length === 1 ? partes[0] : `${partes[0]} ${partes[partes.length - 1]}`;
}

/* -------------------------------------------------------------------- esteira */

const ETAPAS: Record<EtapaVisao, { rotulo: string; dica: string; href: string; icone: LucideIcon }> = {
  triagem: { rotulo: "Triagem Manual", dica: "pendências sem área", href: "/operacoes-legais/vistagem/controladoria", icone: FolderSearch },
  duplicidades: { rotulo: "Duplicidades", dica: "a revisar", href: "/operacoes-legais/vistagem/duplicidades", icone: Copy },
  vistagem: { rotulo: "Vistagem", dica: "para vistar", href: "/operacoes-legais/vistagem/juridico", icone: Scale },
  conferencia: { rotulo: "Conferência", dica: "a conferir", href: "/operacoes-legais/vistagem/conferencia", icone: ClipboardCheck },
  envio: { rotulo: "Envio ao VIOS", dica: "enviando", href: "/operacoes-legais/vistagem/conferencia", icone: ArrowRight },
  check: { rotulo: "Check", dica: "a checar", href: "/operacoes-legais/vistagem/check", icone: CheckCheck },
};

/** Na ordem das abas do cabeçalho. O envio ao VIOS é passagem rápida: aparece como nota da Conferência, não como etapa. */
const ETAPAS_NA_ESTEIRA: EtapaVisao[] = ["triagem", "duplicidades", "vistagem", "conferencia", "check"];

/**
 * O jurídico acompanha só as etapas que têm área (as publicações dele): a Vistagem, que é a aba dele, e o que vem
 * depois, com a controladoria (Conferência e Check, sem link: ele não abre essas abas).
 */
const ETAPAS_DO_JURIDICO: EtapaVisao[] = ["vistagem", "conferencia", "check"];

interface CartaoDaEsteira {
  chave: string;
  rotulo: string;
  dica: string;
  /** Sem `href`, o cartão só mostra o número (aba que a pessoa não abre). */
  href?: string;
  icone: LucideIcon;
  total: number;
  nota?: string;
  destaque?: boolean;
}

/**
 * Um cartão por aba, na ordem do cabeçalho: Gestão das publicações (o que entrou hoje pelo arquivo do dia) e as
 * filas de trabalho, com a Vistagem em destaque. No jurídico, só as etapas das áreas dele.
 */
function cartoesDaEsteira(visao: VisaoGeral, juridico: boolean): CartaoDaEsteira[] {
  const notas: Partial<Record<EtapaVisao, string>> = {
    triagem: visao.aguardandoTriagem ? `+${numero(visao.aguardandoTriagem)} aguardando a triagem automática` : undefined,
    conferencia: visao.etapas.envio ? `+${numero(visao.etapas.envio)} enviando ao VIOS` : undefined,
  };
  if (juridico) {
    return ETAPAS_DO_JURIDICO.map((etapa) => ({
      chave: etapa,
      ...ETAPAS[etapa],
      href: etapa === "vistagem" ? ETAPAS[etapa].href : undefined,
      total: visao.etapas[etapa],
      nota: notas[etapa],
      destaque: etapa === "vistagem",
    }));
  }
  const hoje = visao.porDia.find((dia) => dia.data === visao.hoje);
  return [
    {
      chave: "base",
      rotulo: "Gestão das publicações",
      dica: "entraram hoje na vistagem",
      href: "/operacoes-legais/vistagem/base",
      icone: Inbox,
      total: hoje?.naVistagem ?? 0,
      nota: !hoje || hoje.semArquivo ? "nenhum arquivo hoje ainda" : `de ${numero(hoje.disponiveis)} disponíveis no arquivo do dia`,
    },
    ...ETAPAS_NA_ESTEIRA.map((etapa) => ({
      chave: etapa,
      ...ETAPAS[etapa],
      total: visao.etapas[etapa],
      nota: notas[etapa],
      destaque: etapa === "vistagem",
    })),
  ];
}

function Esteira({ visao, juridico }: { visao: VisaoGeral; juridico: boolean }) {
  const cartoes = cartoesDaEsteira(visao, juridico);
  return (
    <Painel aria-labelledby="esteira-titulo" data-tour="vg-visao-esteira">
      <PainelTopo
        id="esteira-titulo"
        titulo="Onde estão as publicações agora"
        descricao={
          juridico
            ? "Das suas áreas. A Vistagem abre a sua aba; a Conferência e o Check ficam com a controladoria."
            : "Na ordem das abas; cada cartão abre a aba dele."
        }
      />
      {/* 6 cartões: 2, 3 ou 6 por linha; 3 cartões (jurídico): 1 ou 3. Sempre sem célula vazia. */}
      <ol
        className={cn(
          "grid gap-px bg-[#e6eef0]",
          cartoes.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        )}
      >
        {cartoes.map(({ chave, rotulo, dica, href, icone: Icone, total, nota, destaque }) => {
          const classe = cn(
            "flex h-full flex-col gap-2 px-4 py-4",
            destaque ? "bg-[#04202f] text-white" : "",
            href &&
              cn(
                "group outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]",
                destaque ? "hover:bg-[#0a2c3f]" : "hover:bg-[#f6fafb]"
              )
          );
          const conteudo = (
            <>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-md",
                    destaque ? "bg-white/10 text-[#47cdd0]" : "bg-[#e8f8f8] text-[#347796]"
                  )}
                  aria-hidden
                >
                  <Icone className="size-4" />
                </span>
                {/* Pode quebrar em duas linhas ("Gestão das publicações" nas 6 colunas). */}
                <span className={cn("min-w-0 text-xs font-medium leading-tight", destaque ? "text-white/80" : "text-muted-foreground")}>{rotulo}</span>
                {href ? (
                  <ArrowRight
                    className={cn(
                      "ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                      destaque ? "text-white/70" : "text-[#347796]"
                    )}
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className={cn("text-3xl font-semibold leading-none", destaque ? "text-white" : total ? "text-foreground" : "text-muted-foreground/60")}>
                {numero(total)}
              </span>
              <span className={cn("text-xs", destaque ? "text-white/70" : "text-muted-foreground")}>
                {dica}
                {nota ? <span className={cn("mt-0.5 block", destaque ? "text-white/60" : "text-[#285f7a]")}>{nota}</span> : null}
              </span>
            </>
          );
          return (
            <li key={chave} className="min-w-0 bg-white">
              {href ? (
                <Link href={href} className={classe}>
                  {conteudo}
                </Link>
              ) : (
                <div className={classe}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ol>
    </Painel>
  );
}

/* ---------------------------------------------- para vistar, por vistador */

function FotoPessoa({ nome, foto }: { nome: string; foto: string | null }) {
  return (
    <Avatar className="size-8 shrink-0 ring-1 ring-black/5">
      {foto ? <AvatarImage src={foto} alt="" /> : null}
      <AvatarFallback className="bg-[#f2f6f7] text-xs font-semibold text-[#315f73]">{getInitials(nome)}</AvatarFallback>
    </Avatar>
  );
}

/** Lugar da foto quando o vistador ainda não foi passado: contorno tracejado, sem inventar iniciais. */
function SemVistador() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-[#b9cfd6] bg-[#f7fbfc] text-[#5d7f8f]" aria-hidden>
      <UserRoundSearch className="size-4" />
    </span>
  );
}

/** Que demandas a linha cobre: normais, de risco (vermelho, como o selo "Risco" das outras abas) ou todas. */
function TipoDaLinha({ linha }: { linha: VistadorDaVisao }) {
  if (linha.tipo === "risco") {
    return (
      <Selo tom="perigo" icone={ShieldAlert} className="shrink-0">
        {ROTULO_DEMANDA.risco}
      </Selo>
    );
  }
  if (linha.tipo === "normal") {
    return (
      <Selo tom="neutro" className="shrink-0">
        {ROTULO_DEMANDA.normal}
      </Selo>
    );
  }
  return (
    <>
      <Selo tom="neutro" className="shrink-0">
        Todas as demandas
      </Selo>
      {linha.risco ? (
        <Selo tom="perigo" icone={ShieldAlert} className="shrink-0">
          {numero(linha.risco)} de risco
        </Selo>
      ) : null}
    </>
  );
}

/** Fotos sobrepostas de quem vista (até 4; o resto vira "+N"). */
function FotosEmPilha({ pessoas }: { pessoas: PessoaDaVisao[] }) {
  const visiveis = pessoas.slice(0, 4);
  const resto = pessoas.length - visiveis.length;
  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden>
      {visiveis.map((pessoa) => (
        <span key={pessoa.nome} className="rounded-full ring-2 ring-white">
          <FotoPessoa nome={pessoa.nome} foto={pessoa.foto} />
        </span>
      ))}
      {resto > 0 ? (
        <span className="grid size-8 place-items-center rounded-full bg-[#eaf2f5] text-[11px] font-semibold text-[#285f7a] ring-2 ring-white">+{resto}</span>
      ) : null}
    </span>
  );
}

/** "Giovani, Maria Caroline e mais 2": nomes curtos de quem vista. */
function nomesDaLinha(pessoas: PessoaDaVisao[]): string {
  const curtos = pessoas.map((pessoa) => nomeCurto(pessoa.nome));
  if (curtos.length <= 2) return curtos.join(" e ");
  return `${curtos.slice(0, 2).join(", ")} e mais ${curtos.length - 2}`;
}

function LinhaVistador({ linha, maior }: { linha: VistadorDaVisao; maior: number }) {
  const rotuloTipo = linha.tipo ? ROTULO_DEMANDA[linha.tipo].toLowerCase() : "todas as demandas";
  const pessoas = linha.pessoas ?? (linha.nome ? [{ nome: linha.nome, foto: linha.foto }] : []);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      {pessoas.length ? <FotosEmPilha pessoas={pessoas} /> : <SemVistador />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p
            className={cn("min-w-0 flex-1 truncate text-sm font-medium", pessoas.length ? "text-foreground" : "text-muted-foreground")}
            title={pessoas.length ? pessoas.map((pessoa) => pessoa.nome).join(", ") : "O vistador desta área ainda não foi cadastrado"}
          >
            {pessoas.length ? nomesDaLinha(pessoas) : "Vistador a definir"}
          </p>
          <span
            className={cn("shrink-0 text-sm font-semibold tabular-nums", linha.total ? "text-foreground" : "text-muted-foreground/70")}
            aria-label={`${numero(linha.total)} para vistar (${rotuloTipo})`}
          >
            {numero(linha.total)}
          </span>
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <TipoDaLinha linha={linha} />
          {/* Barra do mesmo tom para todos: o comprimento compara quem tem mais para vistar. */}
          <span className="h-1.5 min-w-6 flex-1 rounded-full bg-[#eef3f5]" aria-hidden>
            {linha.total ? (
              <span className="block h-full rounded-full bg-[#347796]" style={{ width: `${Math.max(4, (linha.total / maior) * 100)}%` }} />
            ) : null}
          </span>
          {linha.maisAntiga ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title={`Publicação mais antiga: ${formatarData(linha.maisAntiga)}`}>
              desde {formatarData(linha.maisAntiga).slice(0, 5)}
            </span>
          ) : linha.total === 0 ? (
            <span className="shrink-0 text-xs text-muted-foreground">em dia</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ParaVistar({ visao }: { visao: VisaoGeral }) {
  const minhas = visao.escopo?.areas ?? null;
  const veRisco = visao.escopo?.veRisco ?? true;
  // Área com algo aberto ou com vistador cadastrado (essa aparece mesmo em dia, com o zero); no jurídico, todas as dele.
  const areas = visao.areas.filter(
    (area) =>
      area.vistagem + area.conferencia + area.envio + area.check > 0 ||
      visao.vistadores.some((linha) => linha.area === area.area) ||
      Boolean(minhas?.includes(area.area))
  );
  const maior = Math.max(1, ...visao.vistadores.map((linha) => linha.total));
  const demandas = veRisco ? "nas demandas normais e nas de risco" : "nas demandas normais";
  return (
    <Painel aria-labelledby="para-vistar-titulo" data-tour="vg-visao-para-vistar">
      <PainelTopo
        id="para-vistar-titulo"
        titulo="Publicações para vistar, por área e advogado"
        descricao={
          minhas
            ? `Quem vista cada uma das suas áreas, ${demandas}, com a publicação mais antiga de cada um.`
            : `Quem vista cada área, ${demandas}, com a publicação mais antiga de cada um.`
        }
      >
        <Button asChild size="sm" variant="outline">
          <Link href="/operacoes-legais/vistagem/juridico">
            Abrir a Vistagem
            <ArrowRight />
          </Link>
        </Button>
      </PainelTopo>
      {minhas && minhas.length === 0 ? (
        <Vazio icone={UserRoundSearch} titulo="Nenhuma área sua na Vistagem">
          Peça a um administrador para marcar as suas áreas em Usuários.
        </Vazio>
      ) : areas.length === 0 ? (
        <Vazio icone={UserRoundCheck} titulo="Nenhuma publicação para vistar">
          Tudo o que chegou já foi vistado.
        </Vazio>
      ) : (
        <div className="divide-y divide-[#e6eef0]">
          {areas.map((area) => (
            <BlocoArea key={area.area} area={area} linhas={visao.vistadores.filter((linha) => linha.area === area.area)} maior={maior} />
          ))}
        </div>
      )}
      {(visao.vistadoresDeTodas ?? []).length ? (
        // Quem vista qualquer área (sócios, controladoria): não é uma fila, então vem como rodapé.
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
          <p className="text-xs font-semibold uppercase text-[#285f7a]">Vistam todas as áreas</p>
          {visao.vistadoresDeTodas.map((grupo) => (
            <span key={grupo.tipo} className="flex min-w-0 items-center gap-2">
              <FotosEmPilha pessoas={grupo.pessoas} />
              <span className="min-w-0 text-xs text-muted-foreground" title={grupo.pessoas.map((pessoa) => pessoa.nome).join(", ")}>
                <span className="text-foreground">{nomesDaLinha(grupo.pessoas)}</span> · {ROTULO_DEMANDA[grupo.tipo].toLowerCase()}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </Painel>
  );
}

function BlocoArea({ area, linhas, maior }: { area: AreaDaVisao; linhas: VistadorDaVisao[]; maior: number }) {
  const depois = [
    area.conferencia ? `${numero(area.conferencia)} na conferência` : null,
    area.envio ? `${numero(area.envio)} enviando` : null,
    area.check ? `${numero(area.check)} no check` : null,
  ].filter(Boolean);
  return (
    <section aria-label={area.area}>
      <div className="flex items-center gap-3 bg-[#f7fbfc] px-4 py-3">
        <IconeArea area={area.area} tamanho="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{area.area}</p>
          <p className="truncate text-xs text-muted-foreground">
            {area.maisAntigaParaVistar ? `Mais antiga publicada em ${formatarData(area.maisAntigaParaVistar)}` : "Nada para vistar"}
            {depois.length ? ` · ${depois.join(" · ")}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-semibold leading-none text-foreground">{numero(area.vistagem)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">para vistar</p>
        </div>
      </div>
      {linhas.length ? (
        <ul className="divide-y divide-[#eef3f5]">
          {linhas.map((linha) => (
            <LinhaVistador key={linha.tipo ?? "todas"} linha={linha} maior={maior} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------- chegada */

/**
 * Rampa de um tom só (validada: monotônica, degraus visíveis, ponta clara acima de 2:1 no branco): quanto mais
 * escuro, mais longe a publicação chegou.
 */
const SERIES = [
  { chave: "naVistagem", rotulo: "Entraram na vistagem", cor: "#1d5672", texto: "#ffffff", dica: "Publicações que valem: seguem para a triagem e a vistagem." },
  { chave: "repetidas", rotulo: "Duplicidades e descartes", cor: "#3f88ad", texto: "#ffffff", dica: "Cópias da mesma publicação e índices do diário." },
  { chave: "soNoArquivo", rotulo: "Só no arquivo da Kurier", cor: "#7fb8d0", texto: "#04202f", dica: "Linhas do arquivo que não estão no sistema." },
] as const;
type ChaveSerie = (typeof SERIES)[number]["chave"];

const valorDaSerie = (dia: Omit<DiaDeChegada, "data">, chave: ChaveSerie) =>
  chave === "repetidas" ? dia.duplicidades + dia.descartadas : dia[chave];

/** Teto e marcas do eixo em números redondos (1, 2 ou 5 × 10ⁿ), com até 5 faixas e o teto mais justo possível. */
function escala(maximo: number): number[] {
  if (maximo <= 0) return [0, 1];
  const potencia = 10 ** Math.floor(Math.log10(maximo / 5));
  const passo = [1, 2, 5, 10, 20].map((fator) => fator * potencia).find((candidato) => Math.ceil(maximo / candidato) <= 5) ?? 50 * potencia;
  const topo = Math.ceil(maximo / passo) * passo;
  return Array.from({ length: topo / passo + 1 }, (_, indice) => indice * passo);
}

function Legenda({ chegada }: { chegada: VisaoGeral["chegada"] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-1">
        <dt className="text-xs text-muted-foreground">Disponíveis no período</dt>
        <dd className="text-2xl font-semibold leading-tight text-foreground">{numero(chegada.disponiveis)}</dd>
      </div>
      {SERIES.map((serie) => {
        const valor = valorDaSerie(chegada, serie.chave);
        const parte = chegada.disponiveis ? Math.round((valor / chegada.disponiveis) * 100) : 0;
        return (
          <div key={serie.chave} title={serie.dica}>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: serie.cor }} aria-hidden />
              {serie.rotulo}
            </dt>
            <dd className="text-lg font-semibold leading-tight text-foreground">
              {numero(valor)}
              {chegada.disponiveis ? <span className="ml-1 text-xs font-normal text-muted-foreground">{parte}%</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Um dia só: uma barra dividida (parte do todo), com o número dentro do bloco quando cabe. */
function BarraDoDia({ dia }: { dia: VisaoGeral["porDia"][number] }) {
  if (dia.semArquivo || !dia.disponiveis) {
    return <p className="rounded-md bg-[#f7fbfc] px-3 py-6 text-center text-sm text-muted-foreground">Nenhum arquivo chegou hoje.</p>;
  }
  return (
    <div
      role="img"
      aria-label={SERIES.map((serie) => `${serie.rotulo}: ${valorDaSerie(dia, serie.chave)}`).join("; ")}
      className="flex h-7 w-full gap-[2px]"
    >
      {SERIES.map((serie) => {
        const valor = valorDaSerie(dia, serie.chave);
        if (!valor) return null;
        const parte = valor / dia.disponiveis;
        return (
          <span
            key={serie.chave}
            title={`${serie.rotulo}: ${numero(valor)}`}
            className="flex min-w-0 items-center rounded-[4px] px-2 text-xs font-semibold"
            style={{ flexGrow: valor, flexBasis: 0, backgroundColor: serie.cor, color: serie.texto }}
          >
            {parte >= 0.08 ? numero(valor) : null}
          </span>
        );
      })}
    </div>
  );
}

const ALTURA_GRAFICO = 176;

/** Colunas empilhadas por dia: a altura é o que estava disponível; as partes, até onde cada publicação chegou. */
function GraficoPorDia({ dias }: { dias: VisaoGeral["porDia"] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const marcas = escala(Math.max(0, ...dias.map((dia) => dia.disponiveis)));
  const topo = marcas.at(-1) ?? 1;
  const ultimoComArquivo = dias.findLastIndex((dia) => !dia.semArquivo && dia.disponiveis > 0);
  const muitos = dias.length > 10;
  const focado = foco !== null ? dias[foco] : null;

  return (
    <div className="flex gap-2 pt-4">
      {/* Eixo Y */}
      <div className="relative w-8 shrink-0" style={{ height: ALTURA_GRAFICO }} aria-hidden>
        {marcas.map((marca) => (
          <span
            key={marca}
            className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
            style={{ bottom: `${(marca / topo) * 100}%` }}
          >
            {numero(marca)}
          </span>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        {/* Grade: linhas finas, um tom acima da superfície. */}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: ALTURA_GRAFICO }} aria-hidden>
          {marcas.map((marca) => (
            <span key={marca} className="absolute inset-x-0 h-px bg-[#eef3f5]" style={{ bottom: `${(marca / topo) * 100}%` }} />
          ))}
        </div>

        <ol className="relative flex" style={{ height: ALTURA_GRAFICO }} onMouseLeave={() => setFoco(null)}>
          {dias.map((dia, indice) => {
            const descricao = dia.semArquivo
              ? `${diaLongo(dia.data)}: sem arquivo`
              : `${diaLongo(dia.data)}: ${dia.disponiveis} disponíveis; ${SERIES.map((serie) => `${serie.rotulo.toLowerCase()} ${valorDaSerie(dia, serie.chave)}`).join("; ")}`;
            return (
              <li key={dia.data} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  aria-label={descricao}
                  onMouseEnter={() => setFoco(indice)}
                  onFocus={() => setFoco(indice)}
                  onBlur={() => setFoco(null)}
                  className={cn(
                    "relative flex h-full w-full cursor-default flex-col items-center justify-end rounded-sm outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                    foco === indice && "bg-[#f2f6f7]"
                  )}
                >
                  {indice === ultimoComArquivo ? (
                    <span className="mb-1 text-[11px] font-semibold tabular-nums text-foreground">{numero(dia.disponiveis)}</span>
                  ) : null}
                  <span
                    className="flex w-[60%] max-w-6 flex-col-reverse gap-[2px]"
                    style={{ height: `${(dia.disponiveis / topo) * 100}%` }}
                  >
                    {SERIES.map((serie, posicao) => {
                      const valor = valorDaSerie(dia, serie.chave);
                      if (!valor) return null;
                      const acima = SERIES.slice(posicao + 1).some((outra) => valorDaSerie(dia, outra.chave) > 0);
                      return (
                        <span
                          key={serie.chave}
                          className={cn("block w-full min-h-[2px]", !acima && "rounded-t-[4px]")}
                          style={{ flexGrow: valor, flexBasis: 0, backgroundColor: serie.cor }}
                        />
                      );
                    })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Eixo X */}
        <ol className="mt-1.5 flex" aria-hidden>
          {dias.map((dia, indice) => (
            <li key={dia.data} className="min-w-0 flex-1 whitespace-nowrap text-center text-[11px] leading-tight tabular-nums text-muted-foreground">
              {muitos ? (
                indice % 5 === (dias.length - 1) % 5 ? formatarData(dia.data).slice(0, 5) : ""
              ) : (
                // Dia da semana em cima e o dia embaixo: cabe até no celular.
                <>
                  <span className="block">{diaDaSemana(dia.data)}</span>
                  <span className="block text-foreground/70">{dia.data.slice(8, 10)}</span>
                </>
              )}
            </li>
          ))}
        </ol>

        {focado && foco !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-56 rounded-md border border-[#dce9eb] bg-white p-3 text-xs shadow-[0_8px_24px_rgba(4,32,47,0.12)]"
            style={{
              left: `${((foco + 0.5) / dias.length) * 100}%`,
              transform: `translateX(${foco < dias.length * 0.25 ? "8px" : foco > dias.length * 0.75 ? "calc(-100% - 8px)" : "-50%"})`,
            }}
          >
            <p className="font-medium text-foreground first-letter:uppercase">{diaLongo(focado.data)}</p>
            {focado.semArquivo ? (
              <p className="mt-1 text-muted-foreground">Sem arquivo neste dia.</p>
            ) : (
              <dl className="mt-2 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Disponíveis</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{numero(focado.disponiveis)}</dd>
                </div>
                {SERIES.map((serie) => (
                  <div key={serie.chave} className="flex items-center gap-2">
                    <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: serie.cor }} aria-hidden />
                    <dt className="min-w-0 flex-1 truncate text-muted-foreground">{serie.rotulo}</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{numero(valorDaSerie(focado, serie.chave))}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabelaPorDia({ dias }: { dias: VisaoGeral["porDia"] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#e6eef0]">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Publicações por dia de arquivo</caption>
        <thead className="bg-[#f7fbfc] text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Dia
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Disponíveis
            </th>
            {SERIES.map((serie) => (
              <th key={serie.chave} scope="col" className="px-3 py-2 text-right font-medium">
                {serie.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef3f5]">
          {[...dias].reverse().map((dia) => (
            <tr key={dia.data}>
              <th scope="row" className="px-3 py-2 text-left font-normal text-foreground first-letter:uppercase">
                {diaLongo(dia.data)}
              </th>
              {dia.semArquivo ? (
                <td colSpan={SERIES.length + 1} className="px-3 py-2 text-right text-muted-foreground">
                  Sem arquivo
                </td>
              ) : (
                <>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{numero(dia.disponiveis)}</td>
                  {SERIES.map((serie) => (
                    <td key={serie.chave} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {numero(valorDaSerie(dia, serie.chave))}
                    </td>
                  ))}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROTULO_PERIODO: Record<PeriodoVisao, string> = { 1: "Hoje", 7: "7 dias", 30: "30 dias" };

function SeletorDePeriodo({ periodo, onPeriodo }: { periodo: PeriodoVisao; onPeriodo: (periodo: PeriodoVisao) => void }) {
  return (
    <Segmented<`${PeriodoVisao}`>
      label="Período"
      value={`${periodo}`}
      options={(Object.keys(ROTULO_PERIODO) as `${PeriodoVisao}`[]).map((valor) => ({ value: valor, label: ROTULO_PERIODO[Number(valor) as PeriodoVisao] }))}
      onChange={(valor) => onPeriodo(Number(valor) as PeriodoVisao)}
    />
  );
}

/* ------------------------------------------------------------- por grupo */

/**
 * Etapas de quem chegou no período, na mesma rampa de um tom do gráfico de chegada (validada): quanto mais escuro,
 * mais adiante a publicação está.
 */
const ETAPAS_DO_GRUPO = [
  { chave: "vistadas", rotulo: "Já vistadas", cor: "#1d5672", dica: "Na conferência, no envio ao VIOS, no check ou checadas." },
  { chave: "paraVistar", rotulo: "Para vistar", cor: "#3f88ad", dica: "Com o advogado agora." },
  { chave: "naTriagem", rotulo: "Na triagem", cor: "#7fb8d0", dica: "Ainda sem área (Triagem Manual)." },
] as const;

function IconeDoGrupo({ grupo }: { grupo: GrupoDaVisao }) {
  if (grupo.grupo === OUTROS_GRUPOS_VISAO || grupo.grupo === SEM_GRUPO_VISAO) {
    const Icone = grupo.grupo === OUTROS_GRUPOS_VISAO ? Layers : FolderSearch;
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#f2f6f7] text-muted-foreground ring-1 ring-[#e6eef0]" aria-hidden>
        <Icone className="size-3.5" />
      </span>
    );
  }
  return <LogoGrupo grupo={grupo.grupo} tamanho="sm" />;
}

/**
 * Barras deitadas por grupo (os maiores primeiro), cada uma dividida pela etapa em que as publicações estão. Com
 * `seletor` (o jurídico, que não tem o painel da chegada), o período é escolhido aqui mesmo.
 */
function PorGrupo({ visao, atualizando, seletor }: { visao: VisaoGeral; atualizando: boolean; seletor?: ReactNode }) {
  const grupos = visao.grupos ?? [];
  const maior = Math.max(1, ...grupos.map((grupo) => grupo.total));
  const periodo = visao.dias === 1 ? "hoje" : `nos últimos ${visao.dias} dias`;
  return (
    <Painel aria-labelledby="grupos-titulo" data-tour="vg-visao-grupos">
      <PainelTopo
        id="grupos-titulo"
        titulo="Publicações por grupo de clientes"
        descricao={
          visao.escopo?.areas
            ? `O que chegou ${periodo} para as suas áreas, por grupo e por onde está agora.`
            : `O que chegou ${periodo} (pelo período escolhido acima), por grupo e por onde está agora.`
        }
      >
        {seletor}
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
          {[...ETAPAS_DO_GRUPO].reverse().map((etapa) => (
            <li key={etapa.chave} className="inline-flex items-center gap-1.5" title={etapa.dica}>
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: etapa.cor }} aria-hidden />
              {etapa.rotulo}
            </li>
          ))}
        </ul>
      </PainelTopo>
      {grupos.length === 0 ? (
        <Vazio icone={Layers} titulo="Nenhuma publicação no período" />
      ) : (
        <ol className={cn("divide-y divide-[#eef3f5] transition-opacity", atualizando && "opacity-50")}>
          {grupos.map((grupo) => {
            const resumo = ETAPAS_DO_GRUPO.map((etapa) => `${etapa.rotulo}: ${grupo[etapa.chave]}`).join("; ");
            return (
              <li key={grupo.grupo} className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 max-sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="flex min-w-0 items-center gap-2">
                  <IconeDoGrupo grupo={grupo} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground" title={grupo.grupo}>
                      {grupo.grupo}
                    </span>
                    {grupo.outros ? <span className="block text-[11px] text-muted-foreground">{grupo.outros} grupos menores</span> : null}
                  </span>
                </span>
                {/* Barra: cresce da esquerda (ponta reta), ponta direita arredondada; 2 px de folga entre as partes. */}
                <span
                  role="img"
                  aria-label={`${grupo.grupo}: ${grupo.total} publicações. ${resumo}`}
                  className="flex h-3 gap-[2px] max-sm:col-span-2 max-sm:row-start-2"
                  style={{ width: `${Math.max(2, (grupo.total / maior) * 100)}%` }}
                >
                  {ETAPAS_DO_GRUPO.map((etapa, posicao) => {
                    const valor = grupo[etapa.chave];
                    if (!valor) return null;
                    const ultima = !ETAPAS_DO_GRUPO.slice(posicao + 1).some((outra) => grupo[outra.chave] > 0);
                    return (
                      <span
                        key={etapa.chave}
                        title={`${etapa.rotulo}: ${numero(valor)}`}
                        className={cn("block h-full min-w-[2px]", ultima && "rounded-r-[4px]")}
                        style={{ flexGrow: valor, flexBasis: 0, backgroundColor: etapa.cor }}
                      />
                    );
                  })}
                </span>
                <span className="text-right text-sm tabular-nums text-foreground max-sm:row-start-1 max-sm:col-start-2">
                  <span className="font-semibold">{numero(grupo.total)}</span>
                  {grupo.paraVistar ? <span className="ml-1.5 text-xs text-muted-foreground">{numero(grupo.paraVistar)} para vistar</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Painel>
  );
}

function Chegada({
  visao,
  periodo,
  onPeriodo,
  atualizando,
}: {
  visao: VisaoGeral;
  periodo: PeriodoVisao;
  onPeriodo: (periodo: PeriodoVisao) => void;
  atualizando: boolean;
}) {
  const [tabela, setTabela] = useState(false);
  const idTabela = useId();
  const areas = visao.areas.filter((area) => area.chegaram > 0 || area.checadas > 0);
  const umDia = visao.dias === 1;

  return (
    <Painel aria-labelledby="chegada-titulo" data-tour="vg-visao-chegada">
      <PainelTopo
        id="chegada-titulo"
        titulo="Chegada das publicações"
        descricao="O que estava disponível no arquivo da Kurier (e nas colagens) e até onde entrou no sistema."
      >
        <SeletorDePeriodo periodo={periodo} onPeriodo={onPeriodo} />
      </PainelTopo>

      {/* Ao trocar o período, o gráfico anterior fica esmaecido até chegar o novo (sem pular a tela). */}
      <div className={cn("space-y-5 px-4 py-4 transition-opacity", atualizando && "opacity-50")} aria-busy={atualizando}>
        <Legenda chegada={visao.chegada} />

        {umDia ? <BarraDoDia dia={visao.porDia[0]} /> : <GraficoPorDia dias={visao.porDia} />}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {umDia ? `Arquivo de ${formatarData(visao.hoje)}.` : `De ${formatarData(visao.desde)} a ${formatarData(visao.hoje)}, pela data do arquivo.`}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={tabela}
            aria-controls={idTabela}
            onClick={() => setTabela((atual) => !atual)}
          >
            <Table2 />
            {tabela ? "Esconder a tabela" : "Ver em tabela"}
          </Button>
        </div>
        <div id={idTabela} hidden={!tabela}>
          {tabela ? <TabelaPorDia dias={visao.porDia} /> : null}
        </div>
      </div>

      <div className="border-t border-[#e6eef0]">
        <p className="px-4 pt-3 text-xs font-semibold uppercase text-[#285f7a]">Por área no período</p>
        {areas.length ? (
          <ul className="divide-y divide-[#eef3f5] pb-1">
            {areas.map((area) => (
              <li key={area.area} className="flex items-center gap-3 px-4 py-2.5">
                {area.area === SEM_AREA_VISAO ? (
                  <span className="grid size-6 shrink-0 place-items-center rounded bg-[#f2f6f7] text-muted-foreground ring-1 ring-[#e6eef0]" aria-hidden>
                    <FolderSearch className="size-3.5" />
                  </span>
                ) : (
                  <IconeArea area={area.area} tamanho="sm" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {area.area === SEM_AREA_VISAO ? "Sem área (Triagem Manual)" : area.area}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-foreground">
                  <span className="font-semibold">{numero(area.chegaram)}</span> <span className="text-xs text-muted-foreground">chegaram</span>
                </span>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums text-foreground">
                  <span className="font-semibold">{numero(area.checadas)}</span> <span className="text-xs text-muted-foreground">checadas</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma publicação chegou no período.</p>
        )}
      </div>
    </Painel>
  );
}

/* ---------------------------------------------------------------------- tela */

/** "Cível e Trabalhista", "Cível, Trabalhista e Tributário". */
function juntarNomes(nomes: string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

/** No jurídico, o lugar da situação do arquivo do dia: de quais áreas são os números (e se ficam sem as de risco). */
function ResumoDoEscopo({ escopo }: { escopo: EscopoDaVisao }) {
  const areas = escopo.areas ?? [];
  return (
    <>
      <Selo tom="marca" icone={Scale}>
        {areas.length ? `${areas.length === 1 ? "Sua área" : "Suas áreas"}: ${juntarNomes(areas)}` : "Nenhuma área sua cadastrada"}
      </Selo>
      {escopo.veRisco ? null : <Selo tom="neutro">Sem as demandas de risco</Selo>}
    </>
  );
}

export function VisaoGeralClient() {
  const { profile } = useAuth();
  // O jurídico vê só as suas áreas (o servidor já filtra) e nenhum atalho para as abas da controladoria.
  const juridico = papelVistagem(profile) === "juridico";
  const [periodo, setPeriodo] = useState<PeriodoVisao>(7);
  const [visao, setVisao] = useState<VisaoGeral | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const arquivoDoDia = useArquivoDoDia(!juridico);
  const ultimoPedido = useRef(0);

  const carregar = useCallback(async (dias: PeriodoVisao) => {
    // Trocando o período depressa, só a resposta do último pedido vale.
    const pedido = ++ultimoPedido.current;
    setCarregando(true);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/visao-geral?dias=${dias}`);
      const corpo = await resposta.json().catch(() => ({}));
      if (pedido !== ultimoPedido.current) return;
      if (!resposta.ok) throw new Error((corpo as { error?: string }).error ?? "Não foi possível carregar a visão geral.");
      setVisao(corpo as VisaoGeral);
      setErro(null);
    } catch (falha) {
      if (pedido !== ultimoPedido.current) return;
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a visão geral.");
    } finally {
      if (pedido === ultimoPedido.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(periodo);
  }, [carregar, periodo]);

  const situacaoHoje = useMemo(() => {
    if (!arquivoDoDia) return null;
    if (arquivoDoDia.chegou) return <Selo tom="sucesso" icone={Inbox}>Arquivo da Kurier de hoje recebido</Selo>;
    if (!arquivoDoDia.diaUtil) return <Selo tom="neutro">Hoje não é dia útil</Selo>;
    if (!arquivoDoDia.atrasado) return <Selo tom="marca" icone={Inbox}>Aguardando o arquivo de hoje</Selo>;
    return null;
  }, [arquivoDoDia]);

  return (
    <div className="space-y-4">
      {juridico ? null : (
        <FaixaArquivoDoDia
          situacao={arquivoDoDia}
          acao={
            <Button asChild size="sm" variant="outline" className="-my-1 shrink-0">
              <Link href="/operacoes-legais/vistagem/base">Abrir Gestão das publicações</Link>
            </Button>
          }
        />
      )}

      <BarraAba
        resumo={
          <div className="flex w-fit flex-wrap items-center gap-x-3 gap-y-1" data-tour="vg-visao-hoje">
            <span className="inline-block font-medium text-foreground first-letter:uppercase">{diaLongo(visao?.hoje ?? new Date().toISOString().slice(0, 10))}</span>
            {juridico ? null : situacaoHoje}
            {juridico && visao?.escopo ? <ResumoDoEscopo escopo={visao.escopo} /> : null}
          </div>
        }
      >
        <Button type="button" variant="outline" onClick={() => void carregar(periodo)} disabled={carregando}>
          <RefreshCw className={cn(carregando && "animate-spin")} />
          Atualizar
        </Button>
        {juridico ? null : (
          <Button asChild variant="outline">
            <Link href="/operacoes-legais/vistagem/base">Gestão das publicações</Link>
          </Button>
        )}
      </BarraAba>

      {erro && !visao ? (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar a visão geral"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => void carregar(periodo)}>
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : !visao ? (
        <Painel>
          <Carregando rotulo="Carregando a visão geral" />
        </Painel>
      ) : (
        <>
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
          <Esteira visao={visao} juridico={juridico} />
          {juridico ? (
            // Sem a chegada (o arquivo da Kurier é da casa toda): para vistar e por grupo, lado a lado.
            <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
              <ParaVistar visao={visao} />
              <PorGrupo
                visao={visao}
                atualizando={carregando}
                seletor={<SeletorDePeriodo periodo={periodo} onPeriodo={setPeriodo} />}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start">
                <Chegada visao={visao} periodo={periodo} onPeriodo={setPeriodo} atualizando={carregando} />
                <ParaVistar visao={visao} />
              </div>
              <PorGrupo visao={visao} atualizando={carregando} />
            </>
          )}
        </>
      )}
    </div>
  );
}
