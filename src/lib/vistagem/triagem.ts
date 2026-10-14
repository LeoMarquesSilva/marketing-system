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
}

export type Pendencia = "sem_pasta" | "varias_pastas" | "ex_cliente" | "sem_area" | "sem_grupo";

export interface ResultadoTriagem {
  status: "juridico_vistar" | "triagem_pendente";
  pendencia: Pendencia | null;
  pasta: PastaSioe | null;
  escritorio: string | null;
  demandaRisco: boolean | null;
  candidatas: PastaSioe[];
}

export const ESCRITORIO_EX_CLIENTE = "Operações Legais";

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
export function triar(candidatas: PastaSioe[], areaDoAdvogado: (nome: string | null) => string | null): ResultadoTriagem {
  const pendente = (pendencia: Pendencia, pasta: PastaSioe | null = null): ResultadoTriagem => ({
    status: "triagem_pendente",
    pendencia,
    pasta,
    escritorio: null,
    demandaRisco: pasta ? temDemandaDeRisco(pasta) : null,
    candidatas,
  });

  if (candidatas.length === 0) return pendente("sem_pasta");

  const exCliente = candidatas.find(ehExCliente);
  if (exCliente) {
    return {
      status: "juridico_vistar",
      pendencia: "ex_cliente",
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
    pasta,
    escritorio,
    demandaRisco: temDemandaDeRisco(pasta),
    candidatas: [],
  };
}
