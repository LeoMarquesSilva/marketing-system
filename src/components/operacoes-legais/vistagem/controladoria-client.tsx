"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  ClipboardCheck,
  ShieldAlert,
  ExternalLink,
  FolderX,
  Folders,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  Search,
  SearchX,
  Send,
  Sparkles,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { camposDaPublicacao, combinaCampos } from "@/lib/vistagem/busca";
import { clienteNoTexto, pastaSugerida, verificacoesSemPasta, type SituacaoVerificacao } from "@/lib/vistagem/controladoria";
import { criarCalendarioDePrazo, feriadosNacionais, somarDiasUteis } from "@/lib/vistagem/dias-uteis";
import { ESCRITORIOS, ESCRITORIO_EX_CLIENTE, pastaAtiva, type PastaSioe, type Pendencia } from "@/lib/vistagem/triagem";
import type { SugestaoTriagem } from "@/lib/vistagem/sugestao-triagem";
import type { PendenciasControladoria, PublicacaoResumo, ResolucaoPendencia, TriagemResumo } from "@/lib/vistagem/types";
import { linkPastaVios } from "@/lib/vistagem/vios-links";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { AvisoArquivoDoDia } from "./aviso-arquivo-do-dia";
import { FiltroData, dataNaLista } from "./filtro-data";
import { EditorVistagem } from "./juridico-client";
import { LeitorPublicacao } from "./leitor-publicacao";
import { IconeArea, IconeTribunal, LogoGrupo } from "./marcas";
import { FaixaDoProcesso, SetasDaFila } from "./faixa-processo";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import { PENDENCIAS, formatarData, formatarDataHora } from "./publicacao-ui";
import { ReguaDatas } from "./regua-datas";
import { Seletor, SeletorBusca } from "./seletor";
import {
  Aviso,
  BarraAba,
  Busca,
  Campo,
  Carregando,
  Painel,
  Secao,
  Selo,
  Vazio,
  linhaLista,
} from "./ui";

/**
 * As abas seguem o que chega da triagem: sem pasta (possível abertura), mais de uma pasta e, quando houver, dados
 * faltando. Os ex-clientes não aparecem aqui: a controladoria os vista na fila Operações Legais do Jurídico.
 */
type Aba = "sem_pasta" | "varias_pastas" | "dados";

const ABAS: { valor: Aba; rotulo: string; pendencias: Pendencia[] }[] = [
  { valor: "sem_pasta", rotulo: "Sem pasta · possível abertura", pendencias: ["sem_pasta"] },
  { valor: "varias_pastas", rotulo: "Mais de uma pasta", pendencias: ["varias_pastas"] },
  { valor: "dados", rotulo: "Sem área ou grupo", pendencias: ["sem_area", "sem_grupo"] },
];

const ICONE_ABA = { sem_pasta: FolderX, varias_pastas: Folders, dados: ListChecks } as const;

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function abaDaPendencia(pendencia: Pendencia | null): Aba | null {
  return ABAS.find((aba) => pendencia && aba.pendencias.includes(pendencia))?.valor ?? null;
}

function numeroProcesso(publicacao: PublicacaoResumo): string {
  return publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
}


/** Data de hoje em São Paulo (AAAA-MM-DD), para a régua mostrar "há 2 dias". */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Texto do aviso depois de liberar: para onde a publicação foi. */
function liberada(escritorio: string | null): string {
  return escritorio === ESCRITORIO_EX_CLIENTE ? "enviada para a controladoria vistar (fila Operações Legais)" : `liberada para o jurídico${escritorio ? ` (${escritorio})` : ""}`;
}

