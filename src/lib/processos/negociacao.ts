import { ProcessosError } from "./errors";
import type { PoloParte } from "./types";

/**
 * Negociação de acordo nos processos trabalhistas (o cliente é a reclamada), na parte que não depende de banco:
 * status, o e-mail padrão de pretensão para acordo, o agrupamento por advogado do reclamante, o .eml de
 * rascunho e a leitura da planilha que o cliente devolve com o valor máximo.
 */

export type StatusNegociacao = "a_enviar" | "enviado" | "respondido" | "proposta_recebida" | "contraproposta" | "acordo_fechado" | "sem_interesse";

export const STATUS_NEGOCIACAO: { valor: StatusNegociacao; rotulo: string }[] = [
  { valor: "a_enviar", rotulo: "A enviar" },
  { valor: "enviado", rotulo: "Enviado" },
  { valor: "respondido", rotulo: "Respondido" },
  { valor: "proposta_recebida", rotulo: "Proposta recebida" },
  { valor: "contraproposta", rotulo: "Contraproposta" },
  { valor: "acordo_fechado", rotulo: "Acordo fechado" },
  { valor: "sem_interesse", rotulo: "Sem interesse" },
];

export function rotuloDoStatus(status: string): string {
  return STATUS_NEGOCIACAO.find((item) => item.valor === status)?.rotulo ?? status;
}

export function ehStatusNegociacao(valor: unknown): valor is StatusNegociacao {
  return STATUS_NEGOCIACAO.some((item) => item.valor === valor);
}

export interface Advogado {
  nome: string;
  oab: string | null;
  emails: string[];
  /**
   * Sugestões da leitura dos autos ainda não aprovadas que trazem este advogado (vazio: já está no cadastro).
   * Aprovar inclui o advogado nas partes do processo.
   */
  sugestaoIds?: string[];
}

export interface Negociacao {
  id: string | null;
  status: StatusNegociacao;
  enviadoEm: string | null;
  respondidoEm: string | null;
  propostaValor: number | null;
  propostaCondicoes: string | null;
  contrapropostaValor: number | null;
  contrapropostaCondicoes: string | null;
  acordoValor: number | null;
  acordoCondicoes: string | null;
  valorMaximoCliente: number | null;
  valorMaximoEm: string | null;
  observacoes: string | null;
  atualizadoPorNome: string | null;
  atualizadoEm: string | null;
}

export function negociacaoNova(): Negociacao {
  return {
    id: null,
    status: "a_enviar",
    enviadoEm: null,
    respondidoEm: null,
    propostaValor: null,
    propostaCondicoes: null,
    contrapropostaValor: null,
    contrapropostaCondicoes: null,
    acordoValor: null,
    acordoCondicoes: null,
    valorMaximoCliente: null,
    valorMaximoEm: null,
    observacoes: null,
    atualizadoPorNome: null,
    atualizadoEm: null,
  };
}

export interface EventoNegociacao {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | null;
  para: string[];
  cc: string[];
  remetente: string | null;
  assunto: string | null;
  /** Texto do e-mail (enviado ou recebido). */
  corpo: string | null;
  autor: string | null;
  quando: string;
  /** E-mail da conversa no Microsoft 365: a caixa dela, o id da mensagem (para responder) e quando saiu ou chegou. */
  caixa: string | null;
  mensagemId: string | null;
  mensagemEm: string | null;
}

/** Os e-mails da negociação, do mais antigo ao mais novo (a conversa, como no Outlook). */
export function conversaDosEventos(eventos: EventoNegociacao[]): EventoNegociacao[] {
  return eventos
    .filter((evento) => evento.tipo === "email_enviado" || evento.tipo === "email_recebido" || evento.tipo === "email_rascunho")
    .sort((a, b) => (a.mensagemEm ?? a.quando).localeCompare(b.mensagemEm ?? b.quando));
}

/** "Assunto" → "RE: Assunto" (sem repetir o RE). */
export function assuntoDeResposta(assunto: string | null | undefined): string {
  const limpo = (assunto ?? "").trim();
  return /^(re|res|resp)\s*:/i.test(limpo) ? limpo : `RE: ${limpo}`;
}

