/**
 * O Excel da conferência DJEN × Kurier (pedido de 12/11/2026): o racional de cada publicação — se está nos dois, só na
 * Kurier ou só no DJEN, e por quê —, o resumo por dia e como ler. Puro: recebe os detalhes já comparados.
 */
import * as XLSX from "xlsx";
import {
  ADVOGADOS_DJEN,
  INICIO_DA_CONFERENCIA,
  chaveDoAdvogado,
  type ComunicacaoDjenGuardada,
  type DetalheDoDia,
  type ParDaConferencia,
  type PublicacaoKurier,
  type ResumoDoDia,
} from "./djen-kurier";
import { SITUACAO_ATUAL } from "./historico";
import type { PublicacaoStatus } from "./types";

type Celula = string | number | null;
type Linha = Record<string, Celula>;

const siglaDoAdvogado = new Map(ADVOGADOS_DJEN.map((advogado) => [chaveDoAdvogado(advogado), advogado.sigla]));

/** As colunas com data: o número de série do Excel, mostrado como dd/mm/aaaa. */
const COLUNAS_DE_DATA = new Set(["Publicação", "Disponibilização / divulgação", "Kurier: arquivo de"]);

/**
 * "2026-11-12" → número de série do Excel (dias desde 30/12/1899). Número, e não Date: o Date passa pelo fuso do
 * servidor e pode virar o dia anterior.
 */
export const dataDoExcel = (iso: string | null): number | null => {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86_400_000);
};
/** "2026-11-12" → "12/11" */
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** O dia entra nos totais? Senão, por quê. */
function entraNosTotais(resumo: ResumoDoDia): string {
  if (!resumo.buscado) return "Não: dia sem busca no DJEN";
  if (!resumo.comKurier) return resumo.emAberto ? "Não: a Kurier deste dia ainda não chegou" : "Não: sem Kurier neste dia";
  if (resumo.emAberto) return "Não: dia em aberto (falta o próximo arquivo da Kurier)";
  return "Sim";
}

function situacaoDoDia(resumo: ResumoDoDia): string {
  if (!resumo.buscado) return "Sem busca no DJEN";
  if (!resumo.comKurier) return resumo.emAberto ? "Aguardando a Kurier" : "Sem Kurier";
  if (resumo.emAberto) return "Em aberto";
  return resumo.doBkp ? "Fechado (com BKP)" : "Fechado";
}

const situacaoNaKurier = (item: PublicacaoKurier) => (item.fonte === "bkp" ? item.status : (SITUACAO_ATUAL[item.status as PublicacaoStatus] ?? item.status));

const colunasDaKurier = (item: PublicacaoKurier | null): Linha => ({
  "Kurier: ID da comunicação": item?.djenId ?? null,
  "Kurier: localizado": item?.nomeLocalizado ?? null,
  "Kurier: situação": item ? situacaoNaKurier(item) : null,
  "Kurier: origem": item ? (item.fonte === "bkp" ? "BKP do SIOE" : "Orquestra") : null,
  "Kurier: arquivo de": dataDoExcel(item?.arquivo ?? null),
});

const juntar = (valores: (string | number | null)[]) => [...new Set(valores.filter((valor) => valor !== null && valor !== ""))].join(" | ") || null;

const colunasDoDjen = (comunicacoes: ComunicacaoDjenGuardada[]): Linha => ({
  "DJEN: ID da comunicação": juntar(comunicacoes.map((item) => item.id)),
  "DJEN: tipo": juntar(comunicacoes.map((item) => item.tipo)),
  "DJEN: órgão": juntar(comunicacoes.map((item) => item.orgao)),
  "DJEN: advogados": juntar(comunicacoes.map((item) => item.advogados.map((chave) => siglaDoAdvogado.get(chave) ?? chave).join(" + "))),
  "DJEN: link": juntar(comunicacoes.map((item) => item.link)),
});

function motivoDoPar(par: ParDaConferencia): string {
  if (par.como === "id") return "Mesmo ID de comunicação nos dois.";
  if (par.como === "processo") return "A Kurier veio sem o ID (ou com outro): casou pelo processo, no mesmo dia.";
  return `Do BKP do SIOE, que não tem o ID: casou pelo processo, no mesmo dia (${par.djen.length === 1 ? "1 comunicação" : `${par.djen.length} comunicações`} do DJEN).`;
}