/** Resolve a pendência no servidor; devolve o escritório para onde a publicação foi. */
async function resolver(id: string, entrada: ResolucaoPendencia): Promise<string | null> {
  const resposta = await authFetch(`/api/operacoes-legais/vistagem/pendencias/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entrada),
  });
  const corpo = await resposta.json();
  if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao resolver.");
  return corpo.publicacao?.escritorioResponsavel ?? null;
}

/** O que a controladoria já escolheu ao clicar em "Agendar Direto" (dá para mudar no topo do modal). */
interface PreviaAgendamento {
  escritorio: string;
  grupo: string;
  demandaRisco: boolean;
  ci?: string;
}

/** "Agendar Direto": abre a vistagem do jurídico na própria Controladoria, com a pendência ainda na triagem. */
type AoAgendar = (publicacao: PublicacaoResumo, previa: PreviaAgendamento) => void;

/** Mesmo número de processo (só os 20 dígitos), para confirmar que a pasta é deste processo. */
function mesmoProcesso(pasta: PastaSioe, publicacao: PublicacaoResumo): boolean {
  const digitos = (texto: string | null) => (texto ?? "").replace(/\D/g, "").slice(0, 20);
  return Boolean(pasta.cnj) && digitos(pasta.cnj) === digitos(numeroProcesso(publicacao));
}

/** Dados do processo da pasta: número (e se é o desta publicação), ação, fase e valor, e o link para o VIOS. */
function ProcessoDaPasta({ pasta, publicacao }: { pasta: PastaSioe; publicacao: PublicacaoResumo }) {
  const mesmo = mesmoProcesso(pasta, publicacao);
  const valor = pasta.valorAcaoAtualizado ?? pasta.valorAcao ?? null;
  return (
    <div className="space-y-0.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="tabular-nums text-foreground">{pasta.cnj || "sem número"}</span>
        {pasta.cnj ? (
          <span className={cn("text-[11px] font-medium", mesmo ? "text-emerald-700" : "text-amber-700")}>
            {mesmo ? "mesmo processo da publicação" : "outro número"}
          </span>
        ) : null}
        <a
          href={linkPastaVios(pasta.ci)}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir a pasta no VIOS (nova aba)"
          className="inline-flex items-center gap-1 font-medium text-[#347796] hover:text-[#285f7a] hover:underline"
        >
          Abrir no VIOS
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
      {pasta.acao || pasta.fase || valor !== null ? (
        <p>
          {[pasta.acao, pasta.fase ? `fase ${pasta.fase}` : null, valor !== null ? `valor ${reais(valor)}` : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/** Pasta do VIOS como opção de uma lista: CI, vínculo e situação; processo; grupo e cliente; área e responsável. */
function LinhaPasta({ pasta, publicacao, acao }: { pasta: PastaSioe; publicacao: PublicacaoResumo; acao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-3 py-3 text-xs text-muted-foreground">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="tabular-nums text-sm font-semibold text-foreground">CI {pasta.ci}</span>
          {pasta.vinculo ? <span>{pasta.vinculo}</span> : null}
          {pasta.situacao ? <span>· {pasta.situacao}</span> : null}
        </p>
        <ProcessoDaPasta pasta={pasta} publicacao={publicacao} />
        <p className="flex min-w-0 items-center gap-1.5">
          <LogoGrupo grupo={pasta.grupoCliente} tamanho="xs" />
          <span className="truncate">
            <span className="font-medium text-foreground">{pasta.grupoCliente || "sem grupo"}</span>
            {pasta.cliente ? ` · ${pasta.cliente}` : ""}
          </span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5">
          {pasta.area ? <IconeArea area={pasta.area} /> : null}
          <span className="truncate">
            {pasta.area || "sem área"}
            {pasta.advogadoResponsavel ? ` · Resp.: ${pasta.advogadoResponsavel}` : ""}
          </span>
        </p>
      </div>
      {acao}
    </div>
  );
}

const LISTA_PASTAS = "divide-y divide-[#e6eef0] overflow-hidden rounded-md border border-[#dce9eb] bg-white";

const ROTULO_ORIGEM: Record<SugestaoTriagem["origem"], string> = {
  numero: "Processo citado",
  parte: "Parte cliente",
  ia: "Sugestão da IA",
};

function SeloConfianca({ confianca }: { confianca: SugestaoTriagem["confianca"] }) {
  return (
    <Selo tom={confianca === "alta" ? "sucesso" : confianca === "media" ? "alerta" : "perigo"}>
      confiança {confianca === "media" ? "média" : confianca}
    </Selo>
  );
}

/** De onde vieram os campos já preenchidos (o detalhe está na verificação acima). */
function NotaSugestao({ sugestao }: { sugestao: SugestaoTriagem }) {
  const ia = sugestao.origem === "ia";
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium",
        ia ? "border-[#48466e]/20 bg-[#f6f6fa] text-[#2f2d4d]" : "border-[#47cdd0]/30 bg-[#f2fbfb] text-[#183f50]"
      )}
    >
      {ia ? <Sparkles className="size-3.5" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />}
      Pré-preenchido · {ROTULO_ORIGEM[sugestao.origem]}
      <SeloConfianca confianca={sugestao.confianca} />
      <span className="w-full font-normal text-muted-foreground">Confira antes de liberar.</span>
    </p>
  );
}

/* ------------------------------------------------------------ verificação */

const PASSO: Record<SituacaoVerificacao, { icone: typeof CircleCheck; classe: string; rotulo: string }> = {
  achou: { icone: CircleCheck, classe: "text-emerald-600", rotulo: "Encontrou" },
  nada: { icone: CircleSlash, classe: "text-slate-400", rotulo: "Nada encontrado" },
  nao_verificado: { icone: CircleDashed, classe: "text-slate-300", rotulo: "Não procurado" },
};

/** Sem pasta: o que o sistema já procurou antes de concluir que é possível abertura. */
function VerificacaoSemPasta({ publicacao }: { publicacao: PublicacaoResumo }) {
  const passos = verificacoesSemPasta(publicacao);
  return (
    <Secao titulo="O que já foi procurado" id={`verificacao-${publicacao.id}`}>
      <ol className="space-y-2.5">
        {passos.map((passo) => {
          const info = PASSO[passo.situacao];
          return (
            <li key={passo.rotulo} className="flex gap-2.5">
              <info.icone className={cn("mt-0.5 size-4 shrink-0", info.classe)} aria-label={info.rotulo} />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">{passo.rotulo}</p>
                <p className="text-xs text-muted-foreground">{passo.detalhe}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        Rechecado {publicacao.triadaEm ? `em ${formatarDataHora(publicacao.triadaEm)}` : "na última triagem"}; a cada busca do arquivo da Kurier o sistema procura de
        novo, caso a pasta tenha sido aberta.
      </p>
    </Secao>
  );
}

/* ------------------------------------------------------------ comparador */

/** Mais de uma pasta: as pastas lado a lado, com a sugerida marcada e o cliente que aparece no texto. */
function ComparadorPastas({
  publicacao,
  onResolvida,
  onAgendar,
}: {
  publicacao: PublicacaoResumo;
  onResolvida: (resultado: string) => void;
  onAgendar: (previa: PreviaAgendamento) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const candidatas = publicacao.pastasCandidatas;
  const sugerida = pastaSugerida(candidatas);
  const texto = [publicacao.teor, ...publicacao.djenIntimados].join(" ");

  async function usar(pasta: PastaSioe, agendarDireto = false) {
    setOcupado(pasta.ci);
    setErro("");
    try {
      if (agendarDireto) {
        // Só abre a vistagem: o escritório vem da triagem da pasta; a pendência sai da fila ao enviar as tarefas.
        const resposta = await authFetch(`/api/operacoes-legais/vistagem/sioe/pasta?ci=${encodeURIComponent(pasta.ci)}`);
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "CI não encontrada.");
        onAgendar({ ci: pasta.ci, escritorio: corpo.escritorioSugerido ?? "", grupo: pasta.grupoCliente ?? "", demandaRisco: Boolean(publicacao.demandaRisco) });
      } else {
        onResolvida(liberada(await resolver(publicacao.id, { ci: pasta.ci })));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Secao titulo={`${candidatas.length} pastas para o mesmo processo`} id={`comparador-${publicacao.id}`}>
      {sugerida ? (
        <p className="flex items-center gap-1.5 text-xs text-[#285f7a]">
          <Star className="size-3.5 fill-current" aria-hidden />
          Sugerida: CI {sugerida.pasta.ci}. {sugerida.motivo}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma se destaca: confira vínculo, situação e cliente.</p>
      )}
      <ul className="grid gap-3 @2xl:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
        {candidatas.map((pasta) => {
          const destaque = sugerida?.pasta.ci === pasta.ci;
          const ativa = pastaAtiva(pasta);
          const citado = clienteNoTexto(pasta, texto);
          return (
            <li
              key={pasta.ci}
              className={cn(
                "flex flex-col gap-3 rounded-md border bg-white p-3",
                destaque ? "border-[#347796] ring-1 ring-[#347796]/20" : "border-[#dce9eb]"
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="tabular-nums text-sm font-semibold text-foreground">CI {pasta.ci}</span>
                {destaque ? (
                  <Selo tom="marca" icone={Star}>
                    Sugerida
                  </Selo>
                ) : null}
              </div>
              <dl className="grid gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Processo</dt>
                  <dd className="mt-0.5 text-muted-foreground">
                    <ProcessoDaPasta pasta={pasta} publicacao={publicacao} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vínculo e situação</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1.5">
                    <Selo tom={/principal/i.test(pasta.vinculo ?? "") ? "escuro" : "neutro"}>{pasta.vinculo ?? "sem vínculo"}</Selo>
                    <Selo tom={ativa ? "sucesso" : "neutro"}>{pasta.situacao ?? "sem situação"}</Selo>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <LogoGrupo grupo={pasta.grupoCliente} tamanho="xs" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{pasta.grupoCliente ?? "sem grupo"}</span>
                      <span className="block truncate text-muted-foreground" title={pasta.cliente ?? undefined}>
                        {pasta.cliente ?? "—"}
                      </span>
                    </span>
                  </dd>
                  {citado ? <p className="mt-1 text-[11px] font-medium text-emerald-700">Aparece no texto da publicação</p> : null}
                </div>
                <div>
                  <dt className="text-muted-foreground">Área e responsável</dt>
                  <dd className="mt-0.5 flex min-w-0 items-center gap-1.5 text-foreground">
                    {pasta.area ? <IconeArea area={pasta.area} /> : null}
                    <span className="truncate">{[pasta.area, pasta.advogadoResponsavel].filter(Boolean).join(" · ") || "—"}</span>
                  </dd>
                </div>
              </dl>
              <div className="mt-auto grid gap-1.5">
                <Button size="sm" variant={destaque ? "default" : "outline"} onClick={() => usar(pasta)} disabled={ocupado !== null}>
                  {ocupado === pasta.ci ? <LoaderCircle className="animate-spin" /> : <Check />}
                  Usar e liberar ao jurídico
                </Button>
                <Button size="sm" variant="ghost" className="text-[#347796]" onClick={() => usar(pasta, true)} disabled={ocupado !== null}>
                  <CalendarPlus />
                  Usar e agendar direto
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
    </Secao>
  );
}

/* -------------------------------------------------------------- resolução */

/** Grupo de cliente do VIOS, com as pastas ativas (para o combo). */
interface GrupoCliente {
  grupo: string;
  ativas: number;
}

let gruposEmCache: GrupoCliente[] | null = null;

/** Grupos de clientes do VIOS, carregados uma vez por página. */
function useGruposClientes(): GrupoCliente[] {
  const [grupos, setGrupos] = useState<GrupoCliente[]>(gruposEmCache ?? []);
  useEffect(() => {
    if (gruposEmCache) return;
    let cancelado = false;
    authFetch("/api/operacoes-legais/vistagem/grupos")
      .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as { grupos: GrupoCliente[] }).grupos : []))
      .then((lista) => {
        if (lista.length) gruposEmCache = lista;
        if (!cancelado) setGrupos(lista);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);
  return grupos;
}

/** Grupo do cliente em combo (a lista do VIOS), com busca e logo; um grupo sugerido fora da lista aparece no topo. */
function CampoGrupo({ valor, onChange, obrigatorio }: { valor: string; onChange: (grupo: string) => void; obrigatorio: boolean }) {
  const grupos = useGruposClientes();
  const opcoes = useMemo(() => {
    const lista = grupos.map((item) => ({ valor: item.grupo, rotulo: item.grupo, contagem: item.ativas, icone: <LogoGrupo grupo={item.grupo} tamanho="xs" /> }));
    return valor && !grupos.some((item) => item.grupo === valor)
      ? [{ valor, rotulo: `${valor} (sugerido)`, icone: <LogoGrupo grupo={valor} tamanho="xs" /> }, ...lista]
      : lista;
  }, [grupos, valor]);
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">{obrigatorio ? "Grupo do cliente" : "Grupo do cliente (opcional)"}</span>
      <SeletorBusca
        rotulo="Grupo do cliente"
        placeholder={grupos.length ? "Escolha o grupo" : "Carregando os grupos…"}
        buscaPlaceholder="Buscar grupo…"
        valor={valor}
        onChange={onChange}
        opcoes={opcoes}
      />
    </div>
  );
}

/** Demanda de risco: chave liga/desliga (vermelha quando ligada), no lugar da caixinha do navegador. */
function ChaveRisco({ ligado, onChange }: { ligado: boolean; onChange: (ligado: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      className="inline-flex min-h-10 w-fit items-center gap-2.5 rounded-md text-sm text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
    >
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", ligado ? "bg-red-600" : "bg-[#c9dde6]")} aria-hidden>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform", ligado ? "translate-x-[1.125rem]" : "translate-x-0.5")} />
      </span>
      <ShieldAlert className={cn("size-4", ligado ? "text-red-700" : "text-muted-foreground")} aria-hidden />
      <span className={cn(ligado && "font-medium text-red-800")}>Demanda de risco</span>
    </button>
  );
}

/** Escritório responsável: todas as áreas (Operações Legais é a fila da própria controladoria). */
function CampoEscritorio({ valor, onChange }: { valor: string; onChange: (escritorio: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">Escritório responsável</span>
      <Seletor
        rotulo="Escritório responsável"
        placeholder="Escolha o escritório"
        valor={(ESCRITORIOS as readonly string[]).includes(valor) ? valor : ""}
        onChange={onChange}
        opcoes={ESCRITORIOS.map((nome) => ({ valor: nome, rotulo: nome, icone: <IconeArea area={nome} /> }))}
      />
    </div>
  );
}

/**
 * Achou a pasta (CI): libera para o jurídico ou agenda direto ("Usar e agendar direto", no modelo do jurídico, nesta
 * mesma tela). Sem pasta: informa os dados e libera para o jurídico. Em Operações Legais o grupo é opcional.
 */
function Resolucao({
  publicacao,
  onResolvida,
  onAgendar,
}: {
  publicacao: PublicacaoResumo;
  onResolvida: (resultado: string) => void;
  onAgendar: (previa: PreviaAgendamento) => void;
}) {
  const [ci, setCi] = useState("");
  const [previa, setPrevia] = useState<{ pasta: PastaSioe; escritorioSugerido: string | null } | null>(null);
  // Sem pasta: os campos já vêm com a sugestão (processo citado, parte cliente ou IA); a controladoria confere.
  const sugestao = publicacao.pendencia === "sem_pasta" ? publicacao.sugestaoTriagem : null;
  const [escritorio, setEscritorio] = useState(sugestao?.escritorio ?? publicacao.escritorioResponsavel ?? "");
  const [grupo, setGrupo] = useState(publicacao.grupoCliente ?? sugestao?.grupo ?? "");
  const [demandaRisco, setDemandaRisco] = useState(Boolean(publicacao.demandaRisco ?? sugestao?.demandaRisco));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function liberar(entrada: ResolucaoPendencia) {
    setOcupado(true);
    setErro("");
    try {
      onResolvida(liberada(await resolver(publicacao.id, entrada)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(false);
    }
  }

  async function buscarCi() {
    setOcupado(true);
    setErro("");
    setPrevia(null);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/sioe/pasta?ci=${encodeURIComponent(ci)}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "CI não encontrada.");
      setPrevia(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "CI não encontrada.");
    } finally {
      setOcupado(false);
    }
  }

  const base = `resolucao-${publicacao.id}`;
  const variasPastas = publicacao.pastasCandidatas.length > 1;
  const escritorioValido = (ESCRITORIOS as readonly string[]).includes(escritorio);
  const grupoObrigatorio = escritorio !== ESCRITORIO_EX_CLIENTE;
  const pronto = escritorioValido && (!grupoObrigatorio || Boolean(grupo.trim()));

  return (
    <>
      {!publicacao.pastaCi && !variasPastas ? (
        <Secao titulo="Achou a pasta no VIOS?" id={`${base}-ci`}>
          <div className="flex items-end gap-2">
            <Campo rotulo="CI da pasta" className="min-w-0 flex-1">
              <Input
                value={ci}
                onChange={(evento) => setCi(evento.target.value)}
                placeholder="Número da CI"
                inputMode="numeric"
                aria-label="CI da pasta"
                onKeyDown={(evento) => {
                  if (evento.key === "Enter" && ci.trim()) void buscarCi();
                }}
              />
            </Campo>
            <Button variant="outline" onClick={buscarCi} disabled={ocupado || !ci.trim()}>
              <Search />
              Buscar pasta
            </Button>
          </div>
          {previa ? (
            <div className={LISTA_PASTAS}>
              <LinhaPasta
                pasta={previa.pasta}
                publicacao={publicacao}
                acao={
                  <div className="grid gap-1.5">
                    <Button size="sm" onClick={() => liberar({ ci: previa.pasta.ci })} disabled={ocupado}>
                      <Check />
                      Usar e liberar · {previa.escritorioSugerido ?? "definir escritório"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onAgendar({
                          ci: previa.pasta.ci,
                          escritorio: previa.escritorioSugerido ?? "",
                          grupo: previa.pasta.grupoCliente ?? "",
                          demandaRisco: demandaRisco,
                        })
                      }
                      disabled={ocupado}
                    >
                      <CalendarPlus />
                      Usar e agendar direto
                    </Button>
                  </div>
                }
              />
            </div>
          ) : null}
        </Secao>
      ) : null}

      <Secao titulo={variasPastas ? "Nenhuma serve? Informe os dados" : publicacao.pastaCi ? "Para onde vai" : "Sem pasta: para onde vai"} id={`${base}-destino`}>
        {sugestao ? <NotaSugestao sugestao={sugestao} /> : null}
        <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-1">
          <CampoEscritorio valor={escritorio} onChange={setEscritorio} />
          <CampoGrupo valor={grupo} onChange={setGrupo} obrigatorio={grupoObrigatorio} />
        </div>
        <ChaveRisco ligado={demandaRisco} onChange={setDemandaRisco} />
        <Button
          className="w-full"
          onClick={() => liberar({ escritorio, grupo: grupo.trim() || undefined, demandaRisco, ci: publicacao.pastaCi ?? undefined })}
          disabled={ocupado || !pronto}
        >
          {ocupado ? <LoaderCircle className="animate-spin" /> : <Send />}
          Liberar para o jurídico
        </Button>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </Secao>
    </>
  );
}

/* --------------------------------------------------------------- detalhe */

interface Navegacao {
  posicao: number;
  total: number;
  anterior: string | null;
  proxima: string | null;
}

/** A pendência aberta: régua, leitura completa e, ao lado, a verificação/comparação e a resolução. */
function DetalhePendencia({
  resumo,
  navegacao,
  onAbrir,
  onResolvida,
  onAgendar,
}: {
  resumo: PublicacaoResumo;
  navegacao: Navegacao;
  onAbrir: (id: string) => void;
  onResolvida: (id: string, resultado: string) => void;
  onAgendar: AoAgendar;
}) {
  // A lista traz o teor resumido: o leitor precisa do texto inteiro.
  const [publicacao, setPublicacao] = useState<PublicacaoResumo>(resumo);
  const hoje = useMemo(() => hojeEmSaoPaulo(), []);
  const contaPrazo = useMemo(() => {
    const ano = Number(hoje.slice(0, 4));
    return criarCalendarioDePrazo([...feriadosNacionais(ano), ...feriadosNacionais(ano + 1)]);
  }, [hoje]);

  useEffect(() => {
    if (!resumo.teorResumido) return;
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/publicacoes/${resumo.id}`)
      .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as { publicacao: PublicacaoResumo }).publicacao : null))
      .then((completa) => {
        if (completa && !cancelado) setPublicacao({ ...resumo, teor: completa.teor, teorResumido: false });
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [resumo]);

  const numero = numeroProcesso(publicacao);
  const resolvida = (resultado: string) => onResolvida(publicacao.id, resultado);
  const agendar = (previa: PreviaAgendamento) => onAgendar(publicacao, previa);
  const variasPastas = publicacao.pastasCandidatas.length > 1;
  const IconePendencia = publicacao.pendencia === "varias_pastas" ? Folders : publicacao.pendencia === "sem_pasta" ? FolderX : ListChecks;

  return (
    // Como a Conferência: a faixa do processo no topo e, embaixo, a publicação e a resolução rolando cada uma no seu lugar.
    <Painel aria-labelledby="pendencia-titulo" className="@container lg:flex lg:h-full lg:flex-col">
      <FaixaDoProcesso
        numero={numero}
        tribunal={publicacao.tribunal}
        tituloId="pendencia-titulo"
        selos={
          publicacao.pendencia ? (
            <Selo tom="alerta" icone={IconePendencia}>
              {PENDENCIAS[publicacao.pendencia]}
            </Selo>
          ) : null
        }
      >
        <SetasDaFila navegacao={navegacao} onAbrir={onAbrir} />
      </FaixaDoProcesso>
      <div className="shrink-0 border-b border-[#e6eef0] bg-[#fafcfc] px-4 py-3">
        <ReguaDatas
          rotulo="Datas da publicação"
          hoje={hoje}
          className="max-w-xl"
          marcos={[
            { rotulo: "Divulgação", data: publicacao.dataDivulgacao },
            { rotulo: "Publicação", data: publicacao.dataPublicacao, tom: "marca" },
            {
              rotulo: "Início do prazo",
              data: publicacao.dataPublicacao ? somarDiasUteis(publicacao.dataPublicacao, 1, contaPrazo) : null,
              dica: "1º dia útil após a publicação (feriados nacionais): o prazo corre enquanto a pendência não é resolvida.",
            },
          ]}
        />
      </div>

      <div className="grid lg:min-h-0 lg:flex-1 @max-4xl:overflow-y-auto @4xl:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] @4xl:grid-rows-[minmax(0,1fr)]">
        <div className="min-w-0 @4xl:overflow-y-auto">
          {variasPastas ? <ComparadorPastas key={publicacao.id} publicacao={publicacao} onResolvida={resolvida} onAgendar={agendar} /> : null}
          <LeitorPublicacao publicacao={publicacao} ocultarIdComunicacao className={cn(variasPastas && "border-t border-[#e6eef0]")} />
        </div>
        {/* A coluna da resolução tem o fundo até o fim, como a das tarefas na Conferência. */}
        <div className="min-w-0 border-t border-[#e6eef0] bg-[#f2f6f7] @4xl:overflow-y-auto @4xl:border-l @4xl:border-t-0">
          {publicacao.pendencia === "sem_pasta" ? <VerificacaoSemPasta publicacao={publicacao} /> : null}
          <Resolucao key={publicacao.id} publicacao={publicacao} onResolvida={resolvida} onAgendar={agendar} />
        </div>
      </div>
    </Painel>
  );
}

