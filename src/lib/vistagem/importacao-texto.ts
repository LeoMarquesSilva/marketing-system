import { mascararCnj } from "./processo";
import type { KurierLinha } from "./types";

/**
 * Publicações coladas (corpo de e-mail ou mensagem do Teams) para as poucas demandas que não vêm na
 * Kurier. Cada publicação vira uma linha no formato da Kurier, com o teor no cabeçalho do DJEN
 * (PROCESSO: … TEXTO: … PARTES … ADVOGADOS …), e segue a mesma esteira: duplicidade, triagem com o
 * SIOE, Controladoria e Jurídico.
 *
 * Formatos lidos:
 * - "recorte": Recorte Digital da OAB/SP (e-mail), um bloco por "Data de Disponibilização:", com
 *   Caderno (ex.: TRT2DJEN), Vara e "Publicação:" (PROCESSO: … || texto ||| POLO …, ADVOGADO …).
 * - "djen": comunicação do DJEN repassada por texto (ex.: Teams), com cabeçalho "Divulgado em: … -
 *   Publicado em: …" e "Diário: STJDJN", e um bloco "Publicação / Processo: … / Conteúdo: …" por comunicação.
 */

export type FormatoColado = "recorte" | "djen";

export interface PublicacaoColada {
  formato: FormatoColado;
  /** Pronta para a esteira da Kurier (montarPublicacoes). */
  linha: KurierLinha;
  processo: string;
  tribunal: string;
  orgao: string | null;
  tipoComunicacao: string | null;
  idComunicacao: number | null;
  intimados: string[];
  /** Começo do texto, para conferir antes de importar. */
  resumo: string;
}

export interface TrechoIgnorado {
  trecho: string;
  motivo: string;
}

export interface LeituraColada {
  publicacoes: PublicacaoColada[];
  ignorados: TrechoIgnorado[];
}

export const MAX_PUBLICACOES_COLADAS = 200;
export const MAX_TEXTO_COLADO = 1_000_000;

const CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

/** TJ de cada código de tribunal estadual no CNJ (J = 8). */
const UF_DO_TJ = [
  "", "AC", "AL", "AP", "AM", "BA", "CE", "DFT", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SE", "SP", "TO",
];

/** Tribunal pelo próprio número (J.TR), quando o texto não diz o diário. */
export function tribunalDoCnj(digitos: string): string | null {
  const justica = digitos[13];
  const regiao = Number(digitos.slice(14, 16));
  if (justica === "5") return regiao === 0 ? "TST" : regiao <= 24 ? `TRT${regiao}` : null;
  if (justica === "4") return regiao >= 1 && regiao <= 6 ? `TRF${regiao}` : null;
  if (justica === "8") return UF_DO_TJ[regiao] ? `TJ${UF_DO_TJ[regiao]}` : null;
  return null;
}

/** Texto como sai do Outlook/Teams: quebras do Windows, espaços não separáveis e caracteres invisíveis. */
function limpar(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[   \t]/g, " ")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/ +/g, " ");
}

