import { lerCnj, type NumeroCnj } from "./esaj-urls.ts";

/**
 * DCP do TJRJ, sem navegador (o que dá para testar sozinho). RASCUNHO: o conector ainda não está registrado
 * (nem em CONECTORES, no robô, nem em CONECTORES_DISPONIVEIS, no ORQESTRAI).
 *
 * O DCP é o sistema próprio do TJRJ (o "Próprio" do cadastro do VIOS). O advogado o opera pelo Portal de
 * Serviços. O que está aqui saiu de fontes públicas do tribunal, conferidas em 18/11/2026:
 *
 * - Login: IdServerJus (www3.tjrj.jus.br/idserverjus-front, `sgSist=PORTALSERVICOS`), uma tela Angular com
 *   "Usuário" (#usuario, geralmente o CPF), "Senha" (#senha), botão "Entrar" e, ao lado, "Certificado Digital"
 *   (imagem que leva a www7.tjrj.jus.br/autenticadorCertDigital). A tela avisa que usuários externos, advogados
 *   inclusive, passam por duplo fator. O código da tela carrega o reCAPTCHA (v2 e v3, ligados por parâmetro do
 *   servidor) e tem as rotas #/autenticacao-mfa, #/autenticacao-certificado, #/cadastro-email, #/trocar-senha e
 *   #/selecao-sistemas. Conferido na tela e no código público dela.
 * - Sem login, www3.tjrj.jus.br/portalservicos/ volta para a página inicial do tribunal (www.tjrj.jus.br).
 * - Consulta (manual "Novo Visualizador de Processo Eletrônico", VISPROCELET, v1.0 de 01/09/2021): menu à
 *   esquerda "Consultas" > "Consultas Processuais", abas "Por Número", "Por Nome", "Por OAB"…; ao escolher o
 *   processo abre "Detalhes do Processo", com o botão "Processo Eletrônico – Novo Visualizador" (processos
 *   volumosos só têm o "Antigo Visualizador").
 * - Autos (mesmo manual): no visualizador, o ícone "Baixar o Processo Atual em PDF" pergunta "Deseja salvar uma
 *   cópia das peças processuais?", com "Cancelar", "Salvar documentos selecionados" e "Salvar processo completo".
 *   O índice à esquerda lista os documentos, com caixa de seleção opcional ("Exibir Caixa de Seleção").
 * - Migração (flashcard "Processos Migrados do DCP para o eproc – Portal de Serviços", v1.4): consulta de processo
 *   migrado mostra aviso com "Acessar eproc" (ou "Ir para o eproc", no visualizador); andamentos e peças ficam
 *   como estavam na data da migração.
 *
 * Visto nas telas logadas (mapa de 18/11/2026, processo de teste do TJRJ), corrigindo o manual:
 * - depois do login o portal abre numa janela própria (popup); a janela do login volta para a página inicial;
 * - a consulta (Consultas > Consultas Processuais) fica num iframe de www3.tjrj.jus.br/consultaprocessual: aba
 *   #nav-porNumero, rádio #numeracaoUnica, número em dois campos (input[name=numeroProcesso], que pula sozinho
 *   para o sufixo ao completar 13 dígitos, e #inputSufixoUnica3) e #botaoPesquisarProcesso (um por aba, mesmo id);
 * - o número leva direto a "Detalhes do Processo", com o botão "Processo Eletrônico - Visualizador";
 * - o visualizador abre em aba nova (www3.tjrj.jus.br/visproc/#/<token>); o índice é uma árvore com uma caixa
 *   (mat-checkbox, aria-roledescription = rótulo) por item, depois de "Exibir caixa de seleção";
 * - "Baixar o processo atual em PDF" pergunta "Deseja salvar uma cópia das peças processuais?" com "Cancelar",
 *   "Salvar Documentos Selecionados" (só com algo marcado) e "Salvar Documentos Carregados"; o PDF vem como
 *   download do navegador, em segundos.
 */

export const LOGIN_PORTAL_DE_SERVICOS = "https://www3.tjrj.jus.br/idserverjus-front/#/login?indGet=true&sgSist=PORTALSERVICOS";

/** A área logada do Portal de Serviços (sem login, ele devolve a página inicial do tribunal). */
export const PORTAL_DE_SERVICOS = "https://www3.tjrj.jus.br/portalservicos";

