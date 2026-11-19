import { z } from "zod";
import { gerarParcelas, rotuloDaParcela, type Acordo, type Periodicidade, type PosicaoAcordo } from "./acordos";
import type { Confianca, SugestaoNova } from "./autos-types";
import type { ConferidorDeTrecho } from "./rec-credito-leitura";
import { formatarData, formatarReal } from "./rec-credito";

/**
 * Leitura dos autos para os acordos: o acordo (valor, entrada, parcelas, vencimentos), os pagamentos das
 * parcelas comprovados e o descumprimento informado. Vem na mesma chamada da leitura do cadastro, por pedaço;
 * aqui vira sugestão "acordo" (campo acordo, pagamento ou descumprimento), que só entra na ficha aprovada.
 */

const origem = {
  pagina: z.number().int().describe("Número da página, como na marca [[PÁGINA n]]."),
  trecho: z.string().describe("Cópia literal, de até 200 caracteres, do texto de onde o dado saiu."),
  confianca: z.enum(["alta", "media", "baixa"]),
};

export const ESQUEMA_ACORDOS = z.object({
  acordos: z.array(
    z.object({
      celebrado_em: z.string().nullable().describe("Data do termo ou da petição de acordo, AAAA-MM-DD."),
      homologado_em: z.string().nullable().describe("Data da sentença ou decisão que homologou o acordo, AAAA-MM-DD."),
      cliente_paga: z.boolean().describe("true quando quem paga as parcelas é o cliente do escritório; false quando o cliente recebe."),
      valor_total: z.number().describe("Valor total do acordo, em reais (entrada mais parcelas)."),
      entrada_valor: z.number().nullable().describe("Valor da entrada (ou do pagamento único), em reais."),
      entrada_vencimento: z.string().nullable().describe("Vencimento da entrada, AAAA-MM-DD."),
      quantidade_parcelas: z.number().int().describe("Número de parcelas, sem contar a entrada. 0 quando é pagamento único."),
      valor_parcela: z.number().nullable().describe("Valor de cada parcela, em reais, quando o acordo diz."),
      primeiro_vencimento: z.string().nullable().describe("Vencimento da 1ª parcela (depois da entrada), AAAA-MM-DD."),
      periodicidade: z.enum(["mensal", "quinzenal", "semanal"]),
      multa_percentual: z.number().nullable().describe("Multa (cláusula penal) por atraso ou descumprimento, em %."),
      condicoes: z.string().nullable().describe("Outras condições em uma frase (forma de pagamento, conta, vencimento antecipado, quitação)."),
      ...origem,
    })
  ),
  pagamentos: z.array(
    z.object({
      data: z.string().describe("Data do pagamento comprovado, AAAA-MM-DD."),
      valor: z.number().describe("Valor pago, em reais."),
      parcela_numero: z.number().int().nullable().describe("Número da parcela paga, quando o texto diz (0 = entrada)."),
      descricao: z.string().nullable().describe("Como o texto descreve o pagamento (comprovante, depósito judicial, informação de quitação)."),
      ...origem,
    })
  ),
  descumprimentos: z.array(
    z.object({
      data: z.string().nullable().describe("Data da petição ou certidão que informa o descumprimento, AAAA-MM-DD."),
      descricao: z.string().nullable().describe("O que não foi pago e o que se pediu (prosseguimento da execução, multa)."),
      ...origem,
    })
  ),
});

export type LeituraAcordos = z.infer<typeof ESQUEMA_ACORDOS>;

export function leituraAcordosVazia(): LeituraAcordos {
  return { acordos: [], pagamentos: [], descumprimentos: [] };
}

export function juntarAcordos(leituras: (LeituraAcordos | undefined)[]): LeituraAcordos {
  const tudo = leituraAcordosVazia();
  for (const leitura of leituras) {
    if (!leitura) continue;
    tudo.acordos.push(...leitura.acordos);
    tudo.pagamentos.push(...leitura.pagamentos);
    tudo.descumprimentos.push(...leitura.descumprimentos);
  }
  return tudo;
}

/** Regras dos acordos no pedido à IA (entram nas instruções da leitura). */
export function instrucoesAcordos(): string[] {
  return [
    "acordos (em qualquer processo; listas vazias quando o pedaço não traz):",
    "- acordos: cada acordo entre as partes (termo de acordo, petição conjunta, ata de audiência de conciliação, sentença homologatória), com valor total, entrada, número e valor das parcelas, vencimentos e multa por atraso. O mesmo acordo na petição e na homologação é UM item (use as datas das duas). `cliente_paga`: true quando o cliente do escritório é quem paga. Proposta recusada ou não aceita não é acordo.",
    "- pagamentos: cada pagamento de parcela do acordo comprovado ou informado nos autos (comprovante juntado, petição informando o pagamento, guia de depósito judicial do acordo), com a data e o valor; `parcela_numero` quando o texto diz qual.",
    "- descumprimentos: petição ou certidão que informa que o acordo não foi cumprido (parcela não paga, pedido de prosseguimento da execução ou de aplicação da multa).",
    "- Dinheiro pago por acordo vai em acordos.pagamentos, não em rec_credito.lancamentos.",
  ];
}