function plano(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Começo do trecho que não deu para ler, para a pessoa achar no texto. */
function trechoDe(texto: string): string {
  const linha = plano(texto);
  return linha.length > 160 ? `${linha.slice(0, 160)}…` : linha;
}

function dataIso(texto: string | null | undefined): string | null {
  const achado = (texto ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!achado) return null;
  const [, dia, mes, ano] = achado;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (data.getUTCDate() !== Number(dia) || data.getUTCMonth() !== Number(mes) - 1) return null;
  return `${ano}-${mes}-${dia}`;
}

function cnjDe(texto: string): string | null {
  const achado = texto.match(CNJ);
  if (!achado) return null;
  const digitos = achado[0].replace(/\D/g, "");
  return digitos.length === 20 ? mascararCnj(digitos) : null;
}

/**
 * Valores por rótulo, na ordem em que aparecem: "Processo: X Órgão: Y" → [["processo","X"],["orgao","Y"]].
 * `rotulos` mapeia a chave para a expressão do rótulo (sem os dois-pontos).
 */
function camposPorRotulo(texto: string, rotulos: Record<string, string>, opcoes: { colados?: boolean } = {}): [string, string][] {
  const chaves = Object.keys(rotulos);
  // `colados`: o rótulo pode vir grudado no valor anterior ("SAO PAULOVara:", "04/11/2026Data de Publicação:").
  const antes = opcoes.colados ? "" : "(?:^|\\s|\\|)";
  const regex = new RegExp(`${antes}(${chaves.map((chave) => `(${rotulos[chave]})`).join("|")})\\s*:`, "gi");
  const marcas: { chave: string; inicio: number; fim: number }[] = [];
  for (const achado of texto.matchAll(regex)) {
    const indice = achado.slice(2).findIndex((grupo) => grupo !== undefined);
    const inicio = (achado.index ?? 0) + achado[0].indexOf(achado[1]);
    marcas.push({ chave: chaves[indice], inicio, fim: (achado.index ?? 0) + achado[0].length });
  }
  return marcas.map((marca, posicao) => [
    marca.chave,
    plano(texto.slice(marca.fim, marcas[posicao + 1]?.inicio ?? texto.length)),
  ]);
}

function primeiroCampo(campos: [string, string][], chave: string): string | null {
  return campos.find(([nome]) => nome === chave)?.[1] || null;
}

function polo(texto: string): string {
  const valor = texto.trim().toUpperCase();
  if (valor.startsWith("ATIVO")) return "A";
  if (valor.startsWith("PASSIVO")) return "P";
  return valor.split(/\s+/)[0] || "T";
}

interface Comunicacao {
  formato: FormatoColado;
  cnj: string;
  tribunal: string;
  orgao: string | null;
  dataDisponibilizacao: string;
  dataPublicacao: string;
  tipoComunicacao: string | null;
  classe: string | null;
  corpo: string;
  link: { rotulo: string; url: string } | null;
  intimados: string[];
  partes: { nome: string; polo: string }[];
  advogados: { nome: string; oab: string; uf: string }[];
  idComunicacao: number | null;
  caderno: string;
  comarca: string;
  nomeLocalizado: string;
}

/** Teor no formato do DJEN que a Kurier entrega (o resto da esteira lê órgão, partes, advogados e intimados dele). */
export function teorNoFormatoDjen(c: Comunicacao): string {
  const id = c.idComunicacao ? ` ID COMUNICAÇÃO:${c.idComunicacao}` : "";
  const corpo = [c.corpo, c.link ? `${c.link.rotulo}: ${c.link.url}` : ""].filter(Boolean).join(" ");
  const intimados = c.intimados.length ? ` Intimado(s) / Citado(s) - ${c.intimados.join(" - ")}` : "";
  const partes = c.partes.length ? ` PARTES ${c.partes.map((parte) => `NOME:${parte.nome} POLO:${parte.polo}${id}`).join(" ")}` : "";
  const advogados = c.advogados.length
    ? ` ADVOGADOS ${c.advogados.map((advogado) => `NOME:${advogado.nome} Nº OAB:${advogado.oab} UF:${advogado.uf}`).join(" ")}`
    : "";
  return [
    `PROCESSO:${c.cnj}`,
    `ORGÃO:${c.orgao ?? "não informado"}`,
    `DATA DE DISPONIBILIZAÇÃO:${c.dataDisponibilizacao}`,
    `TIPO DE COMUNICAÇÃO:${c.tipoComunicacao ?? "Intimação"}`,
    "MEIO:Diário de Justiça Eletrônico Nacional",
    `TRIBUNAL:${c.tribunal}${c.classe ? ` ${c.classe}` : ""}`,
    `TEXTO:${corpo}${intimados}${partes}${advogados}`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Recorte Digital da OAB/SP
// ---------------------------------------------------------------------------

const ROTULOS_RECORTE = {
  disponibilizacao: "Data de Disponibiliza[çc][ãa]o",
  publicacao_data: "Data de Publica[çc][ãa]o",
  jornal: "Jornal",
  pagina: "P[áa]gina",
  caderno: "Caderno",
  local: "Local",
  vara: "Vara",
};

const ROTULOS_RECORTE_FIM = {
  ativo: "POLO ATIVO",
  passivo: "POLO PASSIVO",
  terceiro: "TERCEIRO INTERESSADO",
  advogado: "ADVOGADO",
  acesso: "Acesso ao documento",
  identificador: "Identificador do documento",
};

/** Linha do cabeçalho do recorte ("Caderno: TRT1DJEN", "Página: 00001"…). */
const LINHA_CABECALHO_RECORTE = new RegExp(`^\\s*(?:${Object.values(ROTULOS_RECORTE).join("|")})\\s*:`, "i");

/**
 * Onde começa o texto da publicação no bloco. Na vara ele vem depois do rótulo "Publicação:"
 * ("Publicação: Intimação / Notificação / PROCESSO: …"); nos acórdãos de turma o recorte não traz o
 * rótulo e o texto começa na primeira linha depois do cabeçalho ("Página: 00001 / Intimação / Acórdão /
 * PROCESSO: …"). Sem quebras de linha (texto grudado), começa no "PROCESSO:".
 */
function inicioDoConteudoRecorte(bloco: string): number {
  const processo = bloco.search(/PROCESSO\s*:/i);
  // O rótulo só vale antes do "PROCESSO:": depois dele, "publicação:" é texto da decisão.
  const rotulo = (processo >= 0 ? bloco.slice(0, processo) : bloco).search(/(?<!\bde\s{1,3})Publica[çc][ãa]o\s*:/i);
  if (rotulo >= 0) return rotulo;
  let posicao = 0;
  for (const linha of bloco.split("\n")) {
    if (linha.trim() && !LINHA_CABECALHO_RECORTE.test(linha)) return posicao;
    posicao += linha.length + 1;
  }
  return processo;
}

/** "DJEN - Diário de Justiça Eletrônico Nacional - TRT1 - 1ª Turma" → "1ª Turma" (quando o recorte não traz "Vara:"). */
function orgaoDoLocal(local: string, tribunal: string): string | null {
  const resto = local
    .split(/\s+-\s+/)
    .map((parte) => parte.trim())
    .filter((parte) => parte && !/^DJE?N$/i.test(parte) && !/^Di[áa]rio d[ae] Justi[çc]a/i.test(parte))
    .map((parte) => (tribunal && new RegExp(`^${tribunal}\\b`, "i").test(parte) ? parte.slice(tribunal.length).trim() : parte))
    .filter(Boolean);
  return resto.join(" - ") || local || null;
}

function lerBlocoRecorte(bloco: string): Comunicacao | string {
  // O conteúdo vai até o fim do bloco: os rótulos de cima não se repetem dentro dele.
  const inicioConteudo = inicioDoConteudoRecorte(bloco);
  const cabecalho = inicioConteudo >= 0 ? bloco.slice(0, inicioConteudo) : bloco;
  const campos = camposPorRotulo(cabecalho, ROTULOS_RECORTE, { colados: true });
  const conteudo = inicioConteudo >= 0 ? plano(bloco.slice(inicioConteudo).replace(/^\s*Publica[çc][ãa]o\s*:/i, "")) : "";

  const dataDisponibilizacao = dataIso(primeiroCampo(campos, "disponibilizacao"));
  const dataPublicacao = dataIso(primeiroCampo(campos, "publicacao_data"));
  const cnj = cnjDe(conteudo.match(/PROCESSO\s*:\s*([^|]*)/i)?.[1] ?? "") ?? cnjDe(conteudo) ?? cnjDe(bloco);
  if (!cnj) return "sem número de processo";
  if (!dataDisponibilizacao) return "sem a data de disponibilização";
  if (!dataPublicacao) return "sem a data de publicação";
  if (!conteudo) return "sem o texto da publicação";

  const caderno = primeiroCampo(campos, "caderno") ?? "";
  const local = primeiroCampo(campos, "local") ?? "";
  const tribunal =
    caderno.replace(/\s+/g, "").toUpperCase().match(/^([A-Z]+\d*?)DJE?N$/)?.[1] ??
    local.toUpperCase().match(/\b(TRT\s*\d{1,2}|TST|STJ|STF|TRF\s*\d|TJ[A-Z]{2,3})\b/)?.[1]?.replace(/\s+/g, "") ??
    tribunalDoCnj(cnj.replace(/\D/g, "")) ??
    "";

  // "Intimação Notificação PROCESSO: 1000200-04.2025.5.02.0011 - AÇÃO TRABALHISTA - RITO ORDINÁRIO - || texto ||| POLO …"
  const inicioProcesso = conteudo.search(/PROCESSO\s*:/i);
  const antes = inicioProcesso > 0 ? conteudo.slice(0, inicioProcesso).trim().split(/\s+/) : [];
  const tipoComunicacao = antes[0] ?? null;
  const daqui = inicioProcesso >= 0 ? conteudo.slice(inicioProcesso) : conteudo;
  const fimCabecalho = daqui.indexOf("||");
  const inicioFim = daqui.indexOf("|||");
  const linhaProcesso = fimCabecalho >= 0 ? daqui.slice(0, fimCabecalho) : "";
  const classe = [
    ...antes.slice(1),
    linhaProcesso.replace(/PROCESSO\s*:\s*/i, "").replace(CNJ, "").replace(/^[\s-]+|[\s-]+$/g, ""),
  ]
    .filter(Boolean)
    .join(" ");
  let corpo = fimCabecalho >= 0 ? daqui.slice(fimCabecalho + 2, inicioFim > fimCabecalho ? inicioFim : undefined) : daqui;
  const fim = inicioFim >= 0 ? daqui.slice(inicioFim + 3) : "";

  const intimadoMatch = corpo.match(/Intimado\s*\(s\)\s*\/\s*Citado\s*\(s\)\s*-?\s*(.*)$/i);
  const intimados = intimadoMatch ? intimadoMatch[1].split(/\s+-\s+/).map((nome) => nome.trim()).filter(Boolean) : [];
  if (intimadoMatch) corpo = corpo.slice(0, intimadoMatch.index);

  const camposFim = camposPorRotulo(fim, ROTULOS_RECORTE_FIM);
  const partes = camposFim
    .filter(([chave]) => chave === "ativo" || chave === "passivo" || chave === "terceiro")
    .map(([chave, nome]) => ({ nome, polo: chave === "ativo" ? "A" : chave === "passivo" ? "P" : "T" }));
  const advogados = camposFim
    .filter(([chave]) => chave === "advogado")
    .map(([, valor]) => {
      const oab = valor.match(/\s-\s*OAB\s*:?\s*(\d[\d.]*)\s*\/\s*([A-Z]{2})/i);
      return oab
        ? { nome: valor.slice(0, oab.index).trim(), oab: oab[1].replace(/\./g, ""), uf: oab[2].toUpperCase() }
        : { nome: valor, oab: "", uf: "" };
    })
    .filter((advogado) => advogado.nome && advogado.oab);
  const url = primeiroCampo(camposFim, "acesso")?.match(/https?:\/\/\S+/)?.[0] ?? null;
  const identificador = primeiroCampo(camposFim, "identificador")?.match(/\d{5,}/)?.[0];

  return {
    formato: "recorte",
    cnj,
    tribunal,
    orgao: primeiroCampo(campos, "vara") ?? orgaoDoLocal(local, tribunal),
    dataDisponibilizacao,
    dataPublicacao,
    tipoComunicacao,
    classe: classe || null,
    corpo: plano(corpo),
    link: url ? { rotulo: "Acesso ao documento", url } : null,
    intimados,
    partes,
    advogados,
    idComunicacao: identificador ? Number(identificador) : null,
    caderno,
    comarca: "",
    nomeLocalizado: "",
  };
}

function lerRecorte(texto: string): LeituraColada {
  const inicios = [...texto.matchAll(/Data de Disponibiliza[çc][ãa]o\s*:/gi)].map((achado) => achado.index ?? 0);
  const publicacoes: Comunicacao[] = [];
  const ignorados: TrechoIgnorado[] = [];
  inicios.forEach((inicio, posicao) => {
    // "Publicação: 3." entre os blocos é só a numeração do recorte.
    const bloco = texto.slice(inicio, inicios[posicao + 1] ?? texto.length).replace(/\n\s*Publica[çc][ãa]o\s*:\s*\d+\s*\.?\s*$/i, "");
    const lido = lerBlocoRecorte(bloco);
    if (typeof lido === "string") ignorados.push({ trecho: trechoDe(bloco), motivo: lido });
    else publicacoes.push(lido);
  });
  return { publicacoes: publicacoes.map(paraPublicacaoColada), ignorados };
}

// ---------------------------------------------------------------------------
// DJEN repassado por texto (Teams)
// ---------------------------------------------------------------------------

const ROTULOS_DJEN = {
  processo: "Processo",
  orgao: "[ÓO]rg[ãa]o",
  disponibilizacao: "Data de disponibiliza[çc][ãa]o",
  tipo: "Tipo de comunica[çc][ãa]o",
  meio: "Meio",
  inteiro: "Inteiro teor",
  parte: "Parte",
  advogado: "Advogado",
  classe: "Classe",
};

interface CabecalhoDjen {
  dataDisponibilizacao: string | null;
  dataPublicacao: string | null;
  tribunal: string | null;
  comarca: string;
  nomeLocalizado: string;
}

/** "Divulgado em: 06/10/2026 - Publicado em: 07/10/2026", "Diário: STJDJN", "Termo encontrado: …", "Comarca: …". */
function atualizarCabecalho(atual: CabecalhoDjen, texto: string): CabecalhoDjen {
  const divulgado = texto.match(/Divulgado em\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const publicado = texto.match(/Publicado em\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const diario = texto.match(/Di[áa]rio\s*:\s*([A-Za-z0-9]+)/i)?.[1]?.toUpperCase();
  const termo = texto.match(/Termo encontrado\s*:\s*([^\n]+)/i)?.[1]?.trim();
  const comarca = texto.match(/Comarca\s*:\s*([^\n]+)/i)?.[1]?.trim();
  return {
    dataDisponibilizacao: divulgado ? dataIso(divulgado[1]) : atual.dataDisponibilizacao,
    dataPublicacao: publicado ? dataIso(publicado[1]) : atual.dataPublicacao,
    tribunal: diario ? diario.match(/^([A-Z]+\d*?)DJE?N$/)?.[1] ?? atual.tribunal : atual.tribunal,
    comarca: comarca ? (/^n[ãa]o consta$/i.test(comarca) ? "" : comarca) : atual.comarca,
    nomeLocalizado: termo ?? atual.nomeLocalizado,
  };
}

function lerBlocoDjen(bloco: string, cabecalho: CabecalhoDjen): Comunicacao | string {
  const inicioConteudo = bloco.search(/Conte[úu]do\s*:/i);
  if (inicioConteudo < 0) return "sem o conteúdo (Conteúdo:)";
  const campos = camposPorRotulo(bloco.slice(0, inicioConteudo), ROTULOS_DJEN);
  let conteudo = plano(bloco.slice(inicioConteudo).replace(/^Conte[úu]do\s*:/i, ""));
  const id = conteudo.match(/\|?\s*comunica[çc][ãa]o_id\s*:\s*(\d+)\s*\|?/i);
  if (id) conteudo = conteudo.slice(0, id.index).trim();

  const cnj = cnjDe(primeiroCampo(campos, "processo") ?? "");
  const dataDisponibilizacao = dataIso(primeiroCampo(campos, "disponibilizacao")) ?? cabecalho.dataDisponibilizacao;
  if (!cnj) return "sem número de processo";
  if (!dataDisponibilizacao) return "sem a data de disponibilização";
  if (!cabecalho.dataPublicacao) return "sem a data de publicação (Publicado em:)";
  if (!conteudo) return "sem o texto da publicação";

  const partes = campos
    .filter(([chave]) => chave === "parte")
    .map(([, valor]) => {
      const achado = valor.match(/^(?:\d+\s*\.\s*)?(.*?)\s*(?:\([^)]*\))?\s*Polo\s*:\s*(\S+)/i);
      return achado ? { nome: achado[1].trim(), polo: polo(achado[2]) } : { nome: valor.replace(/^\d+\s*\.\s*/, ""), polo: "T" };
    })
    .filter((parte) => parte.nome);
  const advogados = campos
    .filter(([chave]) => chave === "advogado")
    .map(([, valor]) => {
      const oab = valor.match(/\s-\s*OAB\s*:?\s*([A-Z]{2})\s*-?\s*(\d[\d.]*)/i) ?? valor.match(/\s-\s*OAB\s*:?\s*(\d[\d.]*)\s*\/\s*([A-Z]{2})/i);
      if (!oab) return null;
      const [uf, numero] = /^\d/.test(oab[1]) ? [oab[2], oab[1]] : [oab[1], oab[2]];
      return { nome: valor.slice(0, oab.index).trim(), oab: numero.replace(/\./g, ""), uf: uf.toUpperCase() };
    })
    .filter((advogado): advogado is { nome: string; oab: string; uf: string } => Boolean(advogado?.nome));
  // O Teams encurta links longos com "…": aí não servem para abrir.
  const url = primeiroCampo(campos, "inteiro")?.match(/https?:\/\/\S+/)?.[0];

  return {
    formato: "djen",
    cnj,
    tribunal: cabecalho.tribunal ?? tribunalDoCnj(cnj.replace(/\D/g, "")) ?? "",
    orgao: primeiroCampo(campos, "orgao"),
    dataDisponibilizacao,
    dataPublicacao: cabecalho.dataPublicacao,
    tipoComunicacao: primeiroCampo(campos, "tipo"),
    classe: primeiroCampo(campos, "classe"),
    corpo: conteudo,
    link: url && !/…|\.\.\.$/.test(url) ? { rotulo: "Inteiro teor", url } : null,
    intimados: [],
    partes,
    advogados,
    idComunicacao: id ? Number(id[1]) : null,
    caderno: "",
    comarca: cabecalho.comarca,
    nomeLocalizado: cabecalho.nomeLocalizado,
  };
}

function lerDjen(texto: string): LeituraColada {
  // Cada comunicação começa numa linha "Publicação" seguida de "Processo:".
  const marcas = [...texto.matchAll(/(?:^|\s)Publica[çc][ãa]o\s*(?=Processo\s*:)/gi)].map((achado) => ({
    inicio: achado.index ?? 0,
    fim: (achado.index ?? 0) + achado[0].length,
  }));
  const publicacoes: Comunicacao[] = [];
  const ignorados: TrechoIgnorado[] = [];
  let cabecalho = atualizarCabecalho(
    { dataDisponibilizacao: null, dataPublicacao: null, tribunal: null, comarca: "", nomeLocalizado: "" },
    texto.slice(0, marcas[0]?.inicio ?? texto.length)
  );
  marcas.forEach((marca, posicao) => {
    const ate = marcas[posicao + 1]?.inicio ?? texto.length;
    const trecho = texto.slice(marca.fim, ate);
    // O texto da comunicação termina no "|comunicacao_id: N|" (ou na primeira linha em branco depois de "Conteúdo:");
    // o que vem depois pode ser o cabeçalho do próximo processo.
    const id = trecho.match(/\|?\s*comunica[çc][ãa]o_id\s*:\s*\d+\s*\|?/i);
    const conteudo = trecho.search(/Conte[úu]do\s*:/i);
    const branco = conteudo >= 0 ? trecho.slice(conteudo).search(/\n\s*\n/) : -1;
    const fim = id ? (id.index ?? 0) + id[0].length : branco >= 0 ? conteudo + branco : trecho.length;
    const lido = lerBlocoDjen(trecho.slice(0, fim), cabecalho);
    if (typeof lido === "string") ignorados.push({ trecho: trechoDe(trecho), motivo: lido });
    else publicacoes.push(lido);
    cabecalho = atualizarCabecalho(cabecalho, trecho.slice(fim));
  });
  return { publicacoes: publicacoes.map(paraPublicacaoColada), ignorados };
}

// ---------------------------------------------------------------------------

function paraPublicacaoColada(c: Comunicacao, indice: number): PublicacaoColada {
  return {
    formato: c.formato,
    processo: c.cnj,
    tribunal: c.tribunal,
    orgao: c.orgao,
    tipoComunicacao: c.tipoComunicacao,
    idComunicacao: c.idComunicacao,
    intimados: c.intimados,
    resumo: c.corpo.slice(0, 240),
    linha: {
      linha: indice + 1,
      dataDivulgacao: c.dataDisponibilizacao,
      dataPublicacao: c.dataPublicacao,
      numeroProcesso: c.cnj,
      estado: "",
      diario: c.tribunal ? `${c.tribunal}_DJEN` : "",
      nomeLocalizado: c.nomeLocalizado,
      caderno: c.caderno,
      comarca: c.comarca,
      titulo: "",
      teor: teorNoFormatoDjen(c),
    },
  };
}

/** Lê as publicações de um texto colado. O que não der para ler vai em `ignorados`, com o motivo. */
export function lerPublicacoesColadas(textoBruto: string): LeituraColada {
  const texto = limpar(textoBruto.slice(0, MAX_TEXTO_COLADO));
  const djen = /\|\s*comunica[çc][ãa]o_id\s*:|Termo encontrado\s*:|Divulgado em\s*:/i.test(texto) || /(?:^|\s)Publica[çc][ãa]o\s*Processo\s*:/i.test(texto);
  const leitura = djen ? lerDjen(texto) : lerRecorte(texto);
  if (!leitura.publicacoes.length && !leitura.ignorados.length && texto.trim()) {
    leitura.ignorados.push({
      trecho: trechoDe(texto),
      motivo: "nenhuma publicação reconhecida (aceita o Recorte Digital da OAB/SP e o texto do DJEN com \"Publicação / Processo: … / Conteúdo: …\")",
    });
  }
  leitura.publicacoes = leitura.publicacoes.slice(0, MAX_PUBLICACOES_COLADAS);
  return leitura;
}
