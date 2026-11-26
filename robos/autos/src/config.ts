import { hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { certificadoConfigurado, type ConfigCertificado } from "./certificado.ts";
import type { ConfigSegundoFator } from "./segundo-fator.ts";
import { limiteParadoDoNavegador } from "./navegador-parado.ts";
import { PERFIL_EPROC_PADRAO } from "./conectores/eproc-urls.ts";

/**
 * Configuração do robô, toda por variável de ambiente (arquivo .env nesta pasta, fora do repositório).
 * A credencial do tribunal é do advogado: existe só aqui, nesta máquina. O robô não a envia ao ORQESTRAI
 * nem a escreve em log.
 */

export type ModoDeLogin = "certificado" | "senha" | "manual";

/**
 * Como o robô abre o navegador:
 * - comum: abre o Chrome como um navegador comum e se conecta a ele (permite instalar a extensão Web Signer);
 * - playwright: o Playwright abre o navegador. É o modo do servidor (contêiner) e o único que aceita o
 *   certificado em arquivo (CERTIFICADO_PFX ou CERTIFICADO_PASTA). Não instala extensão da Chrome Web Store.
 */
export type ModoDoNavegador = "comum" | "playwright";

export interface ProxyDoNavegador {
  server: string;
  username?: string;
  password?: string;
  bypass?: string;
}

/**
 * Lê NAVEGADOR_PROXY ("socks5://host:porta" ou "http://usuario:senha@host:porta") e NAVEGADOR_PROXY_IGNORAR
 * (domínios que saem direto, separados por vírgula). Usuário e senha saem da URL e vão em campos próprios.
 */
export function lerProxy(valor: string, ignorar = ""): ProxyDoNavegador | null {
  const texto = valor.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new Error("NAVEGADOR_PROXY inválido: use socks5://host:porta ou http://usuario:senha@host:porta.");
  }
  if (!/^(http|https|socks5):$/.test(url.protocol) || !url.hostname || !url.port) {
    throw new Error("NAVEGADOR_PROXY deve ter protocolo (http, https ou socks5), host e porta.");
  }
  if (url.protocol === "socks5:" && (url.username || url.password)) {
    throw new Error("O navegador não aceita usuário e senha em proxy socks5: use http://usuario:senha@host:porta.");
  }
  const proxy: ProxyDoNavegador = { server: `${url.protocol}//${url.hostname}:${url.port}` };
  if (url.username) proxy.username = decodeURIComponent(url.username);
  if (url.password) proxy.password = decodeURIComponent(url.password);
  const lista = ignorar.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean);
  if (lista.length) proxy.bypass = lista.join(",");
  return proxy;
}

