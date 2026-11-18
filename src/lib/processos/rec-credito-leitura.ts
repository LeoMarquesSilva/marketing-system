import { z } from "zod";
import type { Confianca, SugestaoNova } from "./autos-types";
import { MEIOS_CITACAO, RESULTADOS_CITACAO, SITUACOES_PEDIDO, TIPOS_LANCAMENTO, formatarData, formatarReal, type ItensRecCredito, type TipoItem } from "./rec-credito";

/**
 * Leitura dos autos para o saneamento da Rec. Crédito: títulos executados, tentativas de citação, pedidos de
 * execução e dinheiro (guias pagas, valores levantados). Vem na mesma chamada da leitura do cadastro, por
 * pedaço dos autos; aqui o que a IA devolveu vira sugestão "rec_credito", que só entra na ficha aprovada.
 */

const origem = {
  pagina: z.number().int().describe("Número da página, como na marca [[PÁGINA n]]."),
  trecho: z.string().describe("Cópia literal, de até 200 caracteres, do texto de onde o dado saiu."),
  confianca: z.enum(["alta", "media", "baixa"]),
};

export const TIPOS_TITULO_LIDOS = ["nota_promissoria", "duplicata", "ccb", "cheque", "contrato", "outro"] as const;

export const ESQUEMA_REC_CREDITO = z.object({
  titulos: z.array(
    z.object({
      tipo: z.enum(TIPOS_TITULO_LIDOS),
      descricao: z.string().describe("Como a peça chama o título (ex.: \"Duplicata mercantil\", \"Cédula de Crédito Bancário\")."),
      numero: z.string().nullable(),
      valor: z.number().describe("Valor de face do título, em reais."),
      vencimento: z.string().describe("Vencimento do título, AAAA-MM-DD."),
      ...origem,
    })
  ),
  citacoes: z.array(
    z.object({
      data: z.string().nullable().describe("Data da tentativa (do AR, da diligência, do edital), AAAA-MM-DD."),
      meio: z.enum(["ar", "oficial", "edital", "eletronica", "outro"]),
      resultado: z.enum(["positiva", "negativa", "pendente"]),
      endereco: z.string().nullable().describe("Endereço onde se tentou citar, como está escrito."),
      motivo: z.string().nullable().describe("Motivo do insucesso, como está escrito (mudou-se, desconhecido, ausente, endereço insuficiente…)."),
      ...origem,
    })
  ),
  pedidos: z.array(
    z.object({
      tipo: z.string().describe("SISBAJUD, RENAJUD, INFOJUD, CNIB, SERASAJUD, Penhora, Pesquisa de bens, Protesto, Desconsideração da personalidade jurídica, Citação por edital ou outro, com o nome curto."),
      data_pedido: z.string().nullable().describe("Data da petição que fez o pedido, AAAA-MM-DD."),
      situacao: z.enum(["requerido", "deferido", "indeferido", "prejudicado"]),
      data_decisao: z.string().nullable().describe("Data da decisão sobre o pedido, AAAA-MM-DD."),
      resultado: z.string().nullable().describe("O que resultou (ex.: \"bloqueio de R$ 1.234,56 no Banco X\", \"nenhum veículo encontrado\", \"resultado negativo\")."),
      valor_obtido: z.number().nullable().describe("Valor bloqueado ou penhorado, em reais, quando o texto traz."),
      ...origem,
    })
  ),
  lancamentos: z.array(
    z.object({
      tipo: z.enum(["guia_paga", "levantamento"]),
      data: z.string().describe("Data do pagamento ou do levantamento, AAAA-MM-DD."),
      valor: z.number().describe("Valor em reais."),
      descricao: z.string().nullable().describe("O que foi pago ou levantado (ex.: \"guia de diligência do oficial\", \"alvará de levantamento\")."),
      ...origem,
    })
  ),
});

export type LeituraRecCredito = z.infer<typeof ESQUEMA_REC_CREDITO>;

