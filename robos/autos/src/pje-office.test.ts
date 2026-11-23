import { execFileSync } from "node:child_process";
import { X509Certificate, createPublicKey, verify } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import forge from "node-forge";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { abrirAssinador, cadeiaPkiPath, instalarPjeOffice, lerRequisicao, pedidoAutorizado, SERVIDORES_PJE_OFFICE } from "./pje-office";

// Só certificados de teste, gerados aqui pelo openssl: uma autoridade e um titular fictícios.
let pasta = "";
let temOpenssl = true;
const senha = "senha-de-teste";

function openssl(...args: string[]) {
  execFileSync("openssl", args, { cwd: pasta, stdio: "ignore" });
}

beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), "pje-office-"));
  try {
    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ac.key", "-out", "ac.pem", "-days", "30", "-subj", "/CN=AC DE TESTE");
    openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "titular.key", "-out", "titular.csr", "-subj", "/CN=TITULAR DE TESTE");
    openssl("x509", "-req", "-in", "titular.csr", "-CA", "ac.pem", "-CAkey", "ac.key", "-CAcreateserial", "-out", "titular.pem", "-days", "30");
    openssl("pkcs12", "-export", "-inkey", "titular.key", "-in", "titular.pem", "-certfile", "ac.pem", "-out", "aes.pfx", "-passout", `pass:${senha}`, "-keypbe", "AES-256-CBC", "-certpbe", "AES-256-CBC");
    openssl("pkcs12", "-export", "-inkey", "titular.key", "-in", "titular.pem", "-certfile", "ac.pem", "-out", "rc2.pfx", "-passout", `pass:${senha}`, "-certpbe", "PBE-SHA1-RC2-40", "-keypbe", "PBE-SHA1-3DES");
  } catch {
    temOpenssl = false;
  }
});
afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

/** Confere uma assinatura como o SSO: MD5withRSA com a chave do primeiro certificado do titular na cadeia. */
function conferir(mensagem: string, assinatura64: string, cadeia64: string): { ok: boolean; titular: string; emissores: string[] } {
  const seq = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(cadeia64, "base64").toString("binary")));
  const ders = (seq.value as forge.asn1.Asn1[]).map((item) => Buffer.from(forge.asn1.toDer(item).getBytes(), "binary"));
  const certs = ders.map((der) => new X509Certificate(der));
  const titular = certs[certs.length - 1]; // PkiPath: da raiz até o titular
  const ok = verify("md5", Buffer.from(mensagem, "utf8"), createPublicKey(titular.publicKey.export({ type: "spki", format: "pem" })), Buffer.from(assinatura64, "base64"));
  return { ok, titular: titular.subject, emissores: certs.slice(0, -1).map((c) => c.subject) };
}

describe("assinatura do PJe Office", () => {
  // it.for (e não it.each) passa o contexto do teste como 2º argumento, para o ctx.skip() sem OpenSSL.
  it.for(["aes.pfx", "rc2.pfx"])("%s: assina a mensagem (MD5withRSA) e manda a cadeia em PkiPath, da raiz ao titular", async (arquivo, ctx) => {
    if (!temOpenssl) return ctx.skip();
    const assinador = abrirAssinador(await readFile(join(pasta, arquivo)), senha);
    const conferido = conferir("0.abc123", assinador.assinar("0.abc123"), assinador.cadeia64);
    expect(conferido.ok).toBe(true);
    expect(conferido.titular).toMatch(/TITULAR DE TESTE/);
    expect(conferido.emissores.join()).toMatch(/AC DE TESTE/);
    expect(conferir("outra", assinador.assinar("0.abc123"), assinador.cadeia64).ok).toBe(false);
  });

  it("senha errada é recusada sem citar a senha", async (ctx) => {
    if (!temOpenssl) return ctx.skip();
    expect(() => abrirAssinador(Buffer.from("lixo"), senha)).toThrow(/não consegui abrir/i);
    try {
      abrirAssinador(await readFile(join(pasta, "aes.pfx")), "errada");
    } catch (erro) {
      expect((erro as Error).message).not.toContain("errada");
    }
  });

  it("PkiPath vazio de titular só: uma SEQUENCE com um certificado", () => {
    const der = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x05]); // um INTEGER dentro de SEQUENCE, só para a estrutura
    expect(Buffer.from(cadeiaPkiPath([der]), "base64").toString("hex")).toBe("3005" + der.toString("hex"));
  });
});

describe("pedido da página", () => {
  const pedido = (servidor: string, enviarPara = "/pjeoffice-rest") =>
    `http://localhost:8800/pjeOffice/requisicao/?r=${encodeURIComponent(
      JSON.stringify({ sessao: "a=1", aplicacao: "PJe", servidor, codigoSeguranca: "x", tarefaId: "sso.autenticador", tarefa: JSON.stringify({ enviarPara, mensagem: "0.m", token: "t-1" }) })
    )}&u=1`;
  const sso = SERVIDORES_PJE_OFFICE[0];

  it("lê o JSON com a tarefa dentro", () => {
    expect(lerRequisicao(pedido(sso))).toMatchObject({ servidor: sso, tarefaId: "sso.autenticador", tarefa: { token: "t-1", mensagem: "0.m" } });
    expect(lerRequisicao("http://localhost:8800/pjeOffice/requisicao/?r=lixo")).toBeNull();
  });

  it("só atende o SSO da PDPJ, pedido por uma página dele, mandando o resultado para ele mesmo", () => {
    const origem = new URL(sso).origin;
    expect(pedidoAutorizado(lerRequisicao(pedido(sso))!, origem)).toBe(true);
    expect(pedidoAutorizado(lerRequisicao(pedido(sso))!, "https://site-qualquer.example")).toBe(false);
    expect(pedidoAutorizado(lerRequisicao(pedido("https://site-qualquer.example/auth/realms/pje"))!, "https://site-qualquer.example")).toBe(false);
    expect(pedidoAutorizado(lerRequisicao(pedido(sso, "//site-qualquer.example/x"))!, origem)).toBe(false);
    expect(pedidoAutorizado(lerRequisicao(pedido(sso, "https://site-qualquer.example/x"))!, origem)).toBe(false);
  });
});

