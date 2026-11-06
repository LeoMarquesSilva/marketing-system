"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlarmClock,
  Bot,
  BrainCircuit,
  CalendarDays,
  CircleCheck,
  CircleSlash,
  Copy,
  Eye,
  FileInput,
  FolderSearch,
  History,
  Info,
  Pencil,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { ChaveConfiguracao, ConfiguracoesVistagem } from "@/lib/vistagem/configuracoes";
import type { EtapaDocumentada, IaDocumentada, MetricaDaRegra, OrigemDaRegra } from "@/lib/vistagem/regras-documentacao";
import type { PainelDeRegras } from "@/lib/vistagem/regras-server";
import { ESCRITORIOS } from "@/lib/vistagem/triagem";
import {
  ROTULO_DEMANDA,
  TIPOS_DE_DEMANDA,
  TODAS_AS_AREAS_VISTAGEM,
  vistadoresDa,
  type AreaDeVistador,
  type MapaDeVistadores,
  type TipoDeDemanda,
} from "@/lib/vistagem/vistadores";
import type { ResultadoDaImportacao } from "@/lib/vistagem/vistadores-importacao";
import { nomeCurto as nomeCurtoDaPessoa } from "@/lib/vistagem/como-fica-no-vios";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { AvatarPessoa, ComboboxBusca, type OpcaoBusca } from "./combobox-busca";
import { IconeArea } from "./marcas";
import { formatarDataHora } from "./publicacao-ui";
import { Aviso, Carregando, Painel, PainelTopo, Selo } from "./ui";

/* ------------------------------------------------------------------ apoio */

const numero = (valor: number) => valor.toLocaleString("pt-BR");
const dolar = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const ROTULO_DA_CHAVE: Record<ChaveConfiguracao, string> = {
  vistadores: "Vistadores por área",
  etiquetasDeRisco: "Etiquetas de demanda de risco",
  horaArquivoEsperado: "Hora do alerta do arquivo",
  iaSugestaoTarefa: "IA: sugestão de tarefas",
  iaSugestaoTriagem: "IA: sugestão de pasta",
};

/** Valor de uma regra em texto, para o histórico e o "padrão". */
function valorEmTexto(chave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (chave === "vistadores") {
    const mapa = valor as MapaDeVistadores;
    const partes = Object.keys(mapa).map((area) =>
      `${area}: ${TIPOS_DE_DEMANDA.map((tipo) => {
        const nomes = vistadoresDa(area, tipo, mapa);
        return nomes.length ? `${nomes.join(", ")} (${tipo === "normal" ? "normais" : "risco"})` : null;
      })
        .filter(Boolean)
        .join("; ")}`
    );
    return partes.length ? partes.join(" · ") : "ninguém";
  }
  if (chave === "etiquetasDeRisco") return (valor as string[]).join(", ");
  if (chave === "horaArquivoEsperado") return `${valor}h`;
  if (typeof valor === "boolean") return valor ? "Ligada" : "Desligada";
  return JSON.stringify(valor);
}

const ICONE_DA_ETAPA: Record<string, LucideIcon> = {
  captura: FileInput,
  duplicidades: Copy,
  triagem: FolderSearch,
  vistagem: Scale,
  prazos: CalendarDays,
  vios: Send,
  conferencia: CircleCheck,
};

const TOM_DA_ORIGEM: Record<OrigemDaRegra, string> = {
  configuravel: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/40",
  codigo: "bg-slate-100 text-slate-700 ring-slate-200",
  vios: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/20",
  sioe: "bg-sky-50 text-sky-800 ring-sky-200",
  servidor: "bg-amber-50 text-amber-800 ring-amber-200",
};

