import { execFileSync } from "node:child_process";
import { createHash, publicDecrypt, verify, X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { abrirAssinadorWebSigner, instalarWebSigner } from "./web-signer";

// Só dados fictícios: certificado autoassinado gerado aqui, com o CPF de exemplo 12345678909 (não é de ninguém).
let pasta = "";
let temOpenssl = true;
const senha = "senha-de-teste";

beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), "web-signer-"));
  await writeFile(
    join(pasta, "ext.cnf"),
    "[req]\ndistinguished_name=dn\n[dn]\n[ext]\nsubjectAltName=otherName:2.16.76.1.3.1;UTF8:0101199012345678909\n"
  );
  try {
    const rodar = (...args: string[]) => execFileSync("openssl", args, { cwd: pasta, stdio: "ignore" });
    rodar("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "k.pem", "-out", "c.pem", "-days", "30", "-subj", "/CN=ADVOGADO DE TESTE:12345678909", "-config", "ext.cnf", "-extensions", "ext");
    rodar("pkcs12", "-export", "-inkey", "k.pem", "-in", "c.pem", "-out", "rc2.pfx", "-passout", `pass:${senha}`, "-certpbe", "PBE-SHA1-RC2-40", "-keypbe", "PBE-SHA1-3DES");
  } catch {
    temOpenssl = false;
  }
});
afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