/* ------------------------------------------------------------- sugestões */

export type ItemDeAcordo = "acordo" | "pagamento" | "descumprimento";

/** Valor de uma sugestão "acordo": o que gravar, nos campos do formulário da ficha. */
export interface AcordoSugerido {
  item: ItemDeAcordo;
  dados: Record<string, string | number | null>;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 86_400_000;
const PESO: Record<Confianca, number> = { alta: 3, media: 2, baixa: 1 };
const centavos = (valor: number) => Math.round(valor * 100);

function data(texto: string | null | undefined): string | null {
  const limpo = (texto ?? "").trim();
  const br = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(limpo);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : limpo;
  return DATA.test(iso) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? iso : null;
}

function texto(valor: string | null | undefined, maximo: number): string | null {
  const limpo = (valor ?? "").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, maximo) : null;
}

function perto(a: unknown, b: unknown, dias: number): boolean {
  if (typeof a !== "string" || typeof b !== "string" || !DATA.test(a) || !DATA.test(b)) return false;
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) <= dias * DIA;
}

/** O mesmo acordo lido duas vezes (petição e homologação, autos repetidos): mesmo valor total. */
export function mesmoAcordo(a: AcordoSugerido, b: AcordoSugerido): boolean {
  if (a.item !== b.item) return false;
  const x = a.dados;
  const y = b.dados;
  switch (a.item) {
    case "acordo":
      return centavos(Number(x.valorTotal)) === centavos(Number(y.valorTotal));
    case "pagamento":
      return centavos(Number(x.valor)) === centavos(Number(y.valor)) && (x.data === y.data || perto(x.data, y.data, 5));
    case "descumprimento":
      return true;
  }
}

/** Acordos e pagamentos já na ficha, no formato das sugestões. */
export function acordosComoSugeridos(acordos: Acordo[]): AcordoSugerido[] {
  const lista: AcordoSugerido[] = [];
  for (const acordo of acordos) {
    lista.push({ item: "acordo", dados: { valorTotal: acordo.valorTotal } });
    if (acordo.situacao === "descumprido") lista.push({ item: "descumprimento", dados: { data: acordo.descumpridoEm } });
    for (const parcela of acordo.parcelas) if (parcela.pagoEm && parcela.valorPago) lista.push({ item: "pagamento", dados: { data: parcela.pagoEm, valor: parcela.valorPago } });
  }
  return lista;
}

/** Plano de parcelas de um acordo lido, para mostrar na sugestão (e para conferir se fecha). */
export function parcelasDoLido(dados: AcordoSugerido["dados"]): { numero: number; vencimento: string; valor: number }[] | null {
  try {
    const entradaValor = Number(dados.entradaValor) || 0;
    const quantidade = Number(dados.quantidade) || 0;
    return gerarParcelas({
      valorTotal: Number(dados.valorTotal),
      entrada: entradaValor > 0 && typeof dados.entradaVencimento === "string" ? { valor: entradaValor, vencimento: dados.entradaVencimento } : null,
      quantidade,
      primeiroVencimento: typeof dados.primeiroVencimento === "string" ? dados.primeiroVencimento : "",
      periodicidade: (dados.periodicidade as Periodicidade) ?? "mensal",
      valorParcela: Number(dados.valorParcela) > 0 ? Number(dados.valorParcela) : null,
    });
  } catch {
    return null;
  }
}

/**
 * O que a IA leu dos acordos vira sugestões: sem repetir o que já está na ficha nem o que outros documentos já
 * sugeriram, sem repetir entre pedaços (fica a proposta mais confiável) e com a página e o trecho conferidos.
 */
