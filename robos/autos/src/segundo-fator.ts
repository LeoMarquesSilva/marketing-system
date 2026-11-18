import { constants, createHmac, privateDecrypt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as dormir } from "node:timers/promises";

/**
 * Código de 2 fatores (TOTP, RFC 6238) gerado pelo próprio robô a partir do segredo que a equipe cadastra no
 * painel de robôs (o "código para gerar o OTP" que o eproc mostra junto do QR code ao ligar o 2FA).
 *
 * O eproc usa o TOTP padrão dos aplicativos de autenticação (Google/Microsoft Authenticator): 6 dígitos, novo
 * código a cada 30 s, HMAC-SHA1. Se o painel gravar a URI completa do QR code (otpauth://totp/...), valem os
 * parâmetros dela (algorithm, digits, period).
 *
 * Contrato (docs/easypanel.md): o painel grava `segundo-fator.json` na mesma pasta do certificado, com o segredo
 * de cada sistema cifrado com a chave pública do robô (RSA-OAEP com SHA-256, o mesmo do certificado). Só a chave
 * privada do robô decifra. O arquivo é lido a cada login: trocar o segredo no painel não exige reiniciar.
 *
 * O segredo e o código nunca vão para log, diagnóstico, captura de tela ou mensagem de erro.
 */

export interface ConfigSegundoFator {
  /** Pasta gravada pelo painel (ROBO_2FA_PASTA; sem ela, CERTIFICADO_PASTA). Vazia = sem segredo do painel. */
  pasta: string;
  /** Chave privada do robô (CERTIFICADO_CHAVE_PRIVADA_ARQUIVO): a mesma que decifra a senha do certificado. */
  chavePrivadaArquivo: string;
}

export const ARQUIVO_DO_SEGUNDO_FATOR = "segundo-fator.json";
export const FORMATO_DO_SEGUNDO_FATOR = "orqestrai-segundo-fator/1";

/** O que o painel grava em `segundo-fator.json`, um item por sistema ("eproc" = TJSP, "eproc-tjrj"). */
export interface ContratoDoSegundoFator {
  formato: string;
  sistemas: Record<string, { segredo_cifrado: string; enviado_em?: string; enviado_por?: string }>;
}

export type AlgoritmoTotp = "sha1" | "sha256" | "sha512";

export interface SegredoTotp {
  chave: Buffer;
  algoritmo: AlgoritmoTotp;
  digitos: number;
  periodoSegundos: number;
}

