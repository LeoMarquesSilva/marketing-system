import { hostname } from "node:os";
import { fileURLToPath } from "node:url";

/**
 * Configuração do robô, toda por variável de ambiente (arquivo .env nesta pasta, fora do repositório).
 * A credencial do tribunal é do advogado: existe só aqui, nesta máquina. O robô não a envia ao ORQESTRAI
 * nem a escreve em log.
 */

export type ModoDeLogin = "certificado" | "senha" | "manual";

export interface Config {
  orqestraiUrl: string;
  token: string;
  nome: string;
  navegadorCanal: string;
  navegadorExecutavel: string;
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
  eproc: { login: ModoDeLogin; usuario: string; senha: string };
  /**
   * Fonte do código de 2 fatores, montada pelos donos da conta (ex.: um webhook do n8n que gera o TOTP de cada
   * tribunal). Com `url` preenchida, o robô busca o código ali, por sistema (`?sistema=eproc`, `?sistema=pdpj`…),
   * e digita sozinho; sem ela, espera a pessoa. O segredo do 2FA NÃO fica aqui: fica na fonte. Isto só guarda o
   * endereço e o token de acesso dela.
   */
  webhook2fa: { url: string; header: string; token: string };
  pastas: { perfil: string; downloads: string; diagnostico: string };
}

function texto(nome: string): string {
  return process.env[nome]?.trim() ?? "";
}

function numero(nome: string, padrao: number): number {
  const valor = Number(texto(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

const pasta = (nome: string) => fileURLToPath(new URL(`../${nome}/`, import.meta.url));

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

  return {
    orqestraiUrl,
    token,
    nome: texto("ROBO_NOME") || hostname(),
    navegadorCanal: (texto("NAVEGADOR_CANAL") || "chrome").toLowerCase(),
    navegadorExecutavel: texto("NAVEGADOR_EXECUTAVEL"),
    intervaloMs: numero("INTERVALO_SEGUNDOS", 30) * 1000,
    pausaEntrePedidosMs: numero("PAUSA_ENTRE_PEDIDOS_SEGUNDOS", 20) * 1000,
    esperaPessoaMs: numero("ESPERA_PESSOA_MINUTOS", 15) * 60_000,
    geracaoPdfMs: numero("GERACAO_PDF_MINUTOS", 20) * 60_000,
    capaDataJud: !/^(nao|não|0|false)$/i.test(texto("CAPA_DATAJUD")),
    pausaCapaMs: numero("PAUSA_CAPA_SEGUNDOS", 30) * 1000,
    esaj: { login, certificado: texto("ESAJ_CERTIFICADO"), usuario: texto("ESAJ_USUARIO"), senha: texto("ESAJ_SENHA") },
    eproc: { login: loginEproc, usuario: texto("EPROC_USUARIO"), senha: texto("EPROC_SENHA") },
    webhook2fa: { url: texto("ROBO_2FA_WEBHOOK_URL"), header: texto("ROBO_2FA_WEBHOOK_HEADER") || "x-robo-token", token: texto("ROBO_2FA_WEBHOOK_TOKEN") },
    pastas: { perfil: pasta("perfil"), downloads: pasta("downloads"), diagnostico: pasta("diagnostico") },
  };
}