export function leituraRecCreditoVazia(): LeituraRecCredito {
  return { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
}

/** Regras da Rec. Crédito no pedido à IA (entram nas instruções da leitura). */
export function instrucoesRecCredito(): string[] {
  return [
    "rec_credito (saneamento da Recuperação de Crédito; listas vazias quando o pedaço não traz):",
    "- titulos: cada título executado ou cobrado (nota promissória, duplicata, CCB, cheque, contrato), um item por título, com valor de face e vencimento, como a petição inicial, o demonstrativo do débito ou a cópia do título mostram. Não some títulos; não use o valor atualizado. Sem valor ou sem vencimento, não devolva. `tipo`: nota_promissoria, duplicata, ccb (Cédula de Crédito Bancário), cheque, contrato ou outro.",
    "- citacoes: cada tentativa de citar o devedor (aviso de recebimento, certidão do oficial de justiça, edital, citação eletrônica), com o endereço e o resultado: positiva (citado), negativa (não encontrado, mudou-se, desconhecido) ou pendente (expedida, sem retorno no pedaço). Despacho que só manda citar não é tentativa.",
    "- pedidos: cada providência que o CREDOR pediu para receber (SISBAJUD, RENAJUD, INFOJUD, CNIB, SERASAJUD, penhora, pesquisa de bens, protesto, desconsideração da personalidade jurídica, citação por edital) e o que o juiz decidiu e o que resultou. Pedido e decisão sobre o mesmo pedido são UM item: use a situação final que o pedaço mostra. Pedido do devedor não entra.",
    "- lancamentos: guia_paga = custas, taxas ou diligências pagas pelo credor (com o comprovante ou a guia no pedaço); levantamento = dinheiro que o credor recebeu (alvará ou mandado de levantamento expedido, transferência ao credor, pagamento do acordo comprovado). Bloqueio que não foi levantado não é levantamento.",
    "- Datas em AAAA-MM-DD; valores em reais, com ponto decimal (12345.67).",
  ];
}

export function juntarRecCredito(leituras: (LeituraRecCredito | undefined)[]): LeituraRecCredito {
  const tudo = leituraRecCreditoVazia();
  for (const leitura of leituras) {
    if (!leitura) continue;
    tudo.titulos.push(...leitura.titulos);
    tudo.citacoes.push(...leitura.citacoes);
    tudo.pedidos.push(...leitura.pedidos);
    tudo.lancamentos.push(...leitura.lancamentos);
  }
  return tudo;
}

/* ------------------------------------------------------------- sugestões */

/** Valor de uma sugestão da Rec. Crédito: o item a incluir, nos campos do formulário da ficha. */
export interface ItemSugerido {
  item: TipoItem;
  dados: Record<string, string | number | null>;
  /** Para título: a lista "Tipo de título" no momento da leitura (o formulário de conferência usa). */
  tipos?: string[];
}

export interface ConferidorDeTrecho {
  trecho(pagina: number | null, trecho: string | null): { pagina: number | null; conferido: boolean };
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const PESO: Record<Confianca, number> = { alta: 3, media: 2, baixa: 1 };
const LIMITE: Record<TipoItem, number> = { titulo: 60, citacao: 30, pedido: 40, lancamento: 40 };

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

function chaveTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 60);
}

const centavos = (valor: number) => Math.round(valor * 100);

/** "Nota promissória" ↔ nota_promissoria: casa o tipo lido com a lista de Cadastros pelo texto. */
export function tipoDaLista(tipo: (typeof TIPOS_TITULO_LIDOS)[number], descricao: string, lista: string[]): string {
  const alvo: Record<string, RegExp> = {
    nota_promissoria: /notapromissoria/,
    duplicata: /duplicata/,
    ccb: /^ccb|ceduladecreditobancario/,
    cheque: /cheque/,
    contrato: /contrato/,
  };
  const padrao = alvo[tipo];
  const achado = padrao ? lista.find((item) => padrao.test(chaveTexto(item))) : undefined;
  // Fora da lista: o nome padrão do tipo (casa quando a equipe incluir o tipo em Cadastros); só "outro" usa a peça.
  const PADRAO: Record<string, string> = { nota_promissoria: "Nota promissória", duplicata: "Duplicata", ccb: "CCB (Cédula de Crédito Bancário)", cheque: "Cheque", contrato: "Contrato" };
  return achado ?? PADRAO[tipo] ?? (texto(descricao, 80) || "Outro");
}

/** Chaves dos itens já lançados: a leitura não propõe de novo o que a ficha já tem. */
export function chavesExistentes(itens: ItensRecCredito): Set<string> {
  const chaves = new Set<string>();
  for (const titulo of itens.titulos) chaves.add(`titulo:${centavos(titulo.valor)}:${titulo.vencimento}`);
  for (const citacao of itens.citacoes) chaves.add(`citacao:${citacao.tentativaEm ?? ""}:${citacao.resultado}:${chaveTexto(citacao.endereco)}`);
  for (const pedido of itens.pedidos) chaves.add(`pedido:${chaveTexto(pedido.tipo)}:${pedido.pedidoEm ?? pedido.decididoEm ?? ""}`);
  for (const lancamento of itens.lancamentos) chaves.add(`lancamento:${lancamento.tipo}:${lancamento.data}:${centavos(lancamento.valor)}`);
  return chaves;
}

