import { constants, createHash, privateDecrypt, publicEncrypt } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { createSecureContext } from "node:tls";

/**
 * Certificado digital A1 (.pfx) em arquivo, para o login por certificado de cliente TLS (hoje, o SSO do eproc
 * do TJSP). Só vale com o navegador aberto pelo Playwright (NAVEGADOR_MODO=playwright): o Playwright apresenta
 * o certificado ao tribunal sozinho, sem a lista de certificados do Chrome.
 *
 * Duas fontes, por variável de ambiente:
 * - simples: CERTIFICADO_PFX (caminho do .pfx) e a senha em CERTIFICADO_SENHA ou CERTIFICADO_SENHA_ARQUIVO;
 * - painel de robôs: CERTIFICADO_PASTA, onde o painel grava `certificado.json` e o .pfx (contrato em
 *   docs/easypanel.md). A senha vem cifrada com a chave pública do robô (RSA-OAEP com SHA-256); a chave privada
 *   fica em CERTIFICADO_CHAVE_PRIVADA_ARQUIVO, só no serviço do robô.
 *
 * Nada daqui vai para log, para o ORQESTRAI ou para o repositório: nem o arquivo, nem a senha, nem o titular.
 */

export interface ConfigCertificado {
  /** Caminho do .pfx (fonte simples). */
  pfx: string;
  senha: string;
  senhaArquivo: string;
  /** Pasta gravada pelo painel de robôs (fonte do painel). */
  pasta: string;
  chavePrivadaArquivo: string;
  /** Origens exatas que recebem o certificado (https://host). */
  origens: string[];
}

export interface CertificadoCliente {
  pfx: Buffer;
  senha: string;
  origens: string[];
  /** Muda quando o certificado muda: o robô reabre o navegador com o novo. */
  assinatura: string;
  /** Data de fim da validade (ISO), quando o painel informa. */
  validoAte: string;
  /** De onde veio, para o log: nome do arquivo, sem caminho e sem conteúdo. */
  origem: string;
}

/** Problema no certificado configurado. A mensagem nunca leva a senha nem o conteúdo do arquivo. */
export class FalhaDoCertificado extends Error {}

export const ARQUIVO_DO_CONTRATO = "certificado.json";
export const FORMATO_DO_CONTRATO = "orqestrai-certificado/1";

/** O que o painel de robôs grava em `certificado.json` (contrato em docs/easypanel.md). */
export interface ContratoDoPainel {
  formato: string;
  /** Nome do .pfx na mesma pasta, sem barra. */
  arquivo: string;
  /** SHA-256 do .pfx, em hexadecimal: confere que o arquivo está inteiro. */
  sha256: string;
  /** Senha do .pfx cifrada com a chave pública do robô (RSA-OAEP, SHA-256), em base64. */
  senha_cifrada: string;
  valido_ate?: string;
}

export function certificadoConfigurado(config: ConfigCertificado): boolean {
  return Boolean(config.pfx || config.pasta);
}

