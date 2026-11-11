"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CloudDownload, ExternalLink, FileSearch, GitCompareArrows, LoaderCircle, Scale } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { partesDaData } from "@/lib/vistagem/como-fica-no-vios";
import {
  ADVOGADOS_DJEN,
  chaveDoAdvogado,
  type ConferenciaDjenKurier,
  type DiaDaConferencia,
} from "@/lib/vistagem/djen-kurier";
import { SITUACAO_ATUAL } from "@/lib/vistagem/historico";
import type { PublicacaoStatus } from "@/lib/vistagem/types";
import { formatarDataHora } from "./publicacao-ui";
import { Aviso, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo } from "./ui";

type Periodo = "7" | "14" | "30";

const porcento = (valor: number | null) => (valor === null ? "—" : `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const siglaDoAdvogado = new Map(ADVOGADOS_DJEN.map((advogado) => [chaveDoAdvogado(advogado), advogado.sigla]));

function DataDoDia({ data }: { data: string }) {
  const partes = partesDaData(data);
  return (
    <span className="whitespace-nowrap tabular-nums">
      {partes.dia}/{partes.mes} <span className="text-muted-foreground">{partes.semana}</span>
    </span>
  );
}

/**
 * Conferência DJEN × Kurier (Gestão das publicações): o que a API do DJEN traz para o Gustavo e o Ricardo, comparado
 * com o que a Kurier trouxe, dia a dia. Só estudo, para decidir no futuro se dá para tirar a Kurier.
 */
export function ConferenciaDjenKurierPainel() {
  const [periodo, setPeriodo] = useState<Periodo>("14");
  const [dados, setDados] = useState<ConferenciaDjenKurier | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/djen-kurier?dias=${periodo}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a conferência.");
        if (!cancelado) setDados(corpo as ConferenciaDjenKurier);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Falha ao carregar a conferência.");
      });
    return () => {
      cancelado = true;
    };
  }, [periodo]);

  async function buscarAgora() {
    setBuscando(true);
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/djen-kurier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buscar: 2, dias: Number(periodo) }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao buscar no DJEN.");
      setDados(corpo as ConferenciaDjenKurier);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao buscar no DJEN.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <ConferenciaDjenKurierView
      dados={dados}
      erro={erro}
      periodo={periodo}
      onPeriodo={(valor) => {
        setPeriodo(valor);
        setDados(null);
        setAberto(null);
      }}
      buscando={buscando}
      onBuscarAgora={buscarAgora}
      aberto={aberto}
      onAbrir={(data) => setAberto((atual) => (atual === data ? null : data))}
    />
  );
}

/** O desenho da conferência (separado da busca, para o teste). */
export function ConferenciaDjenKurierView({
  dados,
  erro,
  periodo,
  onPeriodo,
  buscando,
  onBuscarAgora,
  aberto,
  onAbrir,
}: {
  dados: ConferenciaDjenKurier | null;
  erro: string;
  periodo: Periodo;
  onPeriodo: (periodo: Periodo) => void;
  buscando: boolean;
  onBuscarAgora: () => void;
  aberto: string | null;
  onAbrir: (data: string) => void;
}) {
  const diaAberto = dados?.dias.find((dia) => dia.data === aberto) ?? null;
  return (
    <div className="space-y-4">
      <Painel aria-labelledby="djen-kurier-titulo">
        <PainelTopo
          id="djen-kurier-titulo"
          titulo="Conferência DJEN × Kurier"
          descricao={`Estudo: o que a API pública do DJEN traz para ${ADVOGADOS_DJEN.map((advogado) => `${advogado.nome} (OAB ${chaveDoAdvogado(advogado)})`).join(" e ")}, comparado com o que a Kurier trouxe em cada dia de disponibilização. Não muda nada no fluxo das publicações.`}
        >
          <Segmented
            label="Período"
            value={periodo}
            options={[
              { value: "7", label: "7 dias" },
              { value: "14", label: "14 dias" },
              { value: "30", label: "30 dias" },
            ]}
            onChange={onPeriodo}
          />
          <Button onClick={onBuscarAgora} disabled={buscando}>
            {buscando ? <LoaderCircle className="animate-spin" /> : <CloudDownload />}
            Buscar agora
          </Button>
        </PainelTopo>
        <p className="border-b border-[#e6eef0] px-4 py-2 text-xs text-muted-foreground">
          O DJEN é buscado sozinho duas vezes por dia (8h e 20h), sempre ontem e hoje.{" "}
          {dados?.ultimaBusca ? (
            <>
              Última busca: {formatarDataHora(dados.ultimaBusca.em)} ({dados.ultimaBusca.origem === "cron" ? "automática" : "pelo botão"})
              {dados.ultimaBusca.erro ? <span className="text-red-700"> · com erro: {dados.ultimaBusca.erro}</span> : null}.
            </>
          ) : dados ? (
            "Ainda não houve busca: use “Buscar agora”."
          ) : null}
        </p>

        {erro ? (
          <Aviso tom="erro" className="m-4">
            {erro}
          </Aviso>
        ) : !dados ? (
          <Carregando rotulo="Comparando o DJEN com a Kurier" />
        ) : (
          <>
            <Indicadores className="grid-cols-2 rounded-none border-x-0 border-t-0 shadow-none lg:grid-cols-4">
              <Indicador icone={Scale} rotulo="Cobertura da Kurier pelo DJEN" valor={porcento(dados.totais.cobertura)} tom={dados.totais.soKurier ? "alerta" : "sucesso"}>
                {dados.totais.nosDois} de {dados.totais.kurier} publicações da Kurier também no DJEN
              </Indicador>
              <Indicador icone={GitCompareArrows} rotulo="Nos dois" valor={dados.totais.nosDois}>
                DJEN: {dados.totais.djen} · Kurier: {dados.totais.kurier}
              </Indicador>
              <Indicador icone={FileSearch} rotulo="Só na Kurier" valor={dados.totais.soKurier} tom={dados.totais.soKurier ? "perigo" : "sucesso"}>
                o DJEN não trouxe
              </Indicador>
              <Indicador icone={CircleCheck} rotulo="Só no DJEN" valor={dados.totais.soDjen}>
                a Kurier não trouxe
              </Indicador>
            </Indicadores>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">Comparação por dia de disponibilização</caption>
                <thead className="bg-[#f7fbfc] text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Dia</th>
                    <th className="px-3 py-2 text-right font-medium">DJEN</th>
                    <th className="px-3 py-2 text-right font-medium">Kurier</th>
                    <th className="px-3 py-2 text-right font-medium">Nos dois</th>
                    <th className="px-3 py-2 text-right font-medium">Só na Kurier</th>
                    <th className="px-3 py-2 text-right font-medium">Só no DJEN</th>
                    <th className="px-4 py-2 text-right font-medium">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f5]">
                  {dados.dias.map((dia) => {
                    const divergencias = dia.soDjen.length + dia.soKurier.length;
                    const compara = dia.buscado && dia.comKurier;
                    return (
                      <tr
                        key={dia.data}
                        className={cn("tabular-nums", divergencias && "cursor-pointer hover:bg-[#f7fbfc]", aberto === dia.data && "bg-[#f2fbfb]")}
                        onClick={divergencias ? () => onAbrir(dia.data) : undefined}
                        aria-expanded={divergencias ? aberto === dia.data : undefined}
                      >
                        <td className="px-4 py-2">
                          <DataDoDia data={dia.data} />
                          {!dia.buscado ? (
                            <Selo className="ml-2 px-1.5 py-0 text-[11px]">sem busca no DJEN</Selo>
                          ) : !dia.comKurier ? (
                            <Selo className="ml-2 px-1.5 py-0 text-[11px]">sem Kurier</Selo>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">{dia.buscado ? dia.djen : "—"}</td>
                        <td className="px-3 py-2 text-right">{dia.kurier}</td>
                        <td className="px-3 py-2 text-right">{compara ? dia.nosDois : "—"}</td>
                        <td className={cn("px-3 py-2 text-right", dia.soKurier.length && "font-semibold text-red-700")}>{compara ? dia.soKurier.length : "—"}</td>
                        <td className="px-3 py-2 text-right">{compara ? dia.soDjen.length : "—"}</td>
                        <td className="px-4 py-2 text-right">{porcento(dia.cobertura)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-[#e6eef0] px-4 py-2 text-[11px] text-muted-foreground">
              O par é pelo ID de comunicação do DJEN (a Kurier traz o mesmo); sem ele, pelo processo no mesmo dia. O dia de hoje só fica completo na
              Kurier com o arquivo de amanhã. A Kurier traz também comunicações do mesmo processo endereçadas a outros advogados (em geral
              marcadas como duplicidade ou descartada), que o DJEN, buscando pela OAB, não traz. Dia sem nenhuma publicação da Kurier (o arquivo não foi importado; antes de 03/11/2026 não há Kurier no Orquestra) não se compara e fica fora dos totais. Clique num dia com diferença para ver quais.
            </p>
          </>
        )}
      </Painel>

      {diaAberto ? <DivergenciasDoDia dia={diaAberto} /> : null}
    </div>
  );
}

function DivergenciasDoDia({ dia }: { dia: DiaDaConferencia }) {
  return (
    <Painel aria-labelledby="djen-kurier-dia">
      <PainelTopo id="djen-kurier-dia" titulo={<>Diferenças de <DataDoDia data={dia.data} /></>} />
      <div className="grid gap-px bg-[#eef3f5] lg:grid-cols-2">
        <section className="bg-white px-4 py-3" aria-label="Só na Kurier">
          <h3 className="text-xs font-semibold uppercase tracking-normal text-red-700">Só na Kurier · o DJEN não trouxe ({dia.soKurier.length})</h3>
          {dia.soKurier.length ? (
            <ul className="mt-2 divide-y divide-[#eef3f5] text-sm">
              {dia.soKurier.map((item) => (
                <li key={item.id} className="py-1.5">
                  <p className="font-medium tabular-nums text-foreground">{item.processo ?? "sem número"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      item.tribunal,
                      item.nomeLocalizado,
                      item.djenId ? `ID ${item.djenId}` : "sem ID de comunicação",
                      SITUACAO_ATUAL[item.status as PublicacaoStatus] ?? item.status,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nada: tudo o que a Kurier trouxe o DJEN também trouxe.</p>
          )}
        </section>
        <section className="bg-white px-4 py-3" aria-label="Só no DJEN">
          <h3 className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">Só no DJEN · a Kurier não trouxe ({dia.soDjen.length})</h3>
          {dia.soDjen.length ? (
            <ul className="mt-2 divide-y divide-[#eef3f5] text-sm">
              {dia.soDjen.map((item) => (
                <li key={item.id} className="py-1.5">
                  <p className="flex items-center gap-1.5 font-medium tabular-nums text-foreground">
                    {item.processo ?? "sem número"}
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noreferrer" className="text-[#347796] hover:underline" aria-label={`Abrir a comunicação ${item.id} no DJEN`}>
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[item.tribunal, item.tipo, item.orgao, item.advogados.map((chave) => siglaDoAdvogado.get(chave) ?? chave).join(" + "), `ID ${item.id}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nada a mais no DJEN.</p>
          )}
        </section>
      </div>
    </Painel>
  );
}