function motivoSoNaKurier(item: PublicacaoKurier): string {
  if (item.djenId) return "O DJEN, buscado pela OAB do Gustavo e do Ricardo, não trouxe esta comunicação.";
  if (item.fonte === "bkp") return "O DJEN não trouxe este processo neste dia (o BKP não tem o ID).";
  return "A Kurier veio sem o ID, e o DJEN não trouxe este processo neste dia.";
}

function motivoSoNoDjen(resumo: ResumoDoDia): string {
  if (!resumo.comKurier) return resumo.emAberto ? "A Kurier deste dia ainda não chegou: vem no arquivo do dia da publicação." : "Não há Kurier neste dia.";
  const base = "A Kurier não trouxe esta comunicação (nem o ID, nem o processo) neste dia.";
  return resumo.emAberto ? `${base} O dia ainda está em aberto: pode vir no próximo arquivo da Kurier.` : base;
}

/** As linhas das duas abas de dados: uma por publicação (o racional) e uma por dia (o resumo). */
export function linhasDaPlanilha(detalhes: DetalheDoDia[]): { publicacoes: Linha[]; resumo: Linha[] } {
  const publicacoes: Linha[] = [];
  const resumo: Linha[] = [];
  for (const { resumo: dia, pares, soKurier, soDjen } of detalhes) {
    const comum = (situacao: string, motivo: string, processo: string | null, tribunal: string | null): Linha => ({
      Publicação: dataDoExcel(dia.publicacao),
      "Disponibilização / divulgação": dataDoExcel(dia.data),
      Situação: situacao,
      "Por quê": motivo,
      Processo: processo,
      Tribunal: tribunal,
    });
    const totais = entraNosTotais(dia);
    for (const par of pares) {
      publicacoes.push({
        ...comum("Nos dois", motivoDoPar(par), par.kurier.processo ?? par.djen[0]?.processo ?? null, par.djen[0]?.tribunal ?? par.kurier.tribunal),
        ...colunasDaKurier(par.kurier),
        ...colunasDoDjen(par.djen),
        "Outro lado em outros dias": null,
        "Entra nos totais": totais,
      });
    }
    for (const { kurier, djenEmOutrosDias } of soKurier) {
      publicacoes.push({
        ...comum("Só na Kurier", motivoSoNaKurier(kurier), kurier.processo, kurier.tribunal),
        ...colunasDaKurier(kurier),
        ...colunasDoDjen([]),
        "Outro lado em outros dias": djenEmOutrosDias.length ? `DJEN trouxe o processo em ${djenEmOutrosDias.map(ddmm).join(", ")}` : null,
        "Entra nos totais": totais,
      });
    }
    for (const { djen, kurierEmOutrosDias } of soDjen) {
      publicacoes.push({
        ...comum("Só no DJEN", motivoSoNoDjen(dia), djen.processo, djen.tribunal),
        ...colunasDaKurier(null),
        ...colunasDoDjen([djen]),
        "Outro lado em outros dias": kurierEmOutrosDias.length ? `Kurier trouxe o processo em ${kurierEmOutrosDias.map(ddmm).join(", ")}` : null,
        "Entra nos totais": totais,
      });
    }
    resumo.push({
      Publicação: dataDoExcel(dia.publicacao),
      "Disponibilização / divulgação": dataDoExcel(dia.data),
      DJEN: dia.buscado ? dia.djen : null,
      Kurier: dia.kurier,
      "Kurier do BKP": dia.doBkp || null,
      "Nos dois": dia.nosDois,
      "Só na Kurier": dia.soKurier,
      "Só no DJEN": dia.comKurier ? dia.soDjen : null,
      Cobertura: dia.cobertura,
      "Situação do dia": situacaoDoDia(dia),
      "Entra nos totais": totais,
    });
  }
  return { publicacoes, resumo };
}

