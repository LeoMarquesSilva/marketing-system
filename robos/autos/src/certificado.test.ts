import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARQUIVO_DO_CONTRATO,
  FORMATO_DO_CONTRATO,
  assinaturaDaFonte,
  cifrarSenha,
  conferirPfx,
  decifrarSenha,
  diasParaVencer,
  lerCertificado,
  lerContrato,
  sha256,
  type ConfigCertificado,
} from "./certificado";

// Sem certificado de verdade nos testes (o repositório é público): só o par de chaves gerado aqui e bytes falsos.
const par = () => generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const robo = par();

const pastas: string[] = [];
afterEach(async () => {
  for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});
async function pastaTemporaria(): Promise<string> {
  const pasta = await mkdtemp(join(tmpdir(), "robo-cert-"));
  pastas.push(pasta);
  return pasta;
}
const vazio: ConfigCertificado = { pfx: "", senha: "", senhaArquivo: "", pasta: "", chavePrivadaArquivo: "", origens: ["https://certificado-sso.tjsp.jus.br"] };

describe("senha cifrada pelo painel", () => {
  it("só a chave privada do robô decifra", () => {
    const cifrada = cifrarSenha("uma senha qualquer", robo.publicKey);
    expect(cifrada).not.toContain("senha");
    expect(decifrarSenha(cifrada, robo.privateKey)).toBe("uma senha qualquer");
    expect(() => decifrarSenha(cifrada, par().privateKey)).toThrow(/não é o par/);
  });
});

describe("contrato do painel", () => {
  const valido = { formato: FORMATO_DO_CONTRATO, arquivo: "certificado.pfx", sha256: "a".repeat(64), senha_cifrada: "xyz" };

  it("aceita o formato combinado", () => {
    expect(lerContrato(JSON.stringify(valido)).arquivo).toBe("certificado.pfx");
  });

  it("recusa JSON pela metade, formato desconhecido, caminho no nome e sha256 inválido", () => {
    expect(() => lerContrato('{"formato":')).toThrow(/JSON válido/);
    expect(() => lerContrato(JSON.stringify({ ...valido, formato: "outro/9" }))).toThrow(/formato/);
    expect(() => lerContrato(JSON.stringify({ ...valido, arquivo: "../fora.pfx" }))).toThrow(/só o nome/);
    expect(() => lerContrato(JSON.stringify({ ...valido, sha256: "123" }))).toThrow(/sha256/);
    expect(() => lerContrato(JSON.stringify({ ...valido, senha_cifrada: "" }))).toThrow(/senha_cifrada/);
  });
});

describe("leitura do certificado", () => {
  it("sem configuração, não há certificado", async () => {
    expect(await lerCertificado(vazio)).toBeNull();
    expect(await assinaturaDaFonte(vazio)).toBe("");
  });

  it("arquivo que não é .pfx é recusado sem citar a senha", () => {
    expect(() => conferirPfx(Buffer.from("não sou um pfx"), "segredo")).toThrow(/não é um \.pfx válido/);
    try {
      conferirPfx(Buffer.from("não sou um pfx"), "segredo");
    } catch (erro) {
      expect((erro as Error).message).not.toContain("segredo");
    }
  });

  it("pasta do painel: confere o sha256 antes de abrir o .pfx", async () => {
    const pasta = await pastaTemporaria();
    const pfx = Buffer.from("bytes de um pfx falso");
    await writeFile(join(pasta, "certificado-1.pfx"), pfx);
    await writeFile(join(pasta, "robo.key"), robo.privateKey);
    const config = { ...vazio, pasta, chavePrivadaArquivo: join(pasta, "robo.key") };

    await expect(lerCertificado(config)).rejects.toThrow(/Não há certificado enviado/);

    const contrato = { formato: FORMATO_DO_CONTRATO, arquivo: "certificado-1.pfx", sha256: sha256("outro conteúdo"), senha_cifrada: cifrarSenha("s", robo.publicKey) };
    await writeFile(join(pasta, ARQUIVO_DO_CONTRATO), JSON.stringify(contrato));
    await expect(lerCertificado(config)).rejects.toThrow(/não confere com o sha256/);

    await writeFile(join(pasta, ARQUIVO_DO_CONTRATO), JSON.stringify({ ...contrato, sha256: sha256(pfx) }));
    await expect(lerCertificado(config)).rejects.toThrow(/não é um \.pfx válido/);
  });

  it("a assinatura muda quando o painel grava um contrato novo", async () => {
    const pasta = await pastaTemporaria();
    const config = { ...vazio, pasta };
    await writeFile(join(pasta, ARQUIVO_DO_CONTRATO), '{"formato":"a"}');
    const antes = await assinaturaDaFonte(config);
    await writeFile(join(pasta, ARQUIVO_DO_CONTRATO), '{"formato":"b"}');
    expect(await assinaturaDaFonte(config)).not.toBe(antes);
  });
});

describe("vencimento", () => {
  it("conta os dias até o fim da validade", () => {
    const agora = new Date("2026-11-17T12:00:00Z");
    expect(diasParaVencer("2026-12-17T12:00:00Z", agora)).toBe(30);
    expect(diasParaVencer("2026-11-16T12:00:00Z", agora)).toBe(-1);
    expect(diasParaVencer("", agora)).toBeNull();
  });
});

describe("cifra antiga (RC2, comum no .pfx exportado pelo Windows)", () => {
  it("o contêiner liga o provedor legado do OpenSSL, sem o qual o Node recusa o .pfx", async () => {
    const { readFile } = await import("node:fs/promises");
    const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
    expect(dockerfile).toMatch(/NODE_OPTIONS=--openssl-legacy-provider/);
  });

  it("com o provedor legado, um .pfx RC2 de teste abre", async () => {
    const { execFileSync } = await import("node:child_process");
    const pasta = await pastaTemporaria();
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(pasta, "k.pem"), "-out", join(pasta, "c.pem"), "-days", "30", "-subj", "/CN=TESTE RC2"], { stdio: "ignore" });
      execFileSync("openssl", ["pkcs12", "-export", "-inkey", join(pasta, "k.pem"), "-in", join(pasta, "c.pem"), "-out", join(pasta, "rc2.pfx"), "-passout", "pass:senha-rc2", "-certpbe", "PBE-SHA1-RC2-40", "-keypbe", "PBE-SHA1-3DES"], { stdio: "ignore" });
    } catch {
      return; // sem openssl com RC2 nesta máquina
    }
    const roteiro = `require("tls").createSecureContext({ pfx: require("fs").readFileSync(${JSON.stringify(join(pasta, "rc2.pfx"))}), passphrase: "senha-rc2" }); console.log("abriu");`;
    expect(execFileSync(process.execPath, ["--openssl-legacy-provider", "-e", roteiro], { encoding: "utf8" }).trim()).toBe("abriu");
  });
});
