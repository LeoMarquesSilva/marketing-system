/**
 * Catálogo dos campos do cadastro de processos. É a fonte única de: rótulo, tipo, de onde o campo vem
 * (VIOS ou só do ORQESTRAI), se pode ser editado, de que coluna do VIOS/SIOE é lido e se está na lista
 * de campos pedida pela equipe de Recuperação de Crédito.
 */

export type TipoCampo = "texto" | "texto_longo" | "data" | "valor" | "percentual" | "lista" | "booleano" | "opcao";
export type TabelaCampo = "processo" | "credito";
export type OrigemCampo = "vios" | "novo";
export type ValorCampo = string | number | boolean | string[] | null;
export type Valores = Record<string, ValorCampo>;

export const GRUPOS_CAMPO = [
  { id: "identificacao", rotulo: "Identificação" },
  { id: "classificacao", rotulo: "Classificação" },
  { id: "responsaveis", rotulo: "Responsáveis e cliente" },
  { id: "orgao", rotulo: "Órgão" },
  { id: "datas", rotulo: "Datas" },
  { id: "valores", rotulo: "Valores e risco" },
  { id: "credito", rotulo: "Crédito" },
  { id: "andamento", rotulo: "Síntese e andamento" },
] as const;

export type GrupoCampo = (typeof GRUPOS_CAMPO)[number]["id"];

export interface CampoProcesso {
  /** Nome da coluna no banco. */
  chave: string;
  rotulo: string;
  grupo: GrupoCampo;
  tipo: TipoCampo;
  tabela: TabelaCampo;
  /** "vios": o campo existe no VIOS e a edição entra na fila de gravação; "novo": só existe no ORQESTRAI. */
  origem: OrigemCampo;
  editavel: boolean;
  /** Cabeçalhos do "Processos Lista" (CSV do VIOS) que trazem o campo. */
  colunasVios?: string[];
  /** Coluna de processos_completo, no SIOE. */
  colunaSioe?: string;
  /** Está na lista de campos da equipe de Rec. Crédito (entra no saneamento e na planilha). */
  naLista?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
}

type Extra = Partial<Pick<CampoProcesso, "tabela" | "editavel" | "colunasVios" | "colunaSioe" | "naLista" | "opcoes">>;

function campo(chave: string, rotulo: string, grupo: GrupoCampo, tipo: TipoCampo, origem: OrigemCampo, extra: Extra = {}): CampoProcesso {
  return { chave, rotulo, grupo, tipo, origem, tabela: "processo", editavel: true, ...extra };
}

export const NATUREZAS_CREDITO = [
  { valor: "concursal", rotulo: "Concursal" },
  { valor: "extraconcursal", rotulo: "Extraconcursal" },
  { valor: "nao_se_aplica", rotulo: "Não se aplica" },
];

