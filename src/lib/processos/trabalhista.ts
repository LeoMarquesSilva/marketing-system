import { ProcessosError } from "./errors";
import { estaPreenchido, type Valores } from "./campos";
import { dataObrigatoria, dataOpcional, lerValor, textoObrigatorio, textoOpcional, umaDas } from "./rec-credito";
import type { Parte, PoloParte } from "./types";

/**
 * Saneamento da área Trabalhista, na parte que não depende de banco: as opções dos campos, os afastamentos pelo
 * INSS e os pedidos da inicial com o resultado em cada decisão, o cálculo do adicional (insalubridade ou
 * periculosidade) e os itens do saneamento. O cliente do escritório é a reclamada.
 */

/* ------------------------------------------------------------------ área */

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Processo da área Trabalhista ("Trabalhista", "Trabalhista Consultivo", "TRABALHISTA - Contencioso"…). */
export function ehTrabalhista(area: unknown): boolean {
  return typeof area === "string" && /\btrabalhist/i.test(semAcento(area));
}

export * from "./trabalhista-opcoes";
import { ESPECIES_AFASTAMENTO, RESULTADOS_PEDIDO, SITUACOES_PRESCRICAO, type EspecieAfastamento, type ResultadoPedido, type SituacaoPrescricao } from "./trabalhista-opcoes";

/** Percentual de reflexos padrão sobre o adicional (13º, férias + 1/3, FGTS…), como a equipe usa. */
export const REFLEXOS_PADRAO = 15;

/* ------------------------------------------------------------ itens */

export type TipoItemTrabalhista = "afastamento" | "pedido";
export type OrigemItem = "manual" | "autos";

interface Comum {
  id: string;
  origem: OrigemItem;
  documentoId: string | null;
  pagina: number | null;
  criadoPorNome: string | null;
}

export interface Afastamento extends Comum {
  inicio: string;
  fim: string | null;
  especie: EspecieAfastamento;
  observacao: string | null;
}

export interface PedidoTrabalhista extends Comum {
  pedido: string;
  valorPedido: number | null;
  resultadoSentenca: ResultadoPedido | null;
  resultadoAcordao: ResultadoPedido | null;
  resultadoRr: ResultadoPedido | null;
  detalhe: string | null;
  /** Prescrição do pedido (arguida? acolhida?) e o marco: parcelas anteriores estão prescritas. */
  prescricao: SituacaoPrescricao | null;
  prescricaoMarco: string | null;
}

export interface ItensTrabalhistas {
  afastamentos: Afastamento[];
  pedidos: PedidoTrabalhista[];
}

export const TABELA_DO_ITEM_TRABALHISTA: Record<TipoItemTrabalhista, string> = {
  afastamento: "proc_trab_afastamentos",
  pedido: "proc_trab_pedidos",
};

export const ROTULO_DO_ITEM_TRABALHISTA: Record<TipoItemTrabalhista, string> = {
  afastamento: "Afastamento INSS",
  pedido: "Pedido",
};

export function ehTipoItemTrabalhista(valor: unknown): valor is TipoItemTrabalhista {
  return valor === "afastamento" || valor === "pedido";
}

function resultadoOpcional(bruto: unknown, rotulo: string): ResultadoPedido | null {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  return umaDas(bruto, RESULTADOS_PEDIDO, rotulo);
}

