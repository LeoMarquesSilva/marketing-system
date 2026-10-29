"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FolderSearch,
  FolderX,
  Folders,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  Scale,
  Search,
  SearchX,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserRoundX,
  Wand2,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { clienteNoTexto, pastaSugerida, verificacoesSemPasta, type SituacaoVerificacao } from "@/lib/vistagem/controladoria";
import { criarCalendarioDePrazo, feriadosNacionais, somarDiasUteis } from "@/lib/vistagem/dias-uteis";
import { ESCRITORIOS, ESCRITORIO_EX_CLIENTE, type PastaSioe, type Pendencia } from "@/lib/vistagem/triagem";
import type { SugestaoTriagem } from "@/lib/vistagem/sugestao-triagem";
import type { PendenciasControladoria, PublicacaoResumo, ResolucaoPendencia, TriagemResumo } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { AvisoArquivoDoDia } from "./aviso-arquivo-do-dia";
import { LeitorPublicacao } from "./leitor-publicacao";
import { IconeArea, LogoGrupo } from "./marcas";
import { DadosPasta, PENDENCIAS, formatarData, formatarDataHora } from "./publicacao-ui";
import { ReguaDatas } from "./regua-datas";
import { Seletor } from "./seletor";
import {
  Aviso,
  BarraAba,
  Busca,
  Campo,
  Carregando,
  Indicador,
  Indicadores,
  Painel,
  Secao,
  Selo,
  Vazio,
  linhaLista,
} from "./ui";

/**
 * As abas seguem o que chega da triagem: sem pasta (possível abertura), mais de uma pasta e, quando houver, dados
 * faltando. Os ex-clientes ficam numa aba à parte, só para consulta: a controladoria vista na fila do Jurídico.
 */
type Aba = "sem_pasta" | "varias_pastas" | "dados" | "ex_clientes";

const ABAS: { valor: Aba; rotulo: string; pendencias: Pendencia[] }[] = [
  { valor: "sem_pasta", rotulo: "Sem pasta · possível abertura", pendencias: ["sem_pasta"] },
  { valor: "varias_pastas", rotulo: "Mais de uma pasta", pendencias: ["varias_pastas"] },
  { valor: "dados", rotulo: "Sem área ou grupo", pendencias: ["sem_area", "sem_grupo"] },
  { valor: "ex_clientes", rotulo: "Ex-clientes", pendencias: ["ex_cliente"] },
];

const ICONE_ABA = { sem_pasta: FolderX, varias_pastas: Folders, dados: ListChecks, ex_clientes: UserRoundX } as const;

/** Fila da Vistagem para onde vai o que a controladoria vista (ex-clientes e pendências que ela assume). */
const JURIDICO_PATH = "/operacoes-legais/vistagem/juridico";

function abaDaPendencia(pendencia: Pendencia | null): Aba | null {
  return ABAS.find((aba) => pendencia && aba.pendencias.includes(pendencia))?.valor ?? null;
}

function numeroProcesso(publicacao: PublicacaoResumo): string {
  return publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
}