export const CAMPOS: CampoProcesso[] = [
  // Identificação
  campo("ci", "CI", "identificacao", "texto", "vios", { editavel: false, colunasVios: ["CI"], colunaSioe: "ci", naLista: true }),
  campo("cnj", "N.º CNJ", "identificacao", "texto", "vios", { colunaSioe: "nro_cnj", naLista: true }),
  campo("outros_numeros", "Outros números do processo", "identificacao", "lista", "vios", { naLista: true }),
  campo("pasta_interna", "Pasta interna", "identificacao", "texto", "vios", { colunasVios: ["Pasta Interna"] }),
  campo("vinculo", "Vínculo", "identificacao", "texto", "vios", { colunasVios: ["Vínculo"] }),

  // Classificação
  campo("departamento", "Departamento", "classificacao", "texto", "vios", { colunasVios: ["Departamento"], colunaSioe: "departamento" }),
  campo("area", "Área", "classificacao", "texto", "vios", { colunasVios: ["Área"], colunaSioe: "area", naLista: true }),
  campo("materia", "Matéria", "classificacao", "texto", "vios", { colunasVios: ["Matéria", "Matérias"], colunaSioe: "materia" }),
  campo("acao", "Ação", "classificacao", "texto", "vios", { colunasVios: ["Ação"], colunaSioe: "acao", naLista: true }),
  campo("fase", "Fase", "classificacao", "texto", "vios", { colunasVios: ["Fase", "Fase processual"], colunaSioe: "fase_processual", naLista: true }),
  campo("situacao", "Situação do processo", "classificacao", "texto", "vios", {
    colunasVios: ["Situação do Processo", "Situação"],
    colunaSioe: "situacao_processo",
    naLista: true,
  }),
  campo("etiquetas", "Etiquetas", "classificacao", "lista", "vios", { colunaSioe: "etiquetas", naLista: true }),
  campo("jurisdicao_atual", "Jurisdição atual", "classificacao", "texto", "vios", { colunasVios: ["Jurisdição", "Jurisdição Atual"], naLista: true }),

  // Responsáveis e cliente
  campo("advogado_responsavel", "Advogado responsável", "responsaveis", "texto", "vios", {
    colunasVios: ["Advogado responsável"],
    colunaSioe: "advogado_responsavel",
    naLista: true,
  }),
  campo("auxiliares", "Auxiliares", "responsaveis", "lista", "vios", { colunasVios: ["Aux.", "Auxiliares"], naLista: true }),
  campo("grupo_cliente", "Grupo do cliente", "responsaveis", "texto", "vios", {
    editavel: false,
    colunasVios: ["Grupo Cliente"],
    colunaSioe: "grupo_cliente",
    naLista: true,
  }),
  campo("cliente", "Cliente", "responsaveis", "texto", "vios", { editavel: false, colunasVios: ["Cliente"], colunaSioe: "cliente" }),
  campo("polo_cliente", "Polo do cliente", "responsaveis", "texto", "vios", { colunasVios: ["Polo do cliente"], naLista: true }),
  campo("contrato_cliente", "Contrato do cliente", "responsaveis", "texto", "vios", { colunasVios: ["Contrato do cliente"] }),

  // Órgão
  campo("justica", "Justiça", "orgao", "texto", "vios", { colunasVios: ["Justiça", "Tipo de Justiça"], naLista: true }),
  campo("sistema_tribunal", "Sistema do tribunal", "orgao", "texto", "vios", { colunasVios: ["Sistema do Tribunal"], colunaSioe: "sistema_tribunal" }),
  campo("uf", "UF", "orgao", "texto", "vios", { colunasVios: ["UF"], naLista: true }),
  campo("cidade", "Cidade", "orgao", "texto", "vios", { colunasVios: ["Cidade"], naLista: true }),
  campo("comarca_tribunal", "Comarca / Tribunal / Órgão adm.", "orgao", "texto", "vios", {
    colunasVios: ["Comarcas / Tribunais / Órgãos Adm."],
    naLista: true,
  }),
  campo("orgao_julgador", "Órgão julgador (vara/câmara)", "orgao", "texto", "vios", { colunasVios: ["Órgão Julgador (Vara/Camara)"] }),
  campo("tipo_orgao_julgador", "Tipo de órgão julgador", "orgao", "texto", "vios", { colunasVios: ["Tipo de órgão julgador (vara/camara)"] }),
  campo("magistrado", "Magistrado", "orgao", "texto", "vios", { colunasVios: ["Magistrado"] }),

  // Datas
  campo("data_recebimento", "Data do recebimento da demanda", "datas", "data", "novo", { naLista: true }),
  campo("data_cadastro", "Data do cadastro", "datas", "data", "vios", {
    editavel: false,
    colunasVios: ["Data do Cadastro"],
    colunaSioe: "data_cadastro",
    naLista: true,
  }),
  campo("data_distribuicao", "Data da ação / distribuição", "datas", "data", "vios", { colunasVios: ["Data da Ação / Distribuição"], naLista: true }),
  campo("data_citacao", "Data da citação", "datas", "data", "vios", { colunasVios: ["Data da citação", "Data da Citação"], naLista: true }),
  campo("data_arquivamento", "Data do arquivamento", "datas", "data", "vios", { colunasVios: ["Data do arquivamento"], naLista: true }),
  campo("data_encerramento", "Data do encerramento", "datas", "data", "vios", {
    colunasVios: ["Data do encerramento"],
    colunaSioe: "data_encerramento",
    naLista: true,
  }),
  campo("motivo_encerramento", "Motivo de encerramento", "datas", "texto", "vios", {
    colunasVios: ["Motivo de Encerramento"],
    colunaSioe: "motivo_encerramento",
  }),

  // Valores e risco
  campo("valor_acao", "Valor da ação", "valores", "valor", "vios", { colunasVios: ["Valor da ação"], colunaSioe: "valor_acao", naLista: true }),
  campo("valor_acao_atualizado", "Valor da ação atualizado", "valores", "valor", "vios", {
    editavel: false,
    colunasVios: ["Valor da ação atualizado"],
    colunaSioe: "valor_acao_atualizado",
  }),
  campo("valor_envolvido", "Valor envolvido", "valores", "valor", "vios"),
  campo("valor_provisionado", "Valor provisionado", "valores", "valor", "vios"),
  campo("valor_risco", "Valor de risco", "valores", "valor", "vios"),
  campo("percentual_risco", "% de risco", "valores", "percentual", "vios"),
  campo("probabilidade", "Probabilidade", "valores", "texto", "vios"),
  campo("grau_risco", "Grau de risco", "valores", "texto", "vios"),
  campo("parecer_risco", "Parecer do risco", "valores", "texto_longo", "vios"),
  campo("beneficio_economico", "Benefício econômico", "valores", "valor", "vios"),
  campo("complexidade", "Complexidade", "valores", "texto", "vios"),
  campo("impacto", "Impacto", "valores", "texto", "vios"),
  campo("honorarios_sucumbencia", "Honorários de sucumbência", "valores", "valor", "vios"),
  campo("processo_eletronico", "Processo eletrônico", "valores", "booleano", "vios"),
  campo("segredo_justica", "Segredo de justiça", "valores", "booleano", "vios"),
  campo("exibir_cliente", "Exibir para o cliente", "valores", "booleano", "vios"),

  // Crédito (Recuperação de Crédito)
  campo("contrato_credito", "Pedidos: contrato relacionado ao crédito", "credito", "texto", "novo", { tabela: "credito", naLista: true }),
  campo("valor_original", "Valor original do crédito", "credito", "valor", "novo", { tabela: "credito", naLista: true }),
  campo("data_origem_debito", "Data de origem do débito", "credito", "data", "novo", { tabela: "credito", naLista: true }),
  campo("natureza_credito", "Natureza concursal/extraconcursal", "credito", "opcao", "novo", { tabela: "credito", naLista: true, opcoes: NATUREZAS_CREDITO }),
  campo("data_acordo", "Data do acordo", "credito", "data", "novo", { tabela: "credito", naLista: true }),
  campo("valor_acordo", "Valor do acordo", "credito", "valor", "novo", { tabela: "credito", naLista: true }),

  // Síntese e andamento
  campo("objeto", "Objeto", "andamento", "texto_longo", "vios", { colunasVios: ["Objeto"] }),
  campo("sintese", "Observações (síntese do processo)", "andamento", "texto_longo", "vios", {
    colunasVios: ["Observações (síntese do processo)"],
    colunaSioe: "observacoes",
    naLista: true,
  }),
  campo("ultimo_andamento_texto", "Texto do último andamento manual", "andamento", "texto_longo", "vios", { naLista: true }),
  campo("ultimo_andamento_data", "Data do último andamento manual", "andamento", "data", "vios"),
];