describe("login de ponta a ponta com um SSO de teste", () => {
  let servidor: Server;
  let base = "";
  const recebidos: { uuid: string; ok: boolean }[] = [];
  const validados = new Set<string>();

  beforeAll(async () => {
    // Imita o SSO: a página de login com o botão que chama o PJe Office (mesmo protocolo), o /pjeoffice-rest que
    // confere a assinatura e o formulário que só entra com um token validado.
    servidor = createServer((req, res) => {
      const url = new URL(req.url ?? "/", base || "http://127.0.0.1");
      if (req.method === "POST" && url.pathname === "/auth/realms/pje/pjeoffice-rest") {
        let corpo = "";
        req.on("data", (p) => (corpo += p));
        req.on("end", () => {
          const dados = JSON.parse(corpo);
          const ok = conferir(dados.mensagem, dados.assinatura, dados.certChain).ok && dados.mensagem === "0.desafio";
          recebidos.push({ uuid: dados.uuid, ok });
          if (ok) validados.add(dados.uuid);
          res.writeHead(ok ? 200 : 400).end();
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/auth/realms/pje/login") {
        let corpo = "";
        req.on("data", (p) => (corpo += p));
        req.on("end", () => {
          const token = new URLSearchParams(corpo).get("pjeoffice-code") ?? "";
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(validados.has(token) ? "<p id=r>logado</p>" : "<p id=r>recusado</p>");
        });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html><form method="post" action="/auth/realms/pje/login">
<input type="hidden" id="pjeoffice-code" name="pjeoffice-code" value="">
<input type="button" id="kc-pje-office" value="CERTIFICADO DIGITAL" onclick="autenticar('cod', '0.desafio')"></form>
<script>
function autenticar(codigoSeguranca, mensagem) {
  var token = "tok-" + Math.random().toString(16).slice(2);
  var r = { sessao: document.cookie, aplicacao: "PJe", servidor: location.origin + "/auth/realms/pje", codigoSeguranca: codigoSeguranca,
            tarefaId: "sso.autenticador", tarefa: JSON.stringify({ enviarPara: "/pjeoffice-rest", mensagem: mensagem, token: token }) };
  var img = new Image();
  img.onload = function () { if (this.width == 2) { document.title = "erro"; } else { document.getElementById("pjeoffice-code").value = token; document.forms[0].submit(); } };
  img.onerror = function () { document.title = "indisponivel"; };
  img.src = "http://localhost:8800/pjeOffice/requisicao/?r=" + encodeURIComponent(JSON.stringify(r)) + "&u=" + Date.now();
}
</script>`);
    });
    await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()));
    const endereco = servidor.address();
    base = `http://127.0.0.1:${typeof endereco === "object" && endereco ? endereco.port : 0}`;
  });
  afterAll(() => new Promise<void>((r) => servidor.close(() => r())));

  it("o robô assina, o SSO valida e o formulário entra; sem o servidor na lista, recusa", async (ctx) => {
    if (!temOpenssl) return ctx.skip();
    const { chromium } = await import("playwright");
    let navegador;
    try {
      // O Chromium do Playwright ou, sem ele, o Google Chrome instalado (perfil temporário, nunca o do robô).
      navegador = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: "chrome" }));
    } catch (erro) {
      console.warn(`Chromium do Playwright indisponível: ${(erro as Error).message.split("\n")[0]}`);
      return ctx.skip();
    }
    try {
      const pfx = await readFile(join(pasta, "rc2.pfx"));
      const certificado = { pfx, senha, origens: [], assinatura: "", validoAte: "", origem: "teste" };
      const log: string[] = [];

      const contexto = await navegador.newContext();
      expect(await instalarPjeOffice(contexto, certificado, { registrar: (m) => log.push(m), servidores: [`${base}/auth/realms/pje`] })).toBe(true);
      const pagina = await contexto.newPage();
      await pagina.goto(`${base}/auth/realms/pje/protocol/openid-connect/auth`);
      await pagina.click("#kc-pje-office");
      await pagina.waitForSelector("#r");
      expect(await pagina.textContent("#r")).toBe("logado");
      expect(recebidos.at(-1)?.ok).toBe(true);
      expect(log.join("\n")).toMatch(/certificado apresentado/);
      expect(log.join("\n")).not.toMatch(/0\.desafio|tok-/);
      await contexto.close();

      // Servidor fora da lista: o robô não assina e a página recebe "erro".
      const outro = await navegador.newContext();
      await instalarPjeOffice(outro, certificado, { registrar: () => undefined });
      const p2 = await outro.newPage();
      await p2.goto(`${base}/auth/realms/pje/protocol/openid-connect/auth`);
      const antes = recebidos.length;
      await p2.click("#kc-pje-office");
      await p2.waitForFunction(() => document.title === "erro");
      expect(recebidos.length).toBe(antes);
      await outro.close();
    } finally {
      await navegador.close();
    }
  }, 60_000);
});
