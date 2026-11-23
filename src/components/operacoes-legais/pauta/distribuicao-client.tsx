"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CircleCheck, Clock, Repeat, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALERTAS_DO_VIOS, alertasDaAudiencia, local, type Contexto } from "@/lib/audiencias/agenda";
import type { Audiencia, Papel } from "@/lib/audiencias/tipos";
import { cn } from "@/lib/utils";
import { Aviso, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio } from "../vistagem/ui";
import { AcessoPauta, Dupla, SeloTipo, TrocaDialog, cliente, diaCurto, diaPorExtenso, hora, mensagemDeErro, pautaApi, type DadosDaPauta } from "./comum";

type Dados = DadosDaPauta & { hoje: string; dias: string[] };

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
  const contexto: Contexto = useMemo(() => ({ pessoas, todas: dados?.audiencias ?? [], duracoes: dados?.duracoes }), [pessoas, dados]);

  const { atencao, emOrdem, numeros } = useMemo(() => {
    const dias = new Set(dados?.dias ?? []);
    const doPeriodo = (dados?.audiencias ?? []).filter((a) => dias.has(local(a.inicio).dia) && a.situacao !== "realizada");
    const comAlertas = doPeriodo.map((a) => ({ aud: a, alertas: alertasDaAudiencia(a, contexto) }));
    const atencao = comAlertas.filter((x) => x.alertas.some((al) => al.grave));
    const emOrdem = comAlertas.filter((x) => x.aud.situacao === "designada" && !x.alertas.some((al) => al.grave));
    const ativas = doPeriodo.filter((a) => a.situacao === "designada");
    return {
      atencao,
      emOrdem,
      numeros: {
        total: ativas.length,
        semTitular: ativas.filter((a) => !a.titularId).length,
        choques: comAlertas.filter((x) => x.alertas.some((al) => al.tipo === "choque" || al.tipo === "deslocamento")).length,
        mudou: comAlertas.filter((x) => x.alertas.some((al) => ALERTAS_DO_VIOS.includes(al.tipo))).length,
        cedo: comAlertas.filter((x) => x.alertas.some((al) => al.tipo === "cedo")).length,
      },
    };
  }, [dados, contexto]);

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
      {dados ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[#47cdd0]/30 bg-[#f2fbfb] px-4 py-2.5 text-sm text-[#285f7a]">
          <Users className="size-4" aria-hidden />
          <span>
            <b className="text-[#10293a]">Reunião de {diaCurto(dados.hoje)}</b> · cobrindo {dados.dias.map((d) => diaPorExtenso(d).toLowerCase()).join(" e ")}
          </span>
          <Button variant="outline" size="xs" className="ml-auto" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={cn(carregando && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      ) : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Indicadores className="lg:grid-cols-5">
        <Indicador icone={CalendarDays} rotulo="Audiências nos 2 dias" valor={numeros.total} />
        <Indicador icone={Users} rotulo="Sem titular" valor={numeros.semTitular} tom={numeros.semTitular ? "perigo" : "neutro"} />
        <Indicador icone={AlertTriangle} rotulo="Choque ou deslocamento" valor={numeros.choques} tom={numeros.choques ? "perigo" : "neutro"} />
        <Indicador icone={Repeat} rotulo="Conferir no VIOS" valor={numeros.mudou} tom={numeros.mudou ? "perigo" : "neutro"} />
        <Indicador icone={Clock} rotulo="Antes das 10h" valor={numeros.cedo} tom={numeros.cedo ? "alerta" : "neutro"} />
      </Indicadores>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Painel>
          <PainelTopo
            titulo={
              <span className={cn("flex items-center gap-2", atencao.length ? "text-red-700" : "text-emerald-700")}>
                {atencao.length ? <AlertTriangle className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
                {atencao.length ? `Precisa de decisão (${atencao.length})` : "Tudo decidido"}
              </span>
            }
            descricao="Sem titular, choque, deslocamento, mudança ou cancelamento no tribunal."
            className={atencao.length ? "bg-red-50" : undefined}
          />
          {!atencao.length ? (
            <Vazio icone={CircleCheck} titulo="Nada pendente">
              Todas as audiências dos próximos dois dias úteis têm titular e nada mudou no tribunal.
            </Vazio>
          ) : (
            <ul>
              {atencao.map(({ aud, alertas }) => {
                const graves = alertas.filter((a) => a.grave);
                const precisaPessoa = graves.some((a) => ["sem_titular", "choque", "deslocamento"].includes(a.tipo));
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
                        <span className={cn("truncate text-sm font-semibold", aud.situacao === "cancelada" && "line-through")}>{cliente(aud)}</span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {aud.cnj} · {aud.orgao}
                      </p>
                      {graves.map((a) => (
                        <p key={a.tipo} className="flex gap-1.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          {a.texto}
                        </p>
                      ))}
                      <Dupla aud={aud} pessoas={pessoas} compacto />
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
                        <span className="block font-sans text-xs text-muted-foreground">{aud.modalidadeTribunal === "presencial" ? "presencial" : aud.modalidadeTribunal === "hibrida" ? "híbrida" : "vídeo"}</span>
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <SeloTipo aud={aud} />
                          <span className="truncate text-sm font-semibold">{cliente(aud)}</span>
                          {alertas.some((a) => a.tipo === "cedo") ? <Selo tom="alerta">Antes das 10h</Selo> : null}
                          {alertas.some((a) => a.tipo === "sem_link") ? <Selo tom="alerta">Sem link</Selo> : null}
                          {alertas.some((a) => a.tipo === "backup_ocupado") ? <Selo tom="alerta">Backup ocupada</Selo> : null}
                        </div>
                        <Dupla aud={aud} pessoas={pessoas} compacto />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="xs" variant="outline" onClick={() => setTroca({ aud, papel: "titular" })}>
                          Trocar
                        </Button>
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