/** Telas do login do TJRJ: IdServerJus (usuário e senha, duplo fator, e-mail, troca de senha, escolha do sistema), certificado e SSO. */
export type EtapaDoLoginDcp = "usuario-senha" | "duplo-fator" | "certificado" | "cadastro-email" | "troca-de-senha" | "selecao-de-sistema" | "sso";

export function etapaDoLoginDcp(url: string): EtapaDoLoginDcp | null {
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }
  const host = endereco.hostname.toLowerCase();
  if (host === "www7.tjrj.jus.br" && /\/autenticadorcertdigital\//i.test(endereco.pathname)) return "certificado";
  // Keycloak do tribunal (rota "redirecionar-keycloak" do IdServerJus).
  if (host === "tjerj-sso.tjrj.jus.br") return "sso";
  if (host !== "www3.tjrj.jus.br" || !/^\/idserverjus-front\b/i.test(endereco.pathname)) return null;
  const rota = endereco.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase();
  if (rota.startsWith("autenticacao-mfa")) return "duplo-fator";
  if (rota.startsWith("autenticacao-certificado")) return "certificado";
  if (rota.startsWith("cadastro-email")) return "cadastro-email";
  if (rota.startsWith("trocar-senha") || rota.startsWith("esqueci-minha-senha")) return "troca-de-senha";
  if (rota.startsWith("selecao-sistemas")) return "selecao-de-sistema";
  return "usuario-senha";
}

/** O que dizer à pessoa em cada tela do login. O robô não digita senha nem código: só espera. */
export function instrucaoDoLoginDcp(etapa: EtapaDoLoginDcp | null): string {
  switch (etapa) {
    case "duplo-fator":
      return "O Portal de Serviços pediu o código do duplo fator. O advogado informa o código na janela do robô.";
    case "certificado":
      return "Login por certificado: escolha o certificado do advogado na janela do robô (se o macOS pedir permissão para usar a chave, autorize).";
    case "cadastro-email":
      return "Primeiro acesso com duplo fator: o tribunal pede para informar e confirmar o e-mail cadastrado. Conclua na janela do robô.";
    case "troca-de-senha":
      return "O tribunal pediu troca de senha. Quem decide é o advogado: conclua (ou cancele) na janela do robô.";
    case "selecao-de-sistema":
      return "Escolha o Portal de Serviços na lista de sistemas, na janela do robô.";
    default:
      return "Entre no Portal de Serviços na janela do robô: usuário e senha do advogado (depois o código do duplo fator) ou o ícone de Certificado Digital.";
  }
}

/**
 * A pessoa já entrou? Critério observável: alguma aba saiu das telas de login e está no Portal de Serviços
 * (no mapa, www3.tjrj.jus.br/portalservicos/#/dashboard, numa janela aberta pelo login).
 */
export function ehAreaLogadaDcp(url: string): boolean {
  if (etapaDoLoginDcp(url)) return false;
  return url.toLowerCase().startsWith(`${PORTAL_DE_SERVICOS}/`) || url.toLowerCase() === PORTAL_DE_SERVICOS;
}

/** O número é de processo do TJRJ (J.TR 8.19)? */
export function cnjDoTjrj(cnj: string): NumeroCnj | null {
  const numero = lerCnj(cnj);
  if (!numero) return null;
  return numero.mascarado.slice(16, 20) === "8.19" ? numero : null;
}

export interface PartesDoCnjTjrj {
  mascarado: string;
  /** "0000000-00.0000": a parte antes de ".8.19." (o site do tribunal mostra ".8.19." fixo entre os dois campos). */
  inicio: string;
  /** Origem (serventia), os 4 últimos dígitos. */
  origem: string;
}

/**
 * O número em pedaços, para as pesquisas que mostram ".8.19." fixo entre dois campos (como a busca da página
 * inicial do tribunal e a aba "Por Número" do Portal de Serviços, conferida no mapa).
 */
export function partesDoCnjTjrj(cnj: string): PartesDoCnjTjrj | null {
  const numero = cnjDoTjrj(cnj);
  if (!numero) return null;
  return { mascarado: numero.mascarado, inicio: numero.numeroDigitoAno, origem: numero.foro };
}

/**
 * O processo já foi para o eproc? Vale para o DCP e para o PJe do TJRJ: o DCP mostra um aviso com "Acessar eproc"
 * (ou "Ir para o eproc", no visualizador); o PJe, "Processo migrado para o eproc, acesse-o através do link".
 * Aí o pedido deve ir ao conector eproc:TJRJ, que já baixa os autos.
 */