const POR_CHAVE = new Map(CAMPOS.map((item) => [item.chave, item]));

export function campoPorChave(chave: string): CampoProcesso | undefined {
  return POR_CHAVE.get(chave);
}

export function rotuloDoCampo(chave: string): string {
  return POR_CHAVE.get(chave)?.rotulo ?? chave;
}

export function camposDoGrupo(grupo: GrupoCampo): CampoProcesso[] {
  return CAMPOS.filter((item) => item.grupo === grupo);
}

/** Colunas de cada tabela, para montar o select e separar o que vai para proc_credito. */
export const COLUNAS_PROCESSO = CAMPOS.filter((item) => item.tabela === "processo").map((item) => item.chave);
export const COLUNAS_CREDITO = CAMPOS.filter((item) => item.tabela === "credito").map((item) => item.chave);

/* ------------------------------------------------------------ valores */

function vazio(valor: ValorCampo | undefined): boolean {
  return valor === null || valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0);
}

export function estaPreenchido(valor: ValorCampo | undefined): boolean {
  return !vazio(valor);
}

/**
 * Texto canônico de um valor, para comparar (o que veio do VIOS × o que está aqui) e para gravar no
 * histórico e na fila do VIOS. Vazio é "", listas saem ordenadas como foram gravadas, valores com 2 casas.
 */
