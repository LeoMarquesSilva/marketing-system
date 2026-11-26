"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleSlash, Clock, Download, History, Landmark, LoaderCircle, RefreshCw, Repeat, Tags, Users, Video } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { alertasDaAudiencia, estadoNoVios, hojeEmBrasilia, local, pendenteNoVios, respostasDosConvites, somarDias, type Contexto } from "@/lib/audiencias/agenda";
import { ROTULO_MUDANCA, ROTULO_TIPO, type AlertaAudiencia, type Audiencia, type Papel, type TipoAudiencia } from "@/lib/audiencias/tipos";
import { cn } from "@/lib/utils";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import { IconeTribunal } from "../vistagem/marcas";
import { IconeOpcao, Seletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, campoClasse } from "../vistagem/ui";
import { AcessoPauta, Avatar, Dupla, LinkDaSala, LinkDoVios, Local, Modalidade, ResumoDoFiltro, SeloOrigem, SeloTipo, TextoComCi, TrocaDialog, cliente, diaPorExtenso, hora, mensagemDeErro, pautaApi, quando, textoDaOrigem, type DadosDaPauta } from "./comum";

const COLUNAS = "lg:grid lg:grid-cols-[4.5rem_minmax(0,1.5fr)_minmax(0,1.1fr)_7.5rem_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-4";
const PERIODOS = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
];

/** Os cartões do topo que filtram a lista ("" = todas do período). */
type CartaoPauta = "" | "mudaram" | "canceladas" | "semLink" | "cedo";
const ROTULO_CARTAO: Record<Exclude<CartaoPauta, "">, string> = {
  mudaram: "Mudaram no tribunal",
  canceladas: "Canceladas no PJe",
  semLink: "Online sem link",
  cedo: "Antes das 10h",
};

interface ComAlertas {
  aud: Audiencia;
  alertas: AlertaAudiencia[];
}

function noCartao(cartao: Exclude<CartaoPauta, "">, { aud, alertas }: ComAlertas): boolean {
  if (cartao === "canceladas") return aud.situacao === "cancelada";
  if (aud.situacao !== "designada") return false;
  if (cartao === "mudaram") return aud.mudancas.length > 0 && !aud.mudancaConferidaEm;
  if (cartao === "semLink") return alertas.some((x) => x.tipo === "sem_link");
  return alertas.some((x) => x.tipo === "cedo");
}

