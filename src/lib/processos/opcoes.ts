/**
 * Listas de opções dos campos de escolha do cadastro de processos: o equivalente aos "Cadastros" do VIOS.
 * A carga inicial veio dos cadastros do VIOS (10/11/2026); depois a equipe mantém as listas aqui.
 */

export interface DefinicaoLista {
  chave: string;
  rotulo: string;
  /** De onde vieram as opções da carga inicial, para a tela de Cadastros. */
  origemVios: string;
  /** Nome que se repete em estados diferentes: a UF entra na identidade da opção (cidade, comarca). */
  porUf?: boolean;
}

export const LISTAS: DefinicaoLista[] = [
  { chave: "justica", rotulo: "Tipo de justiça", origemVios: "Cadastros > Tipo de Justiça" },
  { chave: "jurisdicao", rotulo: "Jurisdição", origemVios: "Cadastros > Jurisdição" },
  { chave: "area", rotulo: "Área jurídica", origemVios: "Cadastros > Área Jurídica" },
  { chave: "departamento", rotulo: "Departamento", origemVios: "Cadastros > Departamentos" },
  { chave: "materia", rotulo: "Matéria", origemVios: "Cadastros > Matérias" },
  { chave: "acao", rotulo: "Tipo de ação", origemVios: "Cadastros > Tipo de Ações" },
  { chave: "fase", rotulo: "Fase processual", origemVios: "Cadastros > Fases processuais" },
  { chave: "situacao", rotulo: "Situação", origemVios: "Cadastros > Situação" },
  { chave: "vinculo", rotulo: "Vínculo do processo", origemVios: "Cadastros > Tipo de Vínculo de Processo" },
  { chave: "etiquetas", rotulo: "Etiquetas de processo", origemVios: "Cadastros > Etiquetas (módulo Processos)" },
  { chave: "colaboradores", rotulo: "Advogados e auxiliares", origemVios: "Responsáveis das pastas no VIOS" },
  { chave: "polo_cliente", rotulo: "Polo do cliente", origemVios: "Valores do VIOS" },
  { chave: "sistema_tribunal", rotulo: "Sistema do tribunal", origemVios: "Valores do VIOS" },
  { chave: "uf", rotulo: "UF", origemVios: "Estados" },
  { chave: "cidade", rotulo: "Cidade", origemVios: "Cadastros > Cidades", porUf: true },
  { chave: "comarca", rotulo: "Comarca / Tribunal / Órgão adm.", origemVios: "Cadastros > Comarca - Tribunal - Órgão Adm.", porUf: true },
  { chave: "orgao_julgador", rotulo: "Órgão julgador (vara/câmara)", origemVios: "Cadastros > Órgão Julgador" },
  { chave: "tipo_orgao_julgador", rotulo: "Tipo de órgão julgador", origemVios: "Cadastros > Tipo de Órgão Julgador" },
  { chave: "tipo_parte", rotulo: "Tipo de parte", origemVios: "Cadastros > Tipo de parte" },
  { chave: "pedidos", rotulo: "Pedidos", origemVios: "Cadastros > Pedidos" },
];

const POR_CHAVE = new Map(LISTAS.map((lista) => [lista.chave, lista]));

export function definicaoDaLista(chave: string): DefinicaoLista | undefined {
  return POR_CHAVE.get(chave);
}

export interface Opcao {
  id: string;
  lista: string;
  valor: string;
  viosCi: string | null;
  extra: Record<string, unknown>;
  ativo: boolean;
  origem: "vios" | "manual";
}

/** Sem caixa, acento nem espaço repetido: "Justiça  Estadual" e "JUSTICA ESTADUAL" são a mesma opção. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Identidade da opção na lista (valor normalizado e, nas listas por UF, a UF). */
export function chaveDaOpcao(lista: string, valor: string, uf?: string | null): string {
  const base = normalizar(valor);
  return definicaoDaLista(lista)?.porUf && uf ? `${base}|${uf.toUpperCase()}` : base;
}

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO"];

const ESTADOS: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF", "espirito santo": "ES",
  goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA", paraiba: "PB",
  parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS",
  rondonia: "RO", roraima: "RR", "santa catarina": "SC", sergipe: "SE", "sao paulo": "SP", tocantins: "TO",
};

/** "São Paulo" → "SP"; "SP" → "SP". */
export function ufDoEstado(estado: string | null | undefined): string | null {
  const texto = normalizar(estado);
  if (!texto) return null;
  if (texto.length === 2 && UFS.includes(texto.toUpperCase())) return texto.toUpperCase();
  return ESTADOS[texto] ?? null;
}

/** "Parte Ativa" → ativo; "Parte Passiva" → passivo; o resto, terceiro. */
export function poloDoTipo(tipo: string | null | undefined): "ativo" | "passivo" | "terceiro" {
  const texto = normalizar(tipo);
  if (texto.includes("ativ")) return "ativo";
  if (texto.includes("passiv")) return "passivo";
  return "terceiro";
}

/**
 * As opções que valem para o processo: nas listas por UF, as da UF do processo primeiro (as outras continuam
 * disponíveis, porque a UF pode estar errada); sempre as ativas e, se o valor atual não estiver entre elas,
 * ele também (para não sumir da tela).
 */
export function opcoesParaCampo(opcoes: Opcao[], atual: string | null | undefined, uf?: string | null): { valor: string; rotulo: string; descricao?: string | null }[] {
  const ativas = opcoes.filter((opcao) => opcao.ativo);
  const daUf = uf ? ativas.filter((opcao) => opcao.extra?.uf === uf) : [];
  const ordenadas = daUf.length ? [...daUf, ...ativas.filter((opcao) => opcao.extra?.uf !== uf)] : ativas;
  const vistas = new Set<string>();
  const lista: { valor: string; rotulo: string; descricao?: string | null }[] = [];
  for (const opcao of ordenadas) {
    if (vistas.has(opcao.valor)) continue;
    vistas.add(opcao.valor);
    const ufDaOpcao = typeof opcao.extra?.uf === "string" ? (opcao.extra.uf as string) : null;
    lista.push({ valor: opcao.valor, rotulo: opcao.valor, descricao: ufDaOpcao && ufDaOpcao !== uf ? ufDaOpcao : null });
  }
  if (atual && !vistas.has(atual)) lista.unshift({ valor: atual, rotulo: atual, descricao: "fora da lista" });
  return lista;
}