/** Problema no segredo ou no contrato. A mensagem nunca leva o segredo nem o código. */
export class FalhaDoSegundoFator extends Error {}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Base32 da RFC 4648, como os aplicativos de autenticação mostram (aceita minúsculas, espaços, hífens e "="). */
export function decodificarBase32(texto: string): Buffer {
  const limpo = texto.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  if (!limpo || /[^A-Z2-7]/.test(limpo)) throw new FalhaDoSegundoFator("O segredo do 2FA não está em base32 (letras A–Z e dígitos 2–7).");
  let acumulado = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const letra of limpo) {
    acumulado = (acumulado << 5) | BASE32.indexOf(letra);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulado >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/**
 * Lê o segredo como o painel o grava: o código base32 que o eproc mostra, ou a URI otpauth://totp/... do QR code.
 * Exige pelo menos 80 bits (16 caracteres base32), o mínimo que os tribunais usam.
 */
export function lerSegredoTotp(texto: string): SegredoTotp {
  const valor = texto.trim();
  let base32 = valor;
  let algoritmo: AlgoritmoTotp = "sha1";
  let digitos = 6;
  let periodoSegundos = 30;
  if (/^otpauth:/i.test(valor)) {
    let uri: URL;
    try {
      uri = new URL(valor);
    } catch {
      throw new FalhaDoSegundoFator("A URI otpauth do 2FA é inválida.");
    }
    if (uri.host.toLowerCase() !== "totp") throw new FalhaDoSegundoFator("A URI do 2FA não é TOTP (otpauth://totp/...).");
    base32 = uri.searchParams.get("secret") ?? "";
    const nome = (uri.searchParams.get("algorithm") ?? "SHA1").toLowerCase();
    if (nome !== "sha1" && nome !== "sha256" && nome !== "sha512") throw new FalhaDoSegundoFator("Algoritmo do 2FA desconhecido (esperado SHA1, SHA256 ou SHA512).");
    algoritmo = nome;
    digitos = Number(uri.searchParams.get("digits") ?? 6);
    periodoSegundos = Number(uri.searchParams.get("period") ?? 30);
    if (![6, 7, 8].includes(digitos)) throw new FalhaDoSegundoFator("Quantidade de dígitos do 2FA inválida (6 a 8).");
    if (!Number.isInteger(periodoSegundos) || periodoSegundos < 15 || periodoSegundos > 120) throw new FalhaDoSegundoFator("Período do 2FA inválido.");
  }
  const chave = decodificarBase32(base32);
  if (chave.length < 10) throw new FalhaDoSegundoFator("O segredo do 2FA é curto demais (mínimo de 16 caracteres base32).");
  return { chave, algoritmo, digitos, periodoSegundos };
}

/** HOTP (RFC 4226) do contador. */
export function gerarHotp(chave: Buffer, contador: number, digitos = 6, algoritmo: AlgoritmoTotp = "sha1"): string {
  const mensagem = Buffer.alloc(8);
  mensagem.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac(algoritmo, chave).update(mensagem).digest();
  const deslocamento = hmac[hmac.length - 1] & 0x0f;
  const binario = hmac.readUInt32BE(deslocamento) & 0x7fffffff;
  return String(binario % 10 ** digitos).padStart(digitos, "0");
}

/** TOTP (RFC 6238) do instante, com T0 = 0. */
export function gerarTotp(segredo: SegredoTotp, instanteMs = Date.now()): string {
  return gerarHotp(segredo.chave, Math.floor(instanteMs / 1000 / segredo.periodoSegundos), segredo.digitos, segredo.algoritmo);
}

/** Quanto falta para o código do instante trocar. */
export function msParaTrocar(segredo: SegredoTotp, instanteMs = Date.now()): number {
  const periodoMs = segredo.periodoSegundos * 1000;
  return periodoMs - (instanteMs % periodoMs);
}

/**
 * Confere se o segredo gera o código que o aplicativo do advogado mostra agora, aceitando a janela anterior e a
 * seguinte (±1 período). É a conferência que o painel faz antes de gravar o segredo; fica aqui como referência.
 */
export function conferirCodigo(segredo: SegredoTotp, codigo: string, instanteMs = Date.now()): boolean {
  const informado = codigo.replace(/\D/g, "");
  const periodoMs = segredo.periodoSegundos * 1000;
  return [-1, 0, 1].some((desvio) => gerarTotp(segredo, instanteMs + desvio * periodoMs) === informado);
}

export function lerContratoDoSegundoFator(texto: string): ContratoDoSegundoFator {
  let dados: Partial<ContratoDoSegundoFator>;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new FalhaDoSegundoFator(`${ARQUIVO_DO_SEGUNDO_FATOR} não é um JSON válido (gravação pela metade?).`);
  }
  if (dados.formato !== FORMATO_DO_SEGUNDO_FATOR) throw new FalhaDoSegundoFator(`${ARQUIVO_DO_SEGUNDO_FATOR}: formato "${String(dados.formato)}" desconhecido (esperado ${FORMATO_DO_SEGUNDO_FATOR}).`);
  if (!dados.sistemas || typeof dados.sistemas !== "object" || Array.isArray(dados.sistemas)) throw new FalhaDoSegundoFator(`${ARQUIVO_DO_SEGUNDO_FATOR}: "sistemas" ausente.`);
  return dados as ContratoDoSegundoFator;
}

