"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CircleCheck, Clock, LoaderCircle, Repeat, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALERTAS_DO_VIOS, alertasDaAudiencia, local, respostasDosConvites, type Contexto } from "@/lib/audiencias/agenda";
import type { AlertaAudiencia, Audiencia, Papel } from "@/lib/audiencias/tipos";
import { cn } from "@/lib/utils";
import { IconeOpcao, Seletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio } from "../vistagem/ui";
import { AcessoPauta, Avatar, Dupla, LinkDoVios, ResumoDoFiltro, SeloOrigem, SeloTipo, TextoComCi, TrocaDialog, cliente, diaCurto, diaPorExtenso, hora, mensagemDeErro, pautaApi, type DadosDaPauta } from "./comum";

type Dados = DadosDaPauta & { hoje: string; dias: string[] };

/** Os cartões do topo que filtram as duas listas ("" = todas dos dois dias). */
type CartaoDistribuicao = "" | "semTitular" | "choques" | "mudou" | "cedo";
const ROTULO_CARTAO: Record<Exclude<CartaoDistribuicao, "">, string> = {
  semTitular: "Sem titular",
  choques: "Conflito de horário ou deslocamento",
  mudou: "Conferir no VIOS",
  cedo: "Antes das 10h",
};

function noCartao(cartao: Exclude<CartaoDistribuicao, "">, aud: Audiencia, alertas: AlertaAudiencia[]): boolean {
  if (cartao === "semTitular") return aud.situacao === "designada" && (!aud.titularId || alertas.some((al) => al.tipo === "recusou"));
  if (cartao === "choques") return alertas.some((al) => al.tipo === "choque" || al.tipo === "deslocamento");
  if (cartao === "mudou") return alertas.some((al) => ALERTAS_DO_VIOS.includes(al.tipo));
  return alertas.some((al) => al.tipo === "cedo");
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function DistribuicaoClient() {
  return (
    <AcessoPauta>
      <Distribuicao />
    </AcessoPauta>
  );
}

function Distribuicao() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [troca, setTroca] = useState<{ aud: Audiencia; papel: Papel } | null>(null);
  const [conferindo, setConferindo] = useState<string | null>(null);
  const [cartao, setCartao] = useState<CartaoDistribuicao>("");
  const [pessoa, setPessoa] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await pautaApi.get<Dados>("/distribuicao"));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pessoas = useMemo(() => new Map((dados?.pessoas ?? []).map((p) => [p.id, p])), [dados]);
  const contexto: Contexto = useMemo(
    () => ({ pessoas, todas: dados?.audiencias ?? [], duracoes: dados?.duracoes, respostas: respostasDosConvites(dados?.convites ?? [], dados?.audiencias ?? []) }),
    [pessoas, dados]
  );

  const { atencao, emOrdem, numeros, total, porPessoa } = useMemo(() => {
    const dias = new Set(dados?.dias ?? []);
    const doPeriodo = (dados?.audiencias ?? []).filter((a) => dias.has(local(a.inicio).dia) && a.situacao !== "realizada");
    // O que aparece nas duas listas: as designadas e as canceladas que ainda pedem decisão.
    const todas = doPeriodo.map((a) => ({ aud: a, alertas: alertasDaAudiencia(a, contexto) })).filter((x) => x.aud.situacao === "designada" || x.alertas.some((al) => al.grave));
    // Pessoa e busca valem para os cartões; o cartão escolhido filtra as duas listas.
    const termo = semAcento(busca.trim());
    const comAlertas = todas.filter(({ aud: a }) => {
      if (pessoa && a.titularId !== pessoa && a.backupId !== pessoa) return false;
      if (!termo) return true;
      return semAcento([a.cnj, cliente(a), a.orgao, a.viosTarefaCi, a.titularId && pessoas.get(a.titularId)?.nomeVios, a.backupId && pessoas.get(a.backupId)?.nomeVios].filter(Boolean).join(" ")).includes(termo);
    });
    const doCartao = cartao ? comAlertas.filter((x) => noCartao(cartao, x.aud, x.alertas)) : comAlertas;
    const atencao = doCartao.filter((x) => x.alertas.some((al) => al.grave));
    const emOrdem = doCartao.filter((x) => x.aud.situacao === "designada" && !x.alertas.some((al) => al.grave));
    const porPessoa = new Map<string, number>();
    for (const { aud } of todas) for (const id of new Set([aud.titularId, aud.backupId])) if (id) porPessoa.set(id, (porPessoa.get(id) ?? 0) + 1);
    const contarCartao = (c: Exclude<CartaoDistribuicao, "">) => comAlertas.filter((x) => noCartao(c, x.aud, x.alertas)).length;
    return {
      atencao,
      emOrdem,
      total: todas.length,
      porPessoa,
      numeros: {
        total: comAlertas.filter((x) => x.aud.situacao === "designada").length,
        semTitular: contarCartao("semTitular"),
        choques: contarCartao("choques"),
        mudou: contarCartao("mudou"),
        cedo: contarCartao("cedo"),
      },
    };
  }, [dados, contexto, pessoas, pessoa, busca, cartao]);

  const filtrosAtivos = [
    cartao ? ROTULO_CARTAO[cartao] : null,
    pessoa ? `Pessoa: ${pessoas.get(pessoa)?.nomeCurto ?? "—"}` : null,
    busca.trim() ? `Busca: “${busca.trim()}”` : null,
  ].filter((f): f is string => Boolean(f));
  const filtrando = filtrosAtivos.length > 0;

  function limparFiltros() {
    setCartao("");
    setPessoa("");
    setBusca("");
  }

  const alternar = (c: Exclude<CartaoDistribuicao, "">) => () => setCartao((atual) => (atual === c ? "" : c));
  // Com filtro, a lista que ficou vazia sai e a outra ocupa a largura.
  const mostrarAtencao = !filtrando || atencao.length > 0;
  const mostrarEmOrdem = !filtrando || emOrdem.length > 0;

  function atualizar(aud: Audiencia) {
    setDados((d) => (d ? { ...d, audiencias: d.audiencias.map((a) => (a.id === aud.id ? aud : a)) } : d));
  }

  async function conferir(aud: Audiencia) {
    setConferindo(aud.id);
    try {
      await pautaApi.post("/conferir", { ids: [aud.id] });
      atualizar({ ...aud, mudancaConferidaEm: new Date().toISOString() });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setConferindo(null);
    }
  }

  if (carregando && !dados) return <Carregando rotulo="Carregando a distribuição" />;

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-2 text-sm text-[#285f7a]">
              <span className="grid size-7 place-items-center rounded-md bg-[#e8f8f8] text-[#347796]" aria-hidden>
                <Users className="size-4" />
              </span>
              {dados ? (
                <span>
                  <b className="text-[#10293a]">Reunião de {diaCurto(dados.hoje)}</b> · cobrindo {dados.dias.map((d) => diaPorExtenso(d).toLowerCase()).join(" e ")}
                </span>
              ) : (
                <span>Reunião do dia</span>
              )}
            </span>
            <Button variant="outline" onClick={() => void carregar()} disabled={carregando} title="Relê a pauta e os alertas">
              {carregando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Atualizar
            </Button>
          </div>
        }
      >
        <Busca placeholder="Buscar cliente, processo, pessoa ou CI" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => (e.key === "Escape" ? setBusca("") : null)} aria-label="Buscar audiência" />
        <Seletor
          rotulo="Pessoa"
          className="sm:w-56"
          valor={pessoa}
          onChange={setPessoa}
          todos={{ rotulo: "Todas as pessoas", contagem: total, icone: <IconeOpcao icone={Users} /> }}
          opcoes={(dados?.pessoas ?? [])
            .filter((p) => p.fazAudiencia && p.ativo)
            .map((p) => ({ valor: p.id, rotulo: p.nomeCurto, contagem: porPessoa.get(p.id) ?? 0, icone: <Avatar pessoa={p} className="size-5" /> }))}
        />
      </BarraAba>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Indicadores className="lg:grid-cols-5">
        <Indicador icone={CalendarDays} rotulo="Audiências nos 2 dias" valor={numeros.total} ativo={!cartao} onClick={() => setCartao("")} dica="Todas as audiências dos dois dias" />
        <Indicador icone={Users} rotulo={ROTULO_CARTAO.semTitular} valor={numeros.semTitular} tom={numeros.semTitular ? "perigo" : "neutro"} ativo={cartao === "semTitular"} onClick={alternar("semTitular")} dica="Mostrar só as audiências sem titular ou com a titular que recusou o convite do Outlook" />
        <Indicador icone={AlertTriangle} rotulo={ROTULO_CARTAO.choques} valor={numeros.choques} tom={numeros.choques ? "perigo" : "neutro"} ativo={cartao === "choques"} onClick={alternar("choques")} dica="Mostrar só os conflitos de horário e a falta de tempo de deslocamento" />
        <Indicador icone={Repeat} rotulo={ROTULO_CARTAO.mudou} valor={numeros.mudou} tom={numeros.mudou ? "perigo" : "neutro"} ativo={cartao === "mudou"} onClick={alternar("mudou")} dica="Mostrar só o que mudou ou cancelou no tribunal ou não bate com o VIOS" />
        <Indicador icone={Clock} rotulo={ROTULO_CARTAO.cedo} valor={numeros.cedo} tom={numeros.cedo ? "alerta" : "neutro"} ativo={cartao === "cedo"} onClick={alternar("cedo")} dica="Mostrar só as que começam antes das 10h" />
      </Indicadores>

      <ResumoDoFiltro mostrando={atencao.length + emOrdem.length} de={total} unidade="audiências dos dois dias" filtros={filtrosAtivos} aoLimpar={limparFiltros} />
      {dados && filtrando && !mostrarAtencao && !mostrarEmOrdem ? (
        <Painel>
          <Vazio icone={CalendarDays} titulo="Nenhuma audiência com estes filtros">
            <Button variant="outline" size="sm" className="mt-1" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </Vazio>
        </Painel>
      ) : null}

      <div className={cn("grid items-start gap-4", mostrarAtencao && mostrarEmOrdem && "lg:grid-cols-2")}>
        {mostrarAtencao ? (
        <Painel>
          <PainelTopo
            titulo={
              <span className={cn("flex items-center gap-2", atencao.length ? "text-red-700" : "text-emerald-700")}>
                {atencao.length ? <AlertTriangle className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
                {atencao.length ? `Precisa de decisão (${atencao.length})` : "Tudo decidido"}
              </span>
            }
            descricao="Sem titular, conflito de horário, deslocamento, mudança ou cancelamento no tribunal, ou diferença com o VIOS."
            className={atencao.length ? "bg-red-50" : undefined}
          />
          {!atencao.length ? (
            <Vazio icone={CircleCheck} titulo="Nada pendente">
              {filtrando ? "Nada pendente com estes filtros." : "Todas as audiências dos próximos dois dias úteis têm titular e nada mudou no tribunal."}
            </Vazio>
          ) : (
            <ul>
              {atencao.map(({ aud, alertas }) => {
                const graves = alertas.filter((a) => a.grave);
                const precisaPessoa = graves.some((a) => ["sem_titular", "choque", "deslocamento", "recusou"].includes(a.tipo));
                const precisaConferir = graves.some((a) => ALERTAS_DO_VIOS.includes(a.tipo));
                return (
                  <li key={aud.id} className="relative grid grid-cols-[4.25rem_minmax(0,1fr)_auto] gap-3 border-b border-[#e6eef0] px-4 py-3 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-600 last:border-b-0">
                    <span className="font-mono text-sm font-medium">
                      {hora(aud.inicio)}
                      <span className="block font-sans text-xs text-muted-foreground">{diaCurto(local(aud.inicio).dia)}</span>
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <SeloTipo aud={aud} />
                          <SeloOrigem aud={aud} />
                        <span className={cn("truncate text-sm font-semibold", aud.situacao === "cancelada" && "line-through")}>{cliente(aud)}</span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {aud.cnj} · {aud.orgao}
                      </p>
                      <LinkDoVios aud={aud} />
                      {graves.map((a) => (
                        <p key={a.tipo} className="flex gap-1.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          <span><TextoComCi texto={a.texto} /></span>
                        </p>
                      ))}
                      <Dupla aud={aud} pessoas={pessoas} compacto respostas={contexto.respostas?.get(aud.id)} />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {precisaPessoa && aud.situacao === "designada" ? (
                        <Button size="xs" onClick={() => setTroca({ aud, papel: "titular" })}>
                          {aud.titularId ? "Trocar" : "Definir titular"}
                        </Button>
                      ) : null}
                      {precisaConferir ? (
                        <Button size="xs" variant="secondary" onClick={() => void conferir(aud)} disabled={conferindo === aud.id}>
                          <CircleCheck />
                          Conferido no VIOS
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
        ) : null}

        {mostrarEmOrdem ? (
        <Painel>
          <PainelTopo titulo={`Em ordem (${emOrdem.length})`} descricao="Clique em Trocar para mudar titular ou backup." />
          {(dados?.dias ?? []).map((dia) => {
            const doDia = emOrdem.filter((x) => local(x.aud.inicio).dia === dia);
            return (
              <div key={dia}>
                <p className="border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-1.5 text-xs font-semibold text-muted-foreground">{diaPorExtenso(dia)}</p>
                {!doDia.length ? <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma audiência.</p> : null}
                <ul>
                  {doDia.map(({ aud, alertas }) => (
                    <li key={aud.id} className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-[#e6eef0] px-4 py-2.5 last:border-b-0">
                      <span className="font-mono text-sm font-medium">
                        {hora(aud.inicio)}
                        <span className="block font-sans text-xs text-muted-foreground">{aud.modalidadeTribunal === "presencial" ? "presencial" : aud.modalidadeTribunal === "hibrida" ? "híbrida" : "online"}</span>
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <SeloTipo aud={aud} />
                          <SeloOrigem aud={aud} />
                          <span className="truncate text-sm font-semibold">{cliente(aud)}</span>
                          {alertas.some((a) => a.tipo === "cedo") ? <Selo tom="alerta">Antes das 10h</Selo> : null}
                          {alertas.some((a) => a.tipo === "sem_link") ? <Selo tom="alerta">Sem link</Selo> : null}
                          {alertas.some((a) => a.tipo === "backup_ocupado") ? <Selo tom="alerta">Backup ocupada</Selo> : null}
                        </div>
                        <LinkDoVios aud={aud} />
                        <Dupla aud={aud} pessoas={pessoas} compacto respostas={contexto.respostas?.get(aud.id)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        {aud.correspondente?.trim() ? null : (
                          <Button size="xs" variant="outline" onClick={() => setTroca({ aud, papel: "titular" })}>
                            Trocar
                          </Button>
                        )}
                        <Button size="xs" variant="ghost" onClick={() => setTroca({ aud, papel: "backup" })}>
                          Backup
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Painel>
        ) : null}
      </div>

      {dados && !dados.audiencias.length ? (
        <Aviso tom="info">
          Nenhuma audiência lida para estes dias. Confira em Configurações quando foi a última leitura do PJe.
        </Aviso>
      ) : null}

      {dados ? <TrocaDialog aud={troca?.aud ?? null} papel={troca?.papel ?? "titular"} dados={dados} aberto={Boolean(troca)} aoFechar={() => setTroca(null)} aoTrocar={atualizar} /> : null}
    </div>
  );
}
