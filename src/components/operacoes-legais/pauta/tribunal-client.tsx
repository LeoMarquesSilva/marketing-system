"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarX2, CircleCheck, CircleSlash, ClipboardCheck, ClipboardList, Landmark, LoaderCircle, RefreshCw, Repeat, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { conferidaDepoisDaCopia, estadoNoVios, hojeEmBrasilia, local, pendenteNoVios, somarDias, type EstadoNoVios } from "@/lib/audiencias/agenda";
import { tribunalDoCnj } from "@/lib/audiencias/conferencia-vios";
import { ROTULO_MUDANCA, ROTULO_TIPO, type Audiencia } from "@/lib/audiencias/tipos";
import { cn } from "@/lib/utils";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import { IconeTribunal } from "../vistagem/marcas";
import { IconeOpcao, Seletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio } from "../vistagem/ui";
import { AcessoPauta, CiDoVios, LinkDaSala, LinkDoVios, ResumoDoFiltro, SeloOrigem, TextoComCi, cliente, diaCurto, hora, mensagemDeErro, pautaApi, quando, type DadosDaPauta } from "./comum";

const COLUNAS = "lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_10rem] lg:items-center lg:gap-4";
const COLUNAS_SO_NO_VIOS = "lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_8rem] lg:items-center lg:gap-4";
const SO_NO_VIOS_INICIAL = 15;

/** O que o VIOS tem de diferente, para a tela (null = nada a dizer). */
const ROTULO_VIOS: Partial<Record<EstadoNoVios, string>> = {
  falta: "Falta no VIOS",
  concluida: "Concluída no VIOS",
  horario: "Data diferente no VIOS",
  aberta: "Ainda aberta no VIOS",
};

/** Data e hora de uma tarefa do VIOS (à meia-noite é tarefa sem horário). */
function quandoNoVios(iso: string): string {
  const v = local(iso);
  return v.hora === "00:00" ? `${diaCurto(v.dia)} (sem horário)` : quando(iso);
}

/** "09/12/2027 às 13h45": com o ano, porque a diferença com o VIOS costuma ser justamente o ano. */
function dataNoTribunal(iso: string): string {
  const v = local(iso);
  return `${v.dia.slice(8, 10)}/${v.dia.slice(5, 7)}/${v.dia.slice(0, 4)} às ${v.hora.replace(":", "h")}`;
}

function oQueMudou(aud: Audiencia): string {
  const partes: string[] = aud.situacao === "cancelada" ? ["Cancelada no PJe, sem nova data"] : aud.mudancas.map((m) => ROTULO_MUDANCA[m]);
  const estado = estadoNoVios(aud);
  if (estado === "horario" && aud.viosInicio) partes.push(`VIOS com ${quandoNoVios(aud.viosInicio)}`);
  if (estado === "falta") partes.push(aud.viosSituacao === "cancelada" ? `Tarefa ${aud.viosTarefaCi ?? ""} cancelada no VIOS` : "Sem tarefa de audiência no VIOS");
  if (estado === "concluida") partes.push(`Tarefa ${aud.viosTarefaCi ?? ""} já concluída no VIOS`);
  if (estado === "aberta") partes.push(`Tarefa ${aud.viosTarefaCi ?? ""} ainda aberta no VIOS`);
  return partes.join(" · ") || "Nada mudou";
}