export interface Config {
  orqestraiUrl: string;
  token: string;
  nome: string;
  navegadorCanal: string;
  navegadorExecutavel: string;
  navegadorModo: ModoDoNavegador;
  /** Sem janela (NAVEGADOR_HEADLESS=sim, só no modo playwright): ninguém consegue resolver login, código ou CAPTCHA. */
  navegadorHeadless: boolean;
  /** Argumentos extras do navegador (NAVEGADOR_ARGS, separados por espaço), ex.: tamanho da janela no contêiner. */
  navegadorArgs: string[];
  /** Endereço da tela remota do robô (noVNC), mostrado no log quando ele precisa de uma pessoa. */
  telaRemotaUrl: string;
  /**
   * Saída do navegador por um proxy (NAVEGADOR_PROXY, só no modo playwright). Os tribunais (CloudFront) bloqueiam IP de
   * data center: no servidor, o navegador sai por um proxy aceito (ex.: socks5://warp:1080). Null = conexão direta.
   */
  navegadorProxy: ProxyDoNavegador | null;
  /**
   * Com a fila vazia por este tempo, o robô fecha o navegador e reabre no próximo pedido (NAVEGADOR_FECHAR_PARADO_MINUTOS;
   * padrão 10 min no modo playwright, nunca no modo comum; 0 = nunca). Ver navegador-parado.ts.
   */
  navegadorParadoMs: number;
  /** Conectores que este robô atende (ROBO_CONECTORES); vazio = todos. Ex.: "eproc" ou "esaj:TJSP,esaj:TJCE". */
  conectores: string[];
  /** Certificado A1 em arquivo (só no modo playwright). */
  certificado: ConfigCertificado;
  intervaloMs: number;
  pausaEntrePedidosMs: number;
  esperaPessoaMs: number;
  geracaoPdfMs: number;
  /** Com a fila de autos vazia, completa a capa dos processos pelo DataJud (CAPA_DATAJUD=nao desliga). */
  capaDataJud: boolean;
  /** Pausa entre duas consultas ao DataJud. */
  pausaCapaMs: number;
  esaj: { login: ModoDeLogin; certificado: string; usuario: string; senha: string };
  /** eproc (TJSP): login pelo SSO do tribunal. Sem EPROC_LOGIN, vale o modo do e-SAJ. */
  eproc: { login: ModoDeLogin; usuario: string; senha: string; perfil: string };
  /**
   * eproc do TJRJ: cadastro e senha próprios do tribunal (EPROC_TJRJ_*). Sem EPROC_TJRJ_LOGIN, vale o modo do
   * eproc do TJSP, menos "senha" sem usuário e senha do TJRJ, que vira "manual".
   */
  eprocTjrj: { login: ModoDeLogin; usuario: string; senha: string };
  /**
   * Fonte alternativa do código de 2 fatores, montada pelos donos da conta (ex.: um webhook do n8n que gera o TOTP de cada
   * tribunal). Com `url` preenchida, o robô busca o código ali, por sistema (`?sistema=eproc`, `?sistema=pdpj`…),
   * e digita sozinho; sem ela, espera a pessoa. O segredo do 2FA NÃO fica aqui: fica na fonte. Isto só guarda o
   * endereço e o token de acesso dela.
   */
  webhook2fa: { url: string; header: string; token: string };
  /**
   * Segredo do TOTP cadastrado no painel de robôs (`segundo-fator.json`, cifrado com a chave pública do robô).
   * Vem antes do webhook: com ele, o robô gera o código sozinho. Pasta: ROBO_2FA_PASTA ou, sem ela, CERTIFICADO_PASTA.
   */
  segundoFator: ConfigSegundoFator;
  /**
   * O robô faz o papel do PJe Office no login por certificado do jus.br (PDPJ), com o mesmo A1 (src/pje-office.ts).
   * Só no modo playwright com certificado; PJE_OFFICE=nao desliga (aí o login no jus.br fica com a pessoa).
   */
  pjeOffice: boolean;
  /**
   * O robô faz o papel do Web Signer da Softplan no login por certificado do e-SAJ, com o mesmo A1 (src/web-signer.ts).
   * Só no modo playwright com certificado; WEB_SIGNER=nao desliga (aí o login do e-SAJ fica com a pessoa).
   */
  webSigner: boolean;
  /**
   * Processo em segredo de justiça: baixa sem esperar a liberação na ficha, porque o robô só abre o que o login do
   * advogado já alcança (decisão de 24/11/2026). SEGREDO_JUSTICA=esperar volta a parar e esperar a liberação.
   */
  segredoSempreLiberado: boolean;
  pastas: { perfil: string; downloads: string; diagnostico: string };
}

function texto(nome: string): string {
  return process.env[nome]?.trim() ?? "";
}