export function textoDoValor(item: CampoProcesso | undefined, valor: ValorCampo | undefined): string {
  if (vazio(valor)) return "";
  if (Array.isArray(valor)) return valor.join("; ");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return item?.tipo === "valor" || item?.tipo === "percentual" ? valor.toFixed(2) : String(valor);
  if (item?.tipo === "valor" || item?.tipo === "percentual") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toFixed(2) : String(valor);
  }
  return String(valor).trim();
}

export function valoresIguais(item: CampoProcesso | undefined, a: ValorCampo | undefined, b: ValorCampo | undefined): boolean {
  return textoDoValor(item, a) === textoDoValor(item, b);
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Como o valor aparece na tela e na planilha. */
export function formatarValor(item: CampoProcesso | undefined, valor: ValorCampo | undefined): string {
  if (vazio(valor)) return "";
  if (Array.isArray(valor)) return valor.join(", ");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (item?.tipo === "data") {
    const partes = DATA_ISO.exec(String(valor));
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : String(valor);
  }
  if (item?.tipo === "valor") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(valor);
  }
  if (item?.tipo === "percentual") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? `${numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : String(valor);
  }
  if (item?.tipo === "opcao") return item.opcoes?.find((opcao) => opcao.valor === valor)?.rotulo ?? String(valor);
  return String(valor);
}

/**
 * Converte o que veio da tela (ou de uma sugestão) para o tipo do campo. Devolve `undefined` quando o
 * valor não serve para o campo (data ou número inválidos, opção que não existe).
 */
export function coagirValor(item: CampoProcesso, bruto: unknown): ValorCampo | undefined {
  if (bruto === null || bruto === undefined) return null;
  switch (item.tipo) {
    case "lista": {
      const itens = Array.isArray(bruto) ? bruto : String(bruto).split(/[;\n]/);
      return [...new Set(itens.map((parte) => String(parte).trim()).filter(Boolean))];
    }
    case "booleano":
      if (typeof bruto === "boolean") return bruto;
      if (bruto === "") return null;
      return undefined;
    case "data": {
      const texto = String(bruto).trim();
      if (!texto) return null;
      const partes = DATA_ISO.exec(texto);
      if (!partes) return undefined;
      const data = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
      const valida = data.getUTCFullYear() === Number(partes[1]) && data.getUTCMonth() === Number(partes[2]) - 1 && data.getUTCDate() === Number(partes[3]);
      return valida ? `${partes[1]}-${partes[2]}-${partes[3]}` : undefined;
    }
    case "valor":
    case "percentual": {
      if (typeof bruto === "number") return Number.isFinite(bruto) ? Math.round(bruto * 100) / 100 : undefined;
      const texto = String(bruto).trim();
      if (!texto) return null;
      const numero = lerNumeroBr(texto);
      return numero === null ? undefined : numero;
    }
    case "opcao": {
      const texto = String(bruto).trim();
      if (!texto) return null;
      return item.opcoes?.some((opcao) => opcao.valor === texto) ? texto : undefined;
    }
    default: {
      const texto = String(bruto).trim();
      return texto || null;
    }
  }
}

/** "1.234,56", "R$ 1.234,56" ou "1234.56" → 1234.56. Devolve null quando não é número. */
export function lerNumeroBr(texto: string): number | null {
  const limpo = texto.replace(/[R$\s%]/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
}
