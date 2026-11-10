"use client";

import { useEffect, useMemo, useState, type ElementType, type KeyboardEvent, type ReactNode } from "react";
import {
  Bot,
  Check,
  CircleAlert,
  CircleCheck,
  FileText,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  CAMPOS_DA_CAPA,
  montarCapa,
  resumoDaCapa,
  ROTULO_DA_FONTE,
  type CampoDaCapa,
  type CapaDoDataJud,
  type CapaParaAbertura,
  type ChaveDaCapa,
  type DefinicaoDoCampo,
  type FonteDaCapa,
  type GrupoDaCapa,
  type ListasDoVios,
  type PedidoDeAbertura,
  rotuloDoCampoDoRobo,
  type StatusDaFonte,
} from "@/lib/vistagem/capa-abertura";
import { Aviso, campoClasse, Secao } from "./ui";

export type EstadoDataJud = { carregando: true } | { carregando: false; resultado: (CapaDoDataJud & { ms: number }) | null; erro: string | null };

/** Os pedidos de abertura ao robô (o mais novo primeiro) e o envio de um novo. */
export interface EstadoDaAbertura {
  pedidos: PedidoDeAbertura[];
  enviando: boolean;
  erro: string;
}

const NA_FILA = new Set<PedidoDeAbertura["status"]>(["pendente", "enviado", "processando"]);

/** Grava ou desfaz a edição de um campo; devolve a mensagem de erro (ou null). */
export type AoEditarCampo = (chave: ChaveDaCapa, edicao: { valor: string } | { desfazer: true }) => Promise<string | null>;

const COR_DA_FONTE: Record<FonteDaCapa, string> = {
  cnj: "text-slate-500",
  regra: "text-slate-500",
  djen: "text-[#2b7a8c]",
  esaj: "text-[#2b7a8c]",
  datajud: "text-[#2b7a8c]",
  triagem: "text-[#5b5891]",
  pastas: "text-[#5b5891]",
  editado: "text-sky-700",
  falta: "text-red-600",
};

/** Campos curtos dividem a linha; os longos ocupam a largura do cartão. */
const LARGOS = new Set<ChaveDaCapa>(["orgao", "acao", "cliente", "partesAtivas", "partesPassivas", "escritorio", "etiqueta", "materias"]);

/** Quais campos ocupam a linha inteira: os largos e o curto que ficaria sem par (antes de um largo ou no fim). */
function camposLargos(campos: CampoDaCapa[]): Set<ChaveDaCapa> {
  const largos = new Set<ChaveDaCapa>();
  let coluna = 0;
  campos.forEach((campo, indice) => {
    const proximoLargo = indice + 1 >= campos.length || LARGOS.has(campos[indice + 1].chave);
    if (LARGOS.has(campo.chave) || (coluna === 0 && proximoLargo)) {
      largos.add(campo.chave);
      coluna = 0;
    } else coluna = 1 - coluna;
  });
  return largos;
}

