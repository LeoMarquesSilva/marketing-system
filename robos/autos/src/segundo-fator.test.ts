import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cifrarSenha } from "./certificado";
import {
  ARQUIVO_DO_SEGUNDO_FATOR,
  conferirCodigo,
  FORMATO_DO_SEGUNDO_FATOR,
  decodificarBase32,
  entrarComCodigoDoPainel,
  gerarHotp,
  gerarTotp,
  lerContratoDoSegundoFator,
  lerSegredoTotp,
  msParaTrocar,
  segredoDoPainel,
  type SegredoTotp,
} from "./segundo-fator";

// Só segredos fictícios: os das RFCs 4226 e 6238 (texto "1234567890" repetido), nunca um segredo de verdade.
const RFC_SHA1 = Buffer.from("12345678901234567890", "ascii");
const RFC_SHA256 = Buffer.from("12345678901234567890123456789012", "ascii");
const RFC_SHA512 = Buffer.from("1234567890123456789012345678901234567890123456789012345678901234", "ascii");
/** Base32 do segredo SHA-1 da RFC. */
const RFC_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("HOTP (RFC 4226, apêndice D)", () => {
  it("bate com os vetores de teste", () => {
    const esperados = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expect(esperados.map((_, contador) => gerarHotp(RFC_SHA1, contador))).toEqual(esperados);
  });
});

describe("TOTP (RFC 6238, apêndice B)", () => {
  const segredo = (chave: Buffer, algoritmo: SegredoTotp["algoritmo"]): SegredoTotp => ({ chave, algoritmo, digitos: 8, periodoSegundos: 30 });
  const vetores: [number, string, string, string][] = [
    [59, "94287082", "46119246", "90693936"],
    [1111111109, "07081804", "68084774", "25091201"],
    [1111111111, "14050471", "67062674", "99943326"],
    [1234567890, "89005924", "91819424", "93441116"],
    [2000000000, "69279037", "90698825", "38618901"],
    [20000000000, "65353130", "77737706", "47863826"],
  ];

  it.each(vetores)("instante %i", (segundos, sha1, sha256, sha512) => {
    expect(gerarTotp(segredo(RFC_SHA1, "sha1"), segundos * 1000)).toBe(sha1);
    expect(gerarTotp(segredo(RFC_SHA256, "sha256"), segundos * 1000)).toBe(sha256);
    expect(gerarTotp(segredo(RFC_SHA512, "sha512"), segundos * 1000)).toBe(sha512);
  });

  it("6 dígitos, como o eproc: os 6 últimos do vetor de 8", () => {
    const padrao = lerSegredoTotp(RFC_BASE32);
    expect(padrao).toMatchObject({ algoritmo: "sha1", digitos: 6, periodoSegundos: 30 });
    expect(gerarTotp(padrao, 59_000)).toBe("287082");
    expect(gerarTotp(padrao, 1111111109_000)).toBe("081804");
  });

  it("conferência do painel: aceita o código do instante e os vizinhos, recusa o resto", () => {
    const padrao = lerSegredoTotp(RFC_BASE32);
    expect(conferirCodigo(padrao, "081804", 1111111109_000)).toBe(true);
    expect(conferirCodigo(padrao, "081 804", 1111111109_000 + 30_000)).toBe(true);
    expect(conferirCodigo(padrao, "081804", 1111111109_000 + 90_000)).toBe(false);
    expect(conferirCodigo(padrao, "000000", 1111111109_000)).toBe(false);
  });

  it("sabe quanto falta para o código trocar", () => {
    const padrao = lerSegredoTotp(RFC_BASE32);
    expect(msParaTrocar(padrao, 59_000)).toBe(1_000);
    expect(msParaTrocar(padrao, 60_000)).toBe(30_000);
  });
});

describe("leitura do segredo", () => {
  it("base32 com espaços, minúsculas e preenchimento", () => {
    expect(decodificarBase32("gezd gnbv-gy3t qojq gezd gnbv gy3t qojq====")).toEqual(RFC_SHA1);
  });

  it("URI otpauth do QR code, com os parâmetros dela", () => {
    const segredo = lerSegredoTotp(`otpauth://totp/Exemplo:fulano?secret=${RFC_BASE32}&issuer=Exemplo&algorithm=SHA1&digits=8&period=30`);
    expect(segredo.digitos).toBe(8);
    expect(gerarTotp(segredo, 59_000)).toBe("94287082");
  });

  it("recusa sem citar o segredo", () => {
    const ruins = ["", "nao-e-base32!", "GEZDGNBV", "otpauth://hotp/x?secret=" + RFC_BASE32, `otpauth://totp/x?secret=${RFC_BASE32}&algorithm=MD5`, `otpauth://totp/x?secret=${RFC_BASE32}&digits=4`];
    for (const ruim of ruins) {
      expect(() => lerSegredoTotp(ruim)).toThrow();
      try {
        lerSegredoTotp(ruim);
      } catch (erro) {
        expect((erro as Error).message).not.toContain(RFC_BASE32);
      }
    }
  });
});

