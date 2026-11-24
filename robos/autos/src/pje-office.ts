import forge from "node-forge";
import type { BrowserContext, Route } from "playwright";
import type { CertificadoCliente } from "./certificado.ts";

/**
 * PJe Office imitado pelo robô, para o login por certificado no SSO da PDPJ (jus.br, usado pelo PJe) sem o
 * programa instalado (no servidor ele não existe).
 *
 * Como o login funciona com o PJe Office de verdade: o botão "CERTIFICADO DIGITAL" do SSO chama
 * http://localhost:8800/pjeOffice/requisicao/?r=<json> por uma imagem. O PJe Office assina a "mensagem" do desafio
 * com o certificado (MD5withRSA) e manda {uuid, mensagem, assinatura, certChain} por POST, em JSON, para
 * `servidor + enviarPara` (o /pjeoffice-rest do SSO). A imagem responde 1×1 (deu certo) ou 2×1 (erro), e a página
 * envia o formulário com o token. Formato conferido no código do PJe Office Pro (signer4j-pje: PjeAutenticadorSSOTask
 * e PjeClient; a cadeia vai em PkiPath, base64).
 *
 * Aqui, o robô intercepta esse endereço dentro do próprio navegador (context.route) e faz o papel do PJe Office com
 * o certificado A1 do painel. Só atende pedidos de servidores da lista (o SSO da PDPJ), feitos por uma página desse
 * mesmo servidor: outra página não consegue fazer o robô assinar nada nem mandar o certificado para outro lugar.
 * Nada daqui vai para log além do resultado (nem a mensagem assinada, nem o token).
 */

export const SERVIDORES_PJE_OFFICE = ["https://sso.cloud.pje.jus.br/auth/realms/pje"];
export const ENDERECO_PJE_OFFICE = "http://localhost:8800/pjeOffice/**";
/** Versão anunciada no cabeçalho "versao", como o PJe Office Pro. */
const VERSAO_PJE_OFFICE = "2.5.16";

// GIF 1×1 (sucesso) e 2×1 (erro): a página decide pelo tamanho da imagem (this.width == 2 é erro).
const GIF_OK = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const GIF_ERRO = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x04, 0x0a, 0x00, 0x3b,
]);

export class FalhaDoPjeOffice extends Error {}

export interface AssinadorPjeOffice {
  /** Assinatura MD5withRSA da mensagem (UTF-8), em base64. */
  assinar(mensagem: string): string;
  /** Cadeia do certificado em PkiPath (da autoridade raiz até o titular), em base64. */
  cadeia64: string;
}

/** Abre o .pfx (inclusive com a cifra antiga RC2) e prepara a assinatura. A senha não sai daqui. */
/** Chave, certificado do titular e cadeia (do titular até onde o arquivo tiver), lidos do .pfx (inclusive RC2). */
export interface PfxAberto {
  chave: forge.pki.rsa.PrivateKey;
  titular: forge.pki.Certificate;
  cadeia: forge.pki.Certificate[];
}

export function abrirPfxComForge(pfx: Buffer, senha: string): PfxAberto {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary"))), senha);
  } catch {
    throw new FalhaDoPjeOffice("Não consegui abrir o certificado (senha ou arquivo inválido).");
  }
  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const chave = chaves.find((bag) => bag.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!chave) throw new FalhaDoPjeOffice("O certificado não tem chave privada RSA.");
  const certificados = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => Boolean(cert));
  const titular = certificados.find((cert) => {
    const publica = cert.publicKey as forge.pki.rsa.PublicKey;
    return publica.n?.equals(chave.n);
  });
  if (!titular) throw new FalhaDoPjeOffice("O certificado do titular não está no arquivo.");

  // Cadeia do titular até onde o arquivo tiver (cada emissor pelo nome).
  const cadeia = [titular];
  for (let atual = titular; cadeia.length < 10; ) {
    if (atual.isIssuer(atual)) break; // autoassinado: a raiz
    const emissor = certificados.find((cert) => !cadeia.includes(cert) && cert.subject.hash === atual.issuer.hash);
    if (!emissor) break;
    cadeia.push(emissor);
    atual = emissor;
  }
  return { chave, titular, cadeia };
}

/** DER do certificado. */
export function derDoCertificado(cert: forge.pki.Certificate): Buffer {
  return Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
}

export function abrirAssinador(pfx: Buffer, senha: string): AssinadorPjeOffice {
  const { chave, cadeia } = abrirPfxComForge(pfx, senha);
  return {
    assinar(mensagem: string): string {
      const resumo = forge.md.md5.create();
      resumo.update(mensagem, "utf8");
      return forge.util.encode64(chave.sign(resumo));
    },
    cadeia64: cadeiaPkiPath(cadeia.map(derDoCertificado)),
  };
}

/** PkiPath (RFC 3279 / Java CertPath "PkiPath"): SEQUENCE OF Certificate, da raiz até o titular. Recebe titular primeiro. */
export function cadeiaPkiPath(derDoTitularAteARaiz: Buffer[]): string {
  const itens = [...derDoTitularAteARaiz].reverse().map((der) => forge.asn1.fromDer(forge.util.createBuffer(der.toString("binary"))));
  const sequencia = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, itens);
  return forge.util.encode64(forge.asn1.toDer(sequencia).getBytes());
}

export interface RequisicaoPjeOffice {
  sessao: string;
  servidor: string;
  tarefaId: string;
  tarefa: { enviarPara: string; mensagem: string; token: string };
}

