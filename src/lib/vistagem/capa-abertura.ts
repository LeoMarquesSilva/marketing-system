import { chaveNome } from "./agendamento";
import { advogadosDoEscritorioCitados, ESCRITORIO_CIVEL_INSOLVENCIA, ESCRITORIO_INSOLVENCIA } from "./triagem";

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
 */

export type FonteDaCapa = "cnj" | "djen" | "esaj" | "datajud" | "triagem" | "pastas" | "regra" | "falta";

export interface CampoDaCapa {
  campo: string;
  valor: string | null;
  fonte: FonteDaCapa;
  /** Precisa de conferência antes de abrir (palpite, regra provável ou campo vazio). */
  conferir: boolean;
  nota?: string;
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
  "5": "Justiça do Trabalho",
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

/** "2ª Câmara Reservada de Direito Empresarial" → { vara: "2ª", tipo: "Câmara Reservada de Direito Empresarial" }. */
export function separarVara(orgao: string | null | undefined): { vara: string | null; tipo: string | null } {
  const texto = orgao?.trim();
  if (!texto) return { vara: null, tipo: null };
  const achado = texto.match(/^(\d{1,3})\s*[ªºa°]\s+(.+)$/i);
  return achado ? { vara: `${achado[1]}ª`, tipo: achado[2].trim() } : { vara: null, tipo: texto };
}

/** Cidade pelo nome do órgão ("… da Comarca de Campinas", "Vara do Trabalho de Carapicuíba", "EXE3 - Jundiaí"). */
export function cidadeDoOrgao(orgao: string | null | undefined): string | null {
  const texto = orgao?.trim() ?? "";
  const achado =
    texto.match(/(?:Comarca|Foro(?: Regional| Distrital)?|Vara do Trabalho|Vara Federal|Varas?)\s+(?:de|do|da)\s+([A-ZÀ-Ý][\p{L}' ]+?)\s*$/u) ??
    texto.match(/\s-\s([A-ZÀ-Ý][\p{L}' ]+)$/u);
  return achado ? achado[1].trim() : null;
}

const SISTEMA_DO_DATAJUD: [RegExp, string][] = [
  [/^PJE/, "PJe"],
  [/SAJ/, "E-saj"],
  [/EPROC/, "E-PROC"],
  [/PROJUDI/, "Projudi"],
];

/** Sistema do tribunal: o do DataJud quando veio; senão, o provável pelo tribunal e pelo número. */
export function sistemaDoTribunal(cnj: Cnj | null, doDataJud: string | null | undefined): { sistema: string; provavel: boolean } | null {
  const chave = sem(doDataJud).replace(/\s/g, "");
  const doCnj = SISTEMA_DO_DATAJUD.find(([regex]) => regex.test(chave));
  if (doCnj) return { sistema: doCnj[1], provavel: false };
  if (!cnj) return null;
  if (cnj.tribunal?.startsWith("TRT") || cnj.tribunal === "TJMG") return { sistema: "PJe", provavel: true };
  if (cnj.tribunal === "TJSC" || cnj.tribunal === "TJRS" || cnj.tribunal === "TRF4") return { sistema: "E-PROC", provavel: true };
  // No TJSP, os processos novos do eproc vêm com o número começando em 4; os do e-SAJ, não.
  if (cnj.tribunal === "TJSP") return { sistema: cnj.digitos.startsWith("4") && cnj.ano >= 2025 ? "E-PROC" : "E-saj", provavel: true };
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
  geradaEm: string;
}

const lista = (nomes: string[], limite = 3) => (nomes.length ? `${nomes.slice(0, limite).join("; ")}${nomes.length > limite ? ` e mais ${nomes.length - limite}` : ""}` : null);
const reais = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Os campos da tela de cadastro do VIOS, na ordem dela, com o valor e a fonte de cada um. */
export function montarCapa(dados: DadosDaCapa): CampoDaCapa[] {
  const cnj = lerCnj(dados.numero);
  const { djen, esaj, datajud } = dados;
  const campos: CampoDaCapa[] = [];
  const add = (campo: string, valor: string | null | undefined, fonte: FonteDaCapa, conferir = false, nota?: string) =>
    campos.push({ campo, valor: valor?.trim() ? valor.trim() : null, fonte: valor?.trim() ? fonte : "falta", conferir: conferir || !valor?.trim(), ...(nota ? { nota } : {}) });

  add("N.º CNJ", dados.numero, "cnj");
  add("Jurisdição", cnj?.grau, "cnj");
  add("Justiça", cnj?.justica, "cnj");
  add("Órgão (tribunal)", cnj?.tribunal ?? djen?.tribunal, cnj?.tribunal ? "cnj" : "djen");
  add("UF", cnj?.uf, "cnj");

  const orgao = esaj?.orgaoJulgador ?? esaj?.vara ?? djen?.orgao ?? null;
  const fonteOrgao: FonteDaCapa = esaj?.orgaoJulgador || esaj?.vara ? "esaj" : "djen";
  const cidade = cnj?.grau === "SEGUNDO GRAU" && cnj.uf ? CAPITAL[cnj.uf] ?? null : cidadeDoOrgao(esaj?.foro ?? djen?.orgao) ?? cidadeDoOrgao(orgao);
  add("Cidade", cidade, cnj?.grau === "SEGUNDO GRAU" ? "regra" : fonteOrgao, true, cnj?.grau === "SEGUNDO GRAU" ? "2º grau: a capital do estado" : undefined);
  const { vara, tipo } = separarVara(orgao);
  add("Vara", vara, fonteOrgao, true);
  add("Tipo de vara / órgão julgador", tipo, fonteOrgao, true);

  const classe = esaj?.classe ?? djen?.classe ?? datajud?.classe ?? null;
  const acao = acaoDoVios(classe);
  add("Ação", acao?.acao, esaj?.classe ? "esaj" : djen?.classe ? "djen" : "datajud", !acao?.conferida, acao && !acao.conferida ? `classe do tribunal: ${classe}` : undefined);
  add("Fase", cnj?.grau === "SEGUNDO GRAU" ? "Recursal" : null, "regra", cnj?.grau !== "SEGUNDO GRAU", cnj?.grau === "SEGUNDO GRAU" ? "2º grau" : "escolher na lista do VIOS");

  const sistema = sistemaDoTribunal(cnj, datajud?.sistema);
  add("Sistema do tribunal", sistema?.sistema, sistema && !sistema.provavel ? "datajud" : "regra", sistema?.provavel ?? true, sistema?.provavel ? "provável, pelo tribunal e o número" : undefined);
  const ajuizamento = esaj?.distribuicao ?? dataDoDataJud(datajud?.ajuizamento);
  add("Data da ação", ajuizamento, esaj?.distribuicao ? "esaj" : "datajud");

  if (esaj?.valor != null) add("Valor da ação (R$)", reais(esaj.valor), "esaj");
  else campos.push({ campo: "Valor da ação (R$)", valor: "0,01", fonte: "regra", conferir: true, nota: "nenhuma fonte trouxe: a ATUALIZAÇÃO DE CADASTRO corrige" });

  add("Partes ativas", lista(djen?.ativas ?? []), "djen");
  add("Partes passivas", lista(djen?.passivas ?? []), "djen");
  const parte = parteDoCliente(dados.cliente, djen ?? { ativas: [], passivas: [] });
  add("Polo do cliente", parte ? (parte.polo === "A" ? "Ativo" : "Passivo") : null, "djen", !parte, parte ? `como "${parte.nome}" no DJEN` : "o cliente não aparece entre as partes");
  add("Cliente", dados.cliente, "triagem", true, "escolher a pessoa no VIOS (CPF/CNPJ)");
  const contrarios = (djen?.advogados ?? []).filter((advogado) => !advogado.doEscritorio).map((advogado) => `${advogado.nome} (OAB ${advogado.oab}/${advogado.uf})`);
  add("Advogado da parte contrária", lista(contrarios, 2), "djen", true);

  add("Departamento", departamentoDaArea(dados.area), "triagem");
  add("Área", dados.area, "triagem");
  add("Advogado responsável", dados.par?.responsavel, "pastas", true, dados.par ? `par de ${dados.par.pastas} pasta(s) viva(s) do grupo na área` : "sem pasta viva do grupo na área");
  add("Auxiliar", dados.par?.auxiliar, "pastas", true);
  add("Etiqueta", dados.grupo ? `Carteira ${dados.grupo.replace(/^grupo\s+/i, "")}` : null, "regra", true, "confirmar o nome da etiqueta no VIOS");
  const assuntos = esaj?.assunto ? [esaj.assunto] : datajud?.assuntos ?? [];
  add("Matérias", lista(assuntos), esaj?.assunto ? "esaj" : "datajud", true);
  campos.push({ campo: "Situação", valor: "Ativo", fonte: "regra", conferir: false });
  return campos;
}

export const ROTULO_DA_FONTE: Record<FonteDaCapa, string> = {
  cnj: "Número CNJ",
  djen: "DJEN",
  esaj: "e-SAJ",
  datajud: "DataJud",
  triagem: "Triagem",
  pastas: "Pastas do grupo",
  regra: "Regra",
  falta: "Falta",
};
