import { describe, expect, it } from "vitest";
import { capaDaFicha, desistirDoJusbr, digitosDoCnj, JUSBR_FALHAS_SEGUIDAS, documentosDaFicha, documentosNovosJusbr, ehAreaLogadaJusbr, ehLoginPdpj, motivoDaResposta, textoParaPdf, urlDaApi } from "./jusbr-urls";

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
  it("junta as tramitações, tira as cópias entre graus e ordena pela juntada", () => {
    const fichas = [
      {
        // 2º grau: cópia do documento do 1º (outro id, mesmo nome e juntada) e um documento próprio.
        tramitacaoAtual: { documentos: [doc(1, 110, "2024-01-01T10:00:00"), doc(5, 150, "2024-03-01T10:00:00")] },
        tramitacoes: [{ documentos: [doc(1, 10, "2024-01-01T10:00:00"), doc(2, 20, "2023-12-01T10:00:00"), { sequencia: 9, idCodex: 90 }] }],
      },
    ];
    const lista = documentosDaFicha(fichas);
    expect(lista.map((d) => d.idCodex)).toEqual([20, 110, 150]);
    expect(lista[1].chave).toBe("jusbr:2024-01-01T10:00:00|doc1.pdf|1");
  });

  it("dois anexos com o mesmo nome na mesma juntada entram os dois", () => {
    const lista = documentosDaFicha([{ tramitacaoAtual: { documentos: [doc(1, 10, "2024-01-01T10:00:00", { nome: "anexo.pdf" }), doc(2, 20, "2024-01-01T10:00:00", { nome: "anexo.pdf" })] } }]);
    expect(lista.map((d) => d.chave)).toEqual(["jusbr:2024-01-01T10:00:00|anexo.pdf|1", "jusbr:2024-01-01T10:00:00|anexo.pdf|2"]);
  });

  it("só os documentos novos (chaves de outro sistema não contam)", () => {
    const documentos = documentosDaFicha([{ tramitacaoAtual: { documentos: [doc(1, 10, "2024-01-01"), doc(2, 20, "2024-02-01")] } }]);
    expect(documentosNovosJusbr(documentos, undefined)).toHaveLength(2);
    expect(documentosNovosJusbr(documentos, ["pje:10"])).toHaveLength(2);
    expect(documentosNovosJusbr(documentos, [documentos[0].chave]).map((d) => d.idCodex)).toEqual([20]);
  });

  it("deixa o texto desenhável pela fonte padrão do PDF", () => {
    expect(textoParaPdf("Petição “inicial” – ação… ✓")).toBe('Petição "inicial" - ação... ?');
  });

  it("monta a capa de cada tramitação, sem repetir a atual que também vem na lista", () => {
    const g1 = {
      grau: { sigla: "G1" },
      dataHoraAjuizamento: "2024-01-01T10:00:00",
      classe: [{ codigo: 1, descricao: "Monitória" }],
      distribuicao: [{ orgaoJulgador: [{ nome: "1ª Vara Cível" }], orgaoJulgadorLocal: { nome: "Vara", jurisdicaoLocal: { nome: "Cidade Exemplo" } } }],
      movimentos: [
        { dataHora: "2024-02-01T10:00:00", descricao: "Despacho", complementos: [{ nome: "tipo", valor: { descricao: "mero expediente" } }] },
        { dataHora: null, descricao: "sem data" },
      ],
    };
    const capa = capaDaFicha([{ siglaTribunal: "TJXX", nivelSigilo: 0, tramitacaoAtual: g1, tramitacoes: [g1, { grau: { sigla: "G2" }, dataHoraAjuizamento: "2025-01-01T10:00:00", movimentos: [] }] } as never]);
    expect(capa?.tramitacoes.map((t) => t.grau)).toEqual(["G1", "G2"]);
    expect(capa?.tramitacoes[0]).toMatchObject({ classe: "Monitória", orgaoJulgador: "1ª Vara Cível", cidade: "Cidade Exemplo" });
    expect(capa?.tramitacoes[0].movimentos).toEqual([{ dataHora: "2024-02-01T10:00:00", descricao: "Despacho", codigo: null, complementos: ["mero expediente"] }]);
    expect(capaDaFicha([])).toBeNull();
  });
});

describe("Jus.br fora do ar para um tribunal", () => {
  it("desiste depois de JUSBR_FALHAS_SEGUIDAS documentos seguidos sem nada", () => {
    expect(JUSBR_FALHAS_SEGUIDAS).toBe(10);
    expect(desistirDoJusbr(0)).toBe(false);
    expect(desistirDoJusbr(JUSBR_FALHAS_SEGUIDAS - 1)).toBe(false);
    expect(desistirDoJusbr(JUSBR_FALHAS_SEGUIDAS)).toBe(true);
  });
});