/** Interruptor liga/desliga com o nome dentro do rótulo acessível. */
function Interruptor({ ligado, onChange, rotulo, desabilitado = false }: { ligado: boolean; onChange: (ligado: boolean) => void; rotulo: string; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => onChange(!ligado)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 focus-visible:ring-offset-2",
        ligado ? "bg-[#347796]" : "bg-slate-300"
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-150", ligado ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Quem mudou a regra por último (do histórico). */
function UltimaAlteracao({ painel, chave }: { painel: PainelDeRegras; chave: ChaveConfiguracao }) {
  const ultima = painel.historico.find((item) => item.chave === chave);
  if (!ultima) return <p className="text-xs text-muted-foreground">Sem alteração: vale o padrão do sistema.</p>;
  return (
    <p className="text-xs text-muted-foreground">
      Alterada por <span className="font-medium text-foreground">{ultima.alteradoPor ?? "admin"}</span> em {formatarDataHora(ultima.alteradoEm)}
    </p>
  );
}

/** Cartão de uma regra editável: ícone, título, explicação, o valor em vigor e as ações. */
function CartaoEditavel({
  icone: Icone,
  titulo,
  descricao,
  acao,
  rodape,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: ReactNode;
  acao?: ReactNode;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Painel className="flex flex-col">
      <div className="flex items-start gap-3 border-b border-[#e6eef0] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#347796]" aria-hidden>
          <Icone className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
        {acao}
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
      {rodape ? <div className="border-t border-[#eef3f5] bg-[#f7fbfc] px-4 py-2">{rodape}</div> : null}
    </Painel>
  );
}

/* --------------------------------------------------------------- editáveis */

/** Área do cartão e do modal: as do sistema e, no fim, quem vista todas as áreas. */
const AREAS_DE_VISTADOR: AreaDeVistador[] = [...ESCRITORIOS, TODAS_AS_AREAS_VISTAGEM];

function IconeDaAreaDeVistador({ area }: { area: string }) {
  if (area === TODAS_AS_AREAS_VISTAGEM) {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded bg-[#04202f] text-[#47cdd0]" aria-hidden>
        <UsersRound className="size-3.5" />
      </span>
    );
  }
  return <IconeArea area={area} tamanho="sm" />;
}

/** Fotos de quem vista um tipo na área, com os nomes curtos (até 3; o resto em "+N"). */
function PessoasDoTipo({ nomes, fotos, tipo }: { nomes: string[]; fotos: Record<string, string>; tipo: TipoDeDemanda }) {
  return (
    <div className="min-w-0 space-y-1">
      <span className={cn("block text-[11px] font-medium", tipo === "risco" ? "text-[#8f1d26]" : "text-muted-foreground")}>{ROTULO_DEMANDA[tipo]}</span>
      {nomes.length ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
          {nomes.slice(0, 3).map((nome) => (
            <li key={nome} className="flex min-w-0 items-center gap-1.5" title={nome}>
              <AvatarPessoa nome={nome} foto={fotos[nome] ?? null} className="size-6" />
              <span className="truncate text-sm text-foreground">{nomeCurtoDaPessoa(nome)}</span>
            </li>
          ))}
          {nomes.length > 3 ? (
            <li className="text-xs text-muted-foreground" title={nomes.slice(3).join(", ")}>
              +{nomes.length - 3}
            </li>
          ) : null}
        </ul>
      ) : (
        <span className="text-sm text-muted-foreground">A definir</span>
      )}
    </div>
  );
}

function Vistadores({
  painel,
  onEditar,
  onImportar,
  importando,
}: {
  painel: PainelDeRegras;
  onEditar: () => void;
  onImportar: () => void;
  importando: boolean;
}) {
  const mapa = painel.configuracoes.vistadores;
  const comVistador = AREAS_DE_VISTADOR.filter((area) => TIPOS_DE_DEMANDA.some((tipo) => vistadoresDa(area, tipo, mapa).length));
  const sem = ESCRITORIOS.filter((area) => !comVistador.includes(area));
  return (
    <CartaoEditavel
      icone={UsersRound}
      titulo="Vistadores por área"
      descricao="Quem vista as demandas normais e as de risco de cada área. A base é a lista USUARIOS do SharePoint; aparece na Visão geral. Quem enxerga a fila continua sendo definido em Usuários."
      acao={
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onImportar} disabled={importando} title="Lê a lista USUARIOS do SharePoint e mostra o que muda antes de salvar">
            {importando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Atualizar da lista
          </Button>
          <Button size="sm" variant="outline" onClick={onEditar}>
            <Pencil />
            Editar
          </Button>
        </div>
      }
      rodape={<UltimaAlteracao painel={painel} chave="vistadores" />}
    >
      <ul className="divide-y divide-[#eef3f5]">
        {comVistador.map((area) => (
          <li key={area} className="grid gap-x-4 gap-y-2 py-2.5 sm:grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <IconeDaAreaDeVistador area={area} />
              {area}
            </span>
            {TIPOS_DE_DEMANDA.map((tipo) => (
              <PessoasDoTipo key={tipo} tipo={tipo} nomes={vistadoresDa(area, tipo, mapa)} fotos={painel.fotosDosVistadores} />
            ))}
          </li>
        ))}
      </ul>
      {sem.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Vistador a definir:</span> {sem.join(", ")}.
        </p>
      ) : null}
    </CartaoEditavel>
  );
}