/** Cifra a senha para o robô (o que o painel faz). Fica aqui como referência e para os testes. */
export function cifrarSenha(senha: string, chavePublicaPem: string): string {
  return publicEncrypt({ key: chavePublicaPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(senha, "utf8")).toString("base64");
}

export function decifrarSenha(cifrada: string, chavePrivadaPem: string): string {
  try {
    return privateDecrypt({ key: chavePrivadaPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(cifrada, "base64")).toString("utf8");
  } catch {
    throw new FalhaDoCertificado("Não consegui decifrar a senha do certificado: a chave do robô (CERTIFICADO_CHAVE_PRIVADA_ARQUIVO) não é o par da chave pública usada pelo painel.");
  }
}

/** Abre o .pfx com a senha, sem guardar nada: só confere que o par arquivo e senha funciona. */
export function conferirPfx(pfx: Buffer, senha: string): void {
  try {
    createSecureContext({ pfx, passphrase: senha });
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "";
    if (/mac verify|bad decrypt|invalid password/i.test(texto)) throw new FalhaDoCertificado("A senha não abre o certificado (.pfx).");
    // .pfx exportado com cifra antiga (RC2 de 40 bits): o OpenSSL 3 do Node só abre com o provedor legado, que o
    // contêiner liga (NODE_OPTIONS=--openssl-legacy-provider no Dockerfile). Com ele ligado, sobra o .pfx sem chave.
    if (/unsupported/i.test(texto)) {
      const legado = /--openssl-legacy-provider/.test(`${process.execArgv.join(" ")} ${process.env.NODE_OPTIONS ?? ""}`);
      throw new FalhaDoCertificado(
        legado
          ? "O .pfx não tem a chave privada (só o certificado). Exporte de novo com a chave privada."
          : "O .pfx usa uma cifra antiga (RC2). Rode o robô com NODE_OPTIONS=--openssl-legacy-provider (como no Dockerfile) ou exporte o certificado de novo com AES-256."
      );
    }
    throw new FalhaDoCertificado("O arquivo do certificado não é um .pfx válido (ou usa um formato que o Node não abre).");
  }
}

/** Lê e confere o contrato do painel. Devolve o nome do .pfx e a senha cifrada. */
export function lerContrato(texto: string): ContratoDoPainel {
  let dados: Partial<ContratoDoPainel>;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new FalhaDoCertificado(`${ARQUIVO_DO_CONTRATO} não é um JSON válido (gravação pela metade?).`);
  }
  if (dados.formato !== FORMATO_DO_CONTRATO) throw new FalhaDoCertificado(`${ARQUIVO_DO_CONTRATO}: formato "${String(dados.formato)}" desconhecido (esperado ${FORMATO_DO_CONTRATO}).`);
  if (!dados.arquivo || basename(dados.arquivo) !== dados.arquivo) throw new FalhaDoCertificado(`${ARQUIVO_DO_CONTRATO}: "arquivo" deve ser só o nome do .pfx, na mesma pasta.`);
  if (!/^[0-9a-f]{64}$/i.test(dados.sha256 ?? "")) throw new FalhaDoCertificado(`${ARQUIVO_DO_CONTRATO}: "sha256" ausente ou inválido.`);
  if (!dados.senha_cifrada) throw new FalhaDoCertificado(`${ARQUIVO_DO_CONTRATO}: "senha_cifrada" ausente.`);
  return dados as ContratoDoPainel;
}

export function sha256(dados: Buffer | string): string {
  return createHash("sha256").update(dados).digest("hex");
}

/**
 * Uma impressão barata da fonte do certificado, para perceber troca sem reler o .pfx: o conteúdo do
 * contrato do painel, ou data e tamanho dos arquivos da fonte simples. Vazio quando não há certificado.
 */
export async function assinaturaDaFonte(config: ConfigCertificado): Promise<string> {
  if (config.pasta) return sha256(await readFile(join(config.pasta, ARQUIVO_DO_CONTRATO), "utf8").catch(() => ""));
  if (!config.pfx) return "";
  const partes = await Promise.all(
    [config.pfx, config.senhaArquivo].filter(Boolean).map((caminho) => stat(caminho).then((info) => `${info.mtimeMs}:${info.size}`, () => "ausente"))
  );
  return sha256(partes.join("|"));
}

/** Carrega e confere o certificado configurado. Nulo quando não há certificado configurado. */
export async function lerCertificado(config: ConfigCertificado): Promise<CertificadoCliente | null> {
  if (!certificadoConfigurado(config)) return null;
  const assinatura = await assinaturaDaFonte(config);

  if (config.pasta) {
    const texto = await readFile(join(config.pasta, ARQUIVO_DO_CONTRATO), "utf8").catch(() => {
      throw new FalhaDoCertificado(`Não há certificado enviado pelo painel (${ARQUIVO_DO_CONTRATO} não está em CERTIFICADO_PASTA).`);
    });
    const contrato = lerContrato(texto);
    const pfx = await readFile(join(config.pasta, contrato.arquivo)).catch(() => {
      throw new FalhaDoCertificado(`O painel indicou o arquivo ${contrato.arquivo}, que não está em CERTIFICADO_PASTA.`);
    });
    if (sha256(pfx) !== contrato.sha256.toLowerCase()) throw new FalhaDoCertificado("O .pfx da pasta não confere com o sha256 do painel (arquivo trocado ou gravado pela metade).");
    if (!config.chavePrivadaArquivo) throw new FalhaDoCertificado("Defina CERTIFICADO_CHAVE_PRIVADA_ARQUIVO: sem a chave do robô não há como decifrar a senha enviada pelo painel.");
    const chave = await readFile(config.chavePrivadaArquivo, "utf8").catch(() => {
      throw new FalhaDoCertificado("Não consegui ler CERTIFICADO_CHAVE_PRIVADA_ARQUIVO.");
    });
    const senha = decifrarSenha(contrato.senha_cifrada, chave);
    conferirPfx(pfx, senha);
    return { pfx, senha, origens: config.origens, assinatura, validoAte: contrato.valido_ate ?? "", origem: contrato.arquivo };
  }

  const pfx = await readFile(config.pfx).catch(() => {
    throw new FalhaDoCertificado("Não consegui ler o arquivo de CERTIFICADO_PFX.");
  });
  const senha = config.senhaArquivo
    ? (
        await readFile(config.senhaArquivo, "utf8").catch(() => {
          throw new FalhaDoCertificado("Não consegui ler CERTIFICADO_SENHA_ARQUIVO.");
        })
      ).replace(/\r?\n$/, "")
    : config.senha;
  conferirPfx(pfx, senha);
  return { pfx, senha, origens: config.origens, assinatura, validoAte: "", origem: basename(config.pfx) };
}

/** Dias até o fim da validade; nulo se a data não é conhecida. */
export function diasParaVencer(validoAte: string, agora = new Date()): number | null {
  const fim = Date.parse(validoAte);
  if (!Number.isFinite(fim)) return null;
  return Math.floor((fim - agora.getTime()) / 86_400_000);
}