function decifrarSegredo(cifrado: string, chavePrivadaPem: string): string {
  try {
    return privateDecrypt({ key: chavePrivadaPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(cifrado, "base64")).toString("utf8");
  } catch {
    throw new FalhaDoSegundoFator("Não consegui decifrar o segredo do 2FA: a chave do robô (CERTIFICADO_CHAVE_PRIVADA_ARQUIVO) não é o par da chave pública usada pelo painel.");
  }
}

/**
 * O segredo do sistema cadastrado no painel, já decifrado. Nulo quando não há pasta configurada, o painel ainda
 * não gravou nada ou não há segredo para esse sistema. Lança FalhaDoSegundoFator quando a configuração está quebrada.
 */
export async function segredoDoPainel(config: ConfigSegundoFator, sistema: string): Promise<SegredoTotp | null> {
  if (!config.pasta) return null;
  const texto = await readFile(join(config.pasta, ARQUIVO_DO_SEGUNDO_FATOR), "utf8").catch(() => null);
  if (texto === null) return null;
  const item = lerContratoDoSegundoFator(texto).sistemas[sistema];
  if (!item?.segredo_cifrado) return null;
  if (!config.chavePrivadaArquivo) throw new FalhaDoSegundoFator("Defina CERTIFICADO_CHAVE_PRIVADA_ARQUIVO: sem a chave do robô não há como decifrar o segredo do 2FA enviado pelo painel.");
  const chave = await readFile(config.chavePrivadaArquivo, "utf8").catch(() => {
    throw new FalhaDoSegundoFator("Não consegui ler CERTIFICADO_CHAVE_PRIVADA_ARQUIVO.");
  });
  return lerSegredoTotp(decifrarSegredo(item.segredo_cifrado, chave));
}

export interface TentativaPeloPainel {
  config: ConfigSegundoFator;
  /** Sistema no contrato: "eproc" (TJSP) ou "eproc-tjrj". */
  sistema: string;
  /** Digita o código na tela e confirma; devolve se o login entrou. */
  digitar: (codigo: string) => Promise<boolean>;
  registrar: (mensagem: string) => void;
  agora?: () => number;
  esperar?: (ms: number) => Promise<unknown>;
}

/** Abaixo disto o código pode vencer entre digitar e o tribunal conferir: espera o próximo. */
const MARGEM_MS = 5_000;

/**
 * Tenta o login com o código gerado pelo segredo do painel. Usa dois códigos no máximo (de janelas diferentes:
 * nunca repete um código recusado) e devolve se o login entrou. Sem segredo para o sistema, devolve falso sem
 * tentar, e o robô segue para o webhook ou para a pessoa.
 */
export async function entrarComCodigoDoPainel(tentativa: TentativaPeloPainel): Promise<boolean> {
  const { registrar } = tentativa;
  const agora = tentativa.agora ?? Date.now;
  const esperar = tentativa.esperar ?? dormir;
  let segredo: SegredoTotp | null;
  try {
    segredo = await segredoDoPainel(tentativa.config, tentativa.sistema);
  } catch (erro) {
    registrar(`Segredo do 2FA do painel não usado: ${erro instanceof FalhaDoSegundoFator ? erro.message : "erro ao ler a pasta do painel."}`);
    return false;
  }
  if (!segredo) return false;

  for (let vez = 0; vez < 2; vez += 1) {
    const falta = msParaTrocar(segredo, agora());
    if (vez > 0 || falta < MARGEM_MS) await esperar(falta + 1_000);
    if (await tentativa.digitar(gerarTotp(segredo, agora()))) {
      registrar("Código de 2 fatores gerado pelo segredo do painel e aceito. Login concluído.");
      return true;
    }
  }
  registrar(`O código gerado pelo segredo do painel (${tentativa.sistema}) não foi aceito: confira o segredo no painel de robôs e o relógio do servidor.`);
  return false;
}
