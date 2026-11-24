import { createHash } from "node:crypto";
import forge from "node-forge";
import type { BrowserContext } from "playwright";
import type { CertificadoCliente } from "./certificado.ts";
import { abrirPfxComForge, derDoCertificado, FalhaDoPjeOffice } from "./pje-office.ts";

/**
 * Web Signer imitado pelo robô, para o login por certificado no e-SAJ (TJSP, TJCE, TJAL, TJMS) sem a extensão e o
 * programa da Softplan (no servidor eles não existem).
 *
 * Como o login funciona com o Web Signer de verdade (sajcas/js/saj-certificado.js, público): a página cria
 * `new SoftplanWebSigner(licenca)` (o objeto vem de sajcas/js/softplan-websigner.js), chama init({ready}), lista os
 * certificados (listCertificates), lê o escolhido (readCertificate) e assina o hash SHA-256 que o servidor manda no
 * desafio (signHash), tudo com respostas .success()/.error(). O e-SAJ confere a assinatura com o certificado.
 *
 * Aqui, o robô troca o softplan-websigner.js por uma versão própria com as mesmas funções, que pedem ao robô (por uma
 * função exposta no navegador) a lista, o certificado e a assinatura. A chave privada fica no Node do robô; a página
 * só recebe o certificado público e a assinatura. Só atende páginas do e-SAJ dos tribunais da lista.
 */

/** Origens do e-SAJ que podem pedir certificado e assinatura ao robô. */
export const ORIGENS_ESAJ = ["https://esaj.tjsp.jus.br", "https://esaj.tjce.jus.br", "https://www2.tjal.jus.br", "https://esaj.tjms.jus.br"];
const ARQUIVO_WEB_SIGNER = "**/js/softplan-websigner.js*";
const FUNCAO_NO_NAVEGADOR = "__roboWebSigner";

export interface CertificadoDoWebSigner {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  email: string;
  validityStart: string;
  validityEnd: string;
  pkiBrazil: { cpf: string; cnpj: string; responsavel: string; dateOfBirth: string };
}

export interface AssinadorWebSigner {
  certificado: CertificadoDoWebSigner;
  /** Certificado (DER) em base64, como o readCertificate devolve. */
  certificado64: string;
  /** Assinatura PKCS#1 v1.5 de um hash já calculado (base64), em base64. */
  assinarHash(hash64: string, algoritmo?: string): string;
  /** Assinatura PKCS#1 v1.5 dos dados (base64), em base64. */
  assinarDados(dados64: string, algoritmo?: string): string;
}

const ALGORITMOS: Record<string, { forge: "sha1" | "sha256" | "sha512"; node: string; bytes: number }> = {
  "SHA-1": { forge: "sha1", node: "sha1", bytes: 20 },
  "SHA-256": { forge: "sha256", node: "sha256", bytes: 32 },
  "SHA-512": { forge: "sha512", node: "sha512", bytes: 64 },
};

function algoritmo(nome = "SHA-256") {
  const chave = nome.toUpperCase().replace(/^SHA(\d)/, "SHA-$1");
  const escolhido = ALGORITMOS[chave];
  if (!escolhido) throw new FalhaDoPjeOffice(`Algoritmo de assinatura não suportado: ${nome}.`);
  return escolhido;
}

function campo(nome: forge.pki.Certificate["subject"], atributo: string): string {
  return String(nome.getField(atributo)?.value ?? "");
}

/**
 * CPF, CNPJ, responsável e data de nascimento da ICP-Brasil, no subjectAltName (otherName): 2.16.76.1.3.1 (pessoa
 * física: nascimento ddmmaaaa + CPF), 2.16.76.1.3.3 (CNPJ), 2.16.76.1.3.2 (nome do responsável). Sem a extensão,
 * o CPF sai do nome ("NOME:12345678901"), como nos certificados da ICP-Brasil.
 */