/**
 * Para quem vai a resposta a um e-mail da conversa: o autor dele e quem estava em "Para" (sem a própria caixa); em
 * cópia, o Cc dele mais a cópia padrão, sem repetir quem já está em "Para".
 */
export function destinatariosDaResposta(evento: Pick<EventoNegociacao, "tipo" | "remetente" | "para" | "cc">, caixa: string | null, ccPadrao: string[] = []): { para: string[]; cc: string[] } {
  const propria = (caixa ?? "").trim().toLowerCase();
  const limpar = (lista: (string | null | undefined)[]) => [...new Set(lista.map((item) => (item ?? "").trim().toLowerCase()).filter((item) => item && item !== propria))];
  const para = evento.tipo === "email_recebido" ? limpar([evento.remetente, ...evento.para]) : limpar(evento.para);
  const cc = limpar([...evento.cc, ...ccPadrao]).filter((item) => !para.includes(item));
  return { para, cc };
}

/** Uma linha do painel: o processo, o reclamante, os advogados dele, o risco e a negociação. */
export interface LinhaNegociacao {
  processoId: string;
  ci: string | null;
  cnj: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  reclamante: string | null;
  advogadoResponsavel: string | null;
  fase: string | null;
  advogados: Advogado[];
  riscoValor: number | null;
  riscoReflexos: number | null;
  riscoTotal: number | null;
  negociacao: Negociacao;
}

/* ------------------------------------------------------------ e-mail */