/** Converte o corpo da tela (ou de uma sugestão) nas colunas da tabela; erro de validação vira 400. */
export function colunasDoItemTrabalhista(tipo: TipoItemTrabalhista, dados: Record<string, unknown>): Record<string, unknown> {
  if (tipo === "afastamento") {
    const inicio = dataObrigatoria(dados.inicio, "o início do afastamento");
    const fim = dataOpcional(dados.fim, "o fim do afastamento");
    if (fim && fim < inicio) throw new ProcessosError("O fim do afastamento é anterior ao início.", 400);
    return {
      inicio,
      fim,
      especie: umaDas(dados.especie, ESPECIES_AFASTAMENTO, "a espécie", "auxilio_doenca"),
      observacao: textoOpcional(dados.observacao, 500),
    };
  }
  const valor = lerValor(dados.valor_pedido);
  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) throw new ProcessosError("Valor inválido no valor pedido.", 400);
  return {
    pedido: textoObrigatorio(dados.pedido, "o pedido", 300),
    valor_pedido: valor === null ? null : Math.round(valor * 100) / 100,
    resultado_sentenca: resultadoOpcional(dados.resultado_sentenca, "o resultado na sentença"),
    resultado_acordao: resultadoOpcional(dados.resultado_acordao, "o resultado no acórdão"),
    resultado_rr: resultadoOpcional(dados.resultado_rr, "o resultado no recurso de revista"),
    detalhe: textoOpcional(dados.detalhe, 1000),
    prescricao: dados.prescricao === null || dados.prescricao === undefined || dados.prescricao === "" ? null : umaDas(dados.prescricao, SITUACOES_PRESCRICAO, "a prescrição do pedido"),
    prescricao_marco: dataOpcional(dados.prescricao_marco, "o marco da prescrição do pedido"),
  };
}

function br(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

const rotuloDe = <T extends string>(lista: readonly { valor: T; rotulo: string }[], valor: unknown) => lista.find((item) => item.valor === valor)?.rotulo ?? String(valor ?? "");

/** Uma linha para o histórico da ficha. */
export function descreverItemTrabalhista(tipo: TipoItemTrabalhista, colunas: Record<string, unknown>): string {
  if (tipo === "afastamento") {
    const fim = typeof colunas.fim === "string" ? br(colunas.fim) : "em curso";
    return `${rotuloDe(ESPECIES_AFASTAMENTO, colunas.especie)}: ${br(String(colunas.inicio))} a ${fim}`;
  }
  const resultados = (
    [
      ["sentença", colunas.resultado_sentenca],
      ["acórdão", colunas.resultado_acordao],
      ["RR", colunas.resultado_rr],
    ] as const
  )
    .filter(([, valor]) => valor)
    .map(([decisao, valor]) => `${decisao}: ${rotuloDe(RESULTADOS_PEDIDO, valor).toLowerCase()}`);
  if (colunas.prescricao) {
    resultados.push(`prescrição: ${rotuloDe(SITUACOES_PRESCRICAO, colunas.prescricao).toLowerCase()}${typeof colunas.prescricao_marco === "string" ? ` (antes de ${br(colunas.prescricao_marco)})` : ""}`);
  }
  const valor = typeof colunas.valor_pedido === "number" ? ` (${formatarReais(colunas.valor_pedido)})` : "";
  return `${colunas.pedido}${valor}${resultados.length ? ` — ${resultados.join("; ")}` : ""}`;
}

/** O resultado que vale para o pedido: o da última decisão que o julgou. */
export function resultadoFinal(pedido: Pick<PedidoTrabalhista, "resultadoSentenca" | "resultadoAcordao" | "resultadoRr">): ResultadoPedido | null {
  for (const resultado of [pedido.resultadoRr, pedido.resultadoAcordao, pedido.resultadoSentenca]) {
    if (resultado && resultado !== "nao_julgado") return resultado;
  }
  return pedido.resultadoSentenca ?? pedido.resultadoAcordao ?? pedido.resultadoRr ?? null;
}

export function formatarReais(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

/* ------------------------------------------------------ salário-mínimo */

/**
 * Salário-mínimo nacional por vigência (mês de início, AAAA-MM). Fonte: as leis e decretos anuais do mínimo.
 * Mês depois da última vigência usa a última (e o cálculo avisa).
 */
export const SALARIO_MINIMO: { desde: string; valor: number }[] = [
  { desde: "2010-01", valor: 510 },
  { desde: "2011-01", valor: 540 },
  { desde: "2011-03", valor: 545 },
  { desde: "2012-01", valor: 622 },
  { desde: "2013-01", valor: 678 },
  { desde: "2014-01", valor: 724 },
  { desde: "2015-01", valor: 788 },
  { desde: "2016-01", valor: 880 },
  { desde: "2017-01", valor: 937 },
  { desde: "2018-01", valor: 954 },
  { desde: "2019-01", valor: 998 },
  { desde: "2020-01", valor: 1039 },
  { desde: "2020-02", valor: 1045 },
  { desde: "2021-01", valor: 1100 },
  { desde: "2022-01", valor: 1212 },
  { desde: "2023-01", valor: 1302 },
  { desde: "2023-05", valor: 1320 },
  { desde: "2024-01", valor: 1412 },
  { desde: "2025-01", valor: 1518 },
  { desde: "2026-01", valor: 1621 },
];

/** O mínimo do mês (AAAA-MM); nulo antes da primeira vigência da tabela. */
export function salarioMinimoDoMes(mes: string): number | null {
  let achado: number | null = null;
  for (const vigencia of SALARIO_MINIMO) {
    if (vigencia.desde <= mes) achado = vigencia.valor;
    else break;
  }
  return achado;
}

/* ------------------------------------------------------------- cálculo */

const DIA = 86_400_000;
const paraDia = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const redondo = (valor: number) => Math.round(valor * 100) / 100;

export interface EntradaDoAdicional {
  inicio: string;
  fim: string;
  /** Percentual do adicional (40, 20, 10 ou 30). */
  percentual: number;
  base: "salario_minimo" | "salario_contratual";
  salario: number | null;
  reflexosPercentual: number;
  afastamentos: { inicio: string; fim: string | null }[];
}

export interface MesDoAdicional {
  mes: string;
  /** Dias do mês dentro do período, sem os afastamentos. */
  dias: number;
  /** Fração do mês que conta: 1 no mês inteiro; dias ÷ 30 no mês quebrado. */
  fracao: number;
  base: number;
  valor: number;
}

export interface ResultadoDoAdicional {
  inicio: string;
  fim: string;
  percentual: number;
  base: EntradaDoAdicional["base"];
  meses: MesDoAdicional[];
  diasAfastado: number;
  principal: number;
  reflexosPercentual: number;
  reflexos: number;
  total: number;
  avisos: string[];
}

/** Junta afastamentos que se sobrepõem (contar o mesmo dia duas vezes tiraria dias demais). */
function intervalosDeAfastamento(afastamentos: EntradaDoAdicional["afastamentos"], fimDoPeriodo: number): [number, number][] {
  const brutos = afastamentos
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.inicio))
    .map((item): [number, number] => [paraDia(item.inicio), item.fim && /^\d{4}-\d{2}-\d{2}$/.test(item.fim) ? paraDia(item.fim) : fimDoPeriodo])
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  const juntos: [number, number][] = [];
  for (const atual of brutos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && atual[0] <= ultimo[1] + DIA) ultimo[1] = Math.max(ultimo[1], atual[1]);
    else juntos.push([...atual]);
  }
  return juntos;
}