const ORDEM_SITUACAO: Record<string, number> = { requerido: 0, prejudicado: 1, indeferido: 2, deferido: 2 };

/** Itens já lançados, no formato das sugestões, para comparar com o que a leitura achou. */
export function comoSugeridos(itens: ItensRecCredito): ItemSugerido[] {
  return [
    ...itens.titulos.map((titulo): ItemSugerido => ({ item: "titulo", dados: { tipo: titulo.tipo, numero: titulo.numero, valor: titulo.valor, vencimento: titulo.vencimento } })),
    ...itens.citacoes.map((citacao): ItemSugerido => ({ item: "citacao", dados: { tentativaEm: citacao.tentativaEm, meio: citacao.meio, resultado: citacao.resultado, endereco: citacao.endereco } })),
    ...itens.pedidos.map((pedido): ItemSugerido => ({ item: "pedido", dados: { tipo: pedido.tipo, pedidoEm: pedido.pedidoEm, situacao: pedido.situacao, decididoEm: pedido.decididoEm } })),
    ...itens.lancamentos.map((lancamento): ItemSugerido => ({ item: "lancamento", dados: { tipo: lancamento.tipo, data: lancamento.data, valor: lancamento.valor } })),
  ];
}

const DIA = 86_400_000;
/** Datas a até `dias` uma da outra (as duas presentes). */
function perto(a: unknown, b: unknown, dias: number): boolean {
  if (typeof a !== "string" || typeof b !== "string" || !DATA.test(a) || !DATA.test(b)) return false;
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) <= dias * DIA;
}

/** Mesmo endereço: o começo do logradouro igual e algum número em comum (o da casa), ignorando a ordem do resto. */
function mesmoEndereco(a: unknown, b: unknown): boolean {
  const x = chaveTexto(typeof a === "string" ? a : "");
  const y = chaveTexto(typeof b === "string" ? b : "");
  if (x.length < 12 || y.length < 12) return x === y;
  const numeros = (texto: unknown) => new Set((typeof texto === "string" ? texto : "").match(/\d+/g) ?? []);
  const nx = numeros(a);
  return x.slice(0, 20) === y.slice(0, 20) && [...numeros(b)].some((numero) => nx.has(numero));
}

/** "RENAJUD e INFOJUD" e "INFOJUD e RENAJUD" são o mesmo pedido. */
function tipoDoPedido(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra && !["e", "de", "da", "do", "via", "pesquisa"].includes(palavra))
    .sort()
    .join(" ");
}

/**
 * O mesmo item lido duas vezes, com pequenas diferenças: autos do eproc que repetem o histórico do e-SAJ,
 * a data do protocolo num e a da juntada noutro. Datas valem com folga de alguns dias.
 */
export function mesmoItem(a: ItemSugerido, b: ItemSugerido): boolean {
  if (a.item !== b.item) return false;
  const x = a.dados;
  const y = b.dados;
  switch (a.item) {
    case "titulo":
      return centavos(Number(x.valor)) === centavos(Number(y.valor)) && (x.vencimento === y.vencimento || perto(x.vencimento, y.vencimento, 3));
    case "citacao":
      if (x.resultado !== y.resultado) return false;
      if (x.tentativaEm && y.tentativaEm) return perto(x.tentativaEm, y.tentativaEm, 5);
      // Sem data num dos dois: a mesma tentativa se o endereço é o mesmo (rua e número), escrito de jeitos diferentes.
      return mesmoEndereco(x.endereco, y.endereco);
    case "pedido": {
      if (tipoDoPedido(x.tipo) !== tipoDoPedido(y.tipo)) return false;
      if (perto(x.pedidoEm, y.pedidoEm, 5) || perto(x.decididoEm, y.decididoEm, 5)) return true;
      const semData = (dados: ItemSugerido["dados"]) => !dados.pedidoEm && !dados.decididoEm;
      return semData(x) && semData(y) && x.situacao === y.situacao;
    }
    case "lancamento":
      return x.tipo === y.tipo && centavos(Number(x.valor)) === centavos(Number(y.valor)) && (x.data === y.data || perto(x.data, y.data, 5));
  }
}

/**
 * O que a IA leu da Rec. Crédito vira sugestões: sem repetir o que já está na ficha, sem repetir entre
 * pedaços (fica a proposta mais confiável) e com a página e o trecho conferidos no PDF.
 */