type RascunhoDeVistadores = Record<string, Record<TipoDeDemanda, string[]>>;

function rascunhoDe(mapa: MapaDeVistadores): RascunhoDeVistadores {
  return Object.fromEntries(AREAS_DE_VISTADOR.map((area) => [area, { normal: vistadoresDa(area, "normal", mapa), risco: vistadoresDa(area, "risco", mapa) }]));
}

/**
 * Montado só enquanto aberto: o rascunho começa com os vistadores em vigor (ou com a proposta da lista do SharePoint,
 * com quem chegou agora marcado como "novo"). Cada pessoa troca de tipo com um clique.
 */
function DialogoVistadores({
  painel,
  proposta,
  salvando,
  onFechar,
  onSalvar,
}: {
  painel: PainelDeRegras;
  proposta: ResultadoDaImportacao | null;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (valor: MapaDeVistadores) => void;
}) {
  const [rascunho, setRascunho] = useState<RascunhoDeVistadores>(() => rascunhoDe(proposta?.mapa ?? painel.configuracoes.vistadores));
  const novos = useMemo(() => new Set((proposta?.novos ?? []).map((item) => `${item.area}|${item.nome}`)), [proposta]);
  const opcoes = useMemo<OpcaoBusca[]>(
    () => painel.pessoas.map((pessoa) => ({ id: pessoa.nome, nome: pessoa.nome, foto: pessoa.foto, detalhe: pessoa.area })),
    [painel.pessoas]
  );
  const foto = (nome: string) => painel.fotosDosVistadores[nome] ?? painel.pessoas.find((pessoa) => pessoa.nome === nome)?.foto ?? null;

  const mudar = (area: string, mudanca: (atual: Record<TipoDeDemanda, string[]>) => Record<TipoDeDemanda, string[]>) =>
    setRascunho((atual) => ({ ...atual, [area]: mudanca(atual[area] ?? { normal: [], risco: [] }) }));
  const tirar = (area: string, tipo: TipoDeDemanda, nome: string) => mudar(area, (atual) => ({ ...atual, [tipo]: atual[tipo].filter((item) => item !== nome) }));
  const trocarTipo = (area: string, tipo: TipoDeDemanda, nome: string) => {
    const outro: TipoDeDemanda = tipo === "normal" ? "risco" : "normal";
    mudar(area, (atual) => ({ ...atual, [tipo]: atual[tipo].filter((item) => item !== nome), [outro]: [...atual[outro], nome] }));
  };
  const incluir = (area: string, tipo: TipoDeDemanda, nome: string) => {
    if (!nome) return;
    mudar(area, (atual) => (atual.normal.includes(nome) || atual.risco.includes(nome) ? atual : { ...atual, [tipo]: [...atual[tipo], nome] }));
  };

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-5xl" onOpenAutoFocus={(evento) => evento.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{proposta ? "Vistadores da lista USUARIOS" : "Vistadores por área"}</DialogTitle>
          <DialogDescription>
            {proposta
              ? `A lista tem ${proposta.responsaveis} responsáveis pela vistagem; ${proposta.novos.length} entram agora (marcados como novo). GERENTE = SIM vai para as demandas de risco: confira e troque o tipo de quem não for. Ninguém sai sem você tirar.`
              : "Escolha quem vista as demandas normais e as de risco. Clique no escudo ao lado do nome para trocar o tipo."}
          </DialogDescription>
        </DialogHeader>
        {proposta?.ignorados.length ? (
          <Aviso tom="alerta">Ficaram de fora: {proposta.ignorados.map((item) => `${item.nome} (${item.motivo})`).join("; ")}.</Aviso>
        ) : null}
        <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
          {AREAS_DE_VISTADOR.map((area) => (
            <li key={area} className="grid gap-3 px-3 py-3 lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="flex items-center gap-2 pt-1 text-sm font-medium text-foreground">
                <IconeDaAreaDeVistador area={area} />
                {area}
              </span>
              {TIPOS_DE_DEMANDA.map((tipo) => {
                const nomes = rascunho[area]?.[tipo] ?? [];
                const ocupados = new Set([...(rascunho[area]?.normal ?? []), ...(rascunho[area]?.risco ?? [])]);
                return (
                  <div key={tipo} className="space-y-1.5">
                    <span className={cn("block text-[11px] font-medium", tipo === "risco" ? "text-[#8f1d26]" : "text-muted-foreground")}>{ROTULO_DEMANDA[tipo]}</span>
                    {nomes.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {nomes.map((nome) => (
                          <li
                            key={nome}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#dce9eb] bg-[#f7fbfc] py-0.5 pl-1 pr-0.5 text-sm text-foreground"
                          >
                            <AvatarPessoa nome={nome} foto={foto(nome)} className="size-5" />
                            <span className="truncate" title={nome}>
                              {nome}
                            </span>
                            {novos.has(`${area}|${nome}`) ? (
                              <span className="rounded-full bg-[#e8f8f8] px-1.5 text-[10px] font-semibold uppercase text-[#285f7a]">novo</span>
                            ) : null}
                            <button
                              type="button"
                              className="rounded p-1 text-muted-foreground hover:bg-[#47cdd0]/15 hover:text-foreground"
                              title={tipo === "normal" ? "Passar para demandas de risco" : "Passar para demandas normais"}
                              aria-label={`${nome}: passar para ${tipo === "normal" ? "demandas de risco" : "demandas normais"}`}
                              onClick={() => trocarTipo(area, tipo, nome)}
                            >
                              {tipo === "normal" ? <ShieldAlert className="size-3.5" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                              aria-label={`Tirar ${nome}`}
                              title="Tirar"
                              onClick={() => tirar(area, tipo, nome)}
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <ComboboxBusca
                      pessoas
                      permitirVazio
                      opcoes={opcoes.filter((opcao) => !ocupados.has(opcao.nome))}
                      valor=""
                      onChange={(nome) => incluir(area, tipo, nome)}
                      placeholder={nomes.length ? "Incluir outra pessoa…" : "A definir"}
                      rotulo={`Incluir em ${ROTULO_DEMANDA[tipo].toLowerCase()} de ${area}`}
                    />
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => onSalvar(rascunho as MapaDeVistadores)} disabled={salvando}>
            Salvar vistadores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EtiquetasDeRisco({ painel, onEditar, onPadrao }: { painel: PainelDeRegras; onEditar: () => void; onPadrao: () => void }) {
  const atuais = painel.configuracoes.etiquetasDeRisco;
  const ehPadrao = valorEmTexto("etiquetasDeRisco", atuais) === valorEmTexto("etiquetasDeRisco", painel.padroes.etiquetasDeRisco);
  return (
    <CartaoEditavel
      icone={ShieldAlert}
      titulo="Etiquetas de demanda de risco"
      descricao="Pasta com uma destas etiquetas no VIOS vira demanda de risco: cabeçalho vermelho, filtro próprio e só quem vista risco vê. Vale para as próximas triagens."
      acao={
        <Button size="sm" variant="outline" onClick={onEditar}>
          <Pencil />
          Editar
        </Button>
      }
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <UltimaAlteracao painel={painel} chave="etiquetasDeRisco" />
          {!ehPadrao ? (
            <Button size="xs" variant="ghost" onClick={onPadrao}>
              <RotateCcw />
              Voltar ao padrão
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {atuais.map((etiqueta) => (
          <Selo key={etiqueta} tom="perigo" icone={ShieldAlert}>
            {etiqueta}
          </Selo>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">{numero(painel.metricas.demandasDeRisco)}</span> publicações marcadas como risco nos últimos{" "}
        {painel.diasDasMetricas} dias.
      </p>
    </CartaoEditavel>
  );
}

/** Montado só enquanto aberto: a lista começa com as etiquetas em vigor. */
function DialogoEtiquetas({
  atuais,
  salvando,
  onFechar,
  onSalvar,
}: {
  atuais: string[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (valor: string[]) => void;
}) {
  const [lista, setLista] = useState<string[]>(atuais);
  const [nova, setNova] = useState("");
  const acrescentar = () => {
    const texto = nova.trim();
    if (texto.length < 2) return;
    setLista((atual) => (atual.some((item) => item.toLowerCase() === texto.toLowerCase()) ? atual : [...atual, texto]));
    setNova("");
  };
  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Etiquetas de demanda de risco</DialogTitle>
          <DialogDescription>
            A comparação ignora acento e maiúscula e procura a palavra inteira (&quot;Crítico&quot; não pega &quot;Autocrítica&quot;). Precisa de pelo menos uma.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
          {lista.map((etiqueta) => (
            <li key={etiqueta} className="inline-flex items-center gap-1 rounded-full bg-red-50 py-0.5 pl-2.5 pr-1 text-sm text-red-800 ring-1 ring-inset ring-red-200">
              {etiqueta}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-red-100"
                aria-label={`Tirar ${etiqueta}`}
                disabled={lista.length <= 1}
                onClick={() => setLista((atual) => atual.filter((item) => item !== etiqueta))}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={nova}
            onChange={(evento) => setNova(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                acrescentar();
              }
            }}
            placeholder="Nova etiqueta (como está no VIOS)"
            aria-label="Nova etiqueta"
            maxLength={60}
          />
          <Button type="button" variant="outline" onClick={acrescentar} disabled={nova.trim().length < 2}>
            <Plus />
            Acrescentar
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => onSalvar(lista)} disabled={salvando || !lista.length}>
            Salvar etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoraDoAlerta({ painel, salvando, onSalvar }: { painel: PainelDeRegras; salvando: boolean; onSalvar: (hora: number) => void }) {
  return (
    <CartaoEditavel
      icone={AlarmClock}
      titulo="Alerta do arquivo do dia"
      descricao="A partir desta hora, em dia útil, a falta do arquivo da Kurier vira faixa vermelha nas abas. O aviso de WhatsApp sai na busca das 9h."
      rodape={<UltimaAlteracao painel={painel} chave="horaArquivoEsperado" />}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<`${number}`>
          label="Hora do alerta"
          value={`${painel.configuracoes.horaArquivoEsperado}`}
          options={[7, 8, 9].map((hora) => ({ value: `${hora}`, label: `${hora}h` }))}
          onChange={(valor) => !salvando && onSalvar(Number(valor))}
        />
        <span className="text-xs text-muted-foreground">Padrão: {painel.padroes.horaArquivoEsperado}h. Depois das 9h não daria tempo do aviso sair.</span>
      </div>
    </CartaoEditavel>
  );
}

/** Uso da sugestão de tarefas: barra fina dividida (usada / com alteração / não usada / sem vistagem) e os números. */
function UsoDaSugestao({ painel }: { painel: PainelDeRegras }) {
  const uso = painel.usoDaIa;
  const partes = [
    { rotulo: "Usada como veio", valor: uso.usada, cor: "#1d5672" },
    { rotulo: "Usada com alteração", valor: uso.usadaComAlteracao, cor: "#3f88ad" },
    { rotulo: "Não usada", valor: uso.naoUsada, cor: "#7fb8d0" },
    { rotulo: "Ainda sem vistagem", valor: uso.semResultado, cor: "#dce9eb" },
  ];
  const decididas = uso.usada + uso.usadaComAlteracao + uso.naoUsada;
  const aproveitamento = decididas ? Math.round(((uso.usada + uso.usadaComAlteracao) / decididas) * 100) : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-foreground">
          <span className="text-xl font-semibold">{aproveitamento === null ? "—" : `${aproveitamento}%`}</span>{" "}
          <span className="text-xs text-muted-foreground">aproveitadas (usadas, com ou sem ajuste)</span>
        </p>
        <span className="text-xs text-muted-foreground">
          {numero(uso.geradas)} geradas · custo {dolar(uso.custoUS)}
        </span>
      </div>
      {uso.geradas ? (
        <div className="flex h-2 w-full gap-[2px]" role="img" aria-label={partes.map((parte) => `${parte.rotulo}: ${parte.valor}`).join("; ")}>
          {partes.map((parte) =>
            parte.valor ? (
              <span key={parte.rotulo} title={`${parte.rotulo}: ${parte.valor}`} className="h-full rounded-full" style={{ flexGrow: parte.valor, flexBasis: 0, backgroundColor: parte.cor }} />
            ) : null
          )}
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {partes.map((parte) => (
          <li key={parte.rotulo} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: parte.cor }} aria-hidden />
            <span className="flex-1 truncate">{parte.rotulo}</span>
            <span className="font-semibold tabular-nums text-foreground">{numero(parte.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChavesDaIa({ painel, salvando, onSalvar }: { painel: PainelDeRegras; salvando: boolean; onSalvar: (chave: ChaveConfiguracao, valor: boolean) => void }) {
  const linhas: { chave: "iaSugestaoTarefa" | "iaSugestaoTriagem"; titulo: string; texto: string }[] = [
    { chave: "iaSugestaoTarefa", titulo: "Sugestão de tarefas (Trabalhista)", texto: "Desligada, o cron não gera e a tela não pede novas sugestões; as já geradas continuam aparecendo." },
    { chave: "iaSugestaoTriagem", titulo: "Sugestão de pasta (Triagem Manual)", texto: "Desligada, valem só as buscas por número de processo e por parte, que não usam IA." },
  ];
  return (
    <CartaoEditavel
      icone={Sparkles}
      titulo="Inteligência artificial"
      descricao={`Modelo ${painel.ambiente.modeloIa}${painel.ambiente.iaComChave ? "" : " · sem chave da OpenAI configurada no servidor"}. Nenhuma das duas grava nada sozinha: só sugere.`}
    >
      <ul className="divide-y divide-[#eef3f5]">
        {linhas.map((linha) => (
          <li key={linha.chave} className="flex items-start gap-3 py-2.5">
            <Interruptor
              ligado={painel.configuracoes[linha.chave]}
              rotulo={linha.titulo}
              desabilitado={salvando}
              onChange={(ligado) => onSalvar(linha.chave, ligado)}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {linha.titulo}{" "}
                <span className={cn("text-xs font-normal", painel.configuracoes[linha.chave] ? "text-emerald-700" : "text-muted-foreground")}>
                  {painel.configuracoes[linha.chave] ? "ligada" : "desligada"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{linha.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </CartaoEditavel>
  );
}

/* --------------------------------------------------------------- leitura */

function SeloDeOrigem({ origem, painel }: { origem: OrigemDaRegra; painel: PainelDeRegras }) {
  const info = painel.origens[origem];
  return (
    <span title={info.dica} className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", TOM_DA_ORIGEM[origem])}>
      {info.rotulo}
    </span>
  );
}

function RegrasDaEsteira({ painel }: { painel: PainelDeRegras }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>De onde vem cada regra:</span>
        {(Object.keys(painel.origens) as OrigemDaRegra[]).map((origem) => (
          <SeloDeOrigem key={origem} origem={origem} painel={painel} />
        ))}
      </div>
      {painel.etapas.map((etapa) => (
        <EtapaDaEsteira key={etapa.id} etapa={etapa} painel={painel} />
      ))}
    </div>
  );
}

function EtapaDaEsteira({ etapa, painel }: { etapa: EtapaDocumentada; painel: PainelDeRegras }) {
  const Icone = ICONE_DA_ETAPA[etapa.id] ?? SlidersHorizontal;
  return (
    <Painel aria-labelledby={`etapa-${etapa.id}`}>
      <div className="flex items-center gap-3 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[#347796] ring-1 ring-[#dce9eb]" aria-hidden>
          <Icone className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 id={`etapa-${etapa.id}`} className="text-sm font-semibold text-foreground">
            {etapa.titulo}
          </h3>
          <p className="text-xs text-muted-foreground">{etapa.resumo}</p>
        </div>
      </div>
      <ol className="divide-y divide-[#eef3f5]">
        {etapa.regras.map((regra) => {
          const valor = regra.metrica ? painel.metricas[regra.metrica as MetricaDaRegra] : null;
          return (
            <li key={regra.id} className="grid gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{regra.titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wide text-[#285f7a] text-[10px]">Quando</span> {regra.quando},{" "}
                  <span className="font-semibold uppercase tracking-wide text-[#285f7a] text-[10px]">então</span> {regra.entao}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end md:justify-center">
                <SeloDeOrigem origem={regra.origem} painel={painel} />
                {valor !== null ? (
                  <span className="text-xs text-muted-foreground" title={`Nos últimos ${painel.diasDasMetricas} dias`}>
                    <span className="font-semibold tabular-nums text-foreground">{numero(valor)}</span> {regra.rotuloDaMetrica} · {painel.diasDasMetricas} dias
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Painel>
  );
}

function ListaDaIa({ icone: Icone, titulo, itens, tom = "neutro" }: { icone: LucideIcon; titulo: string; itens: string[]; tom?: "neutro" | "nunca" }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[#285f7a]">
        <Icone className="size-3.5" aria-hidden />
        {titulo}
      </p>
      <ul className="space-y-1">
        {itens.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-foreground/90">
            {tom === "nunca" ? (
              <CircleSlash className="mt-0.5 size-3.5 shrink-0 text-[#8f1d26]" aria-hidden />
            ) : (
              <span className="mt-2 size-1 shrink-0 rounded-full bg-[#9fb8c2]" aria-hidden />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TransparenciaDaIa({ painel, ia }: { painel: PainelDeRegras; ia: IaDocumentada }) {
  const chave = ia.id === "tarefa" ? "iaSugestaoTarefa" : "iaSugestaoTriagem";
  const ligada = painel.configuracoes[chave];
  const uso = painel.usoDaTriagemIa;
  return (
    <Painel>
      <PainelTopo
        titulo={
          <span className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-[#48466e]" aria-hidden />
            {ia.titulo}
            <Selo tom={ligada ? "sucesso" : "neutro"}>{ligada ? "Ligada" : "Desligada"}</Selo>
          </span>
        }
        descricao={ia.oQueFaz}
      />
      <div className="grid gap-5 px-4 py-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ListaDaIa icone={AlarmClock} titulo="Quando roda" itens={ia.quandoRoda} />
          <ListaDaIa icone={Eye} titulo="O que ela vê" itens={ia.oQueVe} />
        </div>
        <div className="space-y-4">
          <ListaDaIa icone={Scale} titulo="Regras que segue" itens={ia.regras} />
          <ListaDaIa icone={ShieldCheck} titulo="O que nunca faz" itens={ia.nuncaFaz} tom="nunca" />
        </div>
      </div>
      <div className="border-t border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase text-[#285f7a]">Resultado nos últimos {painel.diasDasMetricas} dias</p>
        {ia.id === "tarefa" ? (
          <UsoDaSugestao painel={painel} />
        ) : uso.geradas ? (
          <p className="text-sm text-foreground">
            <span className="font-semibold">{numero(uso.geradas)}</span> sugestões: {numero(uso.porNumero)} pelo número do processo, {numero(uso.porParte)} por parte e{" "}
            {numero(uso.porIa)} pela IA · custo {dolar(uso.custoUS)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma publicação sem pasta precisou de sugestão no período.</p>
        )}
      </div>
    </Painel>
  );
}

function Historico({ painel }: { painel: PainelDeRegras }) {
  if (!painel.historico.length) {
    return (
      <Painel>
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="grid size-10 place-items-center rounded-md bg-[#e8f8f8] text-[#3e84a8]">
            <History className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">Nenhuma alteração ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">Tudo segue o padrão do sistema. Cada mudança feita aqui fica registrada com quem mudou e quando.</p>
        </div>
      </Painel>
    );
  }
  return (
    <Painel>
      <ol className="divide-y divide-[#eef3f5]">
        {painel.historico.map((item, indice) => (
          <li key={`${item.chave}-${item.alteradoEm}-${indice}`} className="flex gap-3 px-4 py-3">
            <AvatarPessoa nome={item.alteradoPor ?? "Admin"} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">{item.alteradoPor ?? "Admin"}</span> mudou{" "}
                <span className="font-medium">{ROTULO_DA_CHAVE[item.chave as ChaveConfiguracao] ?? item.chave}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="line-through decoration-muted-foreground/60">{valorEmTexto(item.chave, item.valorAnterior)}</span>
                {" → "}
                <span className="text-foreground">{valorEmTexto(item.chave, item.valorNovo)}</span>
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatarDataHora(item.alteradoEm)}</span>
          </li>
        ))}
      </ol>
    </Painel>
  );
}

/* ------------------------------------------------------------------ tela */

type Secao = "editaveis" | "esteira" | "ia" | "historico";

function Configuracoes() {
  const [painel, setPainel] = useState<PainelDeRegras | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [secao, setSecao] = useState<Secao>("editaveis");
  const [editando, setEditando] = useState<"vistadores" | "etiquetas" | null>(null);
  /** Proposta lida da lista USUARIOS do SharePoint (abre no modal dos vistadores para conferir antes de salvar). */
  const [proposta, setProposta] = useState<ResultadoDaImportacao | null>(null);
  const [importando, setImportando] = useState(false);

  async function importarDaLista() {
    setImportando(true);
    setErro("");
    setAviso("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/configuracoes/vistadores-sharepoint", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível ler a lista USUARIOS.");
      setProposta(corpo as ResultadoDaImportacao);
      setEditando("vistadores");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível ler a lista USUARIOS.");
    } finally {
      setImportando(false);
    }
  }

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/configuracoes");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível carregar as configurações.");
      setPainel(corpo as PainelDeRegras);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as configurações.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar<C extends ChaveConfiguracao>(chave: C, valor: ConfiguracoesVistagem[C] | unknown) {
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave, valor }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível salvar.");
      setPainel(corpo as PainelDeRegras);
      setEditando(null);
      setAviso(`${ROTULO_DA_CHAVE[chave]}: salvo. Vale em até 1 minuto em todo o sistema.`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!painel) {
    return erro ? (
      <Aviso
        tom="erro"
        titulo="Não foi possível carregar as configurações"
        acao={
          <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => void carregar()}>
            Tentar de novo
          </Button>
        }
      >
        {erro}
      </Aviso>
    ) : (
      <Painel>
        <Carregando rotulo="Carregando as regras" />
      </Painel>
    );
  }

  const ambiente = painel.ambiente;

  return (
    <div className="space-y-4">
      {/* Situação do sistema: o que está ligado no servidor (não muda por esta tela). */}
      <Painel>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#04202f] text-[#47cdd0]" aria-hidden>
              <SlidersHorizontal className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Regras da Vistagem</h2>
              <p className="text-xs text-muted-foreground">Só administradores veem esta tela. O que muda aqui vale para todos em até 1 minuto e fica no histórico.</p>
            </div>
          </div>
          <dl className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5" title="Variável VISTAGEM_RPA_MODO no servidor: muda com o suporte, não por esta tela.">
              <dt className="sr-only">Robô</dt>
              <dd>
                <Selo tom={ambiente.envioReal ? "sucesso" : "alerta"} icone={Bot}>
                  {ambiente.envioReal ? "Robô gravando no VIOS" : "Robô em simulação (não grava)"}
                </Selo>
              </dd>
            </div>
            <div className="flex items-center gap-1.5" title="Variável VISTAGEM_AGENDAMENTO no servidor.">
              <dt className="sr-only">Onde agenda</dt>
              <dd>
                <Selo tom="neutro" icone={Send}>
                  {ambiente.modoAgendamento === "intimacao" ? "Agenda na intimação" : "Agenda na pasta"}
                </Selo>
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">IA</dt>
              <dd>
                <Selo tom={ambiente.iaComChave ? "ia" : "alerta"} icone={Sparkles}>
                  {ambiente.iaComChave ? `IA: ${ambiente.modeloIa}` : "IA sem chave"}
                </Selo>
              </dd>
            </div>
          </dl>
        </div>
      </Painel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Secao>
          label="Parte das configurações"
          value={secao}
          options={[
            { value: "editaveis", label: "O que dá para mudar", icon: Pencil },
            { value: "esteira", label: "Regras da esteira", icon: Info },
            { value: "ia", label: "Como a IA funciona", icon: BrainCircuit },
            { value: "historico", label: `Histórico${painel.historico.length ? ` ${painel.historico.length}` : ""}`, icon: History },
          ]}
          onChange={setSecao}
        />
      </div>

      {aviso ? (
        <Aviso
          tom="sucesso"
          acao={
            <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setAviso("")}>
              <X />
            </Button>
          }
        >
          {aviso}
        </Aviso>
      ) : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {secao === "editaveis" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Vistadores
            painel={painel}
            importando={importando}
            onImportar={() => void importarDaLista()}
            onEditar={() => {
              setProposta(null);
              setEditando("vistadores");
            }}
          />
          <div className="grid content-start gap-4">
            <EtiquetasDeRisco
              painel={painel}
              onEditar={() => setEditando("etiquetas")}
              onPadrao={() => void salvar("etiquetasDeRisco", painel.padroes.etiquetasDeRisco)}
            />
            <HoraDoAlerta painel={painel} salvando={salvando} onSalvar={(hora) => void salvar("horaArquivoEsperado", hora)} />
          </div>
          <div className="xl:col-span-2">
            <ChavesDaIa painel={painel} salvando={salvando} onSalvar={(chave, valor) => void salvar(chave, valor)} />
          </div>
        </div>
      ) : secao === "esteira" ? (
        <RegrasDaEsteira painel={painel} />
      ) : secao === "ia" ? (
        <div className="space-y-4">
          {painel.ias.map((ia) => (
            <TransparenciaDaIa key={ia.id} painel={painel} ia={ia} />
          ))}
        </div>
      ) : (
        <Historico painel={painel} />
      )}

      {editando === "vistadores" ? (
        <DialogoVistadores
          painel={painel}
          proposta={proposta}
          salvando={salvando}
          onFechar={() => {
            setEditando(null);
            setProposta(null);
          }}
          onSalvar={(valor) => void salvar("vistadores", valor)}
        />
      ) : null}
      {editando === "etiquetas" ? (
        <DialogoEtiquetas
          atuais={painel.configuracoes.etiquetasDeRisco}
          salvando={salvando}
          onFechar={() => setEditando(null)}
          onSalvar={(valor) => void salvar("etiquetasDeRisco", valor)}
        />
      ) : null}
    </div>
  );
}

export function ConfiguracoesClient() {
  return (
    <AcessoOperacoesLegais>
      <Configuracoes />
    </AcessoOperacoesLegais>
  );
}