export function dadosIcpBrasil(cert: forge.pki.Certificate): CertificadoDoWebSigner["pkiBrazil"] {
  const dados = { cpf: "", cnpj: "", responsavel: "", dateOfBirth: "" };
  try {
    const extensao = (cert.extensions as { id?: string; value?: string }[]).find((e) => e.id === "2.5.29.17");
    if (extensao?.value) {
      const nomes = forge.asn1.fromDer(forge.util.createBuffer(extensao.value));
      for (const nome of (nomes.value as forge.asn1.Asn1[]) ?? []) {
        if (nome.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC || nome.type !== 0) continue; // otherName
        const [oidAsn1, valorExplicito] = nome.value as forge.asn1.Asn1[];
        const oid = forge.asn1.derToOid(forge.util.createBuffer(oidAsn1.value as string));
        const interno = (valorExplicito?.value as forge.asn1.Asn1[])?.[0];
        const texto = typeof interno?.value === "string" ? interno.value : "";
        if (oid === "2.16.76.1.3.1" && texto.length >= 19) {
          dados.dateOfBirth = texto.slice(0, 8);
          dados.cpf = texto.slice(8, 19);
        } else if (oid === "2.16.76.1.3.3") dados.cnpj = texto.replace(/\D/g, "").slice(0, 14);
        else if (oid === "2.16.76.1.3.2") dados.responsavel = texto.trim();
      }
    }
  } catch {
    /* extensão fora do padrão: fica o que vier do nome */
  }
  if (!dados.cpf && !dados.cnpj) dados.cpf = (/:(\d{11})\b/.exec(campo(cert.subject, "CN")) ?? [])[1] ?? "";
  return dados;
}

/** Abre o .pfx e prepara o que o e-SAJ pede ao Web Signer. A senha e a chave não saem daqui. */
export function abrirAssinadorWebSigner(pfx: Buffer, senha: string): AssinadorWebSigner {
  const { chave, titular } = abrirPfxComForge(pfx, senha);
  const der = derDoCertificado(titular);
  const certificado: CertificadoDoWebSigner = {
    thumbprint: createHash("sha256").update(der).digest("base64"),
    subjectName: campo(titular.subject, "CN"),
    issuerName: campo(titular.issuer, "CN"),
    email: campo(titular.subject, "E"),
    validityStart: titular.validity.notBefore.toISOString(),
    validityEnd: titular.validity.notAfter.toISOString(),
    pkiBrazil: dadosIcpBrasil(titular),
  };
  const assinarHash = (hash64: string, nome?: string) => {
    const alg = algoritmo(nome);
    const hash = Buffer.from(hash64, "base64");
    if (hash.length !== alg.bytes) throw new FalhaDoPjeOffice(`O hash recebido não tem o tamanho de ${nome ?? "SHA-256"}.`);
    // O forge monta o DigestInfo pelo algoritmo do "resumo"; o resumo aqui já vem pronto do servidor.
    const resumo = { algorithm: alg.forge, digest: () => forge.util.createBuffer(hash.toString("binary")) } as unknown as forge.md.MessageDigest;
    return forge.util.encode64(chave.sign(resumo));
  };
  return {
    certificado,
    certificado64: der.toString("base64"),
    assinarHash,
    assinarDados: (dados64, nome) => assinarHash(createHash(algoritmo(nome).node).update(Buffer.from(dados64, "base64")).digest("base64"), nome),
  };
}

/**
 * O softplan-websigner.js do robô: as mesmas funções do original (init, listCertificates, readCertificate, signHash,
 * signData), com respostas .success()/.error(), pedindo tudo à função que o robô expõe no navegador.
 */