/* ------------------------------------------------------------------ fila */

/** Linha da fila: o que ajuda a reconhecer a pendência sem abrir (sugestão, pastas, intimado). */
function LinhaFila({ publicacao, aberta, onAbrir }: { publicacao: PublicacaoResumo; aberta: boolean; onAbrir: () => void }) {
  const sugestao = publicacao.pendencia === "sem_pasta" ? publicacao.sugestaoTriagem : null;
  const candidatas = publicacao.pastasCandidatas;
  const grupo = sugestao?.grupo ?? candidatas[0]?.grupoCliente ?? publicacao.grupoCliente;
  return (
    <button type="button" onClick={onAbrir} aria-current={aberta ? "true" : undefined} className={cn(linhaLista(aberta), "space-y-1")}>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="tabular-nums text-xs font-semibold text-foreground">{numeroProcesso(publicacao)}</span>
        {publicacao.tribunal ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={descricaoDoTribunal(publicacao.tribunal) ?? undefined}>
            <IconeTribunal sigla={publicacao.tribunal} />
            {publicacao.tribunal}
          </span>
        ) : null}
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">publ. {formatarData(publicacao.dataPublicacao).slice(0, 5)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
        {grupo ? <LogoGrupo grupo={grupo} tamanho="xs" /> : null}
        <span className="truncate">
          {candidatas.length > 1
            ? `${candidatas.length} pastas · ${grupo ?? "sem grupo"}`
            : grupo ?? sugestao?.cliente ?? (sugestao ? "Cliente não identificado" : "Sem sugestão")}
        </span>
        {sugestao ? <SeloConfianca confianca={sugestao.confianca} /> : null}
      </span>
      {publicacao.djenIntimados.length ? (
        <span className="block truncate text-xs text-muted-foreground">Intimado: {publicacao.djenIntimados.join(" · ")}</span>
      ) : null}
    </button>
  );
}