describe("contrato do painel", () => {
  it("aceita o formato combinado e recusa o resto", () => {
    expect(lerContratoDoSegundoFator(JSON.stringify({ formato: FORMATO_DO_SEGUNDO_FATOR, sistemas: {} })).sistemas).toEqual({});
    expect(() => lerContratoDoSegundoFator('{"formato":')).toThrow(/JSON válido/);
    expect(() => lerContratoDoSegundoFator(JSON.stringify({ formato: "outro/1", sistemas: {} }))).toThrow(/formato/);
    expect(() => lerContratoDoSegundoFator(JSON.stringify({ formato: FORMATO_DO_SEGUNDO_FATOR }))).toThrow(/sistemas/);
  });
});

describe("código gerado pelo segredo do painel", () => {
  const par = () => generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const robo = par();
  const pastas: string[] = [];
  afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
  });

  async function painel(sistemas: Record<string, string>, chave = robo.privateKey) {
    const pasta = await mkdtemp(join(tmpdir(), "robo-2fa-"));
    pastas.push(pasta);
    await writeFile(join(pasta, "robo.key"), chave);
    const contrato = {
      formato: FORMATO_DO_SEGUNDO_FATOR,
      sistemas: Object.fromEntries(Object.entries(sistemas).map(([sistema, segredo]) => [sistema, { segredo_cifrado: cifrarSenha(segredo, robo.publicKey), enviado_em: "2026-11-18T12:00:00Z", enviado_por: "teste" }])),
    };
    await writeFile(join(pasta, ARQUIVO_DO_SEGUNDO_FATOR), JSON.stringify(contrato));
    return { pasta, chavePrivadaArquivo: join(pasta, "robo.key") };
  }

  it("sem pasta, sem arquivo ou sem o sistema: nulo", async () => {
    expect(await segredoDoPainel({ pasta: "", chavePrivadaArquivo: "" }, "eproc")).toBeNull();
    const vazia = await mkdtemp(join(tmpdir(), "robo-2fa-"));
    pastas.push(vazia);
    expect(await segredoDoPainel({ pasta: vazia, chavePrivadaArquivo: "" }, "eproc")).toBeNull();
    expect(await segredoDoPainel(await painel({ eproc: RFC_BASE32 }), "eproc-tjrj")).toBeNull();
  });

  it("decifra o segredo de cada sistema com a chave do robô", async () => {
    const config = await painel({ eproc: RFC_BASE32 });
    expect((await segredoDoPainel(config, "eproc"))?.chave).toEqual(RFC_SHA1);
  });

  it("chave do robô errada: falha clara", async () => {
    const config = await painel({ eproc: RFC_BASE32 }, par().privateKey);
    await expect(segredoDoPainel(config, "eproc")).rejects.toThrow(/não é o par/);
  });

  it("digita o código do instante; nada de segredo ou código no log", async () => {
    const config = await painel({ eproc: RFC_BASE32 });
    const log: string[] = [];
    const digitados: string[] = [];
    const entrou = await entrarComCodigoDoPainel({
      config,
      sistema: "eproc",
      registrar: (mensagem) => log.push(mensagem),
      digitar: async (codigo) => (digitados.push(codigo), codigo === "081804"),
      agora: () => 1111111109_000 - 10_000,
      esperar: async () => undefined,
    });
    expect(entrou).toBe(true);
    expect(digitados).toEqual(["081804"]);
    expect(log.join("\n")).not.toMatch(/081804|GEZD/);
  });

  it("perto da troca, espera o próximo código; recusado, tenta um código novo e desiste", async () => {
    const config = await painel({ eproc: RFC_BASE32 });
    let instante = 60_000 - 2_000; // faltam 2 s para o código trocar
    const esperas: number[] = [];
    const digitados: string[] = [];
    const log: string[] = [];
    const entrou = await entrarComCodigoDoPainel({
      config,
      sistema: "eproc",
      registrar: (mensagem) => log.push(mensagem),
      digitar: async (codigo) => (digitados.push(codigo), false),
      agora: () => instante,
      esperar: async (ms) => {
        esperas.push(ms);
        instante += ms;
      },
    });
    expect(entrou).toBe(false);
    expect(esperas).toEqual([3_000, 30_000]); // falta + 1 s de folga
    expect(new Set(digitados).size).toBe(2);
    expect(log.at(-1)).toMatch(/não foi aceito/);
    expect(log.join("\n")).not.toContain(digitados[0]);
  });

  it("segredo inválido no painel: registra o motivo e devolve falso", async () => {
    const config = await painel({ eproc: "isto não é base32" });
    const log: string[] = [];
    const entrou = await entrarComCodigoDoPainel({ config, sistema: "eproc", registrar: (m) => log.push(m), digitar: async () => true });
    expect(entrou).toBe(false);
    expect(log[0]).toMatch(/base32/);
  });
});
