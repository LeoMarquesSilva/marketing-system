import { describe, expect, it } from "vitest";
import { chaveDoDocumentoJusbr, digitosDoCnj, documentosDaFicha, documentosNovosJusbr, ehAreaLogadaJusbr, ehLoginPdpj, motivoDaResposta, textoParaPdf, urlDaApi } from "./jusbr-urls";

// Números fictícios (dígito verificador inválido de propósito). Nenhum dado real.
const doc = (sequencia: number, idCodex: number, data: string, extra: Record<string, unknown> = {}) => ({
  sequencia,
  idCodex,
  nome: `doc${sequencia}.pdf`,
  dataHoraJuntada: data,
  hrefBinario: `/processos/0000000-00.0000.8.26.0000/documentos/${idCodex}/binario`,
  hrefTexto: `/processos/0000000-00.0000.8.26.0000/documentos/${idCodex}/texto`,
  ...extra,
});

describe("Jus.br: telas e endereços", () => {
  it("reconhece o login da PDPJ e o portal", () => {
    expect(ehLoginPdpj("https://sso.cloud.pje.jus.br/auth/realms/pje/protocol/openid-connect/auth?client_id=jusbr")).toBe(true);
    expect(ehLoginPdpj("https://portaldeservicos.pdpj.jus.br/consulta")).toBe(false);
    expect(ehAreaLogadaJusbr("https://portaldeservicos.pdpj.jus.br/consulta")).toBe(true);
    expect(ehAreaLogadaJusbr("https://www.jus.br/")).toBe(false);
  });

  it("monta os 20 dígitos e o endereço absoluto dos links", () => {
    expect(digitosDoCnj("0000000-00.0000.8.26.0000")).toBe("00000000000008260000");
    expect(digitosDoCnj("123")).toBeNull();
    expect(urlDaApi("/processos/x/documentos/1/binario")).toBe("https://portaldeservicos.pdpj.jus.br/api/v2/processos/x/documentos/1/binario");
    expect(urlDaApi("https://outro/arquivo")).toBe("https://outro/arquivo");
  });

  it("explica a resposta da API", () => {
    expect(motivoDaResposta(200)).toBeNull();
    expect(motivoDaResposta(404)).toMatch(/não foi encontrado/);
    expect(motivoDaResposta(403)).toMatch(/negou/);
    expect(motivoDaResposta(503)).toMatch(/instável/);
  });
});

describe("Jus.br: documentos", () => {
  it("junta as tramitações sem repetir e ordena pela juntada", () => {
    const fichas = [
      {
        tramitacaoAtual: { documentos: [doc(2, 20, "2024-02-01T10:00:00"), doc(1, 10, "2024-01-01T10:00:00")] },
        tramitacoes: [{ documentos: [doc(1, 10, "2024-01-01T10:00:00"), doc(3, 30, "2023-12-01T10:00:00"), { sequencia: 9, idCodex: 90 }] }],
      },
    ];
    expect(documentosDaFicha(fichas).map((d) => d.idCodex)).toEqual([30, 10, 20]);
  });

  it("chave estável e só os documentos novos (chaves de outro sistema não contam)", () => {
    expect(chaveDoDocumentoJusbr(doc(1, 10, "2024-01-01"))).toBe("jusbr:10");
    expect(chaveDoDocumentoJusbr({ idOrigem: "ABC_1" })).toBe("jusbr:ABC_1");
    expect(chaveDoDocumentoJusbr({})).toBeNull();
    const documentos = [doc(1, 10, "2024-01-01"), doc(2, 20, "2024-02-01")];
    expect(documentosNovosJusbr(documentos, undefined)).toHaveLength(2);
    expect(documentosNovosJusbr(documentos, ["pje:10"])).toHaveLength(2);
    expect(documentosNovosJusbr(documentos, ["jusbr:10"]).map((d) => d.idCodex)).toEqual([20]);
  });

  it("deixa o texto desenhável pela fonte padrão do PDF", () => {
    expect(textoParaPdf("Petição “inicial” – ação… ✓")).toBe('Petição "inicial" - ação... ?');
  });
});