/** Lê o ?r= do pedido da página (JSON, com a tarefa em JSON dentro). Nulo se não for um pedido válido. */
export function lerRequisicao(url: string): RequisicaoPjeOffice | null {
  try {
    const r = JSON.parse(new URL(url).searchParams.get("r") ?? "");
    const tarefa = typeof r.tarefa === "string" ? JSON.parse(r.tarefa) : r.tarefa;
    if (typeof r.servidor !== "string" || typeof r.tarefaId !== "string" || !tarefa) return null;
    if (typeof tarefa.enviarPara !== "string" || typeof tarefa.mensagem !== "string" || typeof tarefa.token !== "string") return null;
    return { sessao: typeof r.sessao === "string" ? r.sessao : "", servidor: r.servidor.replace(/\/+$/, ""), tarefaId: r.tarefaId, tarefa };
  } catch {
    return null;
  }
}

/** O pedido é do SSO autorizado, feito por uma página dele, e manda o resultado para ele mesmo? */
export function pedidoAutorizado(pedido: RequisicaoPjeOffice, origemDaPagina: string, servidores = SERVIDORES_PJE_OFFICE): boolean {
  if (!servidores.includes(pedido.servidor)) return false;
  const origemDoServidor = new URL(pedido.servidor).origin;
  if (origemDaPagina !== origemDoServidor) return false;
  if (!pedido.tarefa.enviarPara.startsWith("/") || pedido.tarefa.enviarPara.startsWith("//")) return false;
  return new URL(pedido.servidor + pedido.tarefa.enviarPara).origin === origemDoServidor;
}

/** Envia a assinatura ao SSO e devolve o status HTTP. */
export type EnviarAssinatura = (url: string, corpo: string, cabecalhos: Record<string, string>) => Promise<number>;

export interface OpcoesPjeOffice {
  registrar: (mensagem: string) => void;
  servidores?: string[];
  /** Para testes. Sem ele, o envio sai pelo próprio navegador (contexto.request): mesmo proxy e mesma sessão. */
  enviar?: EnviarAssinatura;
}

/**
 * Liga o PJe Office imitado no navegador do robô. Devolve falso (e não liga) se o certificado não abrir aqui; o
 * login por certificado no jus.br fica, então, com a pessoa.
 */
export async function instalarPjeOffice(contexto: BrowserContext, certificado: CertificadoCliente, opcoes: OpcoesPjeOffice): Promise<boolean> {
  const { registrar } = opcoes;
  const servidores = opcoes.servidores ?? SERVIDORES_PJE_OFFICE;
  // A assinatura sai pelo navegador, e não pelo fetch do Node: com NAVEGADOR_PROXY (o WARP, contra o bloqueio do
  // CloudFront ao IP do servidor), o SSO vê o mesmo endereço do login e recebe os cookies da sessão.
  const enviar: EnviarAssinatura =
    opcoes.enviar ??
    (async (url, corpo, cabecalhos) => (await contexto.request.post(url, { data: corpo, headers: cabecalhos, timeout: 20_000 })).status());
  let assinador: AssinadorPjeOffice;
  try {
    assinador = abrirAssinador(certificado.pfx, certificado.senha);
  } catch (erro) {
    registrar(`PJe Office do robô desligado: ${erro instanceof FalhaDoPjeOffice ? erro.message : "não consegui preparar o certificado."}`);
    return false;
  }

  const responderImagem = (route: Route, ok: boolean) =>
    route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: ok ? GIF_OK : GIF_ERRO,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Private-Network": "true", "Cache-Control": "no-store" },
    });

  await contexto.route(ENDERECO_PJE_OFFICE, async (route) => {
    const pedidoHttp = route.request();
    if (pedidoHttp.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Private-Network": "true", "Access-Control-Allow-Methods": "GET" },
      });
    }
    const url = pedidoHttp.url();
    // Verificação de disponibilidade (http://localhost:8800/pjeOffice/?&u=…): o PJe Office "está aberto".
    if (!url.includes("/pjeOffice/requisicao/")) return responderImagem(route, true);

    const pedido = lerRequisicao(url);
    let origemDaPagina = "";
    try {
      origemDaPagina = new URL(pedidoHttp.frame().url()).origin;
    } catch {
      /* sem página: recusa abaixo */
    }
    if (!pedido || pedido.tarefaId !== "sso.autenticador" || !pedidoAutorizado(pedido, origemDaPagina, servidores)) {
      registrar("PJe Office do robô recusou um pedido que não é o login do SSO da PDPJ.");
      return responderImagem(route, false);
    }
    try {
      const status = await enviar(
        pedido.servidor + pedido.tarefa.enviarPara,
        JSON.stringify({
          uuid: pedido.tarefa.token,
          mensagem: pedido.tarefa.mensagem,
          assinatura: assinador.assinar(pedido.tarefa.mensagem),
          certChain: assinador.cadeia64,
        }),
        {
          "Content-Type": "application/json",
          Accept: "application/json",
          versao: VERSAO_PJE_OFFICE,
          "User-Agent": (await pedidoHttp.headerValue("user-agent")) ?? "Mozilla/5.0",
        }
      );
      if (status < 200 || status >= 300) {
        registrar(`PJe Office do robô: o SSO da PDPJ recusou a assinatura (HTTP ${status}).`);
        return responderImagem(route, false);
      }
      registrar("PJe Office do robô: certificado apresentado ao SSO da PDPJ.");
      return responderImagem(route, true);
    } catch {
      registrar("PJe Office do robô: não consegui falar com o SSO da PDPJ.");
      return responderImagem(route, false);
    }
  });
  return true;
}