export function sugestoesDosAcordos(lido: LeituraAcordos, existentes: Acordo[], conferidor: ConferidorDeTrecho, jaSugeridos: AcordoSugerido[] = []): SugestaoNova[] {
  const conhecidos = [...acordosComoSugeridos(existentes), ...jaSugeridos];
  const porChave = new Map<string, SugestaoNova & { peso: number }>();
  const lidosAgora: AcordoSugerido[] = [];

  const incluir = (chave: string, resumo: string, valor: AcordoSugerido, de: { pagina: number; trecho: string; confianca: Confianca }, pesoExtra = 0) => {
    if (conhecidos.some((conhecido) => mesmoAcordo(valor, conhecido))) return;
    const achado = conferidor.trecho(de.pagina, de.trecho);
    const confianca: Confianca = achado.conferido ? de.confianca : "baixa";
    const nova = {
      tipo: "acordo" as const,
      campo: valor.item,
      parteId: null,
      item: `acordo_${valor.item}`,
      chave: `acordo:${chave}`,
      resumo: resumo.slice(0, 500),
      valor,
      pagina: achado.pagina,
      trecho: texto(de.trecho, 400),
      trechoConferido: achado.conferido,
      confianca,
      peso: pesoExtra * 100 + PESO[confianca] * 10 + (achado.conferido ? 5 : 0),
    };
    // O mesmo item lido em dois pedaços (com datas um pouco diferentes): fica a proposta mais confiável.
    const repetido = [...porChave.entries()].find(([, atual]) => mesmoAcordo(atual.valor as AcordoSugerido, valor));
    if (repetido) {
      if (nova.peso > repetido[1].peso) {
        porChave.delete(repetido[0]);
        porChave.set(nova.chave, nova);
      }
      return;
    }
    if (porChave.size >= 60) return;
    porChave.set(nova.chave, nova);
    lidosAgora.push(valor);
  };

  for (const acordo of lido.acordos) {
    if (!(acordo.valor_total > 0)) continue;
    const posicao: PosicaoAcordo = acordo.cliente_paga ? "paga" : "recebe";
    const quantidade = Math.max(0, Math.min(360, Math.round(acordo.quantidade_parcelas || 0)));
    const entradaValor = acordo.entrada_valor && acordo.entrada_valor > 0 ? Math.round(acordo.entrada_valor * 100) / 100 : null;
    const dados: AcordoSugerido["dados"] = {
      posicao,
      celebradoEm: data(acordo.celebrado_em),
      homologadoEm: data(acordo.homologado_em),
      valorTotal: Math.round(acordo.valor_total * 100) / 100,
      entradaValor,
      entradaVencimento: entradaValor ? data(acordo.entrada_vencimento) : null,
      quantidade,
      valorParcela: acordo.valor_parcela && acordo.valor_parcela > 0 ? Math.round(acordo.valor_parcela * 100) / 100 : null,
      primeiroVencimento: quantidade ? data(acordo.primeiro_vencimento) : null,
      periodicidade: acordo.periodicidade,
      multaPercentual: acordo.multa_percentual !== null && acordo.multa_percentual >= 0 && acordo.multa_percentual <= 100 ? acordo.multa_percentual : null,
      observacao: texto(acordo.condicoes, 1000),
    };
    // Sem vencimentos, não dá para controlar as parcelas: a proposta não sai.
    if ((quantidade && !dados.primeiroVencimento) || (!quantidade && !(entradaValor && dados.entradaVencimento))) continue;
    const quando = dados.homologadoEm ? `homologado em ${formatarData(dados.homologadoEm as string)}` : dados.celebradoEm ? `de ${formatarData(dados.celebradoEm as string)}` : "";
    const plano = [entradaValor ? `entrada de ${formatarReal(entradaValor)}` : "", quantidade ? `${quantidade} parcela${quantidade === 1 ? "" : "s"}${dados.valorParcela ? ` de ${formatarReal(dados.valorParcela as number)}` : ""}` : ""]
      .filter(Boolean)
      .join(" + ");
    incluir(
      `acordo:${centavos(dados.valorTotal as number)}`,
      `Acordo${quando ? ` ${quando}` : ""}: ${formatarReal(dados.valorTotal as number)} (${plano}), ${posicao === "recebe" ? "o cliente recebe" : "o cliente paga"}`,
      { item: "acordo", dados },
      acordo,
      dados.homologadoEm ? 1 : 0
    );
  }

  for (const pagamento of lido.pagamentos) {
    const quando = data(pagamento.data);
    if (!quando || !(pagamento.valor > 0)) continue;
    const numero = pagamento.parcela_numero !== null && pagamento.parcela_numero >= 0 ? pagamento.parcela_numero : null;
    const descricao = texto(pagamento.descricao, 300);
    incluir(
      `pagamento:${quando}:${centavos(pagamento.valor)}`,
      `Pagamento do acordo${numero !== null ? ` (${rotuloDaParcela(numero).toLowerCase()})` : ""}: ${formatarReal(pagamento.valor)} em ${formatarData(quando)}${descricao ? ` (${descricao})` : ""}`,
      { item: "pagamento", dados: { data: quando, valor: Math.round(pagamento.valor * 100) / 100, parcelaNumero: numero, descricao } },
      pagamento
    );
  }

  // Descumprimento: uma proposta só (a data mais recente), e só quando há acordo na ficha ou lido agora.
  const temAcordo = existentes.some((acordo) => acordo.situacao !== "cancelado") || lidosAgora.some((item) => item.item === "acordo") || jaSugeridos.some((item) => item.item === "acordo");
  const descumprimento = [...lido.descumprimentos].sort((a, b) => (data(b.data) ?? "").localeCompare(data(a.data) ?? ""))[0];
  if (temAcordo && descumprimento) {
    const quando = data(descumprimento.data);
    const descricao = texto(descumprimento.descricao, 300);
    if (quando) {
      incluir(
        "descumprimento",
        `Acordo descumprido em ${formatarData(quando)}${descricao ? `: ${descricao}` : ""}`,
        { item: "descumprimento", dados: { data: quando, descricao } },
        descumprimento
      );
    }
  }

  return [...porChave.values()]
    .map((item) => {
      const { peso, ...sugestao } = item;
      void peso;
      return sugestao;
    })
    .sort((a, b) => (a.pagina ?? Infinity) - (b.pagina ?? Infinity));
}