function diasEmComum(a: number, b: number, x: number, y: number): number {
  const inicio = Math.max(a, x);
  const fim = Math.min(b, y);
  return fim < inicio ? 0 : Math.round((fim - inicio) / DIA) + 1;
}

/**
 * Adicional mês a mês: percentual sobre a base de cada mês (o mínimo nacional da época ou o salário contratual),
 * proporcional aos dias do mês dentro do período, sem os dias de afastamento pelo INSS; mais os reflexos sobre o
 * principal. Valores nominais: sem correção monetária nem juros.
 */
export function calcularAdicional(entrada: EntradaDoAdicional): ResultadoDoAdicional {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(entrada.fim)) throw new ProcessosError("Período de cálculo inválido.", 400);
  if (entrada.fim < entrada.inicio) throw new ProcessosError("O fim do período de cálculo é anterior ao início.", 400);
  if (!(entrada.percentual > 0 && entrada.percentual <= 100)) throw new ProcessosError("Percentual do adicional inválido.", 400);
  if (entrada.base === "salario_contratual" && !(entrada.salario && entrada.salario > 0)) {
    throw new ProcessosError("Informe o salário: a base do adicional é o salário contratual.", 400);
  }
  const avisos: string[] = [];
  const inicio = paraDia(entrada.inicio);
  const fim = paraDia(entrada.fim);
  const afastado = intervalosDeAfastamento(entrada.afastamentos, fim);
  const meses: MesDoAdicional[] = [];
  let diasAfastado = 0;
  const ultimaVigencia = SALARIO_MINIMO[SALARIO_MINIMO.length - 1].desde;
  let mesSemTabela = false;

  let ano = Number(entrada.inicio.slice(0, 4));
  let mes = Number(entrada.inicio.slice(5, 7));
  for (;;) {
    const comecoDoMes = Date.UTC(ano, mes - 1, 1);
    if (comecoDoMes > fim) break;
    const fimDoMes = Date.UTC(ano, mes, 0);
    const diasDoMes = new Date(fimDoMes).getUTCDate();
    const de = Math.max(inicio, comecoDoMes);
    const ate = Math.min(fim, fimDoMes);
    const noPeriodo = diasEmComum(de, ate, de, ate);
    const fora = afastado.reduce((soma, [a, b]) => soma + diasEmComum(de, ate, a, b), 0);
    diasAfastado += fora;
    const dias = Math.max(0, noPeriodo - fora);
    const chave = `${ano}-${String(mes).padStart(2, "0")}`;
    if (dias > 0) {
      const minimo = salarioMinimoDoMes(chave);
      if (entrada.base === "salario_minimo" && minimo === null) {
        throw new ProcessosError(`A tabela do salário-mínimo começa em ${SALARIO_MINIMO[0].desde.slice(5)}/${SALARIO_MINIMO[0].desde.slice(0, 4)}.`, 400);
      }
      if (entrada.base === "salario_minimo" && chave > ultimaVigencia && chave.slice(0, 4) !== ultimaVigencia.slice(0, 4)) mesSemTabela = true;
      const base = entrada.base === "salario_minimo" ? (minimo as number) : (entrada.salario as number);
      const fracao = dias >= diasDoMes ? 1 : Math.min(1, dias / 30);
      meses.push({ mes: chave, dias, fracao: Math.round(fracao * 10000) / 10000, base, valor: redondo((base * entrada.percentual * fracao) / 100) });
    }
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  if (mesSemTabela) avisos.push(`Meses depois de ${ultimaVigencia.slice(0, 4)} usam o último salário-mínimo da tabela: confira.`);
  if (!meses.length) avisos.push("Nenhum dia a calcular: o período inteiro está coberto por afastamentos.");
  const principal = redondo(meses.reduce((soma, item) => soma + item.valor, 0));
  const reflexos = redondo((principal * entrada.reflexosPercentual) / 100);
  return {
    inicio: entrada.inicio,
    fim: entrada.fim,
    percentual: entrada.percentual,
    base: entrada.base,
    meses,
    diasAfastado,
    principal,
    reflexosPercentual: entrada.reflexosPercentual,
    reflexos,
    total: redondo(principal + reflexos),
    avisos,
  };
}

