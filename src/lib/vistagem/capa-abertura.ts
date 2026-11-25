import { chaveNome, paraDataVios } from "./agendamento";
import { somarDiasUteis } from "./dias-uteis";
import { advogadosDoEscritorioCitados, ESCRITORIO_CIVEL_INSOLVENCIA, ESCRITORIO_INSOLVENCIA, type PastaSioe } from "./triagem";

/**
 * Capa para a abertura de pasta (Fase 1, só leitura): o que dá para preencher na tela "Cadastro de Processo
 * (Simplificado)" do VIOS para uma publicação sem pasta, e de onde vem cada campo. Fontes, testadas em 10/11/2026:
 * - número CNJ: justiça, tribunal, UF e grau;
 * - DJEN (API pública do CNJ, sem chave): órgão, classe, partes com o polo e advogados com a OAB;
 * - e-SAJ (consulta pública do TJSP): classe, assunto, foro, vara/órgão julgador, distribuição e o valor da ação.
 *   É a única fonte gratuita do valor; não cobre o eproc nem outros tribunais;
 * - DataJud (CNJ, lento e instável): sistema, data de ajuizamento e assuntos, quando responde;
 * - triagem do Orquestra e pastas vivas do grupo: área, cliente, responsável e auxiliar.
 * Sem valor em nenhuma fonte, vai R$ 0,01 e a ATUALIZAÇÃO DE CADASTRO corrige (decisão do usuário, 10/11/2026).
 * A controladoria edita qualquer campo (lápis): a edição fica gravada na publicação e vale por cima das fontes.
 */

export type FonteDaCapa = "cnj" | "djen" | "esaj" | "datajud" | "triagem" | "pastas" | "regra" | "editado" | "falta";

export interface CampoDaCapa {
  chave: ChaveDaCapa;
  campo: string;
  grupo: GrupoDaCapa;
  /** O VIOS não grava a pasta sem ele. */
  obrigatorio: boolean;
  valor: string | null;
  fonte: FonteDaCapa;
  /** Precisa de conferência antes de abrir (palpite, regra provável ou obrigatório vazio). */
  conferir: boolean;
  nota?: string;
  /** Editado pela controladoria: o que as fontes tinham (para desfazer) e quem editou. */
  original?: { valor: string | null; fonte: FonteDaCapa };
  editado?: { por: string | null; em: string };
  /** O que não está na lista do VIOS do campo (cliente ainda sem pasta, etiqueta de grupo novo): conferir no VIOS. */
  foraDaLista?: string[];
}

export interface Cnj {
  digitos: string;
  justica: string | null;
  tribunal: string | null;
  uf: string | null;
  grau: "PRIMEIRO GRAU" | "SEGUNDO GRAU";
  ano: number;
}

const UF_DO_TJ: Record<string, string> = {
  "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE", "07": "DF", "08": "ES", "09": "GO", "10": "MA",
  "11": "MT", "12": "MS", "13": "MG", "14": "PA", "15": "PB", "16": "PR", "17": "PE", "18": "PI", "19": "RJ", "20": "RN",
  "21": "RS", "22": "RO", "23": "RR", "24": "SC", "25": "SE", "26": "SP", "27": "TO",
};
const UF_DO_TRT: Record<number, string> = {
  1: "RJ", 2: "SP", 3: "MG", 4: "RS", 5: "BA", 6: "PE", 7: "CE", 8: "PA", 9: "PR", 10: "DF", 11: "AM", 12: "SC",
  13: "PB", 14: "RO", 15: "SP", 16: "MA", 17: "ES", 18: "GO", 19: "AL", 20: "SE", 21: "RN", 22: "PI", 23: "MT", 24: "MS",
};
const CAPITAL: Record<string, string> = {
  AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador", CE: "Fortaleza", DF: "Brasília", ES: "Vitória",
  GO: "Goiânia", MA: "São Luís", MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém", PB: "João Pessoa",
  PR: "Curitiba", PE: "Recife", PI: "Teresina", RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho",
  RR: "Boa Vista", SC: "Florianópolis", SE: "Aracaju", SP: "São Paulo", TO: "Palmas",
};
const JUSTICA: Record<string, string> = {
  "1": "Supremo Tribunal Federal",
  "2": "Conselho Nacional de Justiça",
  "3": "Superior Tribunal de Justiça",
  "4": "Justiça Federal",
  "5": "Justiça Trabalhista",
  "6": "Justiça Eleitoral",
  "7": "Justiça Militar da União",
  "8": "Justiça Estadual",
  "9": "Justiça Militar Estadual",
};

/** Lê o número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO): justiça, tribunal, UF e grau (origem 0000 = tribunal, 2º grau). */
export function lerCnj(numero: string | null | undefined): Cnj | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length !== 20) return null;
  const j = digitos[13];
  const tr = digitos.slice(14, 16);
  const regiao = Number(tr);
  let tribunal: string | null = null;
  let uf: string | null = null;
  if (j === "8") {
    uf = UF_DO_TJ[tr] ?? null;
    tribunal = uf ? (uf === "DF" ? "TJDFT" : `TJ${uf}`) : null;
  } else if (j === "5") {
    tribunal = `TRT${regiao}`;
    uf = UF_DO_TRT[regiao] ?? null;
  } else if (j === "4") {
    tribunal = `TRF${regiao}`;
  } else if (j === "3") {
    tribunal = "STJ";
  }
  return {
    digitos,
    justica: JUSTICA[j] ?? null,
    tribunal,
    uf,
    grau: digitos.slice(16) === "0000" ? "SEGUNDO GRAU" : "PRIMEIRO GRAU",
    ano: Number(digitos.slice(9, 13)),
  };
}

// ---------------------------------------------------------------------------------------------------------------- DJEN

/** Uma comunicação da API do DJEN (comunicaapi.pje.jus.br/api/v1/comunicacao), só os campos usados. */
export interface ComunicacaoDjen {
  siglaTribunal?: string | null;
  nomeOrgao?: string | null;
  nomeClasse?: string | null;
  codigoClasse?: string | number | null;
  data_disponibilizacao?: string | null;
  tipoComunicacao?: string | null;
  destinatarios?: { nome?: string | null; polo?: string | null }[] | null;
  destinatarioadvogados?: { advogado?: { nome?: string | null; numero_oab?: string | null; uf_oab?: string | null } | null }[] | null;
}

export interface AdvogadoNaCapa {
  nome: string;
  oab: string;
  uf: string;
  doEscritorio: boolean;
}

export interface CapaDoDjen {
  comunicacoes: number;
  tribunal: string | null;
  orgao: string | null;
  classe: string | null;
  codigoClasse: string | null;
  ativas: string[];
  passivas: string[];
  advogados: AdvogadoNaCapa[];
  /** Data (AAAA-MM-DD) da "Lista de distribuição" no DJEN, quando houver. */
  distribuicao: string | null;
  /** Data (AAAA-MM-DD) da comunicação mais antiga. */
  primeiraComunicacao: string | null;
}