/** Busca por número do processo (a partir de 4 dígitos), tribunal, órgão, pasta, grupo, cliente ou intimado. */
function combinaBusca(publicacao: PublicacaoResumo, busca: string): boolean {
  const texto = busca.trim().toLowerCase();
  if (!texto) return true;
  const digitos = busca.replace(/\D/g, "");
  if (digitos.length >= 4 && numeroProcesso(publicacao).replace(/\D/g, "").includes(digitos)) return true;
  return [
    publicacao.tribunal,
    publicacao.djenOrgao,
    publicacao.escritorioResponsavel,
    publicacao.grupoCliente,
    publicacao.cliente,
    publicacao.pastaCi,
    publicacao.sugestaoTriagem?.grupo,
    publicacao.sugestaoTriagem?.cliente,
    ...publicacao.pastasCandidatas.map((pasta) => pasta.grupoCliente),
    ...publicacao.djenIntimados,
  ].some((campo) => campo?.toLowerCase().includes(texto));
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

/** Pasta do SIOE como opção de uma lista: CI, vínculo e situação; grupo e cliente; área e responsável. */
function LinhaPasta({ pasta, acao }: { pasta: PastaSioe; acao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-3 py-3 text-xs text-muted-foreground">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="tabular-nums text-sm font-semibold text-foreground">CI {pasta.ci}</span>
          {pasta.vinculo ? <span>{pasta.vinculo}</span> : null}
          {pasta.situacao ? <span>· {pasta.situacao}</span> : null}
        </p>
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
        Rechecado no SIOE {publicacao.triadaEm ? `em ${formatarDataHora(publicacao.triadaEm)}` : "na última triagem"}; a cada busca do arquivo da Kurier ele procura de
        novo, caso a pasta tenha sido aberta.
      </p>
    </Secao>
  );
}

/* ------------------------------------------------------------ comparador */

/** Mais de uma pasta: as pastas lado a lado, com a sugerida marcada e o cliente que aparece no texto. */
function ComparadorPastas({ publicacao, onResolvida }: { publicacao: PublicacaoResumo; onResolvida: (resultado: string) => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const candidatas = publicacao.pastasCandidatas;
  const sugerida = pastaSugerida(candidatas);
  const texto = [publicacao.teor, ...publicacao.djenIntimados].join(" ");

  async function usar(pasta: PastaSioe) {
    setOcupado(pasta.ci);
    setErro("");
    try {
      onResolvida(liberada(await resolver(publicacao.id, { ci: pasta.ci })));
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
          const ativa = !/encerrad|arquivad|baixad|extint/i.test(pasta.situacao ?? "");
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
              <Button size="sm" variant={destaque ? "default" : "outline"} className="mt-auto" onClick={() => usar(pasta)} disabled={ocupado !== null}>
                {ocupado === pasta.ci ? <LoaderCircle className="animate-spin" /> : <Check />}
                Usar esta pasta
              </Button>
            </li>
          );
        })}
      </ul>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
    </Secao>
  );
}

/* -------------------------------------------------------------- resolução */

/** Para onde vai a publicação: o jurídico de uma área, a própria controladoria (fila Operações Legais) ou o descarte. */
type Destino = "juridico" | "controladoria" | "descartar";

const ESCRITORIOS_DO_JURIDICO = ESCRITORIOS.filter((nome) => nome !== ESCRITORIO_EX_CLIENTE);

/**
 * Achou a pasta (CI) ou escolhe o destino: jurídico (escritório e grupo), controladoria (ela mesma vista, na fila
 * Operações Legais do Jurídico) ou descarte, com o motivo.
 */
