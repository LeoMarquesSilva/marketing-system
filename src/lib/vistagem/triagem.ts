/**
 * Tipo da pasta que a controladoria informou pela CI na Triagem Manual e que não está nos processos do SIOE (pedido de
 * 18/11/2026: "independente da pasta, se ela colocar o CI tem que ser levado em consideração").
 * - Atendimento: a SAMA conhece a pasta como atendimento (vios_pastas) ou pelas tarefas dela sem CNJ (vios_tarefas).
 * - Processo: a SAMA conhece como processo, mas o SIOE ainda não copiou (pasta aberta hoje).
 * - Desconhecido: nenhuma base conhece; vale como atendimento, e o robô abre a tela que existir.
 */
export type TipoPastaInformada = "Processo" | "Atendimento" | "Desconhecido";

/** Pasta (processo) da base do SIOE (processos_completo), ou uma pasta informada pela CI (`tipoPasta`). */
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
  /** Só nas pastas informadas pela CI que não vieram do SIOE; sem ele, é uma pasta de processo do SIOE. */
  tipoPasta?: TipoPastaInformada;
}

/** Pasta de atendimento (ou que nenhuma base conhece): a vistagem usa as tarefas de atendimento e agenda direto nela. */
export function ehPastaDeAtendimento(tipo: TipoPastaInformada | null | undefined): boolean {
  return tipo === "Atendimento" || tipo === "Desconhecido";
}

/** O tipo da pasta da publicação: a candidata com a CI da pasta diz; as do SIOE (sem tipo) e a falta de pasta, processo. */
export function tipoDaPastaDaPublicacao(publicacao: {
  pasta_ci: string | null;
  pastas_candidatas: PastaSioe[] | null;
}): TipoPastaInformada {
  if (!publicacao.pasta_ci) return "Processo";
  const pasta = (publicacao.pastas_candidatas ?? []).find((candidata) => candidata.ci === publicacao.pasta_ci);
  return pasta?.tipoPasta ?? "Processo";
}

/** O que a SAMA sabe de uma pasta do VIOS fora do SIOE (vios_pastas e a cópia das tarefas, vios_tarefas). */
export interface PastaNoSama {
  tipo: "Processo" | "Atendimento" | null;
  area: string | null;
  cnj: string | null;
  cliente: string | null;
  grupoCliente: string | null;
}

/**
 * Pasta informada pela CI que não está nos processos do SIOE, montada com o que a SAMA sabe (ou só com a CI). Sem
 * tipo na SAMA, a pasta sem CNJ nas tarefas é de atendimento (os atendimentos não têm número de processo).
 */