describe("Web Signer do robô", () => {
  it("lista o certificado como o e-SAJ espera (CPF da ICP-Brasil, validade) e assina o hash do desafio", async (ctx) => {
    if (!temOpenssl) return ctx.skip();
    const assinador = abrirAssinadorWebSigner(await readFile(join(pasta, "rc2.pfx")), senha);
    expect(assinador.certificado.subjectName).toBe("ADVOGADO DE TESTE:12345678909");
    expect(assinador.certificado.pkiBrazil.cpf).toBe("12345678909");
    expect(assinador.certificado.pkiBrazil.dateOfBirth).toBe("01011990");
    expect(Date.parse(assinador.certificado.validityEnd)).toBeGreaterThan(Date.now());

    const desafio = Buffer.from("desafio do servidor");
    const hash64 = createHash("sha256").update(desafio).digest("base64");
    const assinatura = Buffer.from(assinador.assinarHash(hash64, "SHA-256"), "base64");
    const certificado = new X509Certificate(Buffer.from(assinador.certificado64, "base64"));
    expect(verify("sha256", desafio, certificado.publicKey, assinatura)).toBe(true);
    expect(verify("sha256", Buffer.from("outro"), certificado.publicKey, assinatura)).toBe(false);
    expect(Buffer.from(assinador.assinarDados(desafio.toString("base64")), "base64").equals(assinatura)).toBe(true);
    expect(() => assinador.assinarHash(Buffer.from("curto").toString("base64"))).toThrow(/tamanho/);
  });

  describe("login de ponta a ponta com uma página que imita o e-SAJ", () => {
    let servidor: Server;
    let base = "";
    const desafio = createHash("sha256").update("desafio-123").digest("base64");

    beforeAll(async () => {
      // Imita o sajcas: a página cria SoftplanWebSigner, lista, assina o hashDesafio, lê o certificado e envia; o
      // servidor confere a assinatura com o certificado enviado. O softplan-websigner.js "original" daqui não funciona
      // (como num navegador sem a extensão): só a troca pelo do robô faz o login passar.
      servidor = createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://x");
        if (url.pathname === "/sajcas/js/softplan-websigner.js") {
          res.writeHead(200, { "Content-Type": "application/javascript" }).end("window.SoftplanWebSigner = function(){ this.init = function(o){ o.notInstalled(1); }; };");
          return;
        }
        if (req.method === "POST" && url.pathname === "/sajcas/login") {
          let corpo = "";
          req.on("data", (p) => (corpo += p));
          req.on("end", () => {
            const dados = new URLSearchParams(corpo);
            const cert = new X509Certificate(Buffer.from(dados.get("certificado") ?? "", "base64"));
            // A assinatura é sobre o hash do desafio: abre com a chave pública e compara o hash do DigestInfo.
            const digestInfo = publicDecrypt(cert.publicKey, Buffer.from(dados.get("assinatura") ?? "", "base64"));
            const confere = digestInfo.subarray(digestInfo.length - 32).toString("base64") === desafio;
            res.writeHead(200, { "Content-Type": "text/html" }).end(confere ? "<p id=r>logado</p>" : "<p id=r>recusado</p>");
          });
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html>
<select id="certificados"><option value="">Carregando...</option></select>
<form method="post" action="/sajcas/login"><input type="hidden" name="certificado" id="certificado"><input type="hidden" name="assinatura" id="assinatura">
<button type="button" id="submitCertificado">Entrar</button></form>
<script src="/sajcas/js/softplan-websigner.js"></script>
<script>
var pki = new SoftplanWebSigner("licenca");
pki.init({ ready: function () {
  pki.listCertificates().success(function (certs) {
    var s = document.getElementById("certificados"); s.innerHTML = "";
    certs.forEach(function (c) { var o = document.createElement("option"); o.value = c.thumbprint;
      o.textContent = c.subjectName + " - Validade: " + c.validityEnd.toISOString().slice(0, 10) + " - CPF " + c.pkiBrazil.cpf; s.appendChild(o); });
  }).error(function (m) { document.title = "erro: " + m; });
}, notInstalled: function () { document.title = "sem web signer"; } });
document.getElementById("submitCertificado").onclick = function () {
  var t = document.getElementById("certificados").value;
  pki.signHash({ thumbprint: t, hash: "${desafio}", digestAlgorithm: "SHA-256" }).success(function (assinatura) {
    pki.readCertificate(t).success(function (cert) {
      document.getElementById("certificado").value = cert; document.getElementById("assinatura").value = assinatura; document.forms[0].submit();
    });
  }).error(function (m) { document.title = "erro: " + m; });
};
</script>`);
      });
      await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()));
      const endereco = servidor.address();
      base = `http://127.0.0.1:${typeof endereco === "object" && endereco ? endereco.port : 0}`;
    });
    afterAll(() => new Promise<void>((r) => servidor.close(() => r())));

    it("com o e-SAJ na lista, o robô lista, assina e o login entra; fora da lista, nada muda", async (ctx) => {
      if (!temOpenssl) return ctx.skip();
      const { chromium } = await import("playwright");
      const navegador = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: "chrome" }).catch(() => null));
      if (!navegador) return ctx.skip();
      try {
        const certificado = { pfx: await readFile(join(pasta, "rc2.pfx")), senha, origens: [], assinatura: "", validoAte: "", origem: "teste" };
        const log: string[] = [];
        const contexto = await navegador.newContext();
        expect(await instalarWebSigner(contexto, certificado, { registrar: (m) => log.push(m), origens: [base] })).toBe(true);
        const pagina = await contexto.newPage();
        await pagina.goto(`${base}/sajcas/login`);
        await pagina.waitForFunction(() => (document.querySelector("#certificados option") as HTMLOptionElement | null)?.value !== "");
        expect(await pagina.textContent("#certificados")).toMatch(/ADVOGADO DE TESTE.*CPF 12345678909/);
        await pagina.click("#submitCertificado");
        await pagina.waitForSelector("#r");
        expect(await pagina.textContent("#r")).toBe("logado");
        expect(log.join("\n")).toMatch(/certificado apresentado ao e-SAJ/);
        await contexto.close();

        // Outra origem: o arquivo original segue e a página fica "sem web signer".
        const outro = await navegador.newContext();
        await instalarWebSigner(outro, certificado, { registrar: () => undefined, origens: ["https://esaj.tjsp.jus.br"] });
        const p2 = await outro.newPage();
        await p2.goto(`${base}/sajcas/login`);
        await p2.waitForFunction(() => document.title === "sem web signer");
        await outro.close();
      } finally {
        await navegador.close();
      }
    }, 60_000);
  });
});