/** Divergência com o VIOS que ainda vale (some quando alguém conferiu depois da cópia do VIOS). */
function divergenciaNoVios(aud: Audiencia): EstadoNoVios | null {
  const estado = estadoNoVios(aud);
  if (!estado || estado === "confere" || conferidaDepoisDaCopia(aud)) return null;
  return estado;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Os cartões do topo, que escolhem a lista: "A conferir" (o que pede conferência, ao abrir), "Designadas" (todas) e
 * cada motivo. "Só no VIOS" mostra só as tarefas do VIOS sem audiência no PJe.
 */
type CartaoCheck = "conferir" | "todas" | "mudaram" | "canceladas" | "naoBatem" | "soNoVios" | "semLink";
const ROTULO_CARTAO: Record<CartaoCheck, string> = {
  conferir: "A conferir",
  todas: "Designadas (45 dias)",
  mudaram: "Mudaram no PJe",
  canceladas: "Canceladas a conferir",
  naoBatem: "Não batem com o VIOS",
  soNoVios: "Só no VIOS",
  semLink: "Vídeo ainda sem link",
};

function noCartao(cartao: CartaoCheck, a: Audiencia): boolean {
  if (a.situacao === "realizada") return false;
  if (cartao === "conferir") return pendenteNoVios(a);
  if (cartao === "todas") return a.situacao === "designada" || pendenteNoVios(a);
  if (cartao === "canceladas") return a.situacao === "cancelada" && pendenteNoVios(a);
  if (a.situacao !== "designada") return false;
  if (cartao === "mudaram") return a.mudancas.length > 0 && !a.mudancaConferidaEm;
  if (cartao === "naoBatem") return Boolean(divergenciaNoVios(a));
  if (cartao === "semLink") return a.modalidadeTribunal === "video" && !a.linkSala;
  return false;
}

export function TribunalClient() {
  return (
    <AcessoPauta>
      <Tribunal />
    </AcessoPauta>
  );
}

function Tribunal() {
  const [dados, setDados] = useState<DadosDaPauta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [cartao, setCartao] = useState<CartaoCheck>("conferir");
  const [busca, setBusca] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [todasSoNoVios, setTodasSoNoVios] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const hoje = hojeEmBrasilia();
      setDados(await pautaApi.get<DadosDaPauta>(`?de=${hoje}&ate=${somarDias(hoje, 45)}`));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const termo = semAcento(busca.trim());
  // Busca e tribunal valem para os cartões e para as duas listas; o cartão escolhe a lista.
  const daBusca = useMemo(
    () =>
      (dados?.audiencias ?? []).filter((a) => {
        if (tribunal && a.tribunal !== tribunal) return false;
        if (!termo) return true;
        return semAcento([a.cnj, cliente(a), a.orgao, a.viosTarefaCi, a.ciProcesso].filter(Boolean).join(" ")).includes(termo);
      }),
    [dados, tribunal, termo]
  );
  const lista = useMemo(() => daBusca.filter((a) => noCartao(cartao, a)), [daBusca, cartao]);

  const numeros = useMemo(() => {
    const contar = (c: CartaoCheck) => daBusca.filter((a) => noCartao(c, a)).length;
    return {
      conferir: contar("conferir"),
      lidas: daBusca.filter((a) => a.situacao === "designada").length,
      todas: contar("todas"),
      mudaram: contar("mudaram"),
      canceladas: contar("canceladas"),
      naoBatem: contar("naoBatem"),
      semLink: contar("semLink"),
    };
  }, [daBusca]);

  async function conferir(ids: string[]) {
    try {
      await pautaApi.post("/conferir", { ids });
      const agora = new Date().toISOString();
      setDados((d) => (d ? { ...d, audiencias: d.audiencias.map((a) => (ids.includes(a.id) ? { ...a, mudancaConferidaEm: agora } : a)) } : d));
      setMarcadas(new Set());
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const leituras = dados?.leituras ?? [];
  const vios = dados?.vios ?? null;
  const todasDoVios = vios?.soNoVios ?? [];
  const soNoVios = todasDoVios.filter((t) => {
    if (tribunal && tribunalDoCnj(t.cnj) !== tribunal) return false;
    if (!termo) return true;
    return semAcento([t.cnj, t.tarefa, t.tarefaCi, t.ciProcesso, ...t.responsaveis].filter(Boolean).join(" ")).includes(termo);
  });

  // Tribunais da pauta e do "só no VIOS", com a contagem, para o filtro.
  const porTribunal = new Map<string, number>();
  for (const a of dados?.audiencias ?? []) if (a.tribunal && noCartao("todas", a)) porTribunal.set(a.tribunal, (porTribunal.get(a.tribunal) ?? 0) + 1);
  for (const t of todasDoVios) {
    const sigla = tribunalDoCnj(t.cnj);
    if (sigla) porTribunal.set(sigla, (porTribunal.get(sigla) ?? 0) + 1);
  }

  // "A conferir" (ao abrir) e "Designadas" (tudo) não estreitam a lista: não contam como filtro.
  const filtrosAtivos = [cartao !== "conferir" && cartao !== "todas" ? ROTULO_CARTAO[cartao] : null, tribunal || null, busca.trim() ? `Busca: “${busca.trim()}”` : null].filter((f): f is string => Boolean(f));
  const soDoVios = cartao === "soNoVios";
  // Só no VIOS aparece junto de "A conferir" e de "Designadas"; nos motivos, fica só a lista do motivo.
  const mostrarSoNoVios = Boolean(vios?.resumo) && (soDoVios || cartao === "conferir" || cartao === "todas");

  function limparFiltros() {
    setCartao("conferir");
    setTribunal("");
    setBusca("");
  }

  const alternar = (c: CartaoCheck) => () => {
    setMarcadas(new Set());
    setCartao((atual) => (atual === c ? "conferir" : c));
  };

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void carregar()} disabled={carregando} title="Relê a pauta, o que mudou no PJe e a última conferência com o VIOS">
              {carregando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Atualizar
            </Button>
          </div>
        }
      >
        <Busca placeholder="Buscar cliente, processo, tarefa ou CI" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => (e.key === "Escape" ? setBusca("") : null)} aria-label="Buscar audiência ou tarefa" />
        <Seletor
          rotulo="Tribunal"
          className="sm:w-56"
          valor={tribunal}
          onChange={setTribunal}
          todos={{ rotulo: "Todos os tribunais", contagem: [...porTribunal.values()].reduce((soma, n) => soma + n, 0), icone: <IconeOpcao icone={Landmark} /> }}
          opcoes={[...porTribunal.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
            .map(([sigla, quantidade]) => ({ valor: sigla, rotulo: sigla, descricao: descricaoDoTribunal(sigla), contagem: quantidade, icone: <IconeTribunal sigla={sigla} /> }))}
        />
      </BarraAba>

      <Indicadores className="sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Indicador icone={ClipboardCheck} rotulo={ROTULO_CARTAO.conferir} valor={dados ? numeros.conferir : "—"} tom={numeros.conferir ? "perigo" : "sucesso"} ativo={cartao === "conferir"} onClick={alternar("conferir")} dica="O que pede conferência: mudança, cancelamento ou diferença com o VIOS" />
        <Indicador icone={ShieldCheck} rotulo={ROTULO_CARTAO.todas} valor={dados ? numeros.lidas : "—"} ativo={cartao === "todas"} onClick={alternar("todas")} dica="Todas as audiências designadas dos próximos 45 dias" />
        <Indicador icone={Repeat} rotulo={ROTULO_CARTAO.mudaram} valor={dados ? numeros.mudaram : "—"} tom={numeros.mudaram ? "perigo" : "neutro"} ativo={cartao === "mudaram"} onClick={alternar("mudaram")} dica="Mostrar só as que mudaram no PJe e ainda não foram conferidas" />
        <Indicador icone={CircleSlash} rotulo={ROTULO_CARTAO.canceladas} valor={dados ? numeros.canceladas : "—"} tom={numeros.canceladas ? "perigo" : "neutro"} ativo={cartao === "canceladas"} onClick={alternar("canceladas")} dica="Mostrar só as canceladas no PJe que ainda pedem conferência no VIOS" />
        <Indicador icone={CalendarX2} rotulo={ROTULO_CARTAO.naoBatem} valor={dados ? numeros.naoBatem : "—"} tom={numeros.naoBatem ? "perigo" : "neutro"} ativo={cartao === "naoBatem"} onClick={alternar("naoBatem")} dica="Mostrar só as que estão diferentes no VIOS (falta, concluída ou outra data)" />
        <Indicador icone={ClipboardList} rotulo={ROTULO_CARTAO.soNoVios} valor={vios?.resumo ? soNoVios.length : "—"} tom={soNoVios.length ? "alerta" : "neutro"} ativo={soDoVios} onClick={alternar("soNoVios")} dica="Mostrar só as tarefas de audiência do VIOS sem audiência no PJe" />
        <Indicador icone={Video} rotulo={ROTULO_CARTAO.semLink} valor={dados ? numeros.semLink : "—"} tom={numeros.semLink ? "alerta" : "neutro"} ativo={cartao === "semLink"} onClick={alternar("semLink")} dica="Mostrar só as por vídeo ainda sem link da sala" />
      </Indicadores>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Últimas leituras</span>
        <div className="flex flex-wrap gap-1.5">
          {leituras.map((l) => (
            <Selo key={l.fonte + (l.tribunal ?? "")} tom={l.erro ? "perigo" : "sucesso"} icone={CircleCheck} titulo={l.erro ?? undefined}>
              {l.fonte === "pje" ? `PJe ${l.tribunal ?? ""} · ${quando(l.iniciadaEm)}` : l.fonte === "djen" ? `DJEN · ${quando(l.iniciadaEm)}` : `VIOS · ${quando(l.iniciadaEm)}`}
            </Selo>
          ))}
          {vios?.resumo?.relatorioEm ? (
            <Selo
              tom="neutro"
              titulo={`Tarefas.csv do SharePoint da Controladoria (relatório completo do VIOS), mais o que a cópia do SAMA viu depois${vios.resumo.samaEm ? ` (SAMA de ${quando(vios.resumo.samaEm)})` : ""}.`}
            >
              Tarefas do VIOS de {quando(vios.resumo.relatorioEm)}
            </Selo>
          ) : vios?.resumo?.copiaEm ? (
            <Selo tom="neutro" titulo="Só a cópia do SAMA (relida às 2h e às 12h), que pode não ter todas as tarefas.">
              Cópia do SAMA de {quando(vios.resumo.copiaEm)}
            </Selo>
          ) : null}
          {!leituras.length ? <Selo tom="alerta">Nenhuma leitura ainda</Selo> : null}
        </div>
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {vios?.erro ? <Aviso tom="erro">A última conferência com o VIOS falhou: {vios.erro}</Aviso> : null}
      {vios?.resumo?.avisos?.length ? <Aviso tom="alerta">A conferência com o VIOS usou só uma fonte: {vios.resumo.avisos.join(" · ")}</Aviso> : null}
      {carregando && !dados ? <Carregando rotulo="Carregando a conferência" /> : null}
      {dados ? (
        <ResumoDoFiltro
          mostrando={soDoVios ? soNoVios.length : lista.length}
          de={soDoVios ? todasDoVios.length : numeros.todas}
          unidade={soDoVios ? "tarefas só no VIOS" : "audiências dos 45 dias"}
          filtros={filtrosAtivos}
          aoLimpar={limparFiltros}
        />
      ) : null}

      {dados && !soDoVios ? (
        <Painel>
          <PainelTopo
            titulo={`${cartao === "todas" ? "Todas as audiências" : ROTULO_CARTAO[cartao]} (${lista.length})`}
            descricao="O que o PJe mostra agora, o que mudou desde a última leitura, como está no VIOS e de onde veio o link da sala. O PJe manda; o VIOS confere."
          >
            {marcadas.size ? (
              <Button size="xs" onClick={() => void conferir([...marcadas])}>
                <CircleCheck />
                Conferido no VIOS ({marcadas.size})
              </Button>
            ) : null}
          </PainelTopo>
          {!lista.length ? (
            <Vazio icone={CircleCheck} titulo={cartao === "conferir" ? "Nada a conferir" : "Nenhuma audiência"}>
              {tribunal || termo
                ? "Nada com estes filtros."
                : cartao === "conferir"
                  ? "Nenhuma mudança, cancelamento ou diferença com o VIOS nos próximos 45 dias."
                  : cartao === "todas"
                    ? "Nenhuma audiência lida nos próximos 45 dias."
                    : `Nenhuma em “${ROTULO_CARTAO[cartao]}” nos próximos 45 dias.`}
            </Vazio>
          ) : (
            <>
              <div className={cn("hidden border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-medium text-muted-foreground", COLUNAS)}>
                <span>Audiência</span>
                <span>No PJe agora</span>
                <span>O que mudou e o VIOS</span>
                <span>Link da sala</span>
                <span>Resultado</span>
              </div>
              <ul>
                {lista.map((a) => {
                  const pend = pendenteNoVios(a);
                  const divergencia = divergenciaNoVios(a);
                  return (
                    <li key={a.id} className={cn("space-y-2 border-b border-[#e6eef0] px-4 py-3 last:border-b-0 lg:space-y-0", COLUNAS)}>
                      <span className="flex min-w-0 items-start gap-2">
                        {pend ? (
                          <input
                            type="checkbox"
                            className="mt-1 size-4 shrink-0 accent-[#347796]"
                            aria-label="Marcar para conferir"
                            checked={marcadas.has(a.id)}
                            onChange={(e) => setMarcadas((m) => (e.target.checked ? new Set([...m, a.id]) : new Set([...m].filter((x) => x !== a.id))))}
                          />
                        ) : null}
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <Selo tom="ia">{ROTULO_TIPO[a.tipo]}</Selo>
                            <span className="truncate text-sm font-semibold">{cliente(a)}</span>
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{a.cnj}</span>
                          <LinkDoVios aud={a} className="mt-0.5" />
                        </span>
                      </span>
                      <span className="block text-sm">
                        <span className={cn("font-mono font-medium", a.situacao === "cancelada" && "text-red-700")}>{a.situacao === "cancelada" ? "Cancelada" : `${diaCurto(local(a.inicio).dia)} ${hora(a.inicio)}`}</span>
                        <span className="block truncate text-xs text-muted-foreground">{a.orgao}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        <TextoComCi texto={oQueMudou(a)} />
                      </span>
                      <LinkDaSala aud={a} />
                      <span className="flex flex-wrap gap-1">
                        <SeloOrigem aud={a} />
                        {a.situacao === "cancelada" && !divergencia ? <Selo tom="perigo">Cancelada no PJe</Selo> : null}
                        {a.situacao !== "cancelada" && a.mudancas.map((m) => <Selo key={m} tom={m === "link" || m === "vara" ? "alerta" : "perigo"}>{ROTULO_MUDANCA[m]}</Selo>)}
                        {divergencia ? (
                          <Selo tom="perigo" titulo={a.viosTarefaCi ? `Tarefa ${a.viosTarefaCi} no VIOS` : undefined}>
                            {ROTULO_VIOS[divergencia]}
                          </Selo>
                        ) : null}
                        {!pend ? (
                          <Selo tom="sucesso" icone={CircleCheck} titulo={a.viosTarefaCi ? `Tarefa ${a.viosTarefaCi} no VIOS` : undefined}>
                            {a.mudancaConferidaEm ? "Conferida" : a.viosTarefaCi ? "Confere com o VIOS" : "Confere"}
                          </Selo>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Painel>
      ) : null}

      {mostrarSoNoVios ? (
        <Painel>
          <PainelTopo
            titulo={`Só no VIOS (${soNoVios.length})`}
            descricao="Tarefas de audiência abertas no VIOS, de hoje em diante e dos tribunais que o robô lê, sem audiência correspondente no PJe. Pode ser processo fora da pauta do certificado ou tarefa que ficou para trás no VIOS."
          />
          {!soNoVios.length ? (
            <Vazio icone={CircleCheck} titulo="Nada só no VIOS">
              {tribunal || termo ? "Nada com estes filtros." : "Toda tarefa de audiência aberta no VIOS tem a sua audiência no PJe."}
            </Vazio>
          ) : (
            <>
              <div className={cn("hidden border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-medium text-muted-foreground", COLUNAS_SO_NO_VIOS)}>
                <span>Tarefa no VIOS</span>
                <span>Quando</span>
                <span>Responsáveis</span>
                <span>CI da tarefa</span>
              </div>
              <ul>
                {(todasSoNoVios || soDoVios ? soNoVios : soNoVios.slice(0, SO_NO_VIOS_INICIAL)).map((t) => (
                  <li key={t.tarefaCi} className={cn("space-y-1 border-b border-[#e6eef0] px-4 py-3 last:border-b-0 lg:space-y-0", COLUNAS_SO_NO_VIOS)}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t.tarefa}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        {t.cnj}
                        {t.ciProcesso ? (
                          <>
                            {" · processo "}
                            <CiDoVios ci={t.ciProcesso} tipo="processo" />
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className="block">
                      <span className="block font-mono text-sm">{quandoNoVios(t.inicio)}</span>
                      {t.noTribunal?.length ? (
                        <span className="mt-0.5 block text-xs font-medium text-amber-700">No tribunal: {t.noTribunal.map(dataNoTribunal).join(" · ")}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{t.responsaveis.join(", ") || "—"}</span>
                    <span className="block text-xs">
                      <CiDoVios ci={t.tarefaCi} />
                    </span>
                  </li>
                ))}
              </ul>
              {soNoVios.length > SO_NO_VIOS_INICIAL && !soDoVios ? (
                <div className="border-t border-[#e6eef0] px-4 py-2">
                  <Button size="xs" variant="ghost" onClick={() => setTodasSoNoVios((v) => !v)}>
                    {todasSoNoVios ? "Mostrar menos" : `Mostrar todas (${soNoVios.length})`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Painel>
      ) : null}
    </div>
  );
}