const segundos = (ms: number) => `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Lê o JSON da resposta; página de erro (HTML do servidor ou da Vercel) vira uma mensagem legível. */
async function lerJson<T>(resposta: Response, padrao: string): Promise<T> {
  const texto = await resposta.text();
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    throw new Error(`${padrao} (o servidor respondeu ${resposta.status}).`);
  }
  if (!resposta.ok) throw new Error((corpo as { error?: string } | null)?.error ?? `${padrao} (${resposta.status}).`);
  return corpo as T;
}

/**
 * Sem pasta (possível abertura): o resumo da capa que o Orquestra montaria para abrir a pasta no VIOS e, num diálogo,
 * a capa inteira para conferir e editar (lápis). As edições ficam gravadas na publicação; nada vai para o VIOS ainda.
 */
export function CapaParaAberturaDePasta({ publicacaoId }: { publicacaoId: string }) {
  const [capa, setCapa] = useState<CapaParaAbertura | null>(null);
  const [erro, setErro] = useState("");
  const [datajud, setDatajud] = useState<EstadoDataJud>({ carregando: true });
  const [recarga, setRecarga] = useState(0);
  const [aberta, setAberta] = useState(false);
  const [abertura, setAbertura] = useState<EstadoDaAbertura>({ pedidos: [], enviando: false, erro: "" });
  const url = `/api/operacoes-legais/vistagem/publicacoes/${publicacaoId}/capa`;
  const naFila = abertura.pedidos[0] ? NA_FILA.has(abertura.pedidos[0].status) : false;

  // Pedidos ao robô: lê ao abrir e, enquanto o último estiver na fila, de novo a cada 10 s.
  useEffect(() => {
    let cancelado = false;
    const ler = () =>
      authFetch(`${url}/abrir`)
        .then((resposta) => lerJson<{ pedidos: PedidoDeAbertura[] }>(resposta, "Falha ao consultar o robô"))
        .then((corpo) => {
          if (!cancelado) setAbertura((atual) => ({ ...atual, pedidos: corpo.pedidos }));
        })
        .catch(() => undefined);
    void ler();
    const relogio = naFila ? setInterval(ler, 10_000) : null;
    return () => {
      cancelado = true;
      if (relogio) clearInterval(relogio);
    };
  }, [url, naFila]);

  async function simular() {
    setAbertura((atual) => ({ ...atual, enviando: true, erro: "" }));
    try {
      const resposta = await authFetch(`${url}/abrir`, { method: "POST" });
      const corpo = await lerJson<{ pedidos: PedidoDeAbertura[] }>(resposta, "Falha ao pedir a abertura");
      setAbertura({ pedidos: corpo.pedidos, enviando: false, erro: "" });
    } catch (e) {
      setAbertura((atual) => ({ ...atual, enviando: false, erro: e instanceof Error ? e.message : "Falha ao pedir a abertura." }));
    }
  }

  // A tela monta um destes por publicação (key): o estado começa vazio; "Buscar de novo" zera antes de recarregar.
  function buscarDeNovo() {
    setCapa(null);
    setErro("");
    setDatajud({ carregando: true });
    setRecarga((valor) => valor + 1);
  }

  useEffect(() => {
    let cancelado = false;
    authFetch(url)
      .then((resposta) => lerJson<CapaParaAbertura>(resposta, "Falha ao montar a capa"))
      .then((corpo) => {
        if (!cancelado) setCapa(corpo);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Falha ao montar a capa.");
      });
    authFetch(`${url}/datajud`)
      .then((resposta) => lerJson<{ datajud: CapaDoDataJud & { ms: number } }>(resposta, "Falha ao consultar o DataJud"))
      .then((corpo) => {
        if (!cancelado) setDatajud({ carregando: false, resultado: corpo.datajud, erro: null });
      })
      .catch((e: unknown) => {
        if (!cancelado) setDatajud({ carregando: false, resultado: null, erro: e instanceof Error ? e.message : "Falha ao consultar o DataJud." });
      });
    return () => {
      cancelado = true;
    };
  }, [url, recarga]);

  const editar: AoEditarCampo = async (chave, edicao) => {
    try {
      const resposta = await authFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave, ...edicao }),
      });
      const corpo = await lerJson<{ ajustes: CapaParaAbertura["ajustes"] }>(resposta, "Falha ao gravar a edição");
      setCapa((atual) => (atual ? { ...atual, ajustes: corpo.ajustes } : atual));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Falha ao gravar a edição.";
    }
  };

  return (
    <>
      <ResumoDaCapaView
        capa={capa}
        erro={erro}
        datajud={datajud}
        onAbrir={() => setAberta(true)}
        onBuscarDeNovo={buscarDeNovo}
        abertura={abertura}
        onSimular={simular}
      />
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent
          className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-6xl"
          onOpenAutoFocus={(evento) => evento.preventDefault()}
          // Esc dentro de um campo em edição cancela a edição, não fecha a capa.
          onEscapeKeyDown={(evento) => {
            if ((evento.target as HTMLElement | null)?.closest?.("[data-editando]")) evento.preventDefault();
          }}
        >
          {capa ? (
            <CapaDaAberturaView capa={capa} datajud={datajud} onEditar={editar} onBuscarDeNovo={buscarDeNovo} Titulo={DialogTitle} Descricao={DialogDescription} />
          ) : (
            <div className="p-6">
              <DialogTitle className="text-base">Capa para a abertura no VIOS</DialogTitle>
              <DialogDescription className="mt-2">{erro || "Montando a capa…"}</DialogDescription>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function camposDaCapa(capa: CapaParaAbertura, datajud: EstadoDataJud): CampoDaCapa[] {
  const doDataJud = !datajud.carregando && datajud.resultado?.achou ? datajud.resultado : null;
  return montarCapa({ ...capa.dados, datajud: doDataJud }, { ajustes: capa.ajustes, listas: capa.listas });
}

/* ------------------------------------------------------------------------------------------------- resumo (coluna) */

/** O resumo na coluna da resolução: o que falta, o que conferir e os campos principais, com o botão da capa inteira. */
export function ResumoDaCapaView({
  capa,
  erro,
  datajud,
  onAbrir,
  onBuscarDeNovo,
  abertura,
  onSimular,
}: {
  capa: CapaParaAbertura | null;
  erro: string;
  datajud: EstadoDataJud;
  onAbrir: () => void;
  onBuscarDeNovo: () => void;
  abertura?: EstadoDaAbertura;
  onSimular?: () => void;
}) {
  const campos = useMemo(() => (capa ? camposDaCapa(capa, datajud) : []), [capa, datajud]);
  const { faltando, conferir, editados } = resumoDaCapa(campos);
  const valor = (chave: ChaveDaCapa) => campos.find((campo) => campo.chave === chave)?.valor ?? "—";

  return (
    <Secao
      titulo="Abertura de pasta no VIOS"
      id="capa-abertura-resumo"
      acao={
        <Button type="button" size="xs" variant="ghost" onClick={onBuscarDeNovo} disabled={!capa && !erro} aria-label="Buscar a capa de novo">
          <RefreshCw />
          Buscar de novo
        </Button>
      }
    >
      {erro ? (
        <Aviso tom="erro">{erro}</Aviso>
      ) : !capa ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Montando a capa (DJEN, e-SAJ e pastas do grupo)…
        </p>
      ) : (
        <div className="space-y-3">
          {faltando.length ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="flex items-center gap-1.5 font-medium">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                {faltando.length === 1 ? "Falta 1 obrigatório do VIOS" : `Faltam ${faltando.length} obrigatórios do VIOS`}
              </p>
              <p className="mt-0.5 text-xs">{faltando.map((campo) => campo.campo).join(" · ")}</p>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              Obrigatórios do VIOS preenchidos
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {conferir.length ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                <TriangleAlert className="size-3" aria-hidden />
                {conferir.length} para conferir
              </span>
            ) : null}
            {editados.length ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
                <PencilLine className="size-3" aria-hidden />
                {editados.length} editado(s)
              </span>
            ) : null}
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            {(["acao", "valor", "responsavel", "auxiliar", "materias"] as const).map((chave) => (
              <div key={chave} className="contents">
                <dt className="text-muted-foreground">{CAMPOS_DA_CAPA[chave].rotulo.replace(" (R$)", "")}</dt>
                <dd className="truncate font-medium text-foreground" title={valor(chave)}>
                  {chave === "valor" && valor(chave) !== "—" ? `R$ ${valor(chave)}` : valor(chave)}
                </dd>
              </div>
            ))}
          </dl>
          <Button type="button" className="w-full" variant="outline" size="sm" onClick={onAbrir}>
            <FileText />
            Conferir e editar a capa
          </Button>
          {abertura && onSimular ? (
            <BlocoDoRobo abertura={abertura} faltando={faltando.length} onSimular={onSimular} />
          ) : (
            <p className="text-[11px] text-muted-foreground">Prévia: nada é gravado no VIOS ainda.</p>
          )}
        </div>
      )}
    </Secao>
  );
}

/** O robô: pede a simulação da abertura (preenche o cadastro no VIOS sem gravar) e mostra o último pedido. */
export function BlocoDoRobo({ abertura, faltando, onSimular }: { abertura: EstadoDaAbertura; faltando: number; onSimular: () => void }) {
  const [ultimo] = abertura.pedidos;
  const naFila = ultimo ? NA_FILA.has(ultimo.status) : false;
  return (
    <div className="space-y-2 border-t border-[#e6eef0] pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
        <Bot className="size-3.5" aria-hidden />
        Robô
      </p>
      <Button type="button" className="w-full" size="sm" onClick={onSimular} disabled={Boolean(faltando) || naFila || abertura.enviando}>
        {abertura.enviando ? <LoaderCircle className="animate-spin" /> : <Bot />}
        Simular a abertura no VIOS
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {faltando
          ? "Preencha os obrigatórios do VIOS para simular."
          : "O robô preenche o cadastro do processo no VIOS com esta capa e não grava: é só o teste da abertura."}
      </p>
      {abertura.erro ? <Aviso tom="erro">{abertura.erro}</Aviso> : null}
      {ultimo ? <PedidoDoRobo pedido={ultimo} /> : null}
    </div>
  );
}

function PedidoDoRobo({ pedido }: { pedido: PedidoDeAbertura }) {
  const quandoPediu = quando(pedido.criadoEm);
  if (NA_FILA.has(pedido.status)) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-[#dce9eb] bg-[#f6f9fa] px-3 py-2 text-xs text-[#285f7a]" role="status">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden />
        {pedido.status === "processando" ? "O robô está preenchendo o cadastro no VIOS…" : `Na fila do robô (pedido em ${quandoPediu})…`}
      </p>
    );
  }
  if (pedido.status === "erro") {
    return (
      <Aviso tom="erro" titulo={`O robô parou (pedido em ${quandoPediu})`}>
        {pedido.erro ?? "Erro sem mensagem."}
      </Aviso>
    );
  }
  const resultado = pedido.resultado ?? {};
  const preenchidos = Object.keys(resultado.preenchidos ?? {}).length;
  const faltou = resultado.nao_encontrados ?? [];
  const recusaria = resultado.recusaria ?? [];
  const tudoCerto = !faltou.length && !recusaria.length;
  return (
    <Aviso
      tom={tudoCerto ? "sucesso" : "alerta"}
      titulo={
        tudoCerto
          ? `Simulação ok: ${preenchidos} campos preenchidos e o VIOS aceitaria gravar`
          : `Simulação: ${preenchidos} campos preenchidos, ${faltou.length + recusaria.length} pendência(s)`
      }
    >
      <span className="block text-xs">
        {pedido.simulado ? "Nada foi gravado no VIOS." : "Pedido de verdade."} Pedido em {quandoPediu}
        {pedido.autor ? ` por ${pedido.autor}` : ""}.
      </span>
      {faltou.length ? (
        <ul className="mt-1 space-y-0.5 text-xs">
          {faltou.map((item) => (
            <li key={`${item.campo}-${item.pedido}`}>
              <span className="font-medium">{rotuloDoCampoDoRobo(item.campo)}</span>: {item.motivo ?? `"${item.pedido}" não está na lista do VIOS`}
              {item.parecidas?.length ? ` (parecidas: ${item.parecidas.slice(0, 3).join("; ")})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {recusaria.length ? <span className="mt-1 block text-xs">O VIOS recusaria: {recusaria.join(", ")}.</span> : null}
    </Aviso>
  );
}