/**
 * "Agendar Direto" na própria tela: o modelo do jurídico (publicação à esquerda; à direita os dados da pendência e,
 * logo abaixo, as tarefas). Nada é gravado até o envio; "Voltar" devolve a resolução da pendência.
 */
function AgendarDireto({
  previa,
  navegacao,
  onAbrir,
  onMudar,
  onEnviada,
  onVoltar,
}: {
  previa: { id: string } & PreviaAgendamento;
  navegacao: Navegacao;
  onAbrir: (id: string) => void;
  onMudar: (mudanca: Partial<PreviaAgendamento>) => void;
  onEnviada: () => void;
  onVoltar: () => void;
}) {
  const escritorioValido = (ESCRITORIOS as readonly string[]).includes(previa.escritorio);
  const dadosDaPendencia = (
    <Painel aria-labelledby="agendar-direto-titulo" className="@container overflow-visible">
      <div className="flex items-center gap-2 border-b border-[#e6eef0] px-4 py-2.5">
        <CalendarPlus className="size-4 text-[#347796]" aria-hidden />
        <h2 id="agendar-direto-titulo" className="text-sm font-semibold text-foreground">
          Agendar Direto
        </h2>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onVoltar}>
          <ChevronLeft />
          Voltar à pendência
        </Button>
      </div>
      <div className="grid items-end gap-3 px-4 py-3 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
        <CampoEscritorio valor={previa.escritorio} onChange={(escritorio) => onMudar({ escritorio })} />
        <CampoGrupo valor={previa.grupo} onChange={(grupo) => onMudar({ grupo })} obrigatorio={previa.escritorio !== ESCRITORIO_EX_CLIENTE} />
        <ChaveRisco ligado={previa.demandaRisco} onChange={(demandaRisco) => onMudar({ demandaRisco })} />
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Nada é gravado até enviar: ao enviar, a publicação sai da controladoria e as tarefas vão para a conferência.
      </p>
    </Painel>
  );
  return (
    // Altura da tela, como no jurídico: publicação e tarefas rolam cada uma na sua coluna.
    <div className="min-w-0 lg:h-full">
      {escritorioValido ? (
        <EditorVistagem
          key={`${previa.id}|${previa.escritorio}|${previa.ci ?? ""}`}
          id={previa.id}
          navegacao={navegacao}
          onAbrir={onAbrir}
          onConcluida={onEnviada}
          onTransferida={onVoltar}
          onVoltar={onVoltar}
          resolucao={{ escritorio: previa.escritorio, grupo: previa.grupo.trim() || undefined, demandaRisco: previa.demandaRisco, ci: previa.ci }}
          antesDasTarefas={dadosDaPendencia}
        />
      ) : (
        <div className="space-y-3">
          {dadosDaPendencia}
          <Painel>
            <Vazio icone={ListChecks} titulo="Escolha o escritório">
              A lista de tarefas do VIOS depende da área: escolha o escritório responsável acima.
            </Vazio>
          </Painel>
        </div>
      )}
    </div>
  );
}

