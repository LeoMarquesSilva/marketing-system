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
  INICIO_DA_CONFERENCIA,
  chaveDoAdvogado,
  type ComunicacaoDjenGuardada,
  type ConferenciaDjenKurier,
  type DetalheDoDia,
  type ParDaConferencia,
  type PublicacaoKurier,
} from "@/lib/vistagem/djen-kurier";
import { SITUACAO_ATUAL } from "@/lib/vistagem/historico";
import type { PublicacaoStatus } from "@/lib/vistagem/types";
import { formatarDataHora } from "./publicacao-ui";
import { Aviso, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo } from "./ui";

type Periodo = "7" | "14" | "30" | "tudo";
type Aba = "dois" | "kurier" | "djen";

/** "01/10/2026" */
const INICIO_POR_EXTENSO = INICIO_DA_CONFERENCIA.split("-").reverse().join("/");

const porcento = (valor: number | null) => (valor === null ? "—" : `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const siglaDoAdvogado = new Map(ADVOGADOS_DJEN.map((advogado) => [chaveDoAdvogado(advogado), advogado.sigla]));
/** "2026-11-11" → "11/11" */
const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const lista = (datas: string[]) => datas.map(ddmm).join(", ");

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
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const [dados, setDados] = useState<ConferenciaDjenKurier | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheDoDia | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState("");

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

  // O detalhe do dia aberto (o que é o quê), sob demanda.
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/djen-kurier?dia=${aberto}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o dia.");
        if (!cancelado) setDetalhe(corpo as DetalheDoDia);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErroDetalhe(e instanceof Error ? e.message : "Falha ao carregar o dia.");
      });
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  async function buscarAgora() {
    setBuscando(true);
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/djen-kurier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buscar: 2, dias: periodo === "tudo" ? "tudo" : Number(periodo) }),
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
        setDetalhe(null);
      }}
      buscando={buscando}
      onBuscarAgora={buscarAgora}
      aberto={aberto}
      onAbrir={(data) => {
        setDetalhe(null);
        setErroDetalhe("");
        setAberto((atual) => (atual === data ? null : data));
      }}
      detalhe={detalhe && detalhe.resumo.data === aberto ? detalhe : null}
      erroDetalhe={erroDetalhe}
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
  detalhe = null,
  erroDetalhe = "",
}: {
  dados: ConferenciaDjenKurier | null;
  erro: string;
  periodo: Periodo;
  onPeriodo: (periodo: Periodo) => void;
  buscando: boolean;
  onBuscarAgora: () => void;
  aberto: string | null;
  onAbrir: (data: string) => void;
  detalhe?: DetalheDoDia | null;
  erroDetalhe?: string;
}) {
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
              { value: "tudo", label: `Desde ${INICIO_POR_EXTENSO.slice(0, 5)}` },
              { value: "30", label: "30 dias" },
              { value: "14", label: "14 dias" },
              { value: "7", label: "7 dias" },
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
                    const temAlgo = dia.djen + dia.kurier > 0;
                    const compara = dia.buscado && dia.comKurier;
                    return (
                      <tr
                        key={dia.data}
                        className={cn("tabular-nums", temAlgo && "cursor-pointer hover:bg-[#f7fbfc]", aberto === dia.data && "bg-[#f2fbfb]")}
                        onClick={temAlgo ? () => onAbrir(dia.data) : undefined}
                        aria-expanded={temAlgo ? aberto === dia.data : undefined}
                      >
                        <td className="px-4 py-2">
                          <DataDoDia data={dia.data} />
                          {!dia.buscado ? (
                            <Selo className="ml-2 px-1.5 py-0 text-[11px]">sem busca no DJEN</Selo>
                          ) : !dia.comKurier ? (
                            dia.emAberto ? (
                              <Selo tom="alerta" className="ml-2 px-1.5 py-0 text-[11px]">
                                aguardando a Kurier
                              </Selo>
                            ) : (
                              <Selo className="ml-2 px-1.5 py-0 text-[11px]">sem Kurier</Selo>
                            )
                          ) : dia.emAberto ? (
                            <Selo tom="alerta" className="ml-2 px-1.5 py-0 text-[11px]">
                              em aberto
                            </Selo>
                          ) : null}
                          {dia.doBkp ? (
                            <Selo tom="marca" className="ml-2 px-1.5 py-0 text-[11px]">
                              BKP {dia.doBkp}
                            </Selo>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">{dia.buscado ? dia.djen : "—"}</td>
                        <td className="px-3 py-2 text-right">{dia.kurier}</td>
                        <td className="px-3 py-2 text-right">{compara ? dia.nosDois : "—"}</td>
                        <td className={cn("px-3 py-2 text-right", dia.soKurier && "font-semibold text-red-700")}>{compara ? dia.soKurier : "—"}</td>
                        <td className="px-3 py-2 text-right">{compara ? dia.soDjen : "—"}</td>
                        <td className="px-4 py-2 text-right">{porcento(dia.cobertura)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 border-t border-[#e6eef0] px-4 py-2 text-[11px] text-muted-foreground">
              <p>
                <strong className="font-medium text-foreground">O dia</strong> é o da disponibilização no DJEN, que é a divulgação na Kurier. O
                arquivo da Kurier de cada manhã traz o que foi divulgado na véspera (publicado no dia) e, às vezes, parte do próprio dia: por isso
                as publicações do arquivo de hoje aparecem na linha de ontem, e a linha de hoje fica “aguardando a Kurier”.
              </p>
              <p>
                O estudo começa em {INICIO_POR_EXTENSO}. O par é pelo ID de comunicação do DJEN (a Kurier traz o mesmo); sem ele, pelo processo no
                mesmo dia. A Kurier lida é a da tabela do Orquestra.{" "}
                <strong className="font-medium text-foreground">BKP:</strong> só nos dias antes de 09/11/2026 (as limpezas do piloto deixaram só o
                Trabalhista no Orquestra), o que falta vem do BKP de publicações do SIOE (lista do SharePoint), sem o ID: ali o par é pelo
                processo no mesmo dia, uma vez por processo.
              </p>
              <p>
                <strong className="font-medium text-foreground">Em aberto:</strong> o dia só fecha com o arquivo seguinte da Kurier; até lá, fica
                fora dos totais. Clique num dia para ver o que está nos dois, só na Kurier e só no DJEN, e por quê.
              </p>
              {dados.erroBkp ? <p className="text-red-700">Não deu para ler o BKP do SIOE ({dados.erroBkp}): os dias antes de 09/11 estão incompletos.</p> : null}
            </div>
          </>
        )}
      </Painel>

      {aberto ? (
        erroDetalhe ? (
          <Aviso tom="erro">{erroDetalhe}</Aviso>
        ) : detalhe ? (
          <DetalheDoDiaView key={detalhe.resumo.data} detalhe={detalhe} />
        ) : (
          <Painel>
            <Carregando rotulo="Separando o que é o quê" />
          </Painel>
        )
      ) : null}
    </div>
  );
}

/** Uma publicação da Kurier numa linha: tribunal, quem localizou, situação e o arquivo que a trouxe. */
function linhaDaKurier(item: PublicacaoKurier): string {
  return (
    item.fonte === "bkp"
      ? [item.tribunal, "BKP do SIOE", item.status, item.arquivo ? `recebida em ${ddmm(item.arquivo)}` : null]
      : [
          item.tribunal,
          item.nomeLocalizado,
          item.djenId ? `ID ${item.djenId}` : "sem ID de comunicação",
          SITUACAO_ATUAL[item.status as PublicacaoStatus] ?? item.status,
          item.arquivo ? `arquivo de ${ddmm(item.arquivo)}` : null,
        ]
  )
    .filter(Boolean)
    .join(" · ");
}

/** Uma comunicação do DJEN numa linha. */
function linhaDoDjen(item: ComunicacaoDjenGuardada): string {
  return [item.tribunal, item.tipo, item.orgao, item.advogados.map((chave) => siglaDoAdvogado.get(chave) ?? chave).join(" + "), `ID ${item.id}`]
    .filter(Boolean)
    .join(" · ");
}

/** Por que a publicação está nos dois. */
function motivoDoPar(par: ParDaConferencia): string {
  if (par.como === "id") return `Mesmo ID de comunicação nos dois (${par.djen.map((item) => item.id).join(", ")}).`;
  if (par.como === "processo") return "A Kurier veio sem o ID (ou com outro): casou pelo processo, no mesmo dia.";
  return `Do BKP, que não tem o ID: casou pelo processo, no mesmo dia (${par.djen.length === 1 ? "1 comunicação" : `${par.djen.length} comunicações`} do DJEN).`;
}

function LinkDoDjen({ item }: { item: ComunicacaoDjenGuardada | undefined }) {
  if (!item?.link) return null;
  return (
    <a href={item.link} target="_blank" rel="noreferrer" className="text-[#347796] hover:underline" aria-label={`Abrir a comunicação ${item.id} no DJEN`}>
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function ItemDaLista({ processo, link, linhas, motivo }: { processo: string | null; link?: ComunicacaoDjenGuardada; linhas: string[]; motivo: string }) {
  return (
    <li className="py-2">
      <p className="flex items-center gap-1.5 font-medium tabular-nums text-foreground">
        {processo ?? "sem número"}
        <LinkDoDjen item={link} />
      </p>
      {linhas.map((linha) => (
        <p key={linha} className="text-xs text-muted-foreground">
          {linha}
        </p>
      ))}
      <p className="mt-0.5 text-xs text-[#285f7a]">
        <span className="font-medium">Por quê:</span> {motivo}
      </p>
    </li>
  );
}

/** O que é o quê num dia: as três listas, com o motivo de cada item. */
export function DetalheDoDiaView({ detalhe }: { detalhe: DetalheDoDia }) {
  const { resumo, pares, soKurier, soDjen, arquivos } = detalhe;
  const [aba, setAba] = useState<Aba>(soKurier.length ? "kurier" : soDjen.length ? "djen" : "dois");
  const deOnde = arquivos.map((item) => (item.arquivo === "BKP" ? `${item.quantas} do BKP do SIOE` : `${item.quantas} no arquivo de ${ddmm(item.arquivo)}`));

  return (
    <Painel aria-labelledby="djen-kurier-dia">
      <PainelTopo id="djen-kurier-dia" titulo={<>O que é o quê em <DataDoDia data={resumo.data} /></>}>
        <Segmented
          label="Lista"
          value={aba}
          options={[
            { value: "dois", label: `Nos dois (${pares.length})` },
            { value: "kurier", label: `Só na Kurier (${soKurier.length})` },
            { value: "djen", label: `Só no DJEN (${soDjen.length})` },
          ]}
          onChange={setAba}
        />
      </PainelTopo>
      <div className="space-y-1 border-b border-[#e6eef0] px-4 py-2 text-xs text-muted-foreground">
        <p>
          <strong className="font-medium text-foreground">DJEN:</strong>{" "}
          {resumo.buscado ? `${resumo.djen} comunicações disponibilizadas em ${ddmm(resumo.data)}.` : "dia sem busca no DJEN."}{" "}
          <strong className="font-medium text-foreground">Kurier:</strong>{" "}
          {resumo.kurier
            ? `${resumo.kurier} publicações divulgadas em ${ddmm(resumo.data)}${deOnde.length ? ` (${deOnde.join(", ")})` : ""}.`
            : resumo.emAberto
              ? "ainda não chegou: o que foi divulgado neste dia vem no próximo arquivo da Kurier."
              : "nenhuma publicação divulgada neste dia."}
        </p>
        {resumo.emAberto && resumo.kurier ? <p>O dia ainda está em aberto: o resto da Kurier dele vem no próximo arquivo.</p> : null}
        {detalhe.erroBkp ? <p className="text-red-700">Não deu para ler o BKP do SIOE ({detalhe.erroBkp}).</p> : null}
      </div>

      <div className="px-4">
        {aba === "dois" ? (
          pares.length ? (
            <ul className="divide-y divide-[#eef3f5] text-sm">
              {pares.map((par) => (
                <ItemDaLista
                  key={par.kurier.id}
                  processo={par.kurier.processo ?? par.djen[0]?.processo ?? null}
                  link={par.djen[0]}
                  linhas={[`Kurier: ${linhaDaKurier(par.kurier)}`, ...par.djen.map((item) => `DJEN: ${linhaDoDjen(item)}`)]}
                  motivo={motivoDoPar(par)}
                />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">Nada nos dois neste dia.</p>
          )
        ) : aba === "kurier" ? (
          soKurier.length ? (
            <ul className="divide-y divide-[#eef3f5] text-sm">
              {soKurier.map(({ kurier: item, djenEmOutrosDias }) => (
                <ItemDaLista
                  key={item.id}
                  processo={item.processo}
                  linhas={[`Kurier: ${linhaDaKurier(item)}`]}
                  motivo={[
                    item.djenId
                      ? `O DJEN, buscado pela OAB do Gustavo e do Ricardo, não trouxe a comunicação ${item.djenId}.`
                      : item.fonte === "bkp"
                        ? "O DJEN não trouxe este processo neste dia (o BKP não tem o ID)."
                        : "A Kurier veio sem o ID, e o DJEN não trouxe este processo neste dia.",
                    djenEmOutrosDias.length ? `O DJEN trouxe este processo em ${lista(djenEmOutrosDias)}.` : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">Nada: tudo o que a Kurier trouxe o DJEN também trouxe.</p>
          )
        ) : soDjen.length ? (
          <ul className="divide-y divide-[#eef3f5] text-sm">
            {soDjen.map(({ djen: item, kurierEmOutrosDias }) => (
              <ItemDaLista
                key={item.id}
                processo={item.processo}
                link={item}
                linhas={[`DJEN: ${linhaDoDjen(item)}`]}
                motivo={[
                  resumo.comKurier
                    ? "A Kurier não trouxe esta comunicação (nem o ID, nem o processo) neste dia."
                    : "A Kurier ainda não trouxe nada deste dia.",
                  kurierEmOutrosDias.length ? `A Kurier trouxe este processo em ${lista(kurierEmOutrosDias)}.` : null,
                  resumo.emAberto ? "O dia ainda está em aberto: pode vir no próximo arquivo da Kurier." : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">Nada a mais no DJEN.</p>
        )}
      </div>
    </Painel>
  );
}