/** "Empresa Exemplo Comércio Ltda" → "EMPRESA EXEMPLO COMÉRCIO LTDA." */
export function nomeDaEmpresa(cliente: string | null | undefined): string {
  const nome = (cliente ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");
  if (!nome) return "";
  // Tipo societário abreviado leva ponto, como no papel timbrado ("LTDA.", "S.A.").
  return /\b(LTDA|EIRELI|EPP|ME|S\/A|S\.A|CIA)$/.test(nome) ? `${nome}.` : nome;
}

/** "a, b e c". */
export function listaPorExtenso(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Saudação pela hora em Brasília: bom dia até 12h, boa tarde até 18h, boa noite depois. */
export function saudacaoPelaHora(agora: Date = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(agora));
  return hora < 12 ? "bom dia" : hora < 18 ? "boa tarde" : "boa noite";
}

export interface EmailDeAcordo {
  assunto: string;
  texto: string;
}

/**
 * O e-mail padrão de pretensão para acordo. Com um processo, o texto da equipe; com vários do mesmo advogado,
 * os números em lista ("Procs. nº A, B e C") e o pedido da pretensão de cada processo. O nome da empresa vem do
 * cliente do processo; a assinatura, de quem envia.
 */
export function montarEmailDeAcordo(params: { empresa: string; processos: string[]; saudacao?: string; assinatura?: string | null }): EmailDeAcordo {
  const empresa = nomeDaEmpresa(params.empresa);
  if (!empresa) throw new ProcessosError("O processo não tem o cliente no cadastro: o e-mail precisa do nome da empresa.", 400);
  const numeros = [...new Set(params.processos.map((item) => item.trim()).filter(Boolean))];
  if (!numeros.length) throw new ProcessosError("Escolha ao menos um processo para o e-mail.", 400);
  const varios = numeros.length > 1;
  const saudacao = (params.saudacao ?? "boa tarde").trim();
  const assunto = `Pretensão para acordo - ${varios ? "Procs." : "Proc."} nº ${listaPorExtenso(numeros)} - ${empresa}`;
  const corpo = [
    `Prezados, ${saudacao}.`,
    "",
    varios
      ? `Na qualidade de advogada da empresa ${empresa}, entro em contato para verificar eventual interesse na composição amigável nos processos nº ${listaPorExtenso(numeros)}.`
      : `Na qualidade de advogada da empresa ${empresa}, entro em contato para verificar eventual interesse na composição amigável no processo nº ${numeros[0]}.`,
    "",
    varios
      ? "Em caso positivo, solicito, por gentileza, o encaminhamento da pretensão de acordo de cada processo, indicando o valor e as condições de pagamento pretendidas, para que possamos submetê-las à análise da empresa."
      : "Em caso positivo, solicito, por gentileza, o encaminhamento da pretensão de acordo, indicando o valor e as condições de pagamento pretendidas, para que possamos submetê-la à análise da empresa.",
    "",
    "Aguardo retorno.",
    "",
    "Atenciosamente,",
    ...(params.assinatura?.trim() ? [params.assinatura.trim()] : []),
  ];
  return { assunto, texto: corpo.join("\n") };
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Texto simples → HTML do corpo (parágrafos e quebras), para o Outlook mostrar como foi escrito. */
export function textoParaHtml(texto: string): string {
  const paragrafos = texto.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return `<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt;">${paragrafos.map((paragrafo) => `<p>${escaparHtml(paragrafo).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i;

/** "a@x.com; b@y.com, c@z.com" → lista (aceita também uma lista pronta). */
export function separarEmails(lista: unknown): string[] {
  const brutos = Array.isArray(lista) ? lista : typeof lista === "string" ? lista.split(/[;,\s]+/) : [];
  return [...new Set(brutos.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

/** E-mails válidos, sem repetir, em minúsculas. Erro se algum não serve; com `opcional`, a lista pode vir vazia (Cc). */
export function conferirDestinatarios(lista: unknown, opcoes: { opcional?: boolean; rotulo?: string } = {}): string[] {
  const emails = separarEmails(lista);
  const invalidos = emails.filter((item) => !EMAIL.test(item));
  if (invalidos.length) throw new ProcessosError(`E-mail inválido${opcoes.rotulo ? ` em ${opcoes.rotulo}` : ""}: ${invalidos.join(", ")}.`, 400);
  if (!emails.length && !opcoes.opcional) throw new ProcessosError("Informe ao menos um destinatário.", 400);
  if (emails.length > 20) throw new ProcessosError(`No máximo 20 e-mails${opcoes.rotulo ? ` em ${opcoes.rotulo}` : " por campo"}.`, 400);
  return emails;
}

/** UTF-8 em base64, no servidor e no navegador. */
function base64Utf8(texto: string): string {
  let binario = "";
  for (const byte of new TextEncoder().encode(texto)) binario += String.fromCharCode(byte);
  return btoa(binario);
}

/** Cabeçalho MIME com acento (RFC 2047, UTF-8 em base64). */
function cabecalhoMime(texto: string): string {
  return /^[\x20-\x7e]*$/.test(texto) ? texto : `=?UTF-8?B?${base64Utf8(texto)}?=`;
}

function quebrarBase64(texto: string): string {
  return (texto.match(/.{1,76}/g) ?? []).join("\r\n");
}

/**
 * Rascunho em .eml: o Outlook abre como mensagem não enviada (X-Unsent), com destinatários, título e texto, para a
 * pessoa conferir e enviar da própria caixa.
 */
export function gerarEml(params: { para: string[]; cc?: string[]; assunto: string; texto: string; de?: string | null }): string {
  const html = textoParaHtml(params.texto);
  const fronteira = "=_orqestrai_acordo";
  const linhas = [
    ...(params.de ? [`From: ${params.de}`] : []),
    `To: ${params.para.join(", ")}`,
    ...(params.cc?.length ? [`Cc: ${params.cc.join(", ")}`] : []),
    `Subject: ${cabecalhoMime(params.assunto)}`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${fronteira}"`,
    "",
    `--${fronteira}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    quebrarBase64(base64Utf8(params.texto)),
    `--${fronteira}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    quebrarBase64(base64Utf8(html)),
    `--${fronteira}--`,
    "",
  ];
  return linhas.join("\r\n");
}

/* ------------------------------------------------- agrupamento por advogado */

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Chave do advogado: a OAB (só dígitos e UF) ou, sem ela, o nome sem acento nem caixa. */
export function chaveDoAdvogado(advogado: Pick<Advogado, "nome" | "oab">): string {
  const oab = (advogado.oab ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (/\d{3,}/.test(oab)) return `oab:${oab.replace(/^OAB/, "")}`;
  return `nome:${semAcento(advogado.nome).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

/** Um advogado que a leitura dos autos sugeriu num processo (sugestão "parte nova" ainda pendente). */
export interface SugestaoDeAdvogado {
  sugestaoId: string;
  polo: PoloParte | null;
  advogado: Advogado;
}

/** Os do cadastro primeiro; o sugerido do polo do reclamante entra se não for um que o cadastro já tem. */
export function juntarAdvogados(doCadastro: Advogado[], sugeridos: SugestaoDeAdvogado[], poloReclamante: PoloParte): Advogado[] {
  const lista = doCadastro.map((item) => ({ ...item }));
  for (const sugerido of sugeridos) {
    if (sugerido.polo && sugerido.polo !== poloReclamante) continue;
    const chave = chaveDoAdvogado(sugerido.advogado);
    const existente = lista.find((item) => chaveDoAdvogado(item) === chave);
    if (!existente) {
      lista.push({ ...sugerido.advogado, emails: [...sugerido.advogado.emails], sugestaoIds: [sugerido.sugestaoId] });
      continue;
    }
    // Já está no cadastro: só completa e-mail que falta (a sugestão continua lá para aprovar).
    if (!existente.sugestaoIds?.length) continue;
    existente.emails = [...new Set([...existente.emails, ...sugerido.advogado.emails])];
    existente.sugestaoIds = [...new Set([...existente.sugestaoIds, sugerido.sugestaoId])];
  }
  return lista;
}

export interface GrupoDeAdvogado {
  /** Chave estável do grupo (as chaves dos advogados, em ordem). */
  chave: string;
  empresa: string;
  advogados: Advogado[];
  /** Todos os e-mails dos advogados do grupo. */
  emails: string[];
  linhas: LinhaNegociacao[];
}

/**
 * Junta os processos em que o mesmo advogado do reclamante aparece (também por tabela: A num processo e A com B em
 * outro ficam juntos), separados pela empresa do e-mail. Processo sem advogado fica num grupo só dele.
 */
export function agruparPorAdvogado(linhas: LinhaNegociacao[]): GrupoDeAdvogado[] {
  const pai = new Map<string, string>();
  const achar = (chave: string): string => {
    let atual = chave;
    while (pai.get(atual) !== atual) {
      const proximo = pai.get(atual) as string;
      pai.set(atual, pai.get(proximo) as string);
      atual = proximo;
    }
    return atual;
  };
  const unir = (a: string, b: string) => {
    const [x, y] = [achar(a), achar(b)];
    if (x !== y) pai.set(y, x);
  };
  const empresaDa = (linha: LinhaNegociacao) => nomeDaEmpresa(linha.cliente);
  const chavesDa = (linha: LinhaNegociacao) => {
    const advogados = linha.advogados.map((advogado) => `${empresaDa(linha)}|${chaveDoAdvogado(advogado)}`);
    return advogados.length ? advogados : [`${empresaDa(linha)}|processo:${linha.processoId}`];
  };
  for (const linha of linhas) {
    const chaves = chavesDa(linha);
    for (const chave of chaves) if (!pai.has(chave)) pai.set(chave, chave);
    for (const chave of chaves.slice(1)) unir(chaves[0], chave);
  }
  const grupos = new Map<string, GrupoDeAdvogado>();
  for (const linha of linhas) {
    const raiz = achar(chavesDa(linha)[0]);
    let grupo = grupos.get(raiz);
    if (!grupo) {
      grupo = { chave: "", empresa: empresaDa(linha), advogados: [], emails: [], linhas: [] };
      grupos.set(raiz, grupo);
    }
    grupo.linhas.push(linha);
    for (const advogado of linha.advogados) {
      const existente = grupo.advogados.find((item) => chaveDoAdvogado(item) === chaveDoAdvogado(advogado));
      if (existente) {
        existente.emails = [...new Set([...existente.emails, ...advogado.emails])];
        // No cadastro em algum processo e sugerido em outro: as sugestões pendentes continuam para aprovar.
        const sugestoes = [...new Set([...(existente.sugestaoIds ?? []), ...(advogado.sugestaoIds ?? [])])];
        if (sugestoes.length) existente.sugestaoIds = sugestoes;
      } else grupo.advogados.push({ ...advogado, emails: [...advogado.emails], ...(advogado.sugestaoIds?.length ? { sugestaoIds: [...advogado.sugestaoIds] } : {}) });
    }
  }
  for (const grupo of grupos.values()) {
    grupo.advogados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    grupo.emails = [...new Set(grupo.advogados.flatMap((advogado) => advogado.emails))];
    grupo.chave = grupo.advogados.length ? grupo.advogados.map(chaveDoAdvogado).join("+") : `processo:${grupo.linhas[0].processoId}`;
    grupo.linhas.sort((a, b) => (a.cnj ?? "").localeCompare(b.cnj ?? ""));
  }
  // Grupos com mais processos primeiro; sem advogado por último.
  return [...grupos.values()].sort((a, b) => Number(!a.advogados.length) - Number(!b.advogados.length) || b.linhas.length - a.linhas.length || (a.advogados[0]?.nome ?? "").localeCompare(b.advogados[0]?.nome ?? "", "pt-BR"));
}

/* ------------------------------------------------------------ status */

/**
 * O status depois de enviar o e-mail: quem estava "a enviar" passa a "enviado"; a negociação que já andou
 * (respondido, proposta…) não volta atrás por um novo envio.
 */
export function statusAposEnvio(atual: StatusNegociacao): StatusNegociacao {
  return atual === "a_enviar" ? "enviado" : atual;
}

/* ------------------------------------------------------------ planilha */

/** Só os dígitos do número do processo, para casar a planilha com o cadastro. */
export function digitosDoCnj(cnj: unknown): string {
  return String(cnj ?? "").replace(/\D/g, "");
}

function normalizarCabecalho(texto: string): string {
  return semAcento(texto).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface LinhaImportada {
  cnj: string;
  valorMaximo: number | null;
  observacao: string | null;
}

/** Valor de célula do Excel: número, "R$ 12.345,67", "12345.67". Nulo quando vazio; NaN quando não é número. */
export function valorDaCelula(bruto: unknown): number | null {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  if (typeof bruto === "number") return Number.isFinite(bruto) ? Math.round(bruto * 100) / 100 : NaN;
  const limpo = String(bruto).replace(/[R$\s]/g, "");
  if (!limpo || limpo === "-") return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Math.round(Number(normal) * 100) / 100 : NaN;
}

/**
 * Linhas da planilha devolvida pelo cliente → valor máximo por processo. Acha as colunas pelo cabeçalho
 * ("Processo"/"CNJ" e "Valor máximo…"), em qualquer posição; linhas sem número de processo são ignoradas.
 */
export function lerPlanilhaDeValores(linhas: unknown[][]): { itens: LinhaImportada[]; avisos: string[] } {
  const avisos: string[] = [];
  const indiceCabecalho = linhas.findIndex((linha) => linha.some((celula) => /processo|cnj/.test(normalizarCabecalho(String(celula ?? "")))) && linha.some((celula) => /valor maximo|maximo/.test(normalizarCabecalho(String(celula ?? "")))));
  if (indiceCabecalho < 0) throw new ProcessosError("A planilha precisa das colunas \"Processo\" (ou \"CNJ\") e \"Valor máximo para acordo\".", 400);
  const cabecalho = linhas[indiceCabecalho].map((celula) => normalizarCabecalho(String(celula ?? "")));
  const colunaCnj = cabecalho.findIndex((celula) => /^(n )?(processo|cnj)|numero (do )?processo/.test(celula));
  const colunaValor = cabecalho.findIndex((celula) => /valor maximo|maximo/.test(celula));
  const colunaObs = cabecalho.findIndex((celula) => /observ/.test(celula));
  const itens: LinhaImportada[] = [];
  linhas.slice(indiceCabecalho + 1).forEach((linha, indice) => {
    const cnj = digitosDoCnj(linha[colunaCnj]);
    if (cnj.length !== 20) {
      if (String(linha[colunaCnj] ?? "").trim()) avisos.push(`Linha ${indiceCabecalho + indice + 2}: número de processo inválido.`);
      return;
    }
    const valor = valorDaCelula(linha[colunaValor]);
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      avisos.push(`Linha ${indiceCabecalho + indice + 2}: valor máximo inválido.`);
      return;
    }
    const observacao = colunaObs >= 0 ? String(linha[colunaObs] ?? "").trim() || null : null;
    if (valor === null && !observacao) return;
    itens.push({ cnj, valorMaximo: valor, observacao: observacao ? observacao.slice(0, 2000) : null });
  });
  return { itens, avisos };
}