/* ------------------------------------------------------------------------------------------------ a capa (diálogo) */

/** A capa inteira, por grupo, com o lápis em cada campo. `Titulo`/`Descricao` são os do diálogo (h2/p no teste). */
export function CapaDaAberturaView({
  capa,
  datajud,
  onEditar,
  onBuscarDeNovo,
  Titulo = "h2",
  Descricao = "p",
}: {
  capa: CapaParaAbertura;
  datajud: EstadoDataJud;
  onEditar: AoEditarCampo;
  onBuscarDeNovo: () => void;
  Titulo?: ElementType;
  Descricao?: ElementType;
}) {
  const campos = useMemo(() => camposDaCapa(capa, datajud), [capa, datajud]);
  const { faltando, conferir, editados } = resumoDaCapa(campos);
  const [editando, setEditando] = useState<ChaveDaCapa | null>(null);
  const porGrupo = (grupo: GrupoDaCapa) => campos.filter((campo) => campo.grupo === grupo);
  const grupo = capa.dados.grupo;

  return (
    <>
      <header className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-[#e6eef0] px-5 py-4 pr-12">
        <div className="min-w-0 flex-1">
          <Titulo className="text-base font-semibold text-foreground">Capa para a abertura no VIOS</Titulo>
          <Descricao className="mt-1 text-sm text-muted-foreground">
            <span className="tabular-nums">{capa.dados.numero}</span>
            {grupo ? ` · ${grupo}` : ""} · prévia: nada é gravado no VIOS. As edições ficam salvas nesta publicação.
          </Descricao>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {faltando.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <CircleAlert className="size-3" aria-hidden />
              {faltando.length} obrigatório(s) vazio(s)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <CircleCheck className="size-3" aria-hidden />
              Obrigatórios preenchidos
            </span>
          )}
          {conferir.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              <TriangleAlert className="size-3" aria-hidden />
              {conferir.length} para conferir
            </span>
          ) : null}
          {editados.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
              <PencilLine className="size-3" aria-hidden />
              {editados.length} editado(s)
            </span>
          ) : null}
          <Button type="button" size="xs" variant="ghost" onClick={onBuscarDeNovo}>
            <RefreshCw />
            Buscar de novo
          </Button>
        </div>
      </header>

      {!capa.podeEditar ? (
        <Aviso tom="alerta" className="mx-5 mt-4">
          A edição liga quando a coluna das edições existir no banco (SQL da capa). Por enquanto, só leitura.
        </Aviso>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f9fa] px-5 py-4">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <CartaoDoGrupo titulo="Processo" campos={porGrupo("processo")} {...{ capa, editando, setEditando, onEditar }} />
          <div className="grid gap-4">
            <CartaoDoGrupo titulo="Partes e cliente" campos={porGrupo("partes")} {...{ capa, editando, setEditando, onEditar }} />
            <CartaoDoGrupo titulo="Escritório" campos={porGrupo("escritorio")} {...{ capa, editando, setEditando, onEditar }} />
          </div>
        </div>
        <Listas listas={capa.listas} />
      </div>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[#e6eef0] px-5 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Fontes</span>
        <Fonte nome="DJEN" status={capa.fontes.djen} detalhe={capa.dados.djen ? `${capa.dados.djen.comunicacoes} comunicação(ões)` : undefined} />
        <Fonte nome="e-SAJ" status={capa.fontes.esaj} detalhe={capa.dados.esaj?.valor != null ? "com o valor da ação" : "sem o valor da ação"} vazio="só no TJSP" />
        {datajud.carregando ? (
          <span className="inline-flex items-center gap-1">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            DataJud · consultando (leva até 1 min)…
          </span>
        ) : (
          <Fonte
            nome="DataJud"
            status={datajud.resultado ? { ok: datajud.resultado.achou, ms: datajud.resultado.ms, erro: datajud.resultado.erro } : { ok: false, ms: 0, erro: datajud.erro }}
          />
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <span className="text-red-600">*</span> obrigatório no VIOS
        </span>
      </footer>
    </>
  );
}

function Fonte({ nome, status, detalhe, vazio }: { nome: string; status: StatusDaFonte | null; detalhe?: string; vazio?: string }) {
  if (!status) return vazio ? <span>{nome} · {vazio}</span> : null;
  const Icone = status.ok ? CircleCheck : CircleAlert;
  return (
    <span className="inline-flex items-center gap-1">
      <Icone className={cn("size-3.5 shrink-0", status.ok ? "text-emerald-600" : "text-amber-600")} aria-hidden />
      {nome} · {status.ok ? detalhe ?? "ok" : status.erro}
      {status.ms ? ` · ${segundos(status.ms)}` : ""}
    </span>
  );
}

/** As listas do VIOS que viram sugestão ao editar (usuários, matérias e sistemas). */
function Listas({ listas }: { listas: ListasDoVios }) {
  return (
    <>
      {(Object.keys(listas) as (keyof ListasDoVios)[]).map((nome) => (
        <datalist key={nome} id={`capa-lista-${nome}`}>
          {listas[nome].map((opcao) => (
            <option key={opcao} value={opcao} />
          ))}
        </datalist>
      ))}
    </>
  );
}

type PropsDoCartao = {
  titulo: string;
  campos: CampoDaCapa[];
  capa: CapaParaAbertura;
  editando: ChaveDaCapa | null;
  setEditando: (chave: ChaveDaCapa | null) => void;
  onEditar: AoEditarCampo;
};

function CartaoDoGrupo({ titulo, campos, capa, editando, setEditando, onEditar }: PropsDoCartao) {
  const pendentes = campos.filter((campo) => campo.conferir).length;
  const largos = camposLargos(campos);
  return (
    <section aria-label={titulo} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#e6eef0] px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">{titulo}</h3>
        {pendentes ? <span className="text-[11px] font-medium text-amber-700">{pendentes} para conferir</span> : null}
      </div>
      <div className="grid grid-cols-1 gap-px bg-[#eef3f4] sm:grid-cols-2">
        {campos.map((campo) => (
          <CampoView
            key={campo.chave}
            campo={campo}
            largo={largos.has(campo.chave)}
            podeEditar={capa.podeEditar}
            editando={editando === campo.chave}
            onEditar={() => setEditando(campo.chave)}
            onFechar={() => setEditando(null)}
            onGravar={onEditar}
          />
        ))}
      </div>
    </section>
  );
}

function CampoView({
  campo,
  largo,
  podeEditar,
  editando,
  onEditar,
  onFechar,
  onGravar,
}: {
  campo: CampoDaCapa;
  largo: boolean;
  podeEditar: boolean;
  editando: boolean;
  onEditar: () => void;
  onFechar: () => void;
  onGravar: AoEditarCampo;
}) {
  const vazioObrigatorio = campo.obrigatorio && !campo.valor;
  const [desfazendo, setDesfazendo] = useState(false);
  const [erro, setErro] = useState("");

  async function desfazer() {
    setDesfazendo(true);
    setErro("");
    const falha = await onGravar(campo.chave, { desfazer: true });
    setDesfazendo(false);
    if (falha) setErro(falha);
  }

  return (
    <div
      className={cn(
        "group relative min-w-0 bg-white px-4 py-2.5",
        largo && "sm:col-span-2",
        vazioObrigatorio ? "shadow-[inset_3px_0_0_#ef4444] bg-red-50/40" : campo.conferir ? "shadow-[inset_3px_0_0_#f59e0b] bg-amber-50/30" : null,
        editando && "bg-[#f2fbfb] shadow-[inset_3px_0_0_#47cdd0]"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={campo.campo}>
          {campo.campo}
          {campo.obrigatorio ? <span className="ml-0.5 text-red-600" aria-label="obrigatório">*</span> : null}
        </span>
        <span className={cn("shrink-0 text-[10px] font-semibold uppercase tracking-wide", COR_DA_FONTE[campo.fonte])}>{ROTULO_DA_FONTE[campo.fonte]}</span>
        {!editando ? (
          <button
            type="button"
            onClick={onEditar}
            disabled={!podeEditar}
            aria-label={`Editar ${campo.campo}`}
            title={podeEditar ? `Editar ${campo.campo}` : "A edição liga depois da SQL da capa"}
            className="-my-1 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-[#3e84a8] opacity-60 transition hover:bg-[#47cdd0]/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#47cdd0]/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30 group-hover:opacity-100"
          >
            <PencilLine className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {editando ? (
        <EditorDoCampo campo={campo} onFechar={onFechar} onGravar={onGravar} />
      ) : (
        <>
          <p
            className={cn(
              "mt-0.5 line-clamp-3 break-words text-sm font-medium text-foreground",
              !campo.valor && "font-normal italic",
              !campo.valor && (vazioObrigatorio ? "text-red-700" : "text-muted-foreground")
            )}
            title={campo.valor ?? undefined}
          >
            {campo.valor ? (campo.chave === "valor" ? `R$ ${campo.valor}` : campo.valor) : vazioObrigatorio ? "Obrigatório: preencher" : "Vazio"}
          </p>
          {campo.editado ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-sky-800">
              <span>
                Editado{campo.editado.por ? ` por ${campo.editado.por}` : ""} em {quando(campo.editado.em)}
              </span>
              {campo.original?.valor ? (
                <span className="truncate text-muted-foreground" title={campo.original.valor}>
                  · antes: {campo.original.valor}
                </span>
              ) : null}
              <button
                type="button"
                onClick={desfazer}
                disabled={desfazendo || !podeEditar}
                className="inline-flex items-center gap-0.5 font-medium text-[#3e84a8] underline-offset-2 hover:underline disabled:opacity-50"
              >
                {desfazendo ? <LoaderCircle className="size-3 animate-spin" aria-hidden /> : <RotateCcw className="size-3" aria-hidden />}
                Desfazer
              </button>
            </p>
          ) : campo.nota ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{campo.nota}</p>
          ) : null}
          {erro ? <p className="mt-1 text-[11px] text-red-700">{erro}</p> : null}
        </>
      )}
    </div>
  );
}

/** O campo em edição: seletor (lista fechada), sugestões (listas do VIOS) ou texto; Enter grava, Esc cancela. */
function EditorDoCampo({ campo, onFechar, onGravar }: { campo: CampoDaCapa; onFechar: () => void; onGravar: AoEditarCampo }) {
  const definicao: DefinicaoDoCampo = CAMPOS_DA_CAPA[campo.chave];
  const [valor, setValor] = useState(campo.valor ?? "");
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const rotulo = `Novo valor de ${campo.campo}`;

  async function gravar() {
    if (gravando) return;
    setGravando(true);
    setErro("");
    const falha = await onGravar(campo.chave, { valor });
    setGravando(false);
    if (falha) setErro(falha);
    else onFechar();
  }

  const teclas = (evento: KeyboardEvent) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      onFechar();
    } else if (evento.key === "Enter" && (!definicao.longo || evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      void gravar();
    }
  };

  let controle: ReactNode;
  if (definicao.opcoes) {
    const opcoes: readonly string[] = definicao.opcoes;
    controle = (
      <select autoFocus aria-label={rotulo} className={cn(campoClasse, "h-9")} value={valor} onChange={(evento) => setValor(evento.target.value)} onKeyDown={teclas}>
        <option value="">—</option>
        {valor && !opcoes.includes(valor) ? <option value={valor}>{valor}</option> : null}
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    );
  } else if (definicao.longo) {
    controle = (
      <textarea
        autoFocus
        aria-label={rotulo}
        rows={3}
        className={cn(campoClasse, "h-auto py-2")}
        value={valor}
        onChange={(evento) => setValor(evento.target.value)}
        onKeyDown={teclas}
      />
    );
  } else {
    controle = (
      <input
        autoFocus
        aria-label={rotulo}
        className={cn(campoClasse, "h-9")}
        value={valor}
        list={definicao.lista ? `capa-lista-${definicao.lista}` : undefined}
        placeholder={definicao.lista ? "Escreva para buscar na lista do VIOS" : undefined}
        onChange={(evento) => setValor(evento.target.value)}
        onKeyDown={teclas}
      />
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5" data-editando>
      {controle}
      <div className="flex items-center gap-1.5">
        <Button type="button" size="xs" onClick={() => void gravar()} disabled={gravando}>
          {gravando ? <LoaderCircle className="animate-spin" /> : <Check />}
          Salvar
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={onFechar} disabled={gravando}>
          <X />
          Cancelar
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">{definicao.longo ? "Ctrl+Enter salva" : "Enter salva"} · Esc cancela</span>
      </div>
      {erro ? <p className="text-[11px] text-red-700">{erro}</p> : null}
    </div>
  );
}