/** Contagem por valor, para os filtros (pessoa, tribunal, tipo). */
function contar<T>(itens: T[], chaves: (item: T) => (string | null | undefined)[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itens) for (const chave of new Set(chaves(item))) if (chave) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  return contagem;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A tarefa do VIOS desta audiência, pela última conferência. */
function textoDoVios(aud: Audiencia): string {
  const estado = estadoNoVios(aud);
  if (!aud.viosConferidoEm && !aud.viosInicio) return "Ainda não conferido";
  if (!aud.viosTarefaCi && !aud.viosInicio) return aud.situacao === "cancelada" ? "Nenhuma tarefa aberta" : "Nenhuma tarefa de audiência no VIOS";
  const v = aud.viosInicio ? local(aud.viosInicio) : null;
  const dia = v ? (v.hora === "00:00" ? `${v.dia.slice(8, 10)}/${v.dia.slice(5, 7)} (sem horário)` : quando(aud.viosInicio)) : "—";
  const situacao = aud.viosSituacao === "concluida" ? "concluída" : aud.viosSituacao ?? "";
  const ci = aud.viosTarefaCi ? `CI ${aud.viosTarefaCi} · ` : "";
  const nota = estado === "confere" ? " · confere" : "";
  return `${ci}${dia} · ${situacao}${nota}${aud.viosConferidoEm ? ` (cópia de ${quando(aud.viosConferidoEm)})` : ""}`;
}

export function PautaClient() {
  return (
    <AcessoPauta>
      <Pauta />
    </AcessoPauta>
  );
}

function Pauta() {
  const [periodo, setPeriodo] = useState("7");
  // Primeiro dia do período: hoje, ou um dia passado para ver pautas antigas (pedido da equipe, 26/11/2026).
  const [inicio, setInicio] = useState(() => hojeEmBrasilia());
  const [dados, setDados] = useState<DadosDaPauta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [tipo, setTipo] = useState("");
  const [cartao, setCartao] = useState<CartaoPauta>("");
  const [aberta, setAberta] = useState<Audiencia | null>(null);
  const [troca, setTroca] = useState<{ aud: Audiencia; papel: Papel } | null>(null);
  const dias = Number(periodo);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await pautaApi.get<DadosDaPauta>(`?de=${inicio}&ate=${somarDias(inicio, dias)}`));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, [inicio, dias]);
  const hoje = hojeEmBrasilia();
  const rotuloPeriodo = inicio === hoje ? `Próximos ${dias} dias` : `${dias} dias desde ${inicio.slice(8, 10)}/${inicio.slice(5, 7)}`;

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pessoas = useMemo(() => new Map((dados?.pessoas ?? []).map((p) => [p.id, p])), [dados]);
  const contexto: Contexto = useMemo(
    () => ({ pessoas, todas: dados?.audiencias ?? [], duracoes: dados?.duracoes, respostas: respostasDosConvites(dados?.convites ?? [], dados?.audiencias ?? []) }),
    [pessoas, dados]
  );

  // O período: as designadas e as canceladas no PJe que ainda pedem conferência no VIOS.
  const doPeriodo: ComAlertas[] = useMemo(
    () =>
      (dados?.audiencias ?? [])
        .filter((a) => a.situacao === "designada" || (a.situacao === "cancelada" && pendenteNoVios(a)))
        .map((aud) => ({ aud, alertas: alertasDaAudiencia(aud, contexto) })),
    [dados, contexto]
  );

  // Busca, pessoa, tribunal e tipo. Os cartões contam o que sobra; o cartão escolhido filtra mais um passo.
  const semCartao = useMemo(() => {
    const termo = semAcento(busca.trim());
    return doPeriodo.filter(({ aud: a }) => {
      if (pessoa && a.titularId !== pessoa && a.backupId !== pessoa) return false;
      if (tribunal && a.tribunal !== tribunal) return false;
      if (tipo && a.tipo !== tipo) return false;
      if (!termo) return true;
      const texto = semAcento(
        [a.cnj, cliente(a), a.orgao, a.viosTarefaCi, a.correspondente, a.titularId && pessoas.get(a.titularId)?.nomeVios, a.backupId && pessoas.get(a.backupId)?.nomeVios].filter(Boolean).join(" ")
      );
      return texto.includes(termo);
    });
  }, [doPeriodo, busca, pessoa, tribunal, tipo, pessoas]);

  const filtradas = useMemo(() => (cartao ? semCartao.filter((x) => noCartao(cartao, x)) : semCartao), [semCartao, cartao]);

  const porDia = useMemo(() => {
    const grupos = new Map<string, ComAlertas[]>();
    for (const x of filtradas) {
      const dia = local(x.aud.inicio).dia;
      grupos.set(dia, [...(grupos.get(dia) ?? []), x]);
    }
    return [...grupos.entries()];
  }, [filtradas]);

  const numeros = useMemo(
    () => ({
      total: semCartao.filter((x) => x.aud.situacao === "designada").length,
      mudaram: semCartao.filter((x) => noCartao("mudaram", x)).length,
      canceladas: semCartao.filter((x) => noCartao("canceladas", x)).length,
      semLink: semCartao.filter((x) => noCartao("semLink", x)).length,
      cedo: semCartao.filter((x) => noCartao("cedo", x)).length,
    }),
    [semCartao]
  );

  // Opções dos filtros, com a contagem do período (como na Vistagem).
  const porPessoa = useMemo(() => contar(doPeriodo, (x) => [x.aud.titularId, x.aud.backupId]), [doPeriodo]);
  const porTribunal = useMemo(() => contar(doPeriodo, (x) => [x.aud.tribunal]), [doPeriodo]);
  const porTipo = useMemo(() => contar(doPeriodo, (x) => [x.aud.tipo]), [doPeriodo]);

  const filtrosAtivos = [
    cartao ? ROTULO_CARTAO[cartao] : null,
    pessoa ? `Pessoa: ${pessoas.get(pessoa)?.nomeCurto ?? "—"}` : null,
    tribunal || null,
    tipo ? ROTULO_TIPO[tipo as TipoAudiencia] : null,
    busca.trim() ? `Busca: “${busca.trim()}”` : null,
  ].filter((f): f is string => Boolean(f));

  function limparFiltros() {
    setCartao("");
    setPessoa("");
    setTribunal("");
    setTipo("");
    setBusca("");
  }

  const alternar = (c: Exclude<CartaoPauta, "">) => () => setCartao((atual) => (atual === c ? "" : c));

  function atualizar(aud: Audiencia) {
    setDados((d) => (d ? { ...d, audiencias: d.audiencias.map((a) => (a.id === aud.id ? aud : a)) } : d));
    setAberta((a) => (a?.id === aud.id ? aud : a));
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const linhas: (string | null)[][] = [];
    for (const [dia, itens] of porDia) {
      linhas.push([diaPorExtenso(dia).toUpperCase()]);
      linhas.push(["CLIENTE", "HORÁRIO", "EVENTO", "LOCAL", "MODALIDADE", "PROCESSO", "RECLAMANTE", "RESPONSÁVEL", "LINK", "OBSERVAÇÃO"]);
      for (const { aud: a } of itens) {
        const titularTexto = a.correspondente?.trim() ? `${a.correspondente.trim()} (correspondente)` : a.titularId && pessoas.get(a.titularId)?.nomeCurto.split(" ")[0];
        const dupla = [titularTexto, a.backupId && pessoas.get(a.backupId)?.nomeCurto.split(" ")[0]].filter(Boolean).join("-");
        linhas.push([
          cliente(a),
          hora(a.inicio),
          a.tipoDescricao ?? ROTULO_TIPO[a.tipo],
          a.orgao,
          a.modalidadeTribunal === "presencial" ? "Presencial" : a.modalidadeTribunal === "hibrida" ? "Híbrida" : "Online",
          a.cnj,
          a.reclamanteIniciais,
          dupla,
          a.linkSala,
          [a.situacao === "cancelada" ? "CANCELADA NO PJE" : null, a.observacao].filter(Boolean).join(" · ") || null,
        ]);
      }
      linhas.push([]);
    }
    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Pauta");
    XLSX.writeFile(livro, `pauta-trabalhista-${hojeEmBrasilia()}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground" title="Escolha um dia passado para ver pautas antigas">
              A partir de
              <input type="date" className={cn(campoClasse, "h-9 w-[9.5rem] font-normal text-foreground")} value={inicio} max={somarDias(hoje, 365)} onChange={(e) => e.target.value && setInicio(e.target.value)} />
            </label>
            {inicio !== hoje ? (
              <Button variant="ghost" size="sm" onClick={() => setInicio(hoje)}>
                Hoje
              </Button>
            ) : null}
            <Segmented label="Período" value={periodo} options={PERIODOS} onChange={setPeriodo} />
            <Button variant="outline" onClick={() => void carregar()} disabled={carregando} title="Relê a pauta (as leituras do PJe e a conferência com o VIOS)">
              {carregando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Atualizar
            </Button>
          </div>
        }
      >
        <Button variant="outline" onClick={() => void exportar()} disabled={!porDia.length} title="Planilha da pauta, com os filtros aplicados">
          <Download />
          Exportar Excel
        </Button>
      </BarraAba>

      <Indicadores className="lg:grid-cols-5">
        <Indicador icone={CalendarDays} rotulo={rotuloPeriodo} valor={dados ? numeros.total : "—"} ativo={!cartao} onClick={() => setCartao("")} dica="Todas as audiências do período" />
        <Indicador icone={Repeat} rotulo={ROTULO_CARTAO.mudaram} valor={dados ? numeros.mudaram : "—"} tom={numeros.mudaram ? "perigo" : "neutro"} ativo={cartao === "mudaram"} onClick={alternar("mudaram")} dica="Mostrar só as que mudaram no PJe e ainda não foram conferidas" />
        <Indicador icone={CircleSlash} rotulo={ROTULO_CARTAO.canceladas} valor={dados ? numeros.canceladas : "—"} tom={numeros.canceladas ? "perigo" : "neutro"} ativo={cartao === "canceladas"} onClick={alternar("canceladas")} dica="Mostrar só as canceladas no PJe que ainda pedem conferência no VIOS" />
        <Indicador icone={Video} rotulo={ROTULO_CARTAO.semLink} valor={dados ? numeros.semLink : "—"} tom={numeros.semLink ? "alerta" : "neutro"} ativo={cartao === "semLink"} onClick={alternar("semLink")} dica="Mostrar só as online ainda sem link da sala" />
        <Indicador icone={Clock} rotulo={ROTULO_CARTAO.cedo} valor={dados ? numeros.cedo : "—"} tom={numeros.cedo ? "alerta" : "neutro"} ativo={cartao === "cedo"} onClick={alternar("cedo")} dica="Mostrar só as que começam antes das 10h" />
      </Indicadores>

      <div className="flex flex-wrap items-center gap-2">
        <Busca placeholder="Buscar cliente, processo, pessoa ou CI" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => (e.key === "Escape" ? setBusca("") : null)} className="sm:w-72" aria-label="Buscar audiência" />
        <Seletor
          rotulo="Pessoa"
          className="sm:w-56"
          valor={pessoa}
          onChange={setPessoa}
          todos={{ rotulo: "Todas as pessoas", contagem: doPeriodo.length, icone: <IconeOpcao icone={Users} /> }}
          opcoes={(dados?.pessoas ?? [])
            .filter((p) => p.fazAudiencia && p.ativo)
            .map((p) => ({ valor: p.id, rotulo: p.nomeCurto, contagem: porPessoa.get(p.id) ?? 0, icone: <Avatar pessoa={p} className="size-5" /> }))}
        />
        <Seletor
          rotulo="Tribunal"
          className="sm:w-56"
          valor={tribunal}
          onChange={setTribunal}
          todos={{ rotulo: "Todos os tribunais", contagem: doPeriodo.length, icone: <IconeOpcao icone={Landmark} /> }}
          opcoes={[...porTribunal.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
            .map(([sigla, quantidade]) => ({ valor: sigla, rotulo: sigla, descricao: descricaoDoTribunal(sigla), contagem: quantidade, icone: <IconeTribunal sigla={sigla} /> }))}
        />
        <Seletor
          rotulo="Tipo de audiência"
          className="sm:w-48"
          valor={tipo}
          onChange={setTipo}
          todos={{ rotulo: "Todos os tipos", contagem: doPeriodo.length, icone: <IconeOpcao icone={Tags} /> }}
          opcoes={(Object.keys(ROTULO_TIPO) as TipoAudiencia[])
            .filter((t) => porTipo.has(t))
            .map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t], contagem: porTipo.get(t) ?? 0, icone: <IconeOpcao icone={Tags} /> }))}
        />
      </div>

      <ResumoDoFiltro mostrando={filtradas.length} de={doPeriodo.length} unidade="audiências do período" filtros={filtrosAtivos} aoLimpar={limparFiltros} />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando && !dados ? <Carregando rotulo="Carregando a pauta" /> : null}
      {dados && !porDia.length ? (
        <Painel>
          {filtrosAtivos.length ? (
            <Vazio icone={CalendarDays} titulo="Nenhuma audiência com estes filtros">
              <Button variant="outline" size="sm" className="mt-1" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </Vazio>
          ) : (
            <Vazio icone={CalendarDays} titulo="Nenhuma audiência no período">
              A pauta é montada pelas leituras do PJe. Se o robô ainda não rodou, a última leitura aparece em Configurações.
            </Vazio>
          )}
        </Painel>
      ) : null}

      {porDia.map(([dia, itens]) => (
        <Painel key={dia}>
          <div className="flex items-center gap-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2.5 text-sm font-semibold">
            {diaPorExtenso(dia)}
            <span className="text-xs font-medium text-muted-foreground">
              {[
                itens.some((x) => x.aud.situacao === "designada") ? `${itens.filter((x) => x.aud.situacao === "designada").length} audiência(s)` : null,
                itens.some((x) => x.aud.situacao === "cancelada") ? `${itens.filter((x) => x.aud.situacao === "cancelada").length} cancelada(s) no PJe` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <div className={cn("hidden border-b border-[#e6eef0] px-4 py-2 text-xs font-medium text-muted-foreground", COLUNAS)}>
            <span>Hora</span>
            <span>Audiência</span>
            <span>Local</span>
            <span>Modalidade</span>
            <span>Titular e backup</span>
            <span>Link da sala</span>
            <span>Situação</span>
          </div>
          <ul>
            {itens.map(({ aud: a, alertas }) => {
              const cancelada = a.situacao === "cancelada";
              return (
                <li key={a.id} className="border-b border-[#e6eef0] last:border-b-0">
                  {/* Linha clicável (e não <button>) porque leva o link do VIOS dentro: link dentro de botão não é HTML válido. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setAberta(a)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                      e.preventDefault();
                      setAberta(a);
                    }}
                    className={cn("w-full cursor-pointer space-y-2 px-4 py-3 text-left hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none lg:space-y-0", COLUNAS, cancelada && "bg-[#fafcfc]")}
                  >
                    <span className={cn("block font-mono text-sm font-medium tabular-nums", cancelada && "text-muted-foreground line-through")}>{hora(a.inicio)}</span>
                    <span className="block min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <SeloTipo aud={a} />
                        <span className={cn("truncate text-sm font-semibold", cancelada && "text-muted-foreground line-through")}>{cliente(a)}</span>
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{a.cnj}</span>
                      <LinkDoVios aud={a} className="mt-0.5" />
                    </span>
                    <Local aud={a} />
                    <Modalidade aud={a} />
                    <Dupla aud={a} pessoas={pessoas} respostas={contexto.respostas?.get(a.id)} />
                    <LinkDaSala aud={a} />
                    <span className="flex flex-wrap gap-1">
                      <SeloOrigem aud={a} />
                      {cancelada ? <Selo tom="perigo">Cancelada no PJe</Selo> : null}
                      {a.mudancas.length && !a.mudancaConferidaEm && !cancelada ? <Selo tom="perigo" icone={Repeat}>{a.mudancas.map((m) => ROTULO_MUDANCA[m]).join(", ")}</Selo> : null}
                      {alertas.some((x) => x.tipo === "choque" || x.tipo === "deslocamento") ? <Selo tom="alerta">{alertas.find((x) => x.tipo === "choque") ? "Conflito de horário" : "Sem tempo de deslocamento"}</Selo> : null}
                      {alertas.some((x) => x.tipo === "recusou") ? <Selo tom="perigo">Titular recusou o convite</Selo> : null}
                      {alertas.some((x) => x.tipo === "cedo") ? <Selo tom="alerta" icone={Clock}>Antes das 10h</Selo> : null}
                      {!cancelada && !alertas.some((x) => x.grave) ? <Selo tom="marca">Designada</Selo> : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Painel>
      ))}

      <Detalhe
        aud={aberta}
        dados={dados}
        contexto={contexto}
        aoFechar={() => setAberta(null)}
        aoAtualizar={atualizar}
        aoTrocar={(aud, papel) => setTroca({ aud, papel })}
      />
      {dados ? <TrocaDialog aud={troca?.aud ?? null} papel={troca?.papel ?? "titular"} dados={dados} aberto={Boolean(troca)} aoFechar={() => setTroca(null)} aoTrocar={atualizar} /> : null}
    </div>
  );
}

function Detalhe({
  aud,
  dados,
  contexto,
  aoFechar,
  aoAtualizar,
  aoTrocar,
}: {
  aud: Audiencia | null;
  dados: DadosDaPauta | null;
  contexto: Contexto;
  aoFechar: () => void;
  aoAtualizar: (aud: Audiencia) => void;
  aoTrocar: (aud: Audiencia, papel: Papel) => void;
}) {
  const [campos, setCampos] = useState({ modalidadeEquipe: "", correspondente: "", observacao: "", linkSala: "" });
  const [historico, setHistorico] = useState<{ acao: string; de: string | null; para: string | null; motivo: string | null; feito_por: string | null; em: string }[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aud) return;
    setCampos({ modalidadeEquipe: aud.modalidadeEquipe ?? "", correspondente: aud.correspondente ?? "", observacao: aud.observacao ?? "", linkSala: aud.linkFonte === "manual" ? aud.linkSala ?? "" : "" });
    setErro(null);
    setHistorico(null);
    pautaApi
      .get<{ historico: NonNullable<typeof historico> }>(`/${aud.id}`)
      .then((r) => setHistorico(r.historico))
      .catch(() => setHistorico([]));
  }, [aud]);

  if (!aud || !dados) return null;
  const alertas = alertasDaAudiencia(aud, contexto);

  async function salvar() {
    if (!aud) return;
    setSalvando(true);
    setErro(null);
    try {
      const corpo: Record<string, unknown> = { correspondente: campos.correspondente || null, observacao: campos.observacao || null };
      if (aud.modalidadeTribunal === "hibrida") corpo.modalidadeEquipe = campos.modalidadeEquipe || null;
      if (!aud.linkSala || aud.linkFonte === "manual") corpo.linkSala = campos.linkSala || null;
      const { audiencia } = await pautaApi.patch<{ audiencia: Audiencia }>(`/${aud.id}`, corpo);
      aoAtualizar(audiencia);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function conferir() {
    if (!aud) return;
    setSalvando(true);
    try {
      await pautaApi.post(`/conferir`, { ids: [aud.id] });
      aoAtualizar({ ...aud, mudancaConferidaEm: new Date().toISOString() });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={Boolean(aud)} onOpenChange={(v) => (!v ? aoFechar() : null)}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#e6eef0] px-5 py-4 text-left">
          <DialogTitle>
            {ROTULO_TIPO[aud.tipo]} · {cliente(aud)}
          </DialogTitle>
          <DialogDescription>
            {diaPorExtenso(local(aud.inicio).dia)}, {hora(aud.inicio)} · <span className="font-mono">{aud.cnj}</span>
          </DialogDescription>
          <LinkDoVios aud={aud} className="mt-1 text-sm" />
          {textoDaOrigem(aud) ? <p className="mt-1 text-xs text-muted-foreground">{textoDaOrigem(aud)}</p> : null}
          {aud.tipoDescricao && aud.origem === "vios" ? <p className="mt-1 text-xs text-muted-foreground">No VIOS: {aud.tipoDescricao}</p> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {alertas.filter((a) => a.tipo !== "cedo").map((a) => (
            <Aviso key={a.tipo + a.texto} tom={a.grave ? "erro" : "alerta"}>
              <TextoComCi texto={a.texto} />
            </Aviso>
          ))}
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">No tribunal</dt>
            <dd>{aud.tipoDescricao ?? ROTULO_TIPO[aud.tipo]}</dd>
            <dt className="text-muted-foreground">Vara</dt>
            <dd>{[aud.orgao, aud.sala].filter(Boolean).join(" · ") || "—"}</dd>
            <dt className="text-muted-foreground">Modalidade</dt>
            <dd>
              <Modalidade aud={aud} />
            </dd>
            <dt className="text-muted-foreground">Link da sala</dt>
            <dd>
              <LinkDaSala aud={aud} />
              {aud.linkAnterior ? <p className="truncate font-mono text-xs text-muted-foreground line-through">{aud.linkAnterior}</p> : null}
            </dd>
            <dt className="text-muted-foreground">Reclamante</dt>
            <dd>{aud.reclamanteIniciais ?? "—"}</dd>
            <dt className="text-muted-foreground">DJEN</dt>
            <dd>{aud.djenConferidoEm ? (aud.djenData ? `Intimação de ${aud.djenData.slice(8, 10)}/${aud.djenData.slice(5, 7)}${aud.djenInicio ? ` · ${quando(aud.djenInicio)}` : ""}` : "Sem intimação com esta data") : "Ainda não conferido"}</dd>
            <dt className="text-muted-foreground">VIOS</dt>
            <dd>
              <TextoComCi texto={textoDoVios(aud)} />
            </dd>
          </dl>
          <div className="space-y-2 rounded-md border border-[#dce9eb] p-3">
            <div className="flex items-center justify-between gap-2">
              <Dupla aud={aud} pessoas={contexto.pessoas} respostas={contexto.respostas?.get(aud.id)} />
              <div className="flex flex-col gap-1.5">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => aoTrocar(aud, "titular")}
                  disabled={aud.situacao !== "designada" || Boolean(aud.correspondente?.trim())}
                  title={aud.correspondente?.trim() ? "O titular é o correspondente. Para pôr alguém do escritório, apague o correspondente e salve." : undefined}
                >
                  {aud.titularId || aud.correspondente?.trim() ? "Trocar titular" : "Definir titular"}
                </Button>
                <Button size="xs" variant="outline" onClick={() => aoTrocar(aud, "backup")} disabled={aud.situacao !== "designada"}>
                  {aud.backupId ? "Trocar backup" : "Definir backup"}
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {aud.modalidadeTribunal === "hibrida" ? (
              <label className="space-y-1.5">
                <span className="text-xs font-semibold">Como a equipe vai</span>
                <select className={cn(campoClasse, "h-9 w-full")} value={campos.modalidadeEquipe} onChange={(e) => setCampos({ ...campos, modalidadeEquipe: e.target.value })}>
                  <option value="">Escolher</option>
                  <option value="video">Online</option>
                  <option value="presencial">Presencial</option>
                </select>
              </label>
            ) : null}
            {!aud.linkSala || aud.linkFonte === "manual" ? (
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold">Link da sala (se veio por outro meio)</span>
                <input className={cn(campoClasse, "h-9 w-full")} value={campos.linkSala} onChange={(e) => setCampos({ ...campos, linkSala: e.target.value })} placeholder="https://" />
              </label>
            ) : null}
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold">Correspondente (contratação externa)</span>
              <input className={cn(campoClasse, "h-9 w-full")} value={campos.correspondente} onChange={(e) => setCampos({ ...campos, correspondente: e.target.value })} placeholder="Nome ou escritório" />
              <span className="block text-xs text-muted-foreground">
                {aud.correspondente?.trim()
                  ? "O correspondente é o titular e a pessoa do escritório é a backup. Apagando o nome, a backup volta a ser a titular."
                  : "Ao salvar, o correspondente vira o titular e a titular atual passa a backup. Ela recebe o convite como opcional."}
              </span>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold">Observação</span>
              <textarea className={cn(campoClasse, "min-h-16 w-full py-2")} value={campos.observacao} onChange={(e) => setCampos({ ...campos, observacao: e.target.value })} />
            </label>
          </div>
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#285f7a]">
              <History className="size-3.5" aria-hidden /> Histórico
            </p>
            {historico === null ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : historico.length ? (
              <ul className="space-y-1 text-xs">
                {historico.map((h, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-mono">{quando(h.em)}</span> · <b className="text-foreground">{h.acao}</b>
                    {h.de || h.para ? ` · ${h.de ?? "—"} → ${h.para ?? "—"}` : ""}
                    {h.motivo ? ` (${h.motivo})` : ""}
                    {h.feito_por ? ` · ${h.feito_por}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nada registrado ainda.</p>
            )}
          </div>
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        </div>
        <DialogFooter className="border-t border-[#e6eef0] bg-[#f7fbfc] px-5 py-3">
          {pendenteNoVios(aud) ? (
            <Button variant="outline" onClick={() => void conferir()} disabled={salvando}>
              Conferido no VIOS
            </Button>
          ) : null}
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