export function pastaInformada(ci: string, noSama: PastaNoSama | null): PastaSioe {
  const tipoPasta: TipoPastaInformada = !noSama
    ? "Desconhecido"
    : noSama.tipo ?? (noSama.cnj ? "Processo" : "Atendimento");
  return {
    ci,
    cnj: noSama?.cnj ?? "",
    vinculo: null,
    cliente: noSama?.cliente ?? null,
    grupoCliente: noSama?.grupoCliente ?? null,
    area: noSama?.area ?? null,
    advogadoResponsavel: null,
    situacao: null,
    etiquetas: null,
    tipoPasta,
  };
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

/** Prefixo do motivo quando quem descarta é a controladoria (os automáticos têm motivo próprio). */
export const PREFIXO_DESCARTE_CONTROLADORIA = "Descartada pela controladoria: ";

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

export const ESCRITORIO_INSOLVENCIA = "Insolvência";
export const ESCRITORIO_CIVEL_INSOLVENCIA = "Cível | Insolvência";

/**
 * Escritórios que vistam publicações: as áreas das tabelas de pessoas do SIOE, com a
 * Reestruturação dividida nas duas áreas do VIOS (Insolvência e Cível | Insolvência).
 */
export const ESCRITORIOS = [
  "Cível",
  ESCRITORIO_CIVEL_INSOLVENCIA,
  "Contratos",
  "Distressed Deals",
  ESCRITORIO_INSOLVENCIA,
  "Operações Legais",
  "Recuperação de Crédito",
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

/** Pasta em andamento no VIOS: não está encerrada, arquivada, baixada nem extinta. */
export function pastaAtiva(pasta: PastaSioe): boolean {
  return !/encerrad|arquivad|baixad|extint/.test(normalizar(pasta.situacao));
}

/**
 * Etiquetas da pasta no VIOS que fazem a publicação ser demanda de risco (o admin muda em Configurações).
 * Só "Demanda de risco": "Crítico" deixou de contar em 16/11/2026 (na Cível | Insolvência, 46 viravam risco só por ele).
 */
export const ETIQUETAS_DE_RISCO_PADRAO = ["Demanda de risco"];

const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Demanda de risco: a pasta tem uma das etiquetas de risco (sem diferença de acento e maiúscula, como palavra
 * inteira: "Demanda de risco" pega "Carteira X | DEMANDA DE RISCO"; uma etiqueta "Crítico" pegaria "CRITICO", mas não "Autocrítica").
 */
export function temDemandaDeRisco(pasta: PastaSioe, etiquetasDeRisco: string[] = ETIQUETAS_DE_RISCO_PADRAO): boolean {
  const etiquetas = normalizar(pasta.etiquetas);
  if (!etiquetas) return false;
  return etiquetasDeRisco.some((etiqueta) => {
    const termo = normalizar(etiqueta);
    return termo ? new RegExp(`(^|[^a-z0-9])${escaparRegex(termo)}([^a-z0-9]|$)`).test(etiquetas) : false;
  });
}

/** "Insolvência" ou "Cível | Insolvência" quando a área do VIOS é de insolvência; null nas outras. */
function areaDeInsolvencia(area: string | null): string | null {
  const valor = normalizar(area);
  if (!valor.includes("insolv")) return null;
  return valor.includes("civel") ? ESCRITORIO_CIVEL_INSOLVENCIA : ESCRITORIO_INSOLVENCIA;
}

/** Área do processo no VIOS → escritório, quando o advogado não está nas tabelas de pessoas. */
export function escritorioDaAreaDoProcesso(area: string | null): string | null {
  const valor = normalizar(area);
  if (!valor) return null;
  const insolvencia = areaDeInsolvencia(area);
  if (insolvencia) return insolvencia;
  const direto = ESCRITORIOS.find((escritorio) => normalizar(escritorio) === valor);
  return direto ?? area?.trim() ?? null;
}

/**
 * Escritório da pasta: a área do advogado responsável (tabelas de pessoas do SIOE), com a
 * área do processo como reserva. Advogado da Reestruturação vai para a área de insolvência
 * da pasta (Insolvência ou Cível | Insolvência); em pasta de outra área, Cível | Insolvência.
 */
export function escritorioDaPasta(pasta: PastaSioe, areaDoAdvogado: (nome: string | null) => string | null): string | null {
  const daPessoa = areaDoAdvogado(pasta.advogadoResponsavel);
  if (daPessoa && /reestrutura|insolv/.test(normalizar(daPessoa))) return areaDeInsolvencia(pasta.area) ?? ESCRITORIO_CIVEL_INSOLVENCIA;
  return daPessoa ?? escritorioDaAreaDoProcesso(pasta.area);
}

/**
 * Decide para onde vai a publicação. A área é a do advogado responsável
 * (tabelas de pessoas do SIOE), com a área do processo como reserva.
 */
export function triar(
  candidatas: PastaSioe[],
  areaDoAdvogado: (nome: string | null) => string | null,
  contexto: { citaEscritorio?: boolean; etiquetasDeRisco?: string[] } = {}
): ResultadoTriagem {
  const risco = (pasta: PastaSioe) => temDemandaDeRisco(pasta, contexto.etiquetasDeRisco);
  const pendente = (pendencia: Pendencia, pasta: PastaSioe | null = null): ResultadoTriagem => ({
    status: "triagem_pendente",
    pendencia,
    motivoDescarte: null,
    pasta,
    escritorio: null,
    demandaRisco: pasta ? risco(pasta) : null,
    candidatas,
  });

  if (candidatas.length === 0) return pendente("sem_pasta");

  // Mais de uma pasta e só uma em andamento: é ela (as encerradas e arquivadas são de antes).
  const ativas = candidatas.filter(pastaAtiva);
  const pastas = candidatas.length > 1 && ativas.length === 1 ? ativas : candidatas;

  const exCliente = pastas.find(ehExCliente);
  if (exCliente) {
    // Ex-cliente sem advogado do escritório na publicação não precisa de vistagem.
    const descartar = contexto.citaEscritorio === false;
    return {
      status: descartar ? "descartada" : "juridico_vistar",
      pendencia: "ex_cliente",
      motivoDescarte: descartar ? MOTIVO_EX_CLIENTE_SEM_ESCRITORIO : null,
      pasta: pastas.length === 1 ? pastas[0] : exCliente,
      escritorio: ESCRITORIO_EX_CLIENTE,
      demandaRisco: risco(exCliente),
      candidatas: pastas.length > 1 ? pastas : [],
    };
  }

  if (pastas.length > 1) return pendente("varias_pastas");

  const [pasta] = pastas;
  const escritorio = escritorioDaPasta(pasta, areaDoAdvogado);
  if (!escritorio) return pendente("sem_area", pasta);
  if (!pasta.grupoCliente?.trim()) return pendente("sem_grupo", pasta);

  return {
    status: "juridico_vistar",
    pendencia: null,
    motivoDescarte: null,
    pasta,
    escritorio,
    demandaRisco: risco(pasta),
    candidatas: [],
  };
}