export const WEB_SIGNER_DO_ROBO = `/* Web Signer do robô de autos do ORQESTRAI (substitui o softplan-websigner.js). */
(function () {
  function tarefa(acao, dados) {
    var sucessos = [], erros = [], fim = null;
    var t = {
      success: function (cb) { if (fim && fim.ok) cb(fim.valor); else if (!fim) sucessos.push(cb); return t; },
      error: function (cb) { if (fim && !fim.ok) cb(fim.msg, fim.msg, "robo-web-signer"); else if (!fim) erros.push(cb); return t; }
    };
    t.fail = t.error;
    var chamar = window.${FUNCAO_NO_NAVEGADOR};
    if (typeof chamar !== "function") { setTimeout(function () { fim = { ok: false, msg: "Web Signer do robô indisponível" }; erros.forEach(function (cb) { cb(fim.msg, fim.msg, "robo-web-signer"); }); }, 0); return t; }
    chamar(acao, dados || null).then(function (valor) {
      if (acao === "listar") valor = valor.map(function (c) { c.validityStart = new Date(c.validityStart); c.validityEnd = new Date(c.validityEnd); return c; });
      fim = { ok: true, valor: valor };
      sucessos.forEach(function (cb) { cb(valor); });
    }, function (e) {
      fim = { ok: false, msg: String((e && e.message) || e) };
      erros.forEach(function (cb) { cb(fim.msg, fim.msg, "robo-web-signer"); });
    });
    return t;
  }
  function WebSignerDoRobo(licenca) { this.licenca = licenca; }
  WebSignerDoRobo.prototype.init = function (o) {
    o = o || {};
    setTimeout(function () {
      if (typeof window.${FUNCAO_NO_NAVEGADOR} === "function") { if (o.ready) o.ready(); }
      else if (o.notInstalled) o.notInstalled(1);
    }, 0);
  };
  WebSignerDoRobo.prototype.listCertificates = function () { return tarefa("listar"); };
  WebSignerDoRobo.prototype.readCertificate = function (thumbprint) { return tarefa("ler", { thumbprint: thumbprint }); };
  WebSignerDoRobo.prototype.signHash = function (o) { return tarefa("assinarHash", { thumbprint: o.thumbprint, hash: o.hash, digestAlgorithm: o.digestAlgorithm }); };
  WebSignerDoRobo.prototype.signData = function (o) { return tarefa("assinarDados", { thumbprint: o.thumbprint, data: o.data, digestAlgorithm: o.digestAlgorithm }); };
  WebSignerDoRobo.prototype.redirectToInstallPage = function () {};
  window.SoftplanWebSigner = WebSignerDoRobo;
  window.LacunaWebPKI = WebSignerDoRobo;
})();
`;

export interface OpcoesWebSigner {
  registrar: (mensagem: string) => void;
  origens?: string[];
}

/** Liga o Web Signer do robô. Falso (e nada muda) se o certificado não abrir aqui: o login do e-SAJ fica com a pessoa. */
export async function instalarWebSigner(contexto: BrowserContext, certificado: CertificadoCliente, opcoes: OpcoesWebSigner): Promise<boolean> {
  const { registrar } = opcoes;
  const origens = opcoes.origens ?? ORIGENS_ESAJ;
  let assinador: AssinadorWebSigner;
  try {
    assinador = abrirAssinadorWebSigner(certificado.pfx, certificado.senha);
  } catch (erro) {
    registrar(`Web Signer do robô desligado: ${erro instanceof FalhaDoPjeOffice ? erro.message : "não consegui preparar o certificado."}`);
    return false;
  }

  await contexto.route(ARQUIVO_WEB_SIGNER, async (route) => {
    let origem = "";
    try {
      origem = new URL(route.request().url()).origin;
    } catch {
      /* recusa abaixo */
    }
    // Fora do e-SAJ, o arquivo original segue (o robô não mexe em outro site).
    if (!origens.includes(origem)) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: WEB_SIGNER_DO_ROBO, headers: { "Cache-Control": "no-store" } });
  });

  let avisouAssinatura = false;
  await contexto.exposeBinding(FUNCAO_NO_NAVEGADOR, async (fonte, acao: string, dados: { thumbprint?: string; hash?: string; data?: string; digestAlgorithm?: string } | null) => {
    let origem = "";
    try {
      origem = new URL(fonte.frame.url()).origin;
    } catch {
      /* recusa abaixo */
    }
    if (!origens.includes(origem)) throw new Error("O Web Signer do robô só atende o e-SAJ.");
    const doRobo = !dados?.thumbprint || dados.thumbprint === assinador.certificado.thumbprint;
    if (acao === "listar") return [assinador.certificado];
    if (!doRobo) throw new Error("Certificado desconhecido.");
    if (acao === "ler") return assinador.certificado64;
    if (acao === "assinarHash" || acao === "assinarDados") {
      const assinatura = acao === "assinarHash" ? assinador.assinarHash(dados?.hash ?? "", dados?.digestAlgorithm) : assinador.assinarDados(dados?.data ?? "", dados?.digestAlgorithm);
      if (!avisouAssinatura) {
        avisouAssinatura = true;
        registrar(`Web Signer do robô: certificado apresentado ao e-SAJ (${new URL(origem).hostname}).`);
      }
      return assinatura;
    }
    throw new Error(`Pedido desconhecido ao Web Signer do robô: ${acao}.`);
  });
  return true;
}