/** Junta as comunicações do processo: órgão e classe da mais recente, todas as partes e advogados (sem repetir). */
export function capaDoDjen(itens: ComunicacaoDjen[]): CapaDoDjen {
  const ordenadas = [...itens].sort((a, b) => String(b.data_disponibilizacao ?? "").localeCompare(String(a.data_disponibilizacao ?? "")));
  const recente = ordenadas[0];
  const polos = new Map<string, "A" | "P" | null>();
  const advogados = new Map<string, AdvogadoNaCapa>();
  for (const item of ordenadas) {
    for (const destinatario of item.destinatarios ?? []) {
      const nome = destinatario.nome?.trim();
      if (!nome || polos.has(nome)) continue;
      const polo = destinatario.polo?.trim().toUpperCase();
      polos.set(nome, polo === "A" || polo === "P" ? polo : null);
    }
    for (const { advogado } of item.destinatarioadvogados ?? []) {
      const nome = advogado?.nome?.trim();
      const oab = String(advogado?.numero_oab ?? "").trim();
      const uf = String(advogado?.uf_oab ?? "").trim().toUpperCase();
      if (!nome || advogados.has(`${oab}${uf}`)) continue;
      const doEscritorio = uf === "SP" && advogadosDoEscritorioCitados(`${nome} ${oab}`).length > 0;
      advogados.set(`${oab}${uf}`, { nome, oab, uf, doEscritorio });
    }
  }
  return {
    comunicacoes: itens.length,
    tribunal: recente?.siglaTribunal?.trim() || null,
    orgao: recente?.nomeOrgao?.trim() || null,
    classe: recente?.nomeClasse?.trim() || null,
    codigoClasse: recente?.codigoClasse != null ? String(recente.codigoClasse) : null,
    ativas: [...polos].filter(([, polo]) => polo === "A").map(([nome]) => nome),
    passivas: [...polos].filter(([, polo]) => polo === "P").map(([nome]) => nome),
    advogados: [...advogados.values()],
    distribuicao:
      ordenadas.filter((item) => /distribui/i.test(item.tipoComunicacao ?? "")).at(-1)?.data_disponibilizacao?.slice(0, 10) ?? null,
    primeiraComunicacao: ordenadas.at(-1)?.data_disponibilizacao?.slice(0, 10) ?? null,
  };
}

// --------------------------------------------------------------------------------------------------------------- e-SAJ

export interface CapaDoEsaj {
  classe: string | null;
  assunto: string | null;
  foro: string | null;
  vara: string | null;
  orgaoJulgador: string | null;
  distribuicao: string | null;
  valor: number | null;
}

/** Consulta pública do e-SAJ (TJSP): 1º grau no cpopg, 2º grau (origem 0000) no cposg. Null fora do TJSP. */
export function urlDoEsaj(cnj: Cnj | null): string | null {
  if (!cnj || cnj.tribunal !== "TJSP") return null;
  const d = cnj.digitos;
  const numeroAno = `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}`;
  const foro = d.slice(16);
  const formatado = `${numeroAno}.8.26.${foro}`;
  const busca = new URLSearchParams(
    cnj.grau === "SEGUNDO GRAU"
      ? [
          ["conversationId", ""], ["paginaConsulta", "1"], ["cbPesquisa", "NUMPROC"], ["numeroDigitoAnoUnificado", numeroAno],
          ["foroNumeroUnificado", foro], ["dePesquisaNuUnificado", formatado], ["dePesquisaNuUnificado", "UNIFICADO"],
          ["dePesquisa", ""], ["tipoNuProcesso", "UNIFICADO"],
        ]
      : [
          ["conversationId", ""], ["cbPesquisa", "NUMPROC"], ["numeroDigitoAnoUnificado", numeroAno], ["foroNumeroUnificado", foro],
          ["dadosConsulta.valorConsultaNuUnificado", formatado], ["dadosConsulta.valorConsultaNuUnificado", "UNIFICADO"],
          ["dadosConsulta.valorConsulta", ""], ["dadosConsulta.tipoNuProcesso", "UNIFICADO"],
        ]
  );
  return `https://esaj.tjsp.jus.br/${cnj.grau === "SEGUNDO GRAU" ? "cposg" : "cpopg"}/search.do?${busca}`;
}

/** "R$ 174.938.139,07" → 174938139.07. */
export function valorEmReais(texto: string | null | undefined): number | null {
  const achado = (texto ?? "").match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/);
  return achado ? Number(`${achado[1].replace(/\./g, "")}.${achado[2]}`) : null;
}