export function migradoParaEproc(texto: string): boolean {
  const limpo = texto.replace(/\s+/g, " ");
  return /migrado (para|ao) o? ?eproc|acessar (o )?eproc|ir para o eproc/i.test(limpo);
}

/**
 * O processo é sigiloso? SUPOSIÇÃO: os detalhes do processo no Portal de Serviços dizem "segredo de justiça" ou
 * "sigiloso" quando o processo é. Na dúvida (texto ambíguo), trata como segredo: o pedido espera a liberação.
 */
export function emSegredoDcp(texto: string): boolean {
  const limpo = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (/segredo de justica\s*[:?]?\s*(nao|n)\b/.test(limpo)) return false;
  return /segredo de justica|\bsigiloso\b|\bsigilo\s*:?\s*sim\b/.test(limpo);
}

/**
 * Visualizador que o botão abre: o novo tem "Baixar o Processo Atual em PDF"; o antigo (o único para processos
 * volumosos) ainda não foi mapeado. "outro" é um link de processo eletrônico sem dizer qual (portal antigo).
 */
export function visualizadorDoBotao(texto: string): "novo" | "antigo" | "outro" | null {
  const limpo = texto.replace(/\s+/g, " ");
  if (!/processo eletr[oô]nico|visualizador/i.test(limpo)) return null;
  if (/antigo/i.test(limpo)) return "antigo";
  if (/novo/i.test(limpo)) return "novo";
  return "outro";
}

/**
 * Consulta processual do Portal de Serviços, vista no mapa de 18/11/2026: a rota do portal que traz a consulta num
 * iframe (www3.tjrj.jus.br/consultaprocessual). O portal logado abre numa janela própria (popup) depois do login.
 */
export const CONSULTA_PROCESSUAL_DCP = `${PORTAL_DE_SERVICOS}/#/consproc/consultaportal`;

/** A busca dentro do iframe: o iframe guarda a última tela (os detalhes do processo anterior) e volta para cá. */
export const QUADRO_DA_CONSULTA_DCP = "https://www3.tjrj.jus.br/consultaprocessual/#/consultaportal";

/** O iframe da consulta processual (busca e "Detalhes do Processo"). */
export function ehQuadroDaConsultaDcp(url: string): boolean {
  return /^https:\/\/www3\.tjrj\.jus\.br\/consultaprocessual\//i.test(url);
}

/** O visualizador de autos (abre em aba nova, com um token no endereço). */
export function ehVisualizadorDcp(url: string): boolean {
  return /^https:\/\/www3\.tjrj\.jus\.br\/visproc\//i.test(url);
}

export interface DocumentoDoIndiceDcp {
  /** Posição da caixa de seleção no índice (ordem da tela). */
  indice: number;
  rotulo: string;
  chave: string;
}

/**
 * Item do índice do visualizador que é peça do processo: o rótulo começa pelo número sequencial ("11 - Procuração",
 * "90 - Juntada - Petição - dia 16/10/2026"). O número só cresce: uma peça antiga não muda quando entra outra.
 * O nó do processo ("Processo: …") e os agrupadores sem número ("Petição Inicial/Doc. de Origem") ficam de fora.
 */
export function chaveDoDocumentoDcp(rotulo: string): string | null {
  const limpo = rotulo.replace(/\s+/g, " ").trim();
  if (!/^\d+\s*-\s*\S/.test(limpo)) return null;
  return `dcp:${limpo.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()}`;
}

/** Os rótulos das caixas do índice viram documentos (só os numerados). */
export function documentosDoIndiceDcp(rotulos: readonly string[]): DocumentoDoIndiceDcp[] {
  return rotulos.flatMap((rotulo, indice) => {
    const chave = chaveDoDocumentoDcp(rotulo);
    return chave ? [{ indice, rotulo: rotulo.replace(/\s+/g, " ").trim(), chave }] : [];
  });
}

/** Os documentos que ainda não vieram em downloads anteriores (as chaves de outros sistemas não contam). */
export function documentosNovosDcp(documentos: DocumentoDoIndiceDcp[], baixadas: readonly string[] | undefined): DocumentoDoIndiceDcp[] {
  const ja = new Set((baixadas ?? []).filter((chave) => chave.startsWith("dcp:")));
  return ja.size ? documentos.filter((documento) => !ja.has(documento.chave)) : documentos;
}