const PERCENTUAL_DO_GRAU: Record<string, number> = { minimo: 10, medio: 20, maximo: 40 };

const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
const numero = (valor: unknown) => (typeof valor === "number" && Number.isFinite(valor) ? valor : typeof valor === "string" && valor ? Number(valor) : null);

/* ----------------------------------------------------------- prescrição */

/** A mesma data `anos` antes (29/02 vira 28/02 em ano não bissexto). */
function anosAntes(iso: string, anos: number): string {
  const ano = Number(iso.slice(0, 4)) - anos;
  const mes = Number(iso.slice(5, 7));
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${iso.slice(5, 7)}-${String(Math.min(Number(iso.slice(8, 10)), ultimoDia)).padStart(2, "0")}`;
}

/** Marco da prescrição quinquenal (CF, art. 7º, XXIX; Súmula 308 do TST): 5 anos antes do ajuizamento. */
export function marcoQuinquenal(ajuizamento: string | null): string | null {
  return ajuizamento && /^\d{4}-\d{2}-\d{2}/.test(ajuizamento) ? anosAntes(ajuizamento.slice(0, 10), 5) : null;
}

export interface PrescricaoDoProcesso {
  /** Parcelas anteriores a esta data estão prescritas. */
  marco: string | null;
  /** De onde veio o marco: o informado na ficha (lido na decisão) ou 5 anos antes do ajuizamento. */
  origemMarco: "ficha" | "ajuizamento" | null;
  /** O marco limita o início do período do adicional (não vale quando a prescrição foi rejeitada). */
  aplicaNoCalculo: boolean;
  /** Bienal: até quando dava para ajuizar (fim do contrato + 2 anos, sem projetar o aviso prévio). */
  bienalLimite: string | null;
  bienalVencida: boolean;
  avisos: string[];
}

/**
 * A prescrição pelos campos da ficha. Quinquenal: o marco informado ou, sem ele, 5 anos antes da distribuição; vale
 * no cálculo enquanto não for rejeitada (a reclamada argui na defesa). Bienal: ação ajuizada mais de 2 anos depois do
 * fim do contrato. Intercorrente: só o que a ficha diz.
 */
export function prescricaoDoProcesso(valores: Valores): PrescricaoDoProcesso {
  const avisos: string[] = [];
  const informado = texto(valores.prescricao_quinquenal_marco);
  const calculado = marcoQuinquenal(texto(valores.data_distribuicao));
  const marco = informado ?? calculado;
  const situacao = texto(valores.prescricao_quinquenal);
  const aplicaNoCalculo = Boolean(marco) && situacao !== "rejeitada";
  if (situacao === "rejeitada") avisos.push("Prescrição quinquenal rejeitada: o cálculo não corta as parcelas antigas.");
  const fimDoContrato = (valores.tipo_termino === "rescisao_indireta" ? texto(valores.ultimo_dia_trabalhado) : null) ?? texto(valores.data_termino);
  const bienalLimite = fimDoContrato && valores.tipo_termino !== "em_vigor" ? anosAntes(fimDoContrato, -2) : null;
  const ajuizamento = texto(valores.data_distribuicao);
  const bienalVencida = Boolean(bienalLimite && ajuizamento && ajuizamento > bienalLimite);
  if (bienalVencida) avisos.push(`Ação ajuizada depois de ${br(bienalLimite as string)} (2 anos do fim do contrato): cabe arguir a prescrição bienal (total).`);
  if (valores.prescricao_bienal === "acolhida") avisos.push("Prescrição bienal acolhida: o processo inteiro está prescrito.");
  if (valores.prescricao_intercorrente === "acolhida") avisos.push("Prescrição intercorrente acolhida na execução.");
  return { marco, origemMarco: informado ? "ficha" : calculado ? "ajuizamento" : null, aplicaNoCalculo, bienalLimite, bienalVencida, avisos };
}

/** De onde o cálculo tira cada dado, para a tela mostrar e a pessoa ajustar o que faltar. */
export interface ParametrosDoAdicional {
  inicio: string | null;
  fim: string | null;
  percentual: number | null;
  base: EntradaDoAdicional["base"];
  salario: number | null;
  reflexosPercentual: number;
  /** O que falta para calcular. */
  faltando: string[];
  prescricao: PrescricaoDoProcesso;
  /** O início do período foi puxado para o marco da prescrição quinquenal. */
  limitadoPelaPrescricao: boolean;
}

/**
 * Parâmetros do cálculo pelos campos da ficha: o período de cálculo (ou, sem ele, o contrato: admissão até o último
 * dia trabalhado na rescisão indireta, ou até o término); o grau deferido na decisão (ou o do laudo); a base da
 * decisão (insalubridade sobre o mínimo; periculosidade, 30% do salário contratual).
 */
export function parametrosDoAdicional(valores: Valores): ParametrosDoAdicional {
  const faltando: string[] = [];
  const prescricao = prescricaoDoProcesso(valores);
  // Sem o período da decisão: da admissão, cortado no marco da prescrição quinquenal (parcelas anteriores prescritas).
  const admissao = texto(valores.data_admissao);
  const daDecisao = texto(valores.periodo_calculo_inicio);
  const limitadoPelaPrescricao = !daDecisao && Boolean(admissao && prescricao.aplicaNoCalculo && prescricao.marco && prescricao.marco > admissao);
  const inicio = daDecisao ?? (limitadoPelaPrescricao ? prescricao.marco : admissao);
  const fimDoContrato = (valores.tipo_termino === "rescisao_indireta" ? texto(valores.ultimo_dia_trabalhado) : null) ?? texto(valores.data_termino) ?? texto(valores.ultimo_dia_trabalhado);
  const fim = texto(valores.periodo_calculo_fim) ?? fimDoContrato;
  if (!inicio) faltando.push("início do período (ou data de admissão)");
  if (!fim) faltando.push("fim do período (ou término do contrato)");
  const periculosidade = valores.laudo_agente === "periculosidade";
  const grau = texto(valores.adicional_grau) ?? texto(valores.laudo_grau);
  const percentual = periculosidade ? 30 : grau ? (PERCENTUAL_DO_GRAU[grau] ?? null) : null;
  if (percentual === null) faltando.push("grau do adicional (na decisão ou no laudo)");
  const base: EntradaDoAdicional["base"] = valores.adicional_base === "salario_contratual" || valores.adicional_base === "salario_minimo" ? valores.adicional_base : periculosidade ? "salario_contratual" : "salario_minimo";
  const salario = numero(valores.salario);
  if (base === "salario_contratual" && !(salario && salario > 0)) faltando.push("salário (base contratual)");
  const reflexos = numero(valores.risco_reflexos_percentual);
  return { inicio, fim, percentual, base, salario, reflexosPercentual: reflexos !== null && reflexos >= 0 ? reflexos : REFLEXOS_PADRAO, faltando, prescricao, limitadoPelaPrescricao };
}

/** Risco pelo cálculo, ou o motivo de não dar para calcular. */
export function calcularRiscoDoProcesso(valores: Valores, afastamentos: { inicio: string; fim: string | null }[]): { resultado: ResultadoDoAdicional | null; parametros: ParametrosDoAdicional } {
  const parametros = parametrosDoAdicional(valores);
  if (parametros.faltando.length) return { resultado: null, parametros };
  return {
    parametros,
    resultado: calcularAdicional({
      inicio: parametros.inicio as string,
      fim: parametros.fim as string,
      percentual: parametros.percentual as number,
      base: parametros.base,
      salario: parametros.salario,
      reflexosPercentual: parametros.reflexosPercentual,
      afastamentos,
    }),
  };
}

/* ---------------------------------------------------------- saneamento */

/** Polo do reclamante: o oposto ao do cliente (a reclamada); sem "polo do cliente", o ativo. */
export function poloDoReclamante(poloCliente: unknown): PoloParte {
  const texto = semAcento(typeof poloCliente === "string" ? poloCliente : "").toLowerCase();
  return /ativ|autor|reclamante|exequente/.test(texto) ? "passivo" : "ativo";
}

/** Advogados do reclamante: os ligados a uma parte do polo dele ou, sem ligação, os do mesmo polo. */
export function advogadosDoReclamante(partes: Parte[], poloCliente: unknown): Parte[] {
  const polo = poloDoReclamante(poloCliente);
  const doPolo = new Set(partes.filter((parte) => parte.papel === "parte" && parte.polo === polo).map((parte) => parte.id));
  return partes.filter((parte) => parte.papel === "advogado" && (parte.referenteA ? doPolo.has(parte.referenteA) : parte.polo === polo));
}

export function emailsDaParte(parte: Parte): string[] {
  return parte.contatos.filter((contato) => contato.tipo === "email").map((contato) => contato.valor.trim().toLowerCase());
}

export interface ContagensTrabalhistas {
  pedidos: number;
}

interface ItemTrabalhista {
  chave: string;
  rotulo: string;
  origem: "vios" | "novo";
  ok: (valores: Valores, partes: Parte[], contagens: ContagensTrabalhistas) => boolean;
  /** Vazio, não conta como falta (só existe em alguns processos). */
  opcional?: (valores: Valores) => boolean;
}

const preenchido = (chave: string) => (valores: Valores) => estaPreenchido(valores[chave]);
const todos = <T,>(lista: T[], teste: (item: T) => boolean) => lista.length > 0 && lista.every(teste);
const semTransito = (valores: Valores) => !/transit|encerr|arquiv|baixad/i.test(semAcento(String(valores.situacao ?? "")) + semAcento(String(valores.fase ?? "")));

/** A lista do saneamento trabalhista, na ordem em que aparece. */
export const ITENS_TRABALHISTAS: ItemTrabalhista[] = [
  { chave: "cnj", rotulo: "N.º CNJ", origem: "vios", ok: preenchido("cnj") },
  { chave: "fase", rotulo: "Fase", origem: "vios", ok: preenchido("fase") },
  { chave: "reclamante", rotulo: "Reclamante: nome", origem: "vios", ok: (valores, partes) => partes.some((parte) => parte.papel === "parte" && parte.polo === poloDoReclamante(valores.polo_cliente)) },
  {
    chave: "advogado_reclamante",
    rotulo: "Advogado do reclamante: nome e OAB",
    origem: "novo",
    ok: (valores, partes) => todos(advogadosDoReclamante(partes, valores.polo_cliente), (parte) => Boolean(parte.oab)),
  },
  {
    chave: "advogado_reclamante_email",
    rotulo: "Advogado do reclamante: e-mail",
    origem: "novo",
    ok: (valores, partes) => advogadosDoReclamante(partes, valores.polo_cliente).some((parte) => emailsDaParte(parte).length > 0),
  },
  { chave: "data_admissao", rotulo: "Data de admissão", origem: "novo", ok: preenchido("data_admissao") },
  { chave: "data_termino", rotulo: "Data do término", origem: "novo", ok: preenchido("data_termino"), opcional: (valores) => valores.tipo_termino === "em_vigor" },
  { chave: "tipo_termino", rotulo: "Tipo de término", origem: "novo", ok: preenchido("tipo_termino") },
  {
    chave: "ultimo_dia_trabalhado",
    rotulo: "Último dia trabalhado (rescisão indireta)",
    origem: "novo",
    ok: preenchido("ultimo_dia_trabalhado"),
    opcional: (valores) => valores.tipo_termino !== "rescisao_indireta",
  },
  { chave: "cargo", rotulo: "Cargo", origem: "novo", ok: preenchido("cargo") },
  { chave: "salario", rotulo: "Salário", origem: "novo", ok: preenchido("salario") },
  { chave: "pedidos", rotulo: "Pedidos da inicial", origem: "novo", ok: (_valores, _partes, contagens) => contagens.pedidos > 0 },
  { chave: "laudo_agente", rotulo: "Laudo pericial: agente", origem: "novo", ok: preenchido("laudo_agente") },
  {
    chave: "laudo_grau",
    rotulo: "Laudo pericial: grau",
    origem: "novo",
    ok: preenchido("laudo_grau"),
    opcional: (valores) => valores.laudo_agente === "periculosidade" || valores.laudo_agente === "nenhum",
  },
  { chave: "decisao_prevalece", rotulo: "Decisão que prevalece", origem: "novo", ok: preenchido("decisao_prevalece") },
  { chave: "prescricao_quinquenal", rotulo: "Prescrição quinquenal", origem: "novo", ok: preenchido("prescricao_quinquenal") },
  { chave: "data_transito", rotulo: "Trânsito em julgado", origem: "novo", ok: preenchido("data_transito"), opcional: semTransito },
  { chave: "periodo_calculo", rotulo: "Período de cálculo", origem: "novo", ok: (valores) => estaPreenchido(valores.periodo_calculo_inicio) && estaPreenchido(valores.periodo_calculo_fim) },
  { chave: "risco_total", rotulo: "Risco: valor, reflexos e total", origem: "novo", ok: preenchido("risco_total") },
];

export const CHAVES_TRABALHISTAS = new Set(ITENS_TRABALHISTAS.map((item) => item.chave));

export function itensDoSaneamentoTrabalhista(valores: Valores, partes: Parte[], naoAplicaveis: string[], contagens: ContagensTrabalhistas) {
  const fora = new Set(naoAplicaveis);
  return ITENS_TRABALHISTAS.map((item) => {
    const base = { chave: item.chave, rotulo: item.rotulo, origem: item.origem };
    if (fora.has(item.chave)) return { ...base, estado: "nao_se_aplica" as const };
    const ok = item.ok(valores, partes, contagens);
    if (!ok && item.opcional?.(valores)) return { ...base, estado: "nao_se_aplica" as const, automatico: true };
    return { ...base, estado: ok ? ("ok" as const) : ("falta" as const) };
  });
}