const COMO_LER = [
  ["Conferência DJEN × Kurier"],
  [`Estudo desde ${INICIO_DA_CONFERENCIA.split("-").reverse().join("/")}: o que a API pública do DJEN traz pela OAB do Gustavo (275477/SP) e do Ricardo (353389/SP), comparado com o que a Kurier trouxe.`],
  [""],
  ["Datas"],
  ["Disponibilização (DJEN) = divulgação (Kurier): é por ela que se compara. Publicação: o dia útil seguinte, que é o dia em que a Kurier entrega."],
  ["O arquivo da Kurier de cada manhã traz as publicações do dia (disponibilizadas no DJEN no dia útil anterior). O que o DJEN disponibilizou hoje só chega na Kurier no arquivo de amanhã."],
  [""],
  ["Situação"],
  ["Nos dois: a Kurier e o DJEN trouxeram. Só na Kurier: o DJEN, buscado pela OAB, não trouxe. Só no DJEN: a Kurier não trouxe."],
  ["Como casa: pelo ID de comunicação do DJEN (a Kurier traz o mesmo); sem ele, pelo processo no mesmo dia de disponibilização."],
  ["BKP do SIOE: antes de 09/11/2026 as limpezas do piloto deixaram só o Trabalhista no Orquestra; o que falta vem da lista do SharePoint, sem o ID (casa pelo processo, uma vez por processo e dia)."],
  [""],
  ["Totais"],
  ["Ficam fora dos totais: o dia sem busca no DJEN, o dia sem Kurier e o dia em aberto (o próximo arquivo da Kurier ainda pode trazer o resto dele)."],
  ["Cobertura: a parte da Kurier que o DJEN também trouxe."],
];

/** Larguras das colunas (em caracteres), para abrir legível. */
function larguras(linhas: Linha[], minimo = 10, maximo = 60): XLSX.ColInfo[] {
  const colunas = Object.keys(linhas[0] ?? {});
  return colunas.map((coluna) => ({
    wch: Math.min(
      maximo,
      Math.max(minimo, coluna.length + 2, ...linhas.slice(0, 300).map((linha) => (COLUNAS_DE_DATA.has(coluna) ? 11 : String(linha[coluna] ?? "").length + 1)))
    ),
  }));
}

/** Aplica um formato às células numéricas das colunas pedidas (a partir da 2ª linha). */
function formatarColunas(folha: XLSX.WorkSheet, cabecalho: string[], colunas: (coluna: string) => string | null) {
  if (!folha["!ref"]) return;
  const fim = XLSX.utils.decode_range(folha["!ref"]).e.r;
  cabecalho.forEach((coluna, indice) => {
    const formato = colunas(coluna);
    if (!formato) return;
    for (let linha = 1; linha <= fim; linha++) {
      const celula = folha[XLSX.utils.encode_cell({ r: linha, c: indice })];
      if (celula && typeof celula.v === "number") celula.z = formato;
    }
  });
}

function aba(linhas: Linha[], vazia: string): XLSX.WorkSheet {
  if (!linhas.length) return XLSX.utils.aoa_to_sheet([[vazia]]);
  const folha = XLSX.utils.json_to_sheet(linhas);
  const cabecalho = Object.keys(linhas[0]);
  formatarColunas(folha, cabecalho, (coluna) => (COLUNAS_DE_DATA.has(coluna) ? "dd/mm/yyyy" : coluna === "Cobertura" ? "0.0%" : null));
  if (folha["!ref"]) folha["!autofilter"] = { ref: folha["!ref"] };
  folha["!cols"] = larguras(linhas);
  return folha;
}

/** O arquivo .xlsx da conferência: "Publicações" (o racional), "Resumo por dia" e "Como ler". */
export function planilhaDaConferencia(detalhes: DetalheDoDia[], { erroBkp = null }: { erroBkp?: string | null } = {}): Buffer {
  const { publicacoes, resumo } = linhasDaPlanilha(detalhes);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, aba(publicacoes, "Nenhuma publicação no período."), "Publicações");
  XLSX.utils.book_append_sheet(livro, aba(resumo, "Nenhum dia no período."), "Resumo por dia");
  const comoLer = XLSX.utils.aoa_to_sheet(erroBkp ? [...COMO_LER, [""], [`Atenção: não deu para ler o BKP do SIOE (${erroBkp}); os dias antes de 09/11 estão incompletos.`]] : COMO_LER);
  comoLer["!cols"] = [{ wch: 140 }];
  XLSX.utils.book_append_sheet(livro, comoLer, "Como ler");
  return XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