function Controladoria() {
  const [dados, setDados] = useState<PendenciasControladoria | null>(null);
  const [erro, setErro] = useState("");
  const [triando, setTriando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "sucesso" | "info" | "erro"; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  /** Data da publicação (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataPublicacao, setDataPublicacao] = useState("");
  /** Data da divulgação no diário (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataImportacao, setDataImportacao] = useState("");
  const [aba, setAba] = useState<Aba | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  /** A fila abre recolhida, como nas outras abas: a pendência ocupa a largura toda. */
  const [filaRecolhida, setFilaRecolhida] = useState(true);
  /** No celular a fila e a pendência não cabem juntas: mostra a fila só quando pedida. */
  const [listaNoCelular, setListaNoCelular] = useState(false);
  /** Publicação que a controladoria liberou para vistar aqui mesmo, no modal do jurídico. */
  const [agendando, setAgendando] = useState<({ id: string; numero: string } & PreviaAgendamento) | null>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/controladoria");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as pendências.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as pendências.");
      setDados({ pendentes: [], exClientes: [] });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function rodarTriagem() {
    setTriando(true);
    setAviso(null);
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/triagem", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha na triagem.");
      const resumo = corpo as TriagemResumo & { sugestoes?: { geradas?: number } };
      const sugeridas = resumo.sugestoes?.geradas ? ` ${resumo.sugestoes.geradas} sem pasta ganharam dados sugeridos.` : "";
      setAviso(
        resumo.triadas
          ? {
              tom: "sucesso",
              texto: `${resumo.triadas} publicação(ões) triada(s): ${resumo.juridico} para o jurídico, ${resumo.pendentes} ainda pendente(s)${resumo.descartadas ? `, ${resumo.descartadas} descartada(s)` : ""}.${sugeridas}`,
            }
          : { tom: "info", texto: `Nada novo para triar.${sugeridas}` }
      );
      await carregar();
    } catch (e) {
      setAviso({ tom: "erro", texto: e instanceof Error ? e.message : "Falha na triagem." });
    } finally {
      setTriando(false);
    }
  }

  // Data da publicação: filtra a fila e a contagem das abas.
  const datasDasPendencias = useMemo(() => (dados?.pendentes ?? []).map((p) => p.dataPublicacao), [dados]);
  const dataAtiva = dataNaLista(dataPublicacao, datasDasPendencias);
  const importacoesDasPendencias = useMemo(() => (dados?.pendentes ?? []).map((p) => p.dataImportacao), [dados]);
  const importacaoAtiva = dataNaLista(dataImportacao, importacoesDasPendencias);
  const pendentesNaData = useMemo(
    () =>
      (dados?.pendentes ?? []).filter(
        (p) => (!dataAtiva || p.dataPublicacao === dataAtiva) && (!importacaoAtiva || p.dataImportacao === importacaoAtiva)
      ),
    [dados, dataAtiva, importacaoAtiva]
  );

  const porAba = useMemo(() => {
    const total: Record<Aba, number> = { sem_pasta: 0, varias_pastas: 0, dados: 0 };
    for (const p of pendentesNaData) {
      const destino = abaDaPendencia(p.pendencia);
      if (destino) total[destino] += 1;
    }
    return total;
  }, [pendentesNaData]);

  // Sem escolha, abre a primeira aba que tem pendência.
  const abaAtiva: Aba = aba ?? ABAS.find((item) => porAba[item.valor] > 0)?.valor ?? "sem_pasta";
  const abasVisiveis = ABAS.filter((item) => item.valor !== "dados" || porAba.dados > 0 || abaAtiva === "dados");

  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(() => new Map((dados?.pendentes ?? []).map((p) => [p.id, camposDaPublicacao(p)])), [dados]);

  // Mais antigas primeiro: o prazo já está correndo.
  const fila = useMemo(
    () =>
      pendentesNaData
        .filter((p) => abaDaPendencia(p.pendencia) === abaAtiva)
        .filter((p) => combinaCampos(camposDeBusca.get(p.id) ?? [], busca))
        .sort((a, b) => (a.dataPublicacao ?? "").localeCompare(b.dataPublicacao ?? "") || (a.linhaArquivo ?? 0) - (b.linhaArquivo ?? 0)),
    [pendentesNaData, abaAtiva, busca, camposDeBusca]
  );
  const ordem = fila.map((p) => p.id);
  const buscando = busca.trim() !== "";
  // Buscar não troca a pendência aberta: os resultados aparecem na fila e a pessoa escolhe (como na Conferência).
  const fixaNaBusca = buscando && selecionada ? ((dados?.pendentes ?? []).find((p) => p.id === selecionada) ?? null) : null;
  const indiceAberta = selecionada && ordem.includes(selecionada) ? ordem.indexOf(selecionada) : fixaNaBusca ? -1 : ordem.length ? 0 : -1;
  const publicacaoAberta = indiceAberta >= 0 ? fila[indiceAberta] : fixaNaBusca;
  const aberta = publicacaoAberta?.id ?? null;
  const navegacaoAberta: Navegacao = {
    posicao: Math.max(indiceAberta + 1, 0),
    total: ordem.length,
    anterior: indiceAberta >= 0 ? (ordem[indiceAberta - 1] ?? null) : null,
    proxima: indiceAberta >= 0 ? (ordem[indiceAberta + 1] ?? null) : null,
  };
  const filaAberta = !filaRecolhida || buscando;
  // Na busca, quantas acham em cada aba: o que está na outra aba vira um atalho na fila.
  const buscaPorAba = useMemo(() => {
    if (!buscando) return null;
    const total: Record<Aba, number> = { sem_pasta: 0, varias_pastas: 0, dados: 0 };
    for (const p of pendentesNaData) {
      const destino = abaDaPendencia(p.pendencia);
      if (destino && combinaCampos(camposDeBusca.get(p.id) ?? [], busca)) total[destino] += 1;
    }
    return total;
  }, [buscando, pendentesNaData, camposDeBusca, busca]);

  function mudarBusca(texto: string) {
    // Prende a pendência aberta antes de filtrar, para ela não pular para o primeiro resultado.
    if (!selecionada && aberta) setSelecionada(aberta);
    setBusca(texto);
    if (texto.trim()) setListaNoCelular(true);
  }

  function abrir(id: string) {
    setSelecionada(id);
    setAviso(null);
    setListaNoCelular(false);
  }

  const maisAntiga = useMemo(
    () =>
      (dados?.pendentes ?? [])
        .map((p) => p.dataPublicacao)
        .filter((data): data is string => Boolean(data))
        .sort()[0] ?? null,
    [dados]
  );

  function removerResolvida(id: string, resultado: string) {
    const publicacao = dados?.pendentes.find((p) => p.id === id);
    const posicao = ordem.indexOf(id);
    // Segue para a próxima da fila (ou a anterior, se era a última).
    setSelecionada(ordem[posicao + 1] ?? ordem[posicao - 1] ?? null);
    setDados((atual) => (atual ? { ...atual, pendentes: atual.pendentes.filter((p) => p.id !== id) } : atual));
    setAviso({ tom: "sucesso", texto: `${publicacao ? numeroProcesso(publicacao) : "Publicação"} ${resultado}.` });
  }

  // "Agendar Direto": abre a vistagem com a pendência ainda na triagem; nada muda até as tarefas serem enviadas.
  const agendarDireto: AoAgendar = (publicacao, previa) => {
    setAviso(null);
    setAgendando({ id: publicacao.id, numero: numeroProcesso(publicacao), ...previa });
  };

  /** Tarefas enviadas: a pendência saiu da triagem e a vistagem foi para a conferência. */
  function agendamentoEnviado() {
    if (!agendando) return;
    const { id } = agendando;
    setAgendando(null);
    removerResolvida(id, "agendada direto pela controladoria: as tarefas foram para a conferência");
  }

  return (
    <div className="space-y-4">
      <AvisoArquivoDoDia
        acao={
          <Button asChild size="sm" variant="outline" className="-my-1 shrink-0">
            <Link href="/operacoes-legais/vistagem/base">Abrir Gestão das publicações</Link>
          </Button>
        }
      />

      {/* O tipo de pendência fica no topo, como as abas da Conferência; os filtros e a triagem à direita. */}
      <BarraAba
        resumo={
          <div className="space-y-1">
            <Segmented
              label="Tipo de pendência"
              value={abaAtiva}
              options={abasVisiveis.map((item) => ({
                value: item.valor,
                label: dados ? `${item.rotulo} ${porAba[item.valor]}` : item.rotulo,
                icon: ICONE_ABA[item.valor],
              }))}
              onChange={(valor) => {
                setAba(valor);
                setSelecionada(null);
              }}
            />
            {maisAntiga ? (
              <p className="text-xs text-muted-foreground" title="O prazo corre enquanto a pendência não é resolvida.">
                Mais antiga publicada em <span className="font-medium tabular-nums text-foreground">{formatarData(maisAntiga)}</span>
              </p>
            ) : null}
          </div>
        }
      >
        {!filaAberta ? (
          <Button type="button" variant="outline" className="hidden lg:inline-flex" onClick={() => setFilaRecolhida(false)}>
            <PanelLeftOpen />
            Mostrar fila
          </Button>
        ) : null}
        <Busca
          value={busca}
          onChange={(evento) => mudarBusca(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && ordem[0]) abrir(ordem[0]);
            if (evento.key === "Escape") mudarBusca("");
          }}
          placeholder="Processo, CI, grupo, parte ou intimado"
          aria-label="Buscar publicação"
        />
        <FiltroData rotulo="Data Publicação" datas={datasDasPendencias} valor={dataAtiva} onChange={setDataPublicacao} />
        <FiltroData rotulo="Data da importação" datas={importacoesDasPendencias} valor={importacaoAtiva} onChange={setDataImportacao} />
        <Button variant="outline" onClick={rodarTriagem} disabled={triando} title="Tria de novo o que ainda está pendente, com o SIOE">
          {triando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          Rodar triagem agora
        </Button>
      </BarraAba>

      {aviso ? (
        <Aviso
          tom={aviso.tom}
          acao={
            <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
              <X />
            </Button>
          }
        >
          {aviso.texto}
        </Aviso>
      ) : null}

      {dados === null ? (
        <Painel>
          <Carregando rotulo="Carregando pendências" />
        </Painel>
      ) : erro ? (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar as pendências"
          acao={
            <Button
              size="sm"
              variant="outline"
              className="-my-1 shrink-0"
              onClick={() => {
                setDados(null);
                void carregar();
              }}
            >
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : fila.length === 0 && !(buscando && publicacaoAberta) ? (
        <Painel>
          {buscando ? (
            <Vazio icone={SearchX} titulo="Nenhuma pendência com essa busca">
              <Button variant="link" className="h-auto p-0" onClick={() => mudarBusca("")}>
                Limpar busca
              </Button>
            </Vazio>
          ) : (
            <Vazio icone={ClipboardCheck} titulo={dados.pendentes.length ? "Nada nesta aba" : "Nenhuma pendência de triagem"}>
              {dados.pendentes.length ? "Veja as outras abas no topo." : "Tudo o que chegou foi encaminhado para uma área."}
            </Vazio>
          )}
        </Painel>
      ) : (
        // Uma pendência por vez, como a Conferência: a fila fica recolhida e as setas da faixa andam entre as pendências.
        <div
          className={cn(
            "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem] lg:grid-rows-[minmax(0,1fr)]",
            filaAberta ? "lg:grid-cols-[minmax(270px,330px)_minmax(0,1fr)]" : "lg:grid-cols-1"
          )}
        >
          <Painel
            aria-label={buscando ? "Resultados da busca" : "Pendências"}
            className={cn("lg:flex lg:h-full lg:flex-col", publicacaoAberta && !listaNoCelular && "hidden lg:flex", !filaAberta && "lg:hidden")}
          >
            {buscando ? (
              <div className="flex items-center gap-2 border-b border-[#e6eef0] bg-[#f2fbfb] px-4 py-2">
                <Search className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs text-[#285f7a]" aria-live="polite">
                  <span className="font-semibold tabular-nums">{fila.length}</span> {fila.length === 1 ? "resultado" : "resultados"} para{" "}
                  <span className="font-semibold">“{busca.trim()}”</span>
                </span>
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => mudarBusca("")} aria-label="Limpar a busca" title="Limpar a busca">
                  <X />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-b border-[#e6eef0] px-4 py-2">
                <span className="flex-1 text-xs font-medium text-muted-foreground">
                  Fila <span className="tabular-nums">· {fila.length}</span> <span className="font-normal">· mais antigas primeiro</span>
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="hidden lg:inline-flex"
                  onClick={() => setFilaRecolhida(true)}
                  aria-label="Recolher a fila"
                  title="Recolher a fila"
                >
                  <PanelLeftClose />
                </Button>
              </div>
            )}
            <ul className="max-h-[70vh] divide-y divide-[#eef3f5] overflow-y-auto lg:max-h-none lg:flex-1">
              {buscando && publicacaoAberta && indiceAberta < 0 && fila.length ? (
                <li className="px-4 py-2 text-[11px] text-muted-foreground">A pendência aberta ao lado não está nos resultados. Escolha uma da lista.</li>
              ) : null}
              {buscaPorAba
                ? ABAS.filter((item) => item.valor !== abaAtiva && buscaPorAba[item.valor] > 0).map((item) => {
                    const Icone = ICONE_ABA[item.valor];
                    return (
                      <li key={item.valor}>
                        <button
                          type="button"
                          onClick={() => {
                            setAba(item.valor);
                            setSelecionada(null);
                          }}
                          className="flex w-full items-center gap-2 bg-[#fafcfc] px-4 py-2.5 text-left text-xs font-medium text-[#347796] hover:bg-[#47cdd0]/10"
                        >
                          <Icone className="size-3.5 shrink-0" aria-hidden />
                          {buscaPorAba[item.valor]} em “{item.rotulo}”
                          <ChevronRight className="ml-auto size-3.5" aria-hidden />
                        </button>
                      </li>
                    );
                  })
                : null}
              {fila.map((publicacao) => (
                <li key={publicacao.id}>
                  <LinhaFila publicacao={publicacao} aberta={publicacao.id === aberta} onAbrir={() => abrir(publicacao.id)} />
                </li>
              ))}
            </ul>
          </Painel>

          <div className={cn("min-w-0 lg:h-full lg:min-h-0", (!publicacaoAberta || listaNoCelular) && "hidden lg:block")}>
            {publicacaoAberta && agendando?.id === publicacaoAberta.id ? (
              // Agendar Direto: a mesma tela do jurídico (publicação à esquerda, tarefas à direita), sem sair daqui.
              <AgendarDireto
                previa={agendando}
                navegacao={navegacaoAberta}
                onAbrir={abrir}
                onMudar={(mudanca) => setAgendando({ ...agendando, ...mudanca })}
                onEnviada={agendamentoEnviado}
                onVoltar={() => setAgendando(null)}
              />
            ) : publicacaoAberta ? (
              <DetalhePendencia
                key={publicacaoAberta.id}
                resumo={publicacaoAberta}
                navegacao={navegacaoAberta}
                onAbrir={abrir}
                onResolvida={removerResolvida}
                onAgendar={agendarDireto}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function ControladoriaClient() {
  return (
    <AcessoOperacoesLegais>
      <Controladoria />
    </AcessoOperacoesLegais>
  );
}