function numero(nome: string, padrao: number): number {
  const valor = Number(texto(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

/** Pastas de trabalho: dentro de robos/autos, ou dentro de PASTA_DADOS (o volume, no contêiner). */
const pasta = (nome: string) => (texto("PASTA_DADOS") ? join(texto("PASTA_DADOS"), nome) : fileURLToPath(new URL(`../${nome}/`, import.meta.url)));

function lista(nome: string): string[] {
  return texto(nome)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function lerConfig(): Config {
  const orqestraiUrl = texto("ORQESTRAI_URL").replace(/\/+$/, "");
  const token = texto("ROBO_AUTOS_TOKEN");
  if (!/^https?:\/\//.test(orqestraiUrl)) throw new Error("Defina ORQESTRAI_URL no .env (ex.: https://sistema.exemplo.com.br).");
  if (token.length < 24) throw new Error("Defina ROBO_AUTOS_TOKEN no .env (o mesmo valor configurado no ORQESTRAI, com 24 caracteres ou mais).");

  const login = (texto("ESAJ_LOGIN") || "manual").toLowerCase();
  if (login !== "certificado" && login !== "senha" && login !== "manual") throw new Error('ESAJ_LOGIN deve ser "certificado", "senha" ou "manual".');
  if (login === "senha" && (!texto("ESAJ_USUARIO") || !texto("ESAJ_SENHA"))) throw new Error("No modo senha, defina ESAJ_USUARIO e ESAJ_SENHA no .env desta máquina.");

  const loginEproc = (texto("EPROC_LOGIN") || login).toLowerCase();
  if (loginEproc !== "certificado" && loginEproc !== "senha" && loginEproc !== "manual") throw new Error('EPROC_LOGIN deve ser "certificado", "senha" ou "manual".');
  if (loginEproc === "senha" && (!texto("EPROC_USUARIO") || !texto("EPROC_SENHA"))) throw new Error("No modo senha do eproc, defina EPROC_USUARIO e EPROC_SENHA no .env desta máquina.");

  const loginTjrjInformado = texto("EPROC_TJRJ_LOGIN").toLowerCase();
  const credenciaisTjrj = Boolean(texto("EPROC_TJRJ_USUARIO") && texto("EPROC_TJRJ_SENHA"));
  const loginEprocTjrj = loginTjrjInformado || (loginEproc === "senha" && !credenciaisTjrj ? "manual" : loginEproc);
  if (loginEprocTjrj !== "certificado" && loginEprocTjrj !== "senha" && loginEprocTjrj !== "manual") throw new Error('EPROC_TJRJ_LOGIN deve ser "certificado", "senha" ou "manual".');
  if (loginEprocTjrj === "senha" && !credenciaisTjrj) throw new Error("No modo senha do eproc do TJRJ, defina EPROC_TJRJ_USUARIO e EPROC_TJRJ_SENHA no .env desta máquina.");

  const certificado: ConfigCertificado = {
    pfx: texto("CERTIFICADO_PFX"),
    senha: process.env.CERTIFICADO_SENHA ?? "",
    senhaArquivo: texto("CERTIFICADO_SENHA_ARQUIVO"),
    pasta: texto("CERTIFICADO_PASTA"),
    chavePrivadaArquivo: texto("CERTIFICADO_CHAVE_PRIVADA_ARQUIVO"),
    origens: (lista("CERTIFICADO_ORIGENS").length ? lista("CERTIFICADO_ORIGENS") : ["https://certificado-sso.tjsp.jus.br"]).map((origem) => origem.replace(/\/+$/, "")),
  };
  if (certificado.pfx && certificado.pasta) throw new Error("Use CERTIFICADO_PFX ou CERTIFICADO_PASTA, não os dois.");
  if (certificado.origens.some((origem) => !/^https:\/\/[^/]+$/.test(origem))) throw new Error("CERTIFICADO_ORIGENS: cada origem é https://host, sem caminho.");
  const comCertificado = certificadoConfigurado(certificado);
  const navegadorModo = (texto("NAVEGADOR_MODO") || (comCertificado ? "playwright" : "comum")).toLowerCase();
  if (navegadorModo !== "comum" && navegadorModo !== "playwright") throw new Error('NAVEGADOR_MODO deve ser "comum" ou "playwright".');
  if (comCertificado && navegadorModo !== "playwright") throw new Error("O certificado em arquivo (CERTIFICADO_PFX ou CERTIFICADO_PASTA) só funciona com NAVEGADOR_MODO=playwright.");
  const navegadorHeadless = /^(sim|1|true)$/i.test(texto("NAVEGADOR_HEADLESS"));
  if (navegadorHeadless && navegadorModo !== "playwright") throw new Error("NAVEGADOR_HEADLESS só vale com NAVEGADOR_MODO=playwright.");
  const navegadorProxy = lerProxy(texto("NAVEGADOR_PROXY"), texto("NAVEGADOR_PROXY_IGNORAR"));
  if (navegadorProxy && navegadorModo !== "playwright") throw new Error("NAVEGADOR_PROXY só vale com NAVEGADOR_MODO=playwright.");

  return {
    orqestraiUrl,
    token,
    nome: texto("ROBO_NOME") || hostname(),
    navegadorCanal: (texto("NAVEGADOR_CANAL") || "chrome").toLowerCase(),
    navegadorExecutavel: texto("NAVEGADOR_EXECUTAVEL"),
    navegadorModo,
    navegadorHeadless,
    navegadorArgs: texto("NAVEGADOR_ARGS").split(/\s+/).filter(Boolean),
    telaRemotaUrl: texto("TELA_REMOTA_URL"),
    navegadorProxy,
    navegadorParadoMs: limiteParadoDoNavegador(texto("NAVEGADOR_FECHAR_PARADO_MINUTOS"), navegadorModo),
    conectores: lista("ROBO_CONECTORES").map((item) => item.toLowerCase()),
    certificado,
    intervaloMs: numero("INTERVALO_SEGUNDOS", 30) * 1000,
    pausaEntrePedidosMs: numero("PAUSA_ENTRE_PEDIDOS_SEGUNDOS", 20) * 1000,
    esperaPessoaMs: numero("ESPERA_PESSOA_MINUTOS", 15) * 60_000,
    geracaoPdfMs: numero("GERACAO_PDF_MINUTOS", 20) * 60_000,
    capaDataJud: !/^(nao|não|0|false)$/i.test(texto("CAPA_DATAJUD")),
    pausaCapaMs: numero("PAUSA_CAPA_SEGUNDOS", 30) * 1000,
    esaj: { login, certificado: texto("ESAJ_CERTIFICADO"), usuario: texto("ESAJ_USUARIO"), senha: texto("ESAJ_SENHA") },
    // Perfil escolhido quando o advogado tem mais de um no eproc (ex.: inscrições SP e ES): o que começa por este prefixo.
    eproc: { login: loginEproc, usuario: texto("EPROC_USUARIO"), senha: texto("EPROC_SENHA"), perfil: (texto("EPROC_PERFIL") || PERFIL_EPROC_PADRAO).toUpperCase() },
    eprocTjrj: { login: loginEprocTjrj, usuario: texto("EPROC_TJRJ_USUARIO"), senha: texto("EPROC_TJRJ_SENHA") },
    webhook2fa: { url: texto("ROBO_2FA_WEBHOOK_URL"), header: texto("ROBO_2FA_WEBHOOK_HEADER") || "x-robo-token", token: texto("ROBO_2FA_WEBHOOK_TOKEN") },
    segredoSempreLiberado: !/^esperar$/i.test(texto("SEGREDO_JUSTICA")),
    webSigner: comCertificado && navegadorModo === "playwright" && !/^(nao|não|0|false)$/i.test(texto("WEB_SIGNER")),
    pjeOffice: comCertificado && navegadorModo === "playwright" && !/^(nao|não|0|false)$/i.test(texto("PJE_OFFICE")),
    segundoFator: { pasta: texto("ROBO_2FA_PASTA") || certificado.pasta, chavePrivadaArquivo: certificado.chavePrivadaArquivo },
    pastas: { perfil: pasta("perfil"), downloads: pasta("downloads"), diagnostico: pasta("diagnostico") },
  };
}