export function sugestoesDaRecCredito(
  lido: LeituraRecCredito,
  existentes: ItensRecCredito,
  tiposTitulo: string[],
  conferidor: ConferidorDeTrecho,
  /** O que outros documentos do processo já sugeriram (aprovado, recusado ou pendente). */
  jaSugeridos: ItemSugerido[] = []
): SugestaoNova[] {
  const jaTem = chavesExistentes(existentes);
  const conhecidos = [...comoSugeridos(existentes), ...jaSugeridos];
  const porChave = new Map<string, SugestaoNova & { peso: number }>();
  const contagem: Record<TipoItem, number> = { titulo: 0, citacao: 0, pedido: 0, lancamento: 0 };

  const incluir = (item: TipoItem, chave: string, resumo: string, valor: ItemSugerido, de: { pagina: number; trecho: string; confianca: Confianca }, pesoExtra = 0) => {
    if (jaTem.has(chave) || conhecidos.some((conhecido) => mesmoItem(valor, conhecido))) return;
    const achado = conferidor.trecho(de.pagina, de.trecho);
    const confianca: Confianca = achado.conferido ? de.confianca : "baixa";
    const nova = {
      tipo: "rec_credito" as const,
      campo: item,
      parteId: null,
      item: `rec_credito_${item}`,
      chave: `rec_credito:${chave}`,
      resumo: resumo.slice(0, 500),
      valor,
      pagina: achado.pagina,
      trecho: texto(de.trecho, 400),
      trechoConferido: achado.conferido,
      confianca,
      peso: pesoExtra * 100 + PESO[confianca] * 10 + (achado.conferido ? 5 : 0),
    };
    const atual = porChave.get(nova.chave);
    if (atual) {
      if (nova.peso > atual.peso) porChave.set(nova.chave, nova);
      return;
    }
    if (contagem[item] >= LIMITE[item]) return;
    contagem[item] += 1;
    porChave.set(nova.chave, nova);
  };

  for (const titulo of lido.titulos) {
    const vencimento = data(titulo.vencimento);
    if (!vencimento || !(titulo.valor > 0)) continue;
    const tipo = tipoDaLista(titulo.tipo, titulo.descricao, tiposTitulo);
    const numero = texto(titulo.numero, 120);
    incluir(
      "titulo",
      `titulo:${centavos(titulo.valor)}:${vencimento}`,
      `Título: ${tipo}${numero ? ` nº ${numero}` : ""}, ${formatarReal(titulo.valor)}, vencimento ${formatarData(vencimento)}`,
      { item: "titulo", dados: { tipo, numero, valor: Math.round(titulo.valor * 100) / 100, vencimento }, tipos: tiposTitulo },
      titulo
    );
  }

  for (const citacao of lido.citacoes) {
    const quando = data(citacao.data);
    const endereco = texto(citacao.endereco, 500);
    const meio = MEIOS_CITACAO.find((item) => item.valor === citacao.meio)?.rotulo ?? citacao.meio;
    const resultado = RESULTADOS_CITACAO.find((item) => item.valor === citacao.resultado)?.rotulo ?? citacao.resultado;
    incluir(
      "citacao",
      `citacao:${quando ?? ""}:${citacao.resultado}:${chaveTexto(endereco)}`,
      `Citação por ${meio}${quando ? ` em ${formatarData(quando)}` : ""}: ${resultado}${endereco ? ` (${endereco})` : ""}`,
      { item: "citacao", dados: { tentativaEm: quando, meio: citacao.meio, resultado: citacao.resultado, endereco, observacao: texto(citacao.motivo, 1000) } },
      citacao
    );
  }

  for (const pedido of lido.pedidos) {
    const tipo = texto(pedido.tipo, 120);
    if (!tipo) continue;
    const pedidoEm = data(pedido.data_pedido);
    const decididoEm = data(pedido.data_decisao);
    const situacao = SITUACOES_PEDIDO.find((item) => item.valor === pedido.situacao)?.rotulo ?? pedido.situacao;
    const valorObtido = pedido.valor_obtido && pedido.valor_obtido > 0 ? Math.round(pedido.valor_obtido * 100) / 100 : null;
    const resultado = texto(pedido.resultado, 1000);
    // Pedido e decisão em páginas diferentes viram uma proposta só: fica a da situação mais avançada.
    incluir(
      "pedido",
      `pedido:${chaveTexto(tipo)}:${pedidoEm ?? decididoEm ?? ""}`,
      `Pedido de execução: ${tipo}${pedidoEm ? ` (${formatarData(pedidoEm)})` : ""}: ${situacao}${resultado ? `, ${resultado}` : ""}${valorObtido ? ` (${formatarReal(valorObtido)})` : ""}`,
      { item: "pedido", dados: { tipo, pedidoEm, situacao: pedido.situacao, decididoEm, resultado, valorObtido, descricao: null } },
      pedido,
      ORDEM_SITUACAO[pedido.situacao] ?? 0
    );
  }

  for (const lancamento of lido.lancamentos) {
    const quando = data(lancamento.data);
    if (!quando || !(lancamento.valor > 0)) continue;
    const rotulo = TIPOS_LANCAMENTO.find((item) => item.valor === lancamento.tipo)?.rotulo ?? lancamento.tipo;
    const descricao = texto(lancamento.descricao, 500);
    incluir(
      "lancamento",
      `lancamento:${lancamento.tipo}:${quando}:${centavos(lancamento.valor)}`,
      `${rotulo}: ${formatarReal(lancamento.valor)} em ${formatarData(quando)}${descricao ? ` (${descricao})` : ""}`,
      { item: "lancamento", dados: { tipo: lancamento.tipo, data: quando, valor: Math.round(lancamento.valor * 100) / 100, descricao } },
      lancamento
    );
  }

  return [...porChave.values()]
    .map((item) => {
      const { peso, ...sugestao } = item;
      void peso;
      return sugestao;
    })
    .sort((a, b) => (a.pagina ?? Infinity) - (b.pagina ?? Infinity));
}