/** Lê a capa do processo na página do e-SAJ (os campos têm ids fixos); null quando não é a página do processo. */
export function lerCapaDoEsaj(html: string): CapaDoEsaj | null {
  const campo = (id: string) => {
    const achado = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</(?:div|span)>`));
    if (!achado) return null;
    const texto = achado[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    return texto || null;
  };
  if (!/id="numeroProcesso"/.test(html) || !/id="classeProcesso"/.test(html)) return null;
  return {
    classe: campo("classeProcesso"),
    assunto: campo("assuntoProcesso"),
    foro: campo("foroProcesso"),
    vara: campo("varaProcesso"),
    orgaoJulgador: campo("orgaoJulgadorProcesso"),
    distribuicao: campo("dataHoraDistribuicaoProcesso")?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? null,
    valor: valorEmReais(campo("valorAcaoProcesso")),
  };
}

// ------------------------------------------------------------------------------------------------------------ DataJud

export interface CapaDoDataJud {
  achou: boolean;
  erro: string | null;
  sistema: string | null;
  ajuizamento: string | null;
  assuntos: string[];
  classe: string | null;
}

/** Alias do índice do DataJud pelo número (api_publica_tjsp, api_publica_trt2…). */
export function aliasDoDataJud(cnj: Cnj | null): string | null {
  return cnj?.tribunal ? cnj.tribunal.toLowerCase() : null;
}

/** "20261029000000" ou "2026-10-29T…" → "29/10/2026". */
export function dataDoDataJud(valor: string | null | undefined): string | null {
  const d = (valor ?? "").replace(/\D/g, "");
  return d.length >= 8 ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : null;
}


// -------------------------------------------------------------------------------------------------------------- regras

const sem = (texto: string | null | undefined) => chaveNome(texto).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Classe do tribunal → ação do VIOS. Só os pares conferidos no gabarito de 10/11/2026 (pastas abertas desde 01/09);
 * as outras classes vão como estão, para conferir.
 */
const ACAO_DO_VIOS: { classe: RegExp; acao: string }[] = [
  { classe: /^ACAO TRABALHISTA RITO (ORDINARIO|SUMARISSIMO|SUMARIO)$/, acao: "Reclamação Trabalhista" },
  { classe: /^AGRAVO DE INSTRUMENTO$/, acao: "Agravo de instrumento" },
  { classe: /^CUMPRIMENTO (PROVISORIO )?DE SENTENCA$/, acao: "Cumprimento de sentença" },
  { classe: /^LIQUIDACAO POR ARBITRAMENTO$/, acao: "Cumprimento de sentença" },
  { classe: /^FALENCIA DE EMPRESARIOS/, acao: "Falência" },
  { classe: /^TUTELA CAUTELAR ANTECEDENTE$/, acao: "Tutela Provisória Cautelar Antecipada de Urgência" },
];

export function acaoDoVios(classe: string | null | undefined): { acao: string; conferida: boolean } | null {
  if (!classe?.trim()) return null;
  const chave = sem(classe);
  const par = ACAO_DO_VIOS.find((item) => item.classe.test(chave));
  if (par) return { acao: par.acao, conferida: true };
  const minusculas = classe.trim().toLocaleLowerCase("pt-BR");
  return { acao: minusculas.charAt(0).toLocaleUpperCase("pt-BR") + minusculas.slice(1), conferida: false };
}

/** Como o VIOS chama as partes em cada tipo de ação (o padrão é Autor x Réu). */
const TIPOS_DAS_PARTES: { acao: RegExp; ativa: string; passiva: string }[] = [
  { acao: /^AGRAVO/, ativa: "Agravante", passiva: "Agravado" },
  { acao: /^APELACAO/, ativa: "Apelante", passiva: "Apelado" },
  { acao: /^EMBARGOS/, ativa: "Embargante", passiva: "Embargado" },
  { acao: /^(CUMPRIMENTO|EXECUCAO|LIQUIDACAO)/, ativa: "Exequente", passiva: "Executado" },
  { acao: /^RECLAMACAO TRABALHISTA/, ativa: "Reclamante", passiva: "Reclamado" },
  { acao: /^(FALENCIA|RECUPERACAO|HABILITACAO|IMPUGNACAO|TUTELA)/, ativa: "Requerente", passiva: "Requerido" },
];

export function tiposDasPartes(acao: string | null | undefined): { ativa: string; passiva: string } {
  const chave = sem(acao);
  const tipo = TIPOS_DAS_PARTES.find((item) => item.acao.test(chave));
  return tipo ? { ativa: tipo.ativa, passiva: tipo.passiva } : { ativa: "Autor", passiva: "Réu" };
}

/** Fase do VIOS: 2º grau é Recursal; cumprimento e execução, Execução; liquidação, Liquidação; o resto, Conhecimento. */
export function faseDoVios(cnj: Cnj | null, classe: string | null | undefined, acao: string | null | undefined): { fase: string; certa: boolean } {
  if (cnj?.grau === "SEGUNDO GRAU") return { fase: "Recursal", certa: true };
  if (/^LIQUIDACAO/.test(sem(classe))) return { fase: "Liquidação", certa: true };
  if (/^(CUMPRIMENTO|EXECUCAO)/.test(sem(acao)) || /^(CUMPRIMENTO|EXECUCAO)/.test(sem(classe))) return { fase: "Execução", certa: true };
  return { fase: "Conhecimento", certa: false };
}

/**
 * "2ª Câmara Reservada de Direito Empresarial" → { vara: "2ª", tipo: "Câmara Reservada de Direito Empresarial" }. O
 * DJEN do eproc (TJSP, 2º grau) põe o gabinete na frente, "Gab. 06 - 23ª Câmara de Direito Privado": o gabinete não é
 * vara nem tipo no VIOS e sai (18/11/2026, três agravos pararam em "não achou nas listas do VIOS: vara, tipoVara").
 *
 * 25/11/2026, mais três paradas em "tipoVara": a lista de tipos do VIOS tem o nome genérico, sem a cidade (que vai no
 * campo Cidade) e sem o número (que vai no campo Vara).
 *  - "1ª Vara do Trabalho de Hortolândia" → 1ª / "Vara do Trabalho" (a cidade da capa sai do fim);
 *  - "CON1 - Jundiaí" (juízo de conhecimento do PJe do TRT15; também EXE e LIQ) → 1ª / "CON";
 *  - "1ªVara Reg. Comp. Empresarial e Conflitos à Arbitragem Foro Espec. 4ªe10ª RAJs" (número grudado e abreviado) →
 *    1ª / "Vara Regional de Competência Empresarial e de Conflitos Relacionados à Arbitragem".
 */
export function separarVara(orgao: string | null | undefined, cidade?: string | null): { vara: string | null; tipo: string | null } {
  const texto = orgao?.trim().replace(/^Gab(?:inete)?\.?\s*\d+\s*-\s*/i, "");
  if (!texto) return { vara: null, tipo: null };
  const juizo = texto.match(/^([A-Z]{2,5})(\d{1,2})\s*-\s*\S/);
  if (juizo) return { vara: `${Number(juizo[2])}ª`, tipo: juizo[1] };
  const achado = texto.match(/^0*(\d{1,3})\s*(?:[ªº°]\s*|a\s+)(\S.*)$/i);
  const tipo = (achado ? achado[2] : texto).trim();
  return { vara: achado ? `${achado[1]}ª` : null, tipo: tipoDeVaraDoVios(tipo, cidade) };
}

/** Nomes do DJEN que a lista de tipos de vara do VIOS escreve de outro jeito (comparados sem acento e pontuação). */
const TIPO_DE_VARA_DO_VIOS: { orgao: RegExp; tipo: string }[] = [
  {
    orgao: /^VARA REG(?:IONAL)? (?:DE )?COMP(?:ETENCIA)? EMPRESARIAL/,
    tipo: "Vara Regional de Competência Empresarial e de Conflitos Relacionados à Arbitragem",
  },
];

/** O tipo como o VIOS escreve: pelo de-para, ou sem a cidade da capa no fim ("… de Hortolândia", "… da Comarca de X"). */
function tipoDeVaraDoVios(tipo: string, cidade: string | null | undefined): string {
  const doVios = TIPO_DE_VARA_DO_VIOS.find((item) => item.orgao.test(sem(tipo)));
  if (doVios) return doVios.tipo;
  const alvo = sem(cidade);
  if (!alvo) return tipo;
  const palavras = tipo.split(/\s+/);
  const tamanho = alvo.split(" ").length;
  if (palavras.length <= tamanho || sem(palavras.slice(-tamanho).join(" ")) !== alvo) return tipo;
  const resto = palavras.slice(0, -tamanho);
  if (/^(de|do|da|dos|das|-)$/i.test(resto[resto.length - 1] ?? "")) resto.pop();
  if (resto.length > 2 && /^comarca$/i.test(resto[resto.length - 1]) && /^da$/i.test(resto[resto.length - 2])) resto.splice(-2);
  return resto.length ? resto.join(" ") : tipo;
}

/** Cidade pelo nome do órgão ("… da Comarca de Campinas", "Vara do Trabalho de Carapicuíba", "EXE3 - Jundiaí"). */
export function cidadeDoOrgao(orgao: string | null | undefined): string | null {
  const texto = orgao?.trim() ?? "";
  const achado =
    texto.match(/(?:Comarca|Foro(?: Regional| Distrital)?|Vara do Trabalho|Vara Federal|Varas?)\s+(?:de|do|da)\s+([A-ZÀ-Ý][\p{L}' ]+?)\s*$/u) ??
    texto.match(/\s-\s([A-ZÀ-Ý][\p{L}' ]+)$/u);
  return achado ? achado[1].trim() : null;
}

/** "Estado de São Paulo", "Estado do Rio de Janeiro", "Estado da Bahia". */
const ESTADO_DA_UF: Record<string, string> = {
  AC: "do Acre", AL: "de Alagoas", AP: "do Amapá", AM: "do Amazonas", BA: "da Bahia", CE: "do Ceará", ES: "do Espírito Santo",
  GO: "de Goiás", MA: "do Maranhão", MT: "de Mato Grosso", MS: "de Mato Grosso do Sul", MG: "de Minas Gerais", PA: "do Pará",
  PB: "da Paraíba", PR: "do Paraná", PE: "de Pernambuco", PI: "do Piauí", RJ: "do Rio de Janeiro", RN: "do Rio Grande do Norte",
  RS: "do Rio Grande do Sul", RO: "de Rondônia", RR: "de Roraima", SC: "de Santa Catarina", SE: "de Sergipe", SP: "de São Paulo",
  TO: "do Tocantins",
};

/** O órgão como o VIOS escreve (conferido no TJSP, CI 61365, e no TRT2, CI 61361). */
export function orgaoDoVios(cnj: Cnj | null): string | null {
  if (!cnj?.tribunal) return null;
  const regiao = Number(cnj.digitos.slice(14, 16));
  if (cnj.tribunal === "TJDFT") return "Tribunal de Justiça do Distrito Federal e dos Territórios";
  if (cnj.tribunal.startsWith("TJ") && cnj.uf && ESTADO_DA_UF[cnj.uf]) return `Tribunal de Justiça do Estado ${ESTADO_DA_UF[cnj.uf]}`;
  if (cnj.tribunal.startsWith("TRT")) return `${cnj.tribunal} - Tribunal Regional do Trabalho da ${regiao}ª Região`;
  if (cnj.tribunal.startsWith("TRF")) return `Tribunal Regional Federal da ${regiao}ª Região`;
  if (cnj.tribunal === "STJ") return "Superior Tribunal de Justiça";
  return cnj.tribunal;
}

const SISTEMA_DO_DATAJUD: [RegExp, string][] = [
  [/^PJE/, "pje"],
  [/SAJ/, "E-saj"],
  [/EPROC/, "E-PROC"],
  [/PROJUDI/, "projudi"],
  [/THEMIS/, "Themis"],
];

/**
 * Sistema do tribunal, com o nome da lista do VIOS: o do DataJud quando veio; senão, o provável pelo tribunal e o número.
 * TJMG: desde 2026 as pastas novas estão no eproc (65 de 94 no 1º grau, no SIOE em 10/11/2026); antes, no PJe.
 */
export function sistemaDoTribunal(cnj: Cnj | null, doDataJud: string | null | undefined): { sistema: string; provavel: boolean } | null {
  const chave = sem(doDataJud).replace(/\s/g, "");
  const doCnj = SISTEMA_DO_DATAJUD.find(([regex]) => regex.test(chave));
  if (doCnj) return { sistema: doCnj[1], provavel: false };
  if (!cnj) return null;
  if (cnj.tribunal === "TJMG") return { sistema: cnj.ano >= 2026 ? "E-PROC" : "pje", provavel: true };
  if (cnj.tribunal?.startsWith("TRT")) return { sistema: "pje", provavel: true };
  if (cnj.tribunal === "TJSC" || cnj.tribunal === "TJRS" || cnj.tribunal === "TRF4") return { sistema: "E-PROC", provavel: true };
  // No TJSP, os processos novos do eproc vêm com o número começando em 4; os do e-SAJ, não.
  if (cnj.tribunal === "TJSP") return { sistema: cnj.digitos.startsWith("4") && cnj.ano >= 2025 ? "E-PROC" : "E-saj", provavel: true };
  return null;
}

/**
 * Matéria da lista do VIOS pelo assunto do tribunal. O VIOS guarda só a folha ("RECUPERACAO JUDICIAL E FALENCIA");
 * o e-SAJ manda o caminho ("DIREITO CIVIL - Empresas - Recuperação judicial e Falência") e o DataJud, a folha.
 */
export function materiaDoVios(assuntos: string[], materias: readonly string[]): string | null {
  const porChave = new Map(materias.map((materia) => [sem(materia), materia]));
  for (const assunto of assuntos) {
    const folha = assunto.split(/\s+[-|]\s+|\|/).pop() ?? assunto;
    const achada = porChave.get(sem(folha)) ?? porChave.get(sem(assunto));
    if (achada) return achada;
  }
  return null;
}

/** Departamento do VIOS pela área (Cível | Insolvência fica no departamento Insolvência). */
export function departamentoDaArea(area: string | null | undefined): string | null {
  if (!area) return null;
  return area === ESCRITORIO_CIVEL_INSOLVENCIA ? ESCRITORIO_INSOLVENCIA : area;
}

const PALAVRAS_GENERICAS = new Set(["LTDA", "SA", "S", "A", "ME", "EPP", "EIRELI", "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "COMERCIO", "INDUSTRIA", "SERVICOS", "PARTICIPACOES", "RECUPERACAO", "JUDICIAL"]);
const palavras = (nome: string) => sem(nome).split(" ").filter((palavra) => palavra.length > 1 && !PALAVRAS_GENERICAS.has(palavra));

/** A parte do DJEN que é o cliente: todas as palavras que identificam um dos nomes aparecem no outro. */
export function parteDoCliente(cliente: string | null | undefined, capa: Pick<CapaDoDjen, "ativas" | "passivas">): { nome: string; polo: "A" | "P" } | null {
  const doCliente = palavras(cliente ?? "");
  if (!doCliente.length) return null;
  const casa = (parte: string) => {
    const daParte = palavras(parte);
    if (!daParte.length) return false;
    const [menor, maior] = doCliente.length <= daParte.length ? [doCliente, daParte] : [daParte, doCliente];
    return menor.every((palavra) => maior.includes(palavra));
  };
  const ativa = capa.ativas.find(casa);
  if (ativa) return { nome: ativa, polo: "A" };
  const passiva = capa.passivas.find(casa);
  return passiva ? { nome: passiva, polo: "P" } : null;
}

// --------------------------------------------------------------------------------------------------------------- campos

export type GrupoDaCapa = "processo" | "partes" | "escritorio";
/**
 * Listas do VIOS para escolher ao editar. Usuários, matérias e sistemas são cópias do SAMA; clientes, ações e etiquetas
 * saem do "Processos Completo" do VIOS (processos_completo do SIOE), com a grafia que o VIOS grava.
 */
export type ListaDoVios = "usuarios" | "materias" | "sistemas" | "clientes" | "acoes" | "etiquetas";

export interface DefinicaoDoCampo {
  rotulo: string;
  grupo: GrupoDaCapa;
  /** O VIOS não grava a pasta sem ele. */
  obrigatorio?: boolean;
  /** Lista fechada: edita num seletor. */
  opcoes?: readonly string[];
  /** Sugestões ao editar (pode escrever outro valor). */
  sugestoes?: readonly string[];
  /** Escolhe numa lista do VIOS, com busca. */
  lista?: ListaDoVios;
  /** Aceita valor fora da lista (a nossa cópia só tem quem já tem pasta): a capa marca para conferir. */
  aceitaForaDaLista?: boolean;
  /** Vários valores separados por "; " (etiquetas, matérias). */
  multiplo?: boolean;
  /** Texto longo (várias partes): edita numa caixa maior. */
  longo?: boolean;
}

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO"] as const;
const ESCRITORIO_ATUAL = "BISMARCHI PIRES SOCIEDADE DE ADVOGADOS";

/**
 * Os campos do "Cadastro de Processo (Simplificado)" do VIOS que a abertura preenche, por grupo.
 * Obrigatórios: os 21 que a função de gravar do VIOS confere (VerificaFormProc, lida em 10/11/2026); "0,00" conta como
 * vazio no valor. As listas fechadas são as opções da própria tela, com a grafia do VIOS.
 */
export const CAMPOS_DA_CAPA = {
  cnj: { rotulo: "N.º CNJ", grupo: "processo", obrigatorio: true },
  jurisdicao: { rotulo: "Jurisdição atual", grupo: "processo", obrigatorio: true, opcoes: ["PRIMEIRO GRAU", "SEGUNDO GRAU", "CNJ", "STF", "STJ", "TST"] },
  justica: {
    rotulo: "Justiça",
    grupo: "processo",
    obrigatorio: true,
    opcoes: ["Justiça Estadual", "Justiça Trabalhista", "Justiça Federal", "Superior Tribunal de Justiça", "Supremo Tribunal Federal", "Justiça Eleitoral", "Justiça Militar da União", "Justiça Militar Estadual", "Justiça Desportiva", "Conselho Nacional de Justiça", "Administrativa", "Proveniente de Migração"],
  },
  sistema: { rotulo: "Sistema do tribunal", grupo: "processo", obrigatorio: true, lista: "sistemas" },
  orgao: { rotulo: "Comarca / Tribunal / Órgão adm.", grupo: "processo", obrigatorio: true },
  uf: { rotulo: "UF", grupo: "processo", obrigatorio: true, opcoes: UFS },
  cidade: { rotulo: "Cidade", grupo: "processo", obrigatorio: true },
  vara: { rotulo: "Órgão julgador (vara/câmara)", grupo: "processo" },
  tipoVara: { rotulo: "Tipo de órgão julgador", grupo: "processo" },
  acao: { rotulo: "Ação", grupo: "processo", obrigatorio: true, lista: "acoes", aceitaForaDaLista: true },
  fase: { rotulo: "Fase", grupo: "processo", obrigatorio: true, opcoes: ["Conhecimento", "Recursal", "Execução", "Liquidação", "Suspenso", "Arquivado Definitivamente"] },
  dataAcao: { rotulo: "Data da ação / distribuição", grupo: "processo", obrigatorio: true },
  valor: { rotulo: "Valor da ação (R$)", grupo: "processo", obrigatorio: true },
  situacao: {
    rotulo: "Situação do processo",
    grupo: "processo",
    obrigatorio: true,
    opcoes: ["Ativo", "Suspenso", "Arquivado Provisoriamente", "Arquivado definitivamente", "Encerrado - Ex-Cliente"],
  },
  segredo: { rotulo: "Em segredo de justiça?", grupo: "processo", opcoes: ["Não", "Sim"] },

  cliente: { rotulo: "Cliente", grupo: "partes", obrigatorio: true, lista: "clientes", aceitaForaDaLista: true },
  polo: { rotulo: "Polo do cliente", grupo: "partes", obrigatorio: true, opcoes: ["Ativo", "Passivo", "Terceiro"] },
  tipoParteAtiva: {
    rotulo: "Tipo da parte ativa",
    grupo: "partes",
    opcoes: ["Autor", "Agravante", "Apelante", "Arrematante", "Cliente", "Concedente", "Confrontante", "Consignante", "Contratante", "Deprecante", "Embargante", "Excipiente", "Exequente", "Impetrante", "Impugnante", "Inquerente", "Interpelante", "Inventariante", "Notificante", "Opoente", "Ordenante", "PROMOVENTE", "Reclamante", "Reconvinte", "Recorrente", "Recuperanda", "Requerente", "Suscitante"],
  },
  tipoPartePassiva: {
    rotulo: "Tipo da parte passiva",
    grupo: "partes",
    opcoes: ["Réu", "Agravado", "Apelado", "AVERIGUADA", "Consignatário", "Contrário", "Contratada", "Deprecado", "Devedor", "Embargado", "Excepto", "EXECUTADA", "Executado", "Falida", "Impetrado", "Impugnado", "Inquirido", "Interpelado", "Inventariado", "Notificado", "Opositor", "Opostos", "Ordenado", "PROMOVIDO", "Reclamado", "Reconvido", "Recorrido", "REQUERENTE - Réu", "REQUERIDA", "Requerido", "Suscitado", "Vítima"],
  },
  partesAtivas: { rotulo: "Partes ativas", grupo: "partes", longo: true },
  partesPassivas: { rotulo: "Partes passivas", grupo: "partes", longo: true },
  advogadoContrario: { rotulo: "Advogado da parte contrária", grupo: "partes" },
  oabContrario: { rotulo: "OAB do advogado da parte contrária", grupo: "partes" },

  escritorio: { rotulo: "Escritório atual", grupo: "escritorio", obrigatorio: true, opcoes: [ESCRITORIO_ATUAL] },
  departamento: {
    rotulo: "Departamento",
    grupo: "escritorio",
    obrigatorio: true,
    opcoes: ["Cível", "Insolvência", "Trabalhista", "Recuperação de Crédito", "Comercial", "Contratos", "Distressed Deals", "Financeiro", "Operações Legais", "Tributário"],
  },
  area: {
    rotulo: "Área",
    grupo: "escritorio",
    obrigatorio: true,
    opcoes: ["Cível", "Cível | Insolvência", "Insolvência", "Trabalhista", "Recuperação de Crédito", "Contratos", "Operações Legais", "Special Situations", "Tributário", "Não informada"],
  },
  responsavel: { rotulo: "Advogado responsável", grupo: "escritorio", obrigatorio: true, lista: "usuarios" },
  auxiliar: { rotulo: "Auxiliar", grupo: "escritorio", obrigatorio: true, lista: "usuarios" },
  etiqueta: { rotulo: "Etiquetas", grupo: "escritorio", obrigatorio: true, lista: "etiquetas", multiplo: true, aceitaForaDaLista: true },
  materias: { rotulo: "Matéria", grupo: "escritorio", obrigatorio: true, lista: "materias", multiplo: true },
} as const satisfies Record<string, DefinicaoDoCampo>;

export type ChaveDaCapa = keyof typeof CAMPOS_DA_CAPA;
export const CHAVES_DA_CAPA = Object.keys(CAMPOS_DA_CAPA) as ChaveDaCapa[];
export const GRUPOS_DA_CAPA: { id: GrupoDaCapa; titulo: string }[] = [
  { id: "processo", titulo: "Processo" },
  { id: "partes", titulo: "Partes e cliente" },
  { id: "escritorio", titulo: "Escritório" },
];

export const ehChaveDaCapa = (chave: unknown): chave is ChaveDaCapa => typeof chave === "string" && Object.hasOwn(CAMPOS_DA_CAPA, chave);

/** Um campo editado pela controladoria (fica por cima do que veio das fontes; "desfazer" apaga). */
export interface AjusteDaCapa {
  valor: string | null;
  por: string | null;
  porNome: string | null;
  em: string;
}
export type AjustesDaCapa = Partial<Record<ChaveDaCapa, AjusteDaCapa>>;

/** Cliente como o VIOS grava, com o grupo e quantas pastas ele tem (para achar o do grupo da publicação). */
export interface ClienteDoVios {
  nome: string;
  grupo: string | null;
  pastas: number;
}

export interface ListasDoVios {
  usuarios: string[];
  materias: string[];
  sistemas: string[];
  /** Do "Processos Completo" (SIOE): os clientes, as ações e as etiquetas que as pastas já usam. */
  clientes?: ClienteDoVios[];
  acoes?: string[];
  etiquetas?: string[];
}

/** Os nomes de uma lista do VIOS (vazio quando a lista não veio). */
export function nomesDaLista(listas: Partial<ListasDoVios>, lista: ListaDoVios): string[] {
  if (lista === "clientes") return (listas.clientes ?? []).map((cliente) => cliente.nome);
  return listas[lista] ?? [];
}

/** "Carteira Ex-Cliente | Demanda de risco" (como vem no Processos Completo) → as etiquetas uma a uma. */
export function etiquetasDaPasta(texto: string | null | undefined): string[] {
  return (texto ?? "").split(/\s*[|;]\s*/).map((etiqueta) => etiqueta.trim()).filter(Boolean);
}

/** Uma pasta do "Processos Completo", só o que vira lista. */
export interface PastaParaLista {
  cliente: string | null;
  grupoCliente: string | null;
  acao?: string | null;
  etiquetas: string | null;
}

/**
 * Clientes, ações e etiquetas que as pastas do VIOS usam, com a grafia do VIOS: as ações e as etiquetas mais usadas
 * primeiro; os clientes em ordem alfabética, cada um com o grupo mais frequente das pastas dele.
 */
export function listasDasPastas(pastas: PastaParaLista[]): Required<Pick<ListasDoVios, "clientes" | "acoes" | "etiquetas">> {
  const clientes = new Map<string, { nome: string; grupos: Map<string, number>; pastas: number }>();
  const acoes = new Map<string, { nome: string; vezes: number }>();
  const etiquetas = new Map<string, { nome: string; vezes: number }>();
  const contar = (mapa: Map<string, { nome: string; vezes: number }>, nome: string) => {
    const chave = sem(nome);
    if (!chave) return;
    const atual = mapa.get(chave) ?? { nome, vezes: 0 };
    atual.vezes++;
    mapa.set(chave, atual);
  };
  for (const pasta of pastas) {
    const nome = pasta.cliente?.trim();
    if (nome) {
      const chave = sem(nome);
      const atual = clientes.get(chave) ?? { nome, grupos: new Map<string, number>(), pastas: 0 };
      atual.pastas++;
      const grupo = pasta.grupoCliente?.trim();
      if (grupo) atual.grupos.set(grupo, (atual.grupos.get(grupo) ?? 0) + 1);
      clientes.set(chave, atual);
    }
    if (pasta.acao?.trim()) contar(acoes, pasta.acao.trim());
    for (const etiqueta of etiquetasDaPasta(pasta.etiquetas)) contar(etiquetas, etiqueta);
  }
  const maisUsadas = (mapa: Map<string, { nome: string; vezes: number }>) =>
    [...mapa.values()].sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, "pt-BR")).map((item) => item.nome);
  return {
    clientes: [...clientes.values()]
      .map((cliente) => ({ nome: cliente.nome, grupo: [...cliente.grupos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, pastas: cliente.pastas }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    acoes: maisUsadas(acoes),
    etiquetas: maisUsadas(etiquetas),
  };
}

export interface ParDaPasta {
  responsavel: string | null;
  auxiliar: string | null;
  /** Quantas pastas vivas do grupo, na mesma área, têm esse par. */
  pastas: number;
}

export interface DadosDaCapa {
  numero: string;
  djen: CapaDoDjen | null;
  esaj: CapaDoEsaj | null;
  datajud: CapaDoDataJud | null;
  /** Área (escritório), grupo e cliente da triagem (sugestão ou o que a controladoria escolheu). */
  area: string | null;
  grupo: string | null;
  cliente: string | null;
  par: ParDaPasta | null;
  /** Demanda de risco: a pasta leva também a etiqueta "Demanda de risco". */
  demandaRisco?: boolean;
}

export interface StatusDaFonte {
  ok: boolean;
  ms: number;
  erro: string | null;
}

/** O que a rota da capa devolve: tudo menos o DataJud, que vem por outra rota (leva de 15 s a mais de 1 min). */
export interface CapaParaAbertura {
  dados: DadosDaCapa;
  fontes: { djen: StatusDaFonte; esaj: StatusDaFonte | null };
  ajustes: AjustesDaCapa;
  /** Falso enquanto a coluna das edições não existe no banco (a capa abre, mas não grava edição). */
  podeEditar: boolean;
  listas: ListasDoVios;
  geradaEm: string;
}

const lista = (nomes: string[]) => (nomes.length ? nomes.join("; ") : null);
const reais = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const naLista = (valor: string, opcoes: readonly string[]) => opcoes.find((opcao) => sem(opcao) === sem(valor)) ?? valor;

type Preenchimento = { valor: string | null | undefined; fonte: FonteDaCapa; conferir?: boolean; nota?: string };

/**
 * Os campos da capa, com o valor, a fonte de cada um e o que falta conferir. As edições da controladoria ficam por
 * cima das fontes (fonte "editado"); um obrigatório vazio fica para conferir.
 */
export function montarCapa(dados: DadosDaCapa, extras: { ajustes?: AjustesDaCapa; listas?: Partial<ListasDoVios> } = {}): CampoDaCapa[] {
  const cnj = lerCnj(dados.numero);
  const { djen, esaj, datajud } = dados;
  const listas = { usuarios: [], materias: [], sistemas: [], ...extras.listas };
  const preenchido: Partial<Record<ChaveDaCapa, Preenchimento>> = {};
  const por = (chave: ChaveDaCapa, valor: Preenchimento["valor"], fonte: FonteDaCapa, conferir = false, nota?: string) => {
    preenchido[chave] = { valor, fonte, conferir, nota };
  };
  const segundoGrau = cnj?.grau === "SEGUNDO GRAU";

  por("cnj", dados.numero, "cnj");
  por("jurisdicao", cnj?.grau, "cnj");
  por("justica", cnj?.justica, "cnj");
  const orgaoConferido = cnj?.tribunal === "TJSP";
  por("orgao", orgaoDoVios(cnj) ?? djen?.tribunal, cnj?.tribunal ? "cnj" : "djen", !orgaoConferido, orgaoConferido ? undefined : "nome como no VIOS: conferir");
  por("uf", cnj?.uf, "cnj");

  const orgao = esaj?.orgaoJulgador ?? esaj?.vara ?? djen?.orgao ?? null;
  const fonteOrgao: FonteDaCapa = esaj?.orgaoJulgador || esaj?.vara ? "esaj" : "djen";
  const cidade = segundoGrau && cnj?.uf ? CAPITAL[cnj.uf] ?? null : cidadeDoOrgao(esaj?.foro ?? djen?.orgao) ?? cidadeDoOrgao(orgao);
  por("cidade", cidade, segundoGrau ? "regra" : fonteOrgao, !segundoGrau, segundoGrau ? "2º grau: a capital do estado" : undefined);
  const { vara, tipo } = separarVara(orgao, cidade);
  por("vara", vara, fonteOrgao, true);
  por("tipoVara", tipo, fonteOrgao, true);

  const classe = esaj?.classe ?? djen?.classe ?? datajud?.classe ?? null;
  const acao = acaoDoVios(classe);
  por("acao", acao?.acao, esaj?.classe ? "esaj" : djen?.classe ? "djen" : "datajud", !acao?.conferida, acao && !acao.conferida ? `classe do tribunal: ${classe}` : undefined);
  const fase = faseDoVios(cnj, classe, acao?.acao);
  por("fase", fase.fase, "regra", !fase.certa, fase.certa ? (segundoGrau ? "2º grau" : "pela ação") : "provável: conferir");

  const sistema = sistemaDoTribunal(cnj, datajud?.sistema);
  por(
    "sistema",
    sistema ? naLista(sistema.sistema, listas.sistemas) : null,
    sistema && !sistema.provavel ? "datajud" : "regra",
    sistema?.provavel ?? true,
    sistema?.provavel ? "provável, pelo tribunal e o número" : undefined
  );
  const ajuizamento = esaj?.distribuicao ?? dataDoDataJud(datajud?.ajuizamento);
  if (ajuizamento) por("dataAcao", ajuizamento, esaj?.distribuicao ? "esaj" : "datajud");
  else if (djen?.distribuicao) por("dataAcao", dataDoDataJud(djen.distribuicao), "djen", true, "data da lista de distribuição no DJEN");
  else por("dataAcao", dataDoDataJud(djen?.primeiraComunicacao), "djen", true, "1ª comunicação no DJEN (não é a distribuição)");
  if (esaj?.valor != null) por("valor", reais(esaj.valor), "esaj");
  else por("valor", "0,01", "regra", true, "nenhuma fonte trouxe: a ATUALIZAÇÃO DE CADASTRO corrige");
  por("segredo", "Não", "regra");
  por("situacao", "Ativo", "regra");

  const parte = parteDoCliente(dados.cliente, djen ?? { ativas: [], passivas: [] });
  por("polo", parte ? (parte.polo === "A" ? "Ativo" : "Passivo") : null, "djen", !parte, parte ? `como "${parte.nome}" no DJEN` : "o cliente não aparece entre as partes");
  por("cliente", dados.cliente, "triagem", true, "escolher a pessoa no VIOS (CPF/CNPJ)");
  const tipos = tiposDasPartes(acao?.acao);
  por("tipoParteAtiva", tipos.ativa, "regra", true, "pela ação");
  por("partesAtivas", lista(djen?.ativas ?? []), "djen");
  por("tipoPartePassiva", tipos.passiva, "regra", true, "pela ação");
  por("partesPassivas", lista(djen?.passivas ?? []), "djen");
  const contrarios = (djen?.advogados ?? []).filter((advogado) => !advogado.doEscritorio);
  const [contrario] = contrarios;
  por("advogadoContrario", contrario?.nome, "djen", true, contrarios.length > 1 ? `o 1º de ${contrarios.length} advogados de fora no DJEN` : undefined);
  por("oabContrario", contrario ? `${contrario.oab}/${contrario.uf}` : null, "djen", true);

  por("escritorio", ESCRITORIO_ATUAL, "regra");
  por("departamento", departamentoDaArea(dados.area), "triagem");
  por("area", dados.area, "triagem");
  por("responsavel", dados.par?.responsavel, "pastas", true, dados.par ? `par de ${dados.par.pastas} pasta(s) viva(s) do grupo na área` : "sem pasta viva do grupo na área");
  por("auxiliar", dados.par?.auxiliar, "pastas", true);
  const etiquetas = [dados.grupo ? `Carteira ${dados.grupo.replace(/^grupo\s+/i, "")}` : null, dados.demandaRisco ? "Demanda de risco" : null].filter(Boolean) as string[];
  por("etiqueta", etiquetas.join("; "), "regra", true, "Carteira + grupo (confirmar o nome no VIOS)" + (dados.demandaRisco ? "; demanda de risco" : ""));
  const assuntos = [esaj?.assunto, ...(datajud?.assuntos ?? [])].filter((assunto): assunto is string => Boolean(assunto));
  const materia = materiaDoVios(assuntos, listas.materias);
  por(
    "materias",
    materia ?? (listas.materias.length ? null : assuntos[0]),
    esaj?.assunto ? "esaj" : "datajud",
    true,
    materia ? `pelo assunto: ${assuntos[0]}` : assuntos.length ? `assunto sem matéria igual no VIOS: ${assuntos[0]}` : undefined
  );

  return CHAVES_DA_CAPA.map((chave) => {
    const definicao: DefinicaoDoCampo = CAMPOS_DA_CAPA[chave];
    const fonte = preenchido[chave] ?? { valor: null, fonte: "falta" as const };
    const valor = fonte.valor?.trim() ? fonte.valor.trim() : null;
    const dasFontes = conferirNaLista(definicao, valor, listas);
    const base: CampoDaCapa = {
      chave,
      campo: definicao.rotulo,
      grupo: definicao.grupo,
      obrigatorio: Boolean(definicao.obrigatorio),
      valor: dasFontes.valor,
      fonte: valor ? fonte.fonte : "falta",
      conferir: Boolean(fonte.conferir) || (!valor && Boolean(definicao.obrigatorio)) || dasFontes.fora.length > 0,
      ...(fonte.nota ? { nota: fonte.nota } : {}),
      ...(dasFontes.fora.length ? { foraDaLista: dasFontes.fora } : {}),
    };
    const ajuste = extras.ajustes?.[chave];
    if (!ajuste) return base;
    const editado = conferirNaLista(definicao, ajuste.valor?.trim() ? ajuste.valor.trim() : null, listas);
    // A marca de fora da lista é do valor editado, não do que as fontes tinham.
    const semMarca: CampoDaCapa = { ...base };
    delete semMarca.foraDaLista;
    return {
      ...semMarca,
      valor: editado.valor,
      fonte: "editado",
      conferir: (!editado.valor && base.obrigatorio) || editado.fora.length > 0,
      nota: undefined,
      original: { valor: base.valor, fonte: base.fonte },
      editado: { por: ajuste.porNome, em: ajuste.em },
      ...(editado.fora.length ? { foraDaLista: editado.fora } : {}),
    };
  });
}

/**
 * O valor com a grafia da lista do VIOS do campo (o robô procura pelo nome exato) e o que ficou fora dela. Sem a
 * lista (não carregou), o valor fica como veio e nada é marcado.
 */
function conferirNaLista(definicao: DefinicaoDoCampo, valor: string | null, listas: Partial<ListasDoVios>): { valor: string | null; fora: string[] } {
  if (!definicao.lista || !valor) return { valor, fora: [] };
  const nomes = nomesDaLista(listas, definicao.lista);
  if (!nomes.length) return { valor, fora: [] };
  const porChave = new Map(nomes.map((nome) => [sem(nome), nome]));
  const itens = definicao.multiplo ? emLista(valor) : [valor];
  const fora = itens.filter((item) => !porChave.has(sem(item)));
  const naGrafia = itens.map((item) => porChave.get(sem(item)) ?? item);
  return { valor: definicao.multiplo ? naGrafia.join("; ") : naGrafia[0], fora };
}

/** O que impede ou pede atenção antes de abrir: obrigatórios vazios, campos para conferir e editados. */
export function resumoDaCapa(campos: CampoDaCapa[]) {
  return {
    faltando: campos.filter((campo) => campo.obrigatorio && !campo.valor),
    conferir: campos.filter((campo) => campo.conferir && !(campo.obrigatorio && !campo.valor)),
    editados: campos.filter((campo) => campo.fonte === "editado"),
  };
}

/**
 * A capa no formato da fila do robô (vios_agendamentos.abertura.capa): texto por campo; etiquetas e matérias em lista.
 * `clienteCpfCnpj` (do SIOE, na hora do pedido): com duas pessoas do mesmo nome no VIOS, o robô escolhe por ele.
 */
export type CapaDoVios = Record<Exclude<ChaveDaCapa, "etiqueta" | "materias">, string | null> & {
  etiquetas: string[];
  materias: string[];
  clienteCpfCnpj?: string | null;
};

const emLista = (valor: string | null) => (valor ?? "").split(";").map((item) => item.trim()).filter(Boolean);

export function capaParaOVios(campos: CampoDaCapa[]): CapaDoVios {
  const valor = (chave: ChaveDaCapa) => campos.find((campo) => campo.chave === chave)?.valor ?? null;
  const texto = Object.fromEntries(
    CHAVES_DA_CAPA.filter((chave) => chave !== "etiqueta" && chave !== "materias").map((chave) => [chave, valor(chave)])
  ) as Omit<CapaDoVios, "etiquetas" | "materias">;
  return { ...texto, etiquetas: emLista(valor("etiqueta")), materias: emLista(valor("materias")) };
}

/** O que impede mandar a capa ao robô: obrigatórios vazios e formatos que o VIOS não aceita. */
export function problemasParaOVios(capa: CapaDoVios): string[] {
  const problemas: string[] = [];
  if (capa.valor && !/^\d{1,3}(\.\d{3})*,\d{2}$/.test(capa.valor)) problemas.push("Valor da ação: escreva como 1.234,56");
  if (capa.dataAcao && !/^\d{2}\/\d{2}\/\d{4}$/.test(capa.dataAcao)) problemas.push("Data da ação: escreva como DD/MM/AAAA");
  if (capa.cnj && !/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(capa.cnj)) problemas.push("N.º CNJ fora do formato");
  return problemas;
}

/**
 * O CPF/CNPJ do cliente entre as pessoas do VIOS com o nome dele: a única, ou, com homônimos (matriz e filial da AXPR,
 * 18/11/2026), a que tem mais pastas. Empate ou nenhuma pasta: null (o robô não chuta; diz quais achou).
 */
export function documentoDoClienteEntre(
  pessoas: { id: string; cpf_cnpj: string | null }[],
  pastasPorPessoa: ReadonlyMap<string, number>
): string | null {
  const comDocumento = pessoas.filter((pessoa) => pessoa.cpf_cnpj?.replace(/\D/g, ""));
  if (comDocumento.length <= 1) return comDocumento[0]?.cpf_cnpj?.trim() ?? null;
  const [primeira, segunda] = comDocumento
    .map((pessoa) => ({ pessoa, pastas: pastasPorPessoa.get(pessoa.id) ?? 0 }))
    .sort((a, b) => b.pastas - a.pastas);
  return primeira.pastas > 0 && primeira.pastas > segunda.pastas ? primeira.pessoa.cpf_cnpj!.trim() : null;
}

/** Um pedido de abertura ao robô (linha operacao abrir_pasta da fila do SAMA). */
/** A tarefa que a pasta aberta pelo robô já leva (pedido de 17/11/2026). */
export const TAREFA_DA_PASTA_NOVA = "ATUALIZAÇÃO DE CADASTRO";
/** Etiqueta PROVIDÊNCIA do VIOS: a do tipo 539, usada se a cópia do SAMA não trouxer o tipo. */
const ETIQUETA_PROVIDENCIA = 204;

/** Tipo de tarefa do VIOS como a cópia do SAMA guarda (vios_tipos_tarefa). */
export interface TipoDaTarefaNova {
  id: number;
  etiquetas: number[];
  /** Os fixos do cadastro do tipo: a reserva, se o robô não conseguir ler a regra no VIOS. */
  responsaveis: string[];
}

/** O que vai ao robô em `abertura.tarefas`: ele cria cada uma na pasta nova, logo depois de abri-la. */
export interface TarefaDaAbertura {
  tarefa: string;
  tarefa_id: string | null;
  etiqueta_id: string;
  /** DD/MM/AAAA. */
  data: string;
  responsaveis_do_tipo: string[];
  observacao: string;
}

/** O que o robô devolve de cada tarefa da pasta nova. */
export interface TarefaCriadaNaAbertura {
  tarefa: string;
  ci_vios: string | null;
  data: string;
  responsaveis?: string[];
  erro?: string;
}

/**
 * A pasta nova já leva a ATUALIZAÇÃO DE CADASTRO, para o dia útil seguinte a hoje, com os responsáveis da regra do tipo
 * no VIOS (o robô lê a regra na hora; os fixos do cadastro vão como reserva). Sem o tipo na cópia do SAMA, o robô
 * escolhe pelo nome.
 */
export function tarefasDaAbertura(tipo: TipoDaTarefaNova | null, hoje: string, ehDiaUtil: (iso: string) => boolean): TarefaDaAbertura[] {
  return [
    {
      tarefa: TAREFA_DA_PASTA_NOVA,
      tarefa_id: tipo ? String(tipo.id) : null,
      etiqueta_id: String(tipo?.etiquetas[0] ?? ETIQUETA_PROVIDENCIA),
      data: paraDataVios(somarDiasUteis(hoje, 1, ehDiaUtil)),
      responsaveis_do_tipo: tipo?.responsaveis ?? [],
      observacao: "Pasta aberta pelo robô do Orquestra a partir de uma publicação sem pasta. Conferir e completar o cadastro: partes, valor da causa e monitoramento.",
    },
  ];
}

export interface PedidoDeAbertura {
  id: string;
  status: "pendente" | "enviado" | "processando" | "concluido" | "erro";
  erro: string | null;
  simulado: boolean;
  autor: string | null;
  criadoEm: string;
  atualizadoEm: string | null;
  resultado: {
    preenchidos?: Record<string, string>;
    nao_encontrados?: { campo: string; pedido: string; motivo?: string; parecidas?: string[] }[];
    recusaria?: string[];
    avisos?: string[];
    ci?: string | null;
    /** De verdade (Fase 3): o CI da pasta que o robô abriu no VIOS. */
    ci_pasta?: string | null;
    /** As tarefas que o robô criou na pasta nova (a ATUALIZAÇÃO DE CADASTRO), ou o erro de cada uma. */
    tarefas?: TarefaCriadaNaAbertura[];
  } | null;
  /** A capa que foi ao robô neste pedido (para saber se a simulação vale para a capa de agora). */
  capa: CapaDoVios | null;
}

const NA_FILA_DO_ROBO = new Set<PedidoDeAbertura["status"]>(["pendente", "enviado", "processando"]);

/** O CI da pasta aberta de verdade, se o pedido for de verdade e tiver terminado. */
export function ciDaPastaAberta(pedido: PedidoDeAbertura | undefined): string | null {
  if (!pedido || pedido.simulado || pedido.status !== "concluido") return null;
  return pedido.resultado?.ci_pasta?.replace(/\D/g, "") || null;
}

/**
 * O CI da pasta que já existia: o robô confere no VIOS, antes de gravar, se o número já tem pasta e recusa com "O
 * processo … já tem pasta no VIOS (CI 61597): nada foi gravado." (18/11/2026: a 2ª publicação do 2272666-73 pediu a
 * abertura logo depois da 1ª, ficou sem a CI e foi à Central como abertura). Uma pasta só: é a do processo. Mais de
 * uma, a pessoa escolhe.
 */
export function ciDaPastaQueJaExistia(pedido: PedidoDeAbertura | undefined): string | null {
  if (!pedido || pedido.simulado || pedido.status !== "erro") return null;
  const achado = (pedido.erro ?? "").match(/j[aá] tem pasta no VIOS \(CI (\d+)\)/i);
  return achado ? achado[1] : null;
}

export type SituacaoDaAberturaReal = { pode: true } | { pode: false; motivo: string; conferirNoVios?: true };

/**
 * Fase 3: quando a controladoria pode pedir a abertura de verdade. Sem simulação antes (pedido do usuário,
 * 16/11/2026: conferiu e editou a capa, "Abrir a pasta no VIOS" vai direto); o próprio robô confere que o número não
 * tem pasta e só grava se o VIOS aceitar a capa inteira. Não deixa com pedido na fila nem com a pasta já aberta. Se o
 * último pedido parou depois do Gravar (ATENÇÃO), só pede de novo quem conferiu no VIOS que a pasta não foi criada
 * (`conferidoNoVios`). Os pedidos vêm do mais novo para o mais antigo.
 */
export function situacaoDaAberturaReal(pedidos: PedidoDeAbertura[], { conferidoNoVios = false }: { conferidoNoVios?: boolean } = {}): SituacaoDaAberturaReal {
  if (pedidos.some((pedido) => NA_FILA_DO_ROBO.has(pedido.status))) return { pode: false, motivo: "Já há um pedido desta publicação na fila do robô." };
  const real = pedidos.find((pedido) => !pedido.simulado);
  const ci = ciDaPastaAberta(real);
  if (ci) return { pode: false, motivo: `A pasta já foi aberta no VIOS: CI ${ci}.` };
  const existente = ciDaPastaQueJaExistia(real);
  if (existente) return { pode: false, motivo: `O processo já tem pasta no VIOS: CI ${existente}.` };
  if (real?.status === "erro" && /^ATEN[ÇC][ÃA]O/i.test(real.erro ?? "") && !conferidoNoVios) {
    return {
      pode: false,
      conferirNoVios: true,
      motivo: "O último pedido parou depois do Gravar: confira no VIOS se a pasta foi criada. Se não foi, peça de novo.",
    };
  }
  return { pode: true };
}

/** "161.341,87" → 161341.87 (null se não for número). */
function valorDaCapa(texto: string | null): number | null {
  const numero = Number((texto ?? "").replace(/\./g, "").replace(",", "."));
  return texto && Number.isFinite(numero) ? numero : null;
}

/**
 * A pasta que o robô acabou de abrir, no formato da triagem: o SIOE só copia o VIOS de madrugada, então até lá a
 * pasta nova não está lá. Montada da capa que foi ao VIOS; o grupo vem das pastas do cliente.
 */
export function pastaDaCapaAberta(ci: string, capa: CapaDoVios, grupo: string | null): PastaSioe {
  return {
    ci,
    cnj: capa.cnj ?? "",
    vinculo: null,
    cliente: capa.cliente,
    grupoCliente: grupo,
    area: capa.area,
    advogadoResponsavel: capa.responsavel,
    situacao: capa.situacao ?? "Ativo",
    etiquetas: capa.etiquetas.length ? capa.etiquetas.join(" | ") : null,
    acao: capa.acao,
    fase: capa.fase,
    valorAcao: valorDaCapa(capa.valor),
  };
}

/** Rótulo do campo que o robô devolveu (ele chama as etiquetas de "etiquetas"). */
export function rotuloDoCampoDoRobo(campo: string): string {
  const chave = campo === "etiquetas" ? "etiqueta" : campo;
  return ehChaveDaCapa(chave) ? CAMPOS_DA_CAPA[chave].rotulo : campo;
}

export const ROTULO_DA_FONTE: Record<FonteDaCapa, string> = {
  cnj: "Número CNJ",
  djen: "DJEN",
  esaj: "e-SAJ",
  datajud: "DataJud",
  triagem: "Triagem",
  pastas: "Pastas do grupo",
  regra: "Regra",
  editado: "Editado",
  falta: "Sem fonte",
};