function Resolucao({ publicacao, onResolvida }: { publicacao: PublicacaoResumo; onResolvida: (resultado: string) => void }) {
  const [ci, setCi] = useState("");
  const [previa, setPrevia] = useState<{ pasta: PastaSioe; escritorioSugerido: string | null } | null>(null);
  // Sem pasta: os campos já vêm com a sugestão (processo citado, parte cliente ou IA); a controladoria confere.
  const sugestao = publicacao.pendencia === "sem_pasta" ? publicacao.sugestaoTriagem : null;
  const sugeriuControladoria = sugestao?.escritorio === ESCRITORIO_EX_CLIENTE;
  const [destino, setDestino] = useState<Destino>(sugeriuControladoria ? "controladoria" : "juridico");
  const [escritorio, setEscritorio] = useState(sugestao?.escritorio && !sugeriuControladoria ? sugestao.escritorio : "");
  const [grupo, setGrupo] = useState(publicacao.grupoCliente ?? sugestao?.grupo ?? "");
  const [demandaRisco, setDemandaRisco] = useState(Boolean(publicacao.demandaRisco ?? sugestao?.demandaRisco));
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function executar(acao: () => Promise<string>) {
    setOcupado(true);
    setErro("");
    try {
      onResolvida(await acao());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(false);
    }
  }

  const liberar = (entrada: ResolucaoPendencia) => executar(async () => liberada(await resolver(publicacao.id, entrada)));

  const descartar = () =>
    executar(async () => {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/pendencias/${publicacao.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "descartar", motivo }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao descartar.");
      return "descartada";
    });

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

  const campoGrupo = (rotulo: string) => (
    <Campo rotulo={rotulo}>
      <div className="relative">
        {grupo.trim() ? <LogoGrupo grupo={grupo} tamanho="xs" className="absolute left-2.5 top-1/2 -translate-y-1/2" /> : null}
        <Input
          value={grupo}
          onChange={(evento) => setGrupo(evento.target.value)}
          placeholder="Grupo do cliente"
          aria-label="Grupo do cliente"
          className={cn(grupo.trim() && "pl-9")}
        />
      </div>
    </Campo>
  );

  const campoRisco = (
    <label className="flex min-h-10 w-fit cursor-pointer items-center gap-2.5 text-sm text-foreground">
      <input type="checkbox" checked={demandaRisco} onChange={(evento) => setDemandaRisco(evento.target.checked)} className="size-4 accent-[#347796]" />
      Demanda de risco
    </label>
  );

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
              Buscar no SIOE
            </Button>
          </div>
          {previa ? (
            <div className={LISTA_PASTAS}>
              <LinhaPasta
                pasta={previa.pasta}
                acao={
                  <Button size="sm" className="self-start" onClick={() => liberar({ ci: previa.pasta.ci })} disabled={ocupado}>
                    <Check />
                    Usar · {previa.escritorioSugerido ?? "definir escritório"}
                  </Button>
                }
              />
            </div>
          ) : null}
        </Secao>
      ) : null}

      <Secao titulo={variasPastas ? "Nenhuma serve? Escolha o destino" : publicacao.pastaCi ? "Para onde vai" : "Sem pasta: para onde vai"} id={`${base}-destino`}>
        <Segmented
          label="Destino da publicação"
          value={destino}
          options={[
            { value: "juridico" as Destino, label: "Jurídico", icon: Scale },
            { value: "controladoria" as Destino, label: "Controladoria", icon: ClipboardCheck },
            { value: "descartar" as Destino, label: "Descartar", icon: Trash2 },
          ]}
          onChange={(valor) => {
            setDestino(valor);
            setErro("");
          }}
        />

        {destino !== "descartar" && sugestao ? <NotaSugestao sugestao={sugestao} /> : null}

        {destino === "juridico" ? (
          <>
            <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-1">
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">Escritório responsável</span>
                <Seletor
                  rotulo="Escritório responsável"
                  placeholder="Escolha o escritório"
                  valor={escritorio}
                  onChange={setEscritorio}
                  opcoes={ESCRITORIOS_DO_JURIDICO.map((nome) => ({ valor: nome, rotulo: nome, icone: <IconeArea area={nome} /> }))}
                />
              </div>
              {campoGrupo("Grupo do cliente")}
            </div>
            {campoRisco}
            <Button
              className="w-full"
              onClick={() => liberar({ escritorio, grupo, demandaRisco, ci: publicacao.pastaCi ?? undefined })}
              disabled={ocupado || !escritorio || !grupo.trim()}
            >
              {ocupado ? <LoaderCircle className="animate-spin" /> : <Send />}
              Liberar para o jurídico
            </Button>
          </>
        ) : destino === "controladoria" ? (
          <>
            <p className="text-xs text-muted-foreground">
              A controladoria vista a publicação na fila <span className="font-medium text-foreground">Operações Legais</span> do Jurídico, como os
              ex-clientes. O grupo é opcional.
            </p>
            {campoGrupo("Grupo do cliente (opcional)")}
            {campoRisco}
            <Button
              className="w-full"
              onClick={() =>
                liberar({ escritorio: ESCRITORIO_EX_CLIENTE, grupo: grupo.trim() || undefined, demandaRisco, ci: publicacao.pastaCi ?? undefined })
              }
              disabled={ocupado}
            >
              {ocupado ? <LoaderCircle className="animate-spin" /> : <ClipboardCheck />}
              Mandar para a controladoria
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Para publicação que não é do escritório. Ela sai da fila e fica como descartada na Captura, com o motivo.</p>
            <Campo rotulo="Motivo do descarte">
              <Textarea
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ex.: processo de terceiro, sem cliente do escritório."
              />
            </Campo>
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={descartar}
              disabled={ocupado || !motivo.trim()}
            >
              {ocupado ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Descartar publicação
            </Button>
          </>
        )}
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

/**
 * A pendência aberta: régua, leitura completa e, ao lado, a verificação/comparação e a resolução. O ex-cliente abre
 * só para consulta: a pasta e o atalho para a fila do Jurídico, onde a controladoria vista.
 */
function DetalhePendencia({
  resumo,
  navegacao,
  onAbrir,
  onResolvida,
  consulta = false,
}: {
  resumo: PublicacaoResumo;
  navegacao: Navegacao;
  onAbrir: (id: string) => void;
  onResolvida: (id: string, resultado: string) => void;
  consulta?: boolean;
}) {
  // A lista traz o teor resumido: o leitor precisa do texto inteiro.
  const [publicacao, setPublicacao] = useState<PublicacaoResumo>(resumo);
  const [copiado, setCopiado] = useState(false);
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
  const variasPastas = !consulta && publicacao.pastasCandidatas.length > 1;

  return (
    <Painel aria-labelledby="pendencia-titulo" className="@container">
      <div className="space-y-3 border-b border-[#e6eef0] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="pendencia-titulo" className="tabular-nums text-base font-semibold text-foreground">
            {numero}
          </h2>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title={copiado ? "Copiado" : "Copiar o número para buscar no VIOS"}
            aria-label="Copiar o número do processo"
            onClick={() => {
              void navigator.clipboard?.writeText(numero).then(() => {
                setCopiado(true);
                window.setTimeout(() => setCopiado(false), 1500);
              });
            }}
          >
            {copiado ? <Check /> : <Copy />}
          </Button>
          {publicacao.tribunal ? <Selo tom="marca">{publicacao.tribunal}</Selo> : null}
          {publicacao.pendencia ? <Selo tom={consulta ? "neutro" : "alerta"}>{PENDENCIAS[publicacao.pendencia]}</Selo> : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={!navegacao.anterior}
              onClick={() => navegacao.anterior && onAbrir(navegacao.anterior)}
              aria-label="Pendência anterior"
              title="Pendência anterior"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-14 text-center text-xs tabular-nums text-muted-foreground">
              {navegacao.posicao} de {navegacao.total}
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={!navegacao.proxima}
              onClick={() => navegacao.proxima && onAbrir(navegacao.proxima)}
              aria-label="Próxima pendência"
              title="Próxima pendência"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
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

      <div className="grid @4xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="min-w-0">
          {variasPastas ? <ComparadorPastas key={publicacao.id} publicacao={publicacao} onResolvida={resolvida} /> : null}
          <LeitorPublicacao publicacao={publicacao} ocultarIdComunicacao className={cn(variasPastas && "border-t border-[#e6eef0]")} />
        </div>
        <div className="min-w-0 border-t border-[#e6eef0] bg-[#fafcfc] @4xl:border-l @4xl:border-t-0">
          {consulta ? (
            <Secao titulo="Ex-cliente" id={`ex-cliente-${publicacao.id}`}>
              <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
              <p className="text-xs text-muted-foreground">
                Publicação de ex-cliente com advogado do escritório: a controladoria vista na fila{" "}
                <span className="font-medium text-foreground">Operações Legais</span> do Jurídico.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={JURIDICO_PATH}>
                  <ExternalLink />
                  Abrir a fila do Jurídico
                </Link>
              </Button>
            </Secao>
          ) : (
            <>
              {publicacao.pendencia === "sem_pasta" ? <VerificacaoSemPasta publicacao={publicacao} /> : null}
              <Resolucao key={publicacao.id} publicacao={publicacao} onResolvida={resolvida} />
            </>
          )}
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
        {publicacao.tribunal ? <Selo>{publicacao.tribunal}</Selo> : null}
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

function Controladoria() {
  const [dados, setDados] = useState<PendenciasControladoria | null>(null);
  const [erro, setErro] = useState("");
  const [triando, setTriando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "sucesso" | "info" | "erro"; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);

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

  const porAba = useMemo(() => {
    const total: Record<Aba, number> = { sem_pasta: 0, varias_pastas: 0, dados: 0, ex_clientes: dados?.exClientes.length ?? 0 };
    for (const p of dados?.pendentes ?? []) {
      const destino = abaDaPendencia(p.pendencia);
      if (destino && destino !== "ex_clientes") total[destino] += 1;
    }
    return total;
  }, [dados]);

  // Sem escolha, abre a primeira aba que tem pendência (ex-clientes só se não houver nenhuma).
  const abaAtiva: Aba =
    aba ?? ABAS.find((item) => item.valor !== "ex_clientes" && porAba[item.valor] > 0)?.valor ?? (porAba.ex_clientes ? "ex_clientes" : "sem_pasta");
  const abasVisiveis = ABAS.filter((item) => item.valor !== "dados" || porAba.dados > 0 || abaAtiva === "dados");
  const consulta = abaAtiva === "ex_clientes";

  // Mais antigas primeiro: o prazo já está correndo.
  const fila = useMemo(
    () =>
      (abaAtiva === "ex_clientes" ? dados?.exClientes ?? [] : (dados?.pendentes ?? []).filter((p) => abaDaPendencia(p.pendencia) === abaAtiva))
        .filter((p) => combinaBusca(p, busca))
        .sort((a, b) => (a.dataPublicacao ?? "").localeCompare(b.dataPublicacao ?? "") || (a.linhaArquivo ?? 0) - (b.linhaArquivo ?? 0)),
    [dados, abaAtiva, busca]
  );
  const ordem = fila.map((p) => p.id);
  const aberta = selecionada && ordem.includes(selecionada) ? selecionada : ordem[0] ?? null;
  const indiceAberta = aberta ? ordem.indexOf(aberta) : -1;
  const publicacaoAberta = fila[indiceAberta] ?? null;

  const maisAntiga = useMemo(
    () =>
      (dados?.pendentes ?? [])
        .map((p) => p.dataPublicacao)
        .filter((data): data is string => Boolean(data))
        .sort()[0] ?? null,
    [dados]
  );
  const buscando = busca.trim() !== "";

  function removerResolvida(id: string, resultado: string) {
    const publicacao = dados?.pendentes.find((p) => p.id === id);
    const posicao = ordem.indexOf(id);
    // Segue para a próxima da fila (ou a anterior, se era a última).
    setSelecionada(ordem[posicao + 1] ?? ordem[posicao - 1] ?? null);
    setDados((atual) => (atual ? { ...atual, pendentes: atual.pendentes.filter((p) => p.id !== id) } : atual));
    setAviso({ tom: "sucesso", texto: `${publicacao ? numeroProcesso(publicacao) : "Publicação"} ${resultado}.` });
  }

  return (
    <div className="space-y-6">
      <AvisoArquivoDoDia
        acao={
          <Button asChild size="sm" variant="outline" className="-my-1 shrink-0">
            <Link href="/operacoes-legais/vistagem">Abrir Captura</Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <BarraAba resumo="O que a triagem com o SIOE não conseguiu encaminhar sozinha. Confira se a pasta existe mesmo, escolha a certa ou informe os dados para liberar ao jurídico.">
          <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Processo, CI, grupo ou intimado" aria-label="Buscar publicação" />
          <Button variant="outline" onClick={rodarTriagem} disabled={triando}>
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
      </div>

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
      ) : (
        <>
          <Indicadores>
            <Indicador icone={ClipboardCheck} rotulo="Para resolver" valor={dados.pendentes.length} tom={dados.pendentes.length ? "alerta" : "neutro"}>
              {maisAntiga ? `Publicação mais antiga: ${formatarData(maisAntiga)}` : "Nenhuma pendência de triagem"}
            </Indicador>
            <Indicador icone={FolderX} rotulo="Sem pasta no VIOS" valor={porAba.sem_pasta}>
              Possível abertura de pasta
            </Indicador>
            <Indicador icone={FolderSearch} rotulo="Mais de uma pasta" valor={porAba.varias_pastas}>
              {porAba.dados ? `${porAba.dados} sem área ou grupo` : "Escolha a pasta certa"}
            </Indicador>
            <Indicador icone={UserRoundX} rotulo="Ex-clientes" valor={dados.exClientes.length}>
              Vistagem da controladoria
            </Indicador>
          </Indicadores>

          <div className="space-y-3">
            <Segmented
              label="Tipo de pendência"
              value={abaAtiva}
              options={abasVisiveis.map((item) => ({ value: item.valor, label: `${item.rotulo} ${porAba[item.valor]}`, icon: ICONE_ABA[item.valor] }))}
              onChange={(valor) => {
                setAba(valor);
                setSelecionada(null);
              }}
            />

            {fila.length === 0 && !buscando ? (
              <Painel>
                {consulta ? (
                  <Vazio icone={UserRoundX} titulo="Nenhuma publicação de ex-cliente" />
                ) : (
                  <Vazio icone={ClipboardCheck} titulo={dados.pendentes.length ? "Nada nesta aba" : "Nenhuma pendência de triagem"}>
                    {dados.pendentes.length ? null : "Tudo o que chegou foi encaminhado para uma área."}
                  </Vazio>
                )}
              </Painel>
            ) : fila.length === 0 ? (
              <Painel>
                <Vazio icone={SearchX} titulo={consulta ? "Nenhum ex-cliente com essa busca" : "Nenhuma pendência com essa busca"}>
                  <Button variant="link" className="h-auto p-0" onClick={() => setBusca("")}>
                    Limpar busca
                  </Button>
                </Vazio>
              </Painel>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
                <Painel aria-label={consulta ? "Ex-clientes" : "Pendências"} className="lg:sticky lg:top-4">
                  <div className="border-b border-[#e6eef0] px-4 py-2 text-xs font-medium text-muted-foreground">
                    {consulta ? "Ex-clientes" : "Fila"} <span className="tabular-nums">· {fila.length}</span>{" "}
                    <span className="font-normal">· mais antigas primeiro</span>
                  </div>
                  <ul className="max-h-[70vh] divide-y divide-[#eef3f5] overflow-y-auto">
                    {fila.map((publicacao) => (
                      <li key={publicacao.id}>
                        <LinhaFila
                          publicacao={publicacao}
                          aberta={publicacao.id === aberta}
                          onAbrir={() => {
                            setSelecionada(publicacao.id);
                            setAviso(null);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </Painel>

                {publicacaoAberta ? (
                  <DetalhePendencia
                    key={publicacaoAberta.id}
                    resumo={publicacaoAberta}
                    navegacao={{
                      posicao: indiceAberta + 1,
                      total: ordem.length,
                      anterior: ordem[indiceAberta - 1] ?? null,
                      proxima: ordem[indiceAberta + 1] ?? null,
                    }}
                    onAbrir={setSelecionada}
                    onResolvida={removerResolvida}
                    consulta={consulta}
                  />
                ) : null}
              </div>
            )}
          </div>
        </>
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