/**
 * O crédito na origem, pelos títulos: o valor original é a soma dos valores de face (sem correção, juros nem
 * multa) e a origem do débito é o vencimento mais antigo. Títulos repetidos (o mesmo lido duas vezes) contam uma vez.
 */
export function creditoDosTitulos(titulos: ItemSugerido[]): { valorOriginal: number; origem: string; quantidade: number } | null {
  const unicos: ItemSugerido[] = [];
  for (const titulo of titulos) {
    if (titulo.item !== "titulo") continue;
    const valor = Number(titulo.dados.valor);
    if (!(valor > 0) || typeof titulo.dados.vencimento !== "string" || !DATA.test(titulo.dados.vencimento)) continue;
    if (!unicos.some((ja) => mesmoItem(ja, titulo))) unicos.push(titulo);
  }
  if (!unicos.length) return null;
  const total = unicos.reduce((soma, titulo) => soma + centavos(Number(titulo.dados.valor)), 0) / 100;
  const origem = unicos.map((titulo) => titulo.dados.vencimento as string).sort()[0];
  return { valorOriginal: total, origem, quantidade: unicos.length };
}

/** Sugestões do valor original e da origem do débito tiradas dos títulos (só o que difere do cadastro). */
export function sugestoesDoCreditoPelosTitulos(credito: { valorOriginal: number; origem: string; quantidade: number }, valores: Record<string, unknown>): SugestaoNova[] {
  const sugestoes: SugestaoNova[] = [];
  const base = { tipo: "campo" as const, parteId: null, pagina: null, trecho: null, trechoConferido: true, confianca: "alta" as const };
  const atualValor = valores.valor_original === null || valores.valor_original === undefined || valores.valor_original === "" ? null : Number(valores.valor_original);
  if (atualValor === null || centavos(atualValor) !== centavos(credito.valorOriginal)) {
    sugestoes.push({
      ...base,
      campo: "valor_original",
      item: "valor_original",
      chave: `campo:valor_original:titulos:${centavos(credito.valorOriginal)}`,
      resumo: `Valor original do crédito: ${formatarReal(credito.valorOriginal)}, ${credito.quantidade === 1 ? "valor do único título" : `soma dos ${credito.quantidade} títulos`}`,
      valor: { valor: Math.round(credito.valorOriginal * 100) / 100 },
    });
  }
  const atualOrigem = typeof valores.data_origem_debito === "string" ? valores.data_origem_debito.slice(0, 10) : null;
  if (atualOrigem !== credito.origem) {
    sugestoes.push({
      ...base,
      campo: "data_origem_debito",
      item: "data_origem_debito",
      chave: `campo:data_origem_debito:titulos:${credito.origem}`,
      resumo: `Data de origem do débito: ${formatarData(credito.origem)}, ${credito.quantidade === 1 ? "vencimento do único título" : `vencimento mais antigo entre os ${credito.quantidade} títulos`}`,
      valor: { valor: credito.origem },
    });
  }
  return sugestoes;
}
