"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleSlash, Repeat, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hojeEmBrasilia, local, somarDias } from "@/lib/audiencias/agenda";
import { ROTULO_MUDANCA, ROTULO_TIPO, type Audiencia } from "@/lib/audiencias/tipos";
import { cn } from "@/lib/utils";
import { Aviso, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio } from "../vistagem/ui";
import { AcessoPauta, LinkDaSala, cliente, diaCurto, hora, mensagemDeErro, pautaApi, quando, type DadosDaPauta } from "./comum";

const COLUNAS = "lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_10rem] lg:items-center lg:gap-4";

function oQueMudou(aud: Audiencia): string {
  if (aud.situacao === "cancelada") return "Cancelada no PJe, sem nova data";
  const partes = aud.mudancas.map((m) => ROTULO_MUDANCA[m]);
  if (aud.viosInicio && Math.abs(new Date(aud.viosInicio).getTime() - new Date(aud.inicio).getTime()) >= 60000) partes.push(`VIOS com ${quando(aud.viosInicio)}`);
  return partes.join(" · ") || "Nada mudou";
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
  const [soMudancas, setSoMudancas] = useState(true);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

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

  const pendente = (a: Audiencia) =>
    !a.mudancaConferidaEm && (a.situacao === "cancelada" || a.mudancas.length > 0 || (a.viosInicio !== null && Math.abs(new Date(a.viosInicio).getTime() - new Date(a.inicio).getTime()) >= 60000));

  const lista = useMemo(() => (dados?.audiencias ?? []).filter((a) => a.situacao !== "realizada" && (soMudancas ? pendente(a) : a.situacao === "designada" || pendente(a))), [dados, soMudancas]);

  const numeros = useMemo(() => {
    const todas = dados?.audiencias ?? [];
    const ativas = todas.filter((a) => a.situacao === "designada");
    return {
      lidas: ativas.length,
      mudaram: ativas.filter((a) => a.mudancas.length && !a.mudancaConferidaEm).length,
      canceladas: todas.filter((a) => a.situacao === "cancelada" && !a.mudancaConferidaEm).length,
      linkDjen: ativas.filter((a) => a.linkFonte === "djen").length,
      semLink: ativas.filter((a) => a.modalidadeTribunal === "video" && !a.linkSala).length,
    };
  }, [dados]);

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

  return (
    <div className="space-y-4">
      <Indicadores className="lg:grid-cols-5">
        <Indicador icone={ShieldCheck} rotulo="Designadas (45 dias)" valor={dados ? numeros.lidas : "—"} />
        <Indicador icone={Repeat} rotulo="Mudaram no PJe" valor={dados ? numeros.mudaram : "—"} tom={numeros.mudaram ? "perigo" : "neutro"} />
        <Indicador icone={CircleSlash} rotulo="Canceladas sem nova data" valor={dados ? numeros.canceladas : "—"} tom={numeros.canceladas ? "perigo" : "neutro"} />
        <Indicador icone={Video} rotulo="Link só na intimação" valor={dados ? numeros.linkDjen : "—"} />
        <Indicador icone={Video} rotulo="Vídeo ainda sem link" valor={dados ? numeros.semLink : "—"} tom={numeros.semLink ? "alerta" : "neutro"} />
      </Indicadores>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[#347796]" checked={soMudancas} onChange={(e) => setSoMudancas(e.target.checked)} />
          Só o que mudou
        </label>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {leituras.map((l) => (
            <Selo key={l.fonte + (l.tribunal ?? "")} tom={l.erro ? "perigo" : "sucesso"} icone={CircleCheck} titulo={l.erro ?? undefined}>
              {l.fonte === "pje" ? `PJe ${l.tribunal ?? ""}` : l.fonte === "djen" ? "DJEN" : "VIOS"} · {quando(l.iniciadaEm)}
            </Selo>
          ))}
          {!leituras.length ? <Selo tom="alerta">Nenhuma leitura ainda</Selo> : null}
        </div>
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando && !dados ? <Carregando rotulo="Carregando a conferência" /> : null}

      {dados ? (
        <Painel>
          <PainelTopo titulo="Conferência no tribunal" descricao="O que o PJe mostra agora, o que mudou desde a última leitura e de onde veio o link da sala.">
            {marcadas.size ? (
              <Button size="xs" onClick={() => void conferir([...marcadas])}>
                <CircleCheck />
                Conferido no VIOS ({marcadas.size})
              </Button>
            ) : null}
          </PainelTopo>
          {!lista.length ? (
            <Vazio icone={CircleCheck} titulo={soMudancas ? "Nada a conferir" : "Nenhuma audiência"}>
              {soMudancas ? "Nenhuma mudança ou cancelamento pendente nos próximos 45 dias." : "Nenhuma audiência lida nos próximos 45 dias."}
            </Vazio>
          ) : (
            <>
              <div className={cn("hidden border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-medium text-muted-foreground", COLUNAS)}>
                <span>Audiência</span>
                <span>No PJe agora</span>
                <span>O que mudou</span>
                <span>Link da sala</span>
                <span>Resultado</span>
              </div>
              <ul>
                {lista.map((a) => {
                  const pend = pendente(a);
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
                        </span>
                      </span>
                      <span className="block text-sm">
                        <span className={cn("font-mono font-medium", a.situacao === "cancelada" && "text-red-700")}>{a.situacao === "cancelada" ? "Cancelada" : `${diaCurto(local(a.inicio).dia)} ${hora(a.inicio)}`}</span>
                        <span className="block truncate text-xs text-muted-foreground">{a.orgao}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{oQueMudou(a)}</span>
                      <LinkDaSala aud={a} />
                      <span className="flex flex-wrap gap-1">
                        {a.situacao === "cancelada" ? <Selo tom="perigo">Cancelada no PJe</Selo> : null}
                        {a.situacao !== "cancelada" && a.mudancas.map((m) => <Selo key={m} tom={m === "link" || m === "vara" ? "alerta" : "perigo"}>{ROTULO_MUDANCA[m]}</Selo>)}
                        {!pend ? <Selo tom="sucesso" icone={CircleCheck}>{a.mudancaConferidaEm ? "Conferida" : "Confere"}</Selo> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Painel>
      ) : null}
    </div>
  );
}
