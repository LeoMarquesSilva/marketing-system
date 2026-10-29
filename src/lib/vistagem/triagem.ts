/** Pasta (processo) da base do SIOE (processos_completo). */
export interface PastaSioe {
  ci: string;
  cnj: string;
  vinculo: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  area: string | null;
  advogadoResponsavel: string | null;
  situacao: string | null;
  etiquetas: string | null;
  /** Ação, fase processual e valor da ação da pasta no VIOS (as candidatas gravadas antes não têm). */
  acao?: string | null;
  fase?: string | null;
  valorAcao?: number | null;
  valorAcaoAtualizado?: number | null;
}

export type Pendencia = "sem_pasta" | "varias_pastas" | "ex_cliente" | "sem_area" | "sem_grupo";

export interface ResultadoTriagem {
  status: "juridico_vistar" | "triagem_pendente" | "descartada";
  pendencia: Pendencia | null;
  motivoDescarte: string | null;
  pasta: PastaSioe | null;
  escritorio: string | null;
  demandaRisco: boolean | null;
  candidatas: PastaSioe[];
}

export const ESCRITORIO_EX_CLIENTE = "Operações Legais";

export const MOTIVO_EX_CLIENTE_SEM_ESCRITORIO =
  "Ex-cliente sem advogado do escritório na publicação (Ricardo Viscardi Pires / Gustavo Bismarchi Motta).";

/** Advogados do escritório monitorados na Kurier (nome e OAB/SP). */
const ADVOGADOS_DO_ESCRITORIO = [
  { nome: "gustavobismarchimotta", oab: "275477", exibicao: "Gustavo Bismarchi Motta" },
  { nome: "ricardoviscardipires", oab: "353389", exibicao: "Ricardo Viscardi Pires" },
];

/**
 * Advogados do escritório que a publicação cita, com o nome e a OAB/SP. Compara o nome sem acentos,
 * espaços e hifens (diários quebram nomes no fim da linha) e aceita também o número da OAB, que aparece
 * quando o nome vem abreviado.
 */
export function advogadosDoEscritorioCitados(texto: string): { nome: string; oab: string }[] {
  const compacto = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s-]+/g, "");
  const digitos = texto.replace(/[.\s]/g, "");
  return ADVOGADOS_DO_ESCRITORIO.filter(({ nome, oab }) => compacto.includes(nome) || new RegExp(`(^|\\D)${oab}(\\D|$)`).test(digitos)).map(
    (advogado) => ({ nome: advogado.exibicao, oab: advogado.oab })
  );
}

/** A publicação cita um advogado do escritório? */
export function citaAdvogadoDoEscritorio(texto: string): boolean {
  return advogadosDoEscritorioCitados(texto).length > 0;
}

/** Escritórios que vistam publicações (áreas das tabelas de pessoas do SIOE). */
export const ESCRITORIOS = [
  "Cível",
  "Contratos",
  "Distressed Deals",
  "Operações Legais",
  "Recuperação de Crédito",
  "Reestruturação",
  "Trabalhista",
  "Tributário",
] as const;

function normalizar(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function chavePessoa(nome: string | null | undefined): string {
  return normalizar(nome);
}

/** Ex-cliente aparece no grupo, na etiqueta "Carteira Ex-Cliente" ou na situação "Encerrado - Ex-Cliente". */
export function ehExCliente(pasta: PastaSioe): boolean {
  return /\bex.?cliente\b/.test(normalizar(`${pasta.grupoCliente} | ${pasta.etiquetas} | ${pasta.situacao}`));
}

export function temDemandaDeRisco(pasta: PastaSioe): boolean {
  return normalizar(pasta.etiquetas).includes("demanda de risco");
}

/** Área do processo no VIOS → escritório, quando o advogado não está nas tabelas de pessoas. */
export function escritorioDaAreaDoProcesso(area: string | null): string | null {
  const valor = normalizar(area);
  if (!valor) return null;
  if (valor.includes("insolv")) return "Reestruturação";
  const direto = ESCRITORIOS.find((escritorio) => normalizar(escritorio) === valor);
  return direto ?? area?.trim() ?? null;
}

/**
 * Decide para onde vai a publicação. A área é a do advogado responsável
 * (tabelas de pessoas do SIOE), com a área do processo como reserva.
 */
export function triar(
  candidatas: PastaSioe[],
  areaDoAdvogado: (nome: string | null) => string | null,
  contexto: { citaEscritorio?: boolean } = {}
): ResultadoTriagem {
  const pendente = (pendencia: Pendencia, pasta: PastaSioe | null = null): ResultadoTriagem => ({
    status: "triagem_pendente",
    pendencia,
    motivoDescarte: null,
    pasta,
    escritorio: null,
    demandaRisco: pasta ? temDemandaDeRisco(pasta) : null,
    candidatas,
  });

  if (candidatas.length === 0) return pendente("sem_pasta");

  const exCliente = candidatas.find(ehExCliente);
  if (exCliente) {
    // Ex-cliente sem advogado do escritório na publicação não precisa de vistagem.
    const descartar = contexto.citaEscritorio === false;
    return {
      status: descartar ? "descartada" : "juridico_vistar",
      pendencia: "ex_cliente",
      motivoDescarte: descartar ? MOTIVO_EX_CLIENTE_SEM_ESCRITORIO : null,
      pasta: candidatas.length === 1 ? candidatas[0] : exCliente,
      escritorio: ESCRITORIO_EX_CLIENTE,
      demandaRisco: temDemandaDeRisco(exCliente),
      candidatas: candidatas.length > 1 ? candidatas : [],
    };
  }

  if (candidatas.length > 1) return pendente("varias_pastas");

  const [pasta] = candidatas;
  const escritorio = areaDoAdvogado(pasta.advogadoResponsavel) ?? escritorioDaAreaDoProcesso(pasta.area);
  if (!escritorio) return pendente("sem_area", pasta);
  if (!pasta.grupoCliente?.trim()) return pendente("sem_grupo", pasta);

  return {
    status: "juridico_vistar",
    pendencia: null,
    motivoDescarte: null,
    pasta,
    escritorio,
    demandaRisco: temDemandaDeRisco(pasta),
    candidatas: [],
  };
}
