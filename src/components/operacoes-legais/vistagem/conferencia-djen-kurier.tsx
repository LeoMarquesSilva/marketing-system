"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CloudDownload, FileSearch, FileSpreadsheet, GitCompareArrows, LoaderCircle, Scale } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { partesDaData } from "@/lib/vistagem/como-fica-no-vios";
import { ADVOGADOS_DJEN, INICIO_DA_CONFERENCIA, chaveDoAdvogado, type ConferenciaDjenKurier } from "@/lib/vistagem/djen-kurier";
import { formatarDataHora } from "./publicacao-ui";
import { Aviso, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo } from "./ui";

type Periodo = "7" | "14" | "30" | "tudo";

/** "01/10/2026" */
const INICIO_POR_EXTENSO = INICIO_DA_CONFERENCIA.split("-").reverse().join("/");
const URL_DA_CONFERENCIA = "/api/operacoes-legais/vistagem/djen-kurier";

const porcento = (valor: number | null) => (valor === null ? "—" : `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
/** "2026-11-11" → "11/11" */
const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** A tela nunca fica carregando para sempre: depois de 1 minuto, mostra o erro. */
const ESPERA_MAXIMA_MS = 60_000;
const mensagemDoErro = (e: unknown, padrao: string) =>
  e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")
    ? "A conferência demorou mais de 1 minuto para responder. Tente de novo em instantes."
    : e instanceof Error
      ? e.message
      : padrao;

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
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    authFetch(`${URL_DA_CONFERENCIA}?dias=${periodo}`, { signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) })
      .then(async (resposta) => {
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a conferência.");
        if (!cancelado) setDados(corpo as ConferenciaDjenKurier);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(mensagemDoErro(e, "Falha ao carregar a conferência."));
      });
    return () => {
      cancelado = true;
    };
  }, [periodo]);

  async function buscarAgora() {
    setBuscando(true);
    setErro("");
    try {
      const resposta = await authFetch(URL_DA_CONFERENCIA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buscar: 2, dias: periodo === "tudo" ? "tudo" : Number(periodo) }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao buscar no DJEN.");
      setDados(corpo as ConferenciaDjenKurier);
    } catch (e) {
      setErro(mensagemDoErro(e, "Falha ao buscar no DJEN."));
    } finally {
      setBuscando(false);
    }
  }

  /** O Excel do período: cada publicação, se está nos dois, só na Kurier ou só no DJEN, e por quê. */
  async function baixarExcel() {
    setBaixando(true);
    setErro("");
    try {
      const resposta = await authFetch(`${URL_DA_CONFERENCIA}?dias=${periodo}&formato=xlsx`, { signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo.error ?? "Falha ao gerar o Excel.");
      }
      const nome = /filename="([^"]+)"/.exec(resposta.headers.get("Content-Disposition") ?? "")?.[1] ?? "conferencia-djen-kurier.xlsx";
      const endereco = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = endereco;
      link.download = nome;
      link.click();
      URL.revokeObjectURL(endereco);
    } catch (e) {
      setErro(mensagemDoErro(e, "Falha ao gerar o Excel."));
    } finally {
      setBaixando(false);
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
        setErro("");
      }}
      buscando={buscando}
      onBuscarAgora={buscarAgora}
      baixando={baixando}
      onBaixarExcel={baixarExcel}
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
  baixando = false,
  onBaixarExcel = () => undefined,
}: {
  dados: ConferenciaDjenKurier | null;
  erro: string;
  periodo: Periodo;
  onPeriodo: (periodo: Periodo) => void;
  buscando: boolean;
  onBuscarAgora: () => void;
  baixando?: boolean;
  onBaixarExcel?: () => void;
}) {
  // Dia sem nada nos dois lados (fim de semana, feriado) não aparece.
  const dias = dados?.dias.filter((dia) => dia.djen + dia.kurier > 0) ?? [];
  return (
    <Painel aria-labelledby="djen-kurier-titulo">
      <PainelTopo
        id="djen-kurier-titulo"
        titulo="Conferência DJEN × Kurier"
        descricao={`Estudo: o que a API pública do DJEN traz para ${ADVOGADOS_DJEN.map((advogado) => `${advogado.nome} (OAB ${chaveDoAdvogado(advogado)})`).join(" e ")}, comparado com o que a Kurier trouxe. Não muda nada no fluxo das publicações.`}
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
        <Button variant="outline" onClick={onBaixarExcel} disabled={baixando || !dados}>
          {baixando ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
          Baixar Excel
        </Button>
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
      ) : null}
      {!dados ? (
        erro ? null : <Carregando rotulo="Comparando o DJEN com a Kurier" />
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
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Comparação por dia de publicação</caption>
              <thead className="bg-[#f7fbfc] text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Publicação</th>
                  <th className="px-3 py-2 font-medium">Disponibilizado no DJEN</th>
                  <th className="px-3 py-2 text-right font-medium">DJEN</th>
                  <th className="px-3 py-2 text-right font-medium">Kurier</th>
                  <th className="px-3 py-2 text-right font-medium">Nos dois</th>
                  <th className="px-3 py-2 text-right font-medium">Só na Kurier</th>
                  <th className="px-3 py-2 text-right font-medium">Só no DJEN</th>
                  <th className="px-4 py-2 text-right font-medium">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f5]">
                {dias.map((dia) => {
                  const compara = dia.buscado && dia.comKurier;
                  return (
                    <tr key={dia.data} className="tabular-nums">
                      <td className="px-4 py-2">
                        <DataDoDia data={dia.publicacao} />
                        {!dia.buscado ? (
                          <Selo className="ml-2 px-1.5 py-0 text-[11px]">sem busca no DJEN</Selo>
                        ) : !dia.comKurier ? (
                          dia.emAberto ? (
                            <Selo tom="alerta" className="ml-2 px-1.5 py-0 text-[11px]">
                              Kurier chega em {ddmm(dia.publicacao)}
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
                      <td className="px-3 py-2 text-muted-foreground">
                        <DataDoDia data={dia.data} />
                      </td>
                      <td className="px-3 py-2 text-right">{dia.buscado ? dia.djen : "—"}</td>
                      <td className="px-3 py-2 text-right">{dia.comKurier ? dia.kurier : "—"}</td>
                      <td className="px-3 py-2 text-right">{compara ? dia.nosDois : "—"}</td>
                      <td className={cn("px-3 py-2 text-right", compara && dia.soKurier && "font-semibold text-red-700")}>{compara ? dia.soKurier : "—"}</td>
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
              <strong className="font-medium text-foreground">Cada linha é um dia de publicação</strong>, o dia em que a Kurier entrega: o arquivo da
              manhã traz as publicações do dia, que o DJEN disponibilizou no dia útil anterior. A primeira linha é a de amanhã: o DJEN já tem o
              que disponibilizou hoje, e a Kurier dele chega no arquivo de amanhã.
            </p>
            <p>
              O estudo começa em {INICIO_POR_EXTENSO}. O par é pelo ID de comunicação do DJEN (a Kurier traz o mesmo); sem ele, pelo processo no
              mesmo dia. A Kurier lida é a da tabela do Orquestra.{" "}
              <strong className="font-medium text-foreground">BKP:</strong> só antes de 09/11/2026 (as limpezas do piloto deixaram só o
              Trabalhista no Orquestra), o que falta vem do BKP de publicações do SIOE, sem o ID: ali o par é pelo processo, uma vez por
              processo e dia.
            </p>
            <p>
              <strong className="font-medium text-foreground">Em aberto</strong> e <strong className="font-medium text-foreground">Kurier chega em</strong>{" "}
              ficam fora dos totais até chegar o arquivo da Kurier. Para ver o que é o quê (nos dois, só na Kurier, só no DJEN) e por quê,
              use “Baixar Excel”.
            </p>
            {dados.erroBkp ? <p className="text-red-700">Não deu para ler o BKP do SIOE ({dados.erroBkp}): os dias antes de 09/11 estão incompletos.</p> : null}
          </div>
        </>
      )}
    </Painel>
  );
}
