import { describe, expect, it } from "vitest";
import type { ValorDeCampo } from "./autos-types";
import { cidadeDoOrgao, dataDoDataJud, indiceDoDataJud, lerCnjDaCapa, orgaoSemComarca, registroAtual, separarVara, sugestoesDaCapa, ultimoMovimento, type RegistroDataJud } from "./capa";

// Números e órgãos inventados.
const PRIMEIRO_GRAU = "1012345-67.2024.8.26.0114";

const G1: RegistroDataJud = {
  grau: "G1",
  dataAjuizamento: "20240315103000",
  nivelSigilo: 0,
  formato: { nome: "Eletrônico" },
  orgaoJulgador: { nome: "Juízo Titular I - 4ª Vara Cível da Comarca de Vila Modelo", codigoMunicipioIBGE: 3500000 },
  movimentos: [
    { nome: "Conclusão", dataHora: "2026-09-01T10:00:00.000Z", complementosTabelados: [{ nome: "para despacho" }] },
    { nome: "Distribuição", dataHora: "2024-03-15T10:30:00.000Z" },
  ],
};

const vazio = (extra: Record<string, unknown> = {}) => ({ cnj: PRIMEIRO_GRAU, ...extra }) as never;

describe("número CNJ", () => {
  it("lê justiça, tribunal, UF e grau", () => {
    expect(lerCnjDaCapa(PRIMEIRO_GRAU)).toMatchObject({ justica: "Justiça Estadual", tribunal: "TJSP", uf: "SP", grau: "PRIMEIRO GRAU" });
    expect(lerCnjDaCapa("2001234-56.2025.8.26.0000")?.grau).toBe("SEGUNDO GRAU");
    expect(lerCnjDaCapa("0001234-56.2024.5.02.0001")).toMatchObject({ justica: "Justiça Trabalhista", tribunal: "TRT2", uf: "SP" });
    expect(lerCnjDaCapa("0001234-56.2024.8.07.0001")?.tribunal).toBe("TJDFT");
    expect(lerCnjDaCapa("123")).toBeNull();
  });

  it("acha o índice do tribunal no DataJud", () => {
    expect(indiceDoDataJud(lerCnjDaCapa(PRIMEIRO_GRAU))).toBe("api_publica_tjsp");
    expect(indiceDoDataJud(lerCnjDaCapa("0001234-56.2024.5.02.0001"))).toBe("api_publica_trt2");
  });
});

describe("órgão julgador", () => {
  it("escreve o órgão como o VIOS: vara, tipo e cidade", () => {
    const orgao = orgaoSemComarca("Juízo Titular I - 4ª Vara Cível da Comarca de Vila Modelo");
    expect(orgao).toBe("4ª Vara Cível");
    expect(separarVara(orgao)).toEqual({ vara: "4ª", tipo: "Vara Cível" });
    expect(separarVara("12 Vara Civel")).toEqual({ vara: "12ª", tipo: "Vara Civel" });
    expect(separarVara("Câmara Especial")).toEqual({ vara: null, tipo: "Câmara Especial" });
    expect(cidadeDoOrgao("Juízo Titular I - 4ª Vara Cível da Comarca de Vila Modelo")).toBe("Vila Modelo");
    expect(cidadeDoOrgao("2ª Vara do Trabalho de Cidade Exemplo")).toBe("Cidade Exemplo");
    expect(cidadeDoOrgao("Foro Regional de Bairro Novo - 1ª Vara")).toBe("Bairro Novo");
    expect(cidadeDoOrgao("3ª Câmara de Direito Privado")).toBeNull();
  });
});

describe("DataJud", () => {
  it("lê as datas nos formatos do DataJud", () => {
    expect(dataDoDataJud("20240315103000")).toBe("2024-03-15");
    expect(dataDoDataJud("2024-03-15T10:30:00.000Z")).toBe("2024-03-15");
    expect(dataDoDataJud("")).toBeNull();
  });

  it("escolhe o grau com o movimento mais recente e o último andamento", () => {
    const g2: RegistroDataJud = { grau: "G2", movimentos: [{ nome: "Recebimento", dataHora: "2026-10-01T09:00:00.000Z" }] };
    expect(registroAtual([G1, g2])?.grau).toBe("G2");
    expect(registroAtual([G1])?.grau).toBe("G1");
    expect(ultimoMovimento(G1)).toEqual({ texto: "Conclusão - para despacho", data: "2026-09-01" });
  });
});

describe("sugestoesDaCapa", () => {
  const consultadoEm = "10/11/2026";

  it("propõe só o que falta, cada um com a fonte", () => {
    const sugestoes = sugestoesDaCapa({ valores: vazio(), datajud: [G1], municipio: "Vila Modelo", consultadoEm });
    const porCampo = Object.fromEntries(sugestoes.map((item) => [item.campo, item]));
    expect(Object.keys(porCampo).sort()).toEqual(
      ["cidade", "data_distribuicao", "jurisdicao_atual", "justica", "orgao_julgador", "processo_eletronico", "segredo_justica", "tipo_orgao_julgador", "uf", "ultimo_andamento_texto"].sort()
    );
    expect(porCampo.justica).toMatchObject({ fonte: "cnj", valor: { valor: "Justiça Estadual" }, confianca: "alta" });
    expect(porCampo.uf).toMatchObject({ fonte: "cnj", valor: { valor: "SP" } });
    expect(porCampo.jurisdicao_atual).toMatchObject({ fonte: "datajud", valor: { valor: "PRIMEIRO GRAU" } });
    expect(porCampo.cidade).toMatchObject({ fonte: "datajud", valor: { valor: "Vila Modelo" } });
    expect(porCampo.orgao_julgador.valor).toEqual({ valor: "4ª" });
    expect(porCampo.tipo_orgao_julgador.valor).toEqual({ valor: "Vara Cível" });
    expect(porCampo.data_distribuicao.valor).toEqual({ valor: "2024-03-15" });
    expect(porCampo.processo_eletronico.valor).toEqual({ valor: true });
    expect(porCampo.segredo_justica.valor).toEqual({ valor: false });
    expect(porCampo.ultimo_andamento_texto.valor as ValorDeCampo).toEqual({ valor: "Conclusão - para despacho", junto: { ultimo_andamento_data: "2026-09-01" } });
    expect(porCampo.cidade.trecho).toContain("DataJud (TJSP, 1º grau), 10/11/2026");
    expect(sugestoes.every((item) => item.trechoConferido && item.pagina === null && item.tipo === "campo")).toBe(true);
  });

  it("não propõe o que o cadastro já tem, mas propõe andamento mais novo", () => {
    const valores = vazio({
      justica: "Justiça Estadual",
      uf: "SP",
      jurisdicao_atual: "PRIMEIRO GRAU",
      cidade: "Vila Modelo",
      orgao_julgador: "4ª",
      tipo_orgao_julgador: "Vara Cível",
      data_distribuicao: "2024-03-15",
      processo_eletronico: true,
      segredo_justica: false,
      ultimo_andamento_texto: "Distribuição",
      ultimo_andamento_data: "2024-03-15",
    });
    const sugestoes = sugestoesDaCapa({ valores, datajud: [G1], consultadoEm });
    expect(sugestoes.map((item) => item.campo)).toEqual(["ultimo_andamento_texto"]);
    const emDia = sugestoesDaCapa({ valores: { ...(valores as Record<string, unknown>), ultimo_andamento_data: "2026-09-01" } as never, datajud: [G1], consultadoEm });
    expect(emDia).toEqual([]);
  });

  it("sem DataJud, fica só com as regras do número", () => {
    const sugestoes = sugestoesDaCapa({ valores: vazio(), datajud: [], consultadoEm });
    expect(sugestoes.map((item) => `${item.fonte}:${item.campo}`).sort()).toEqual(["cnj:jurisdicao_atual", "cnj:justica", "cnj:uf"]);
    expect(sugestoes.find((item) => item.campo === "jurisdicao_atual")?.confianca).toBe("media");
  });

  it("no 2º grau, cidade é a capital e a vara não é proposta", () => {
    const g2: RegistroDataJud = { grau: "G2", orgaoJulgador: { nome: "3ª Câmara de Direito Privado" }, movimentos: [{ nome: "Conclusão", dataHora: "2026-10-01T09:00:00.000Z" }] };
    const sugestoes = sugestoesDaCapa({ valores: { cnj: "2001234-56.2025.8.26.0000" } as never, datajud: [g2], consultadoEm });
    const porCampo = Object.fromEntries(sugestoes.map((item) => [item.campo, item]));
    expect(porCampo.cidade.valor).toEqual({ valor: "São Paulo" });
    expect(porCampo.cidade.confianca).toBe("media");
    expect(porCampo.jurisdicao_atual.valor).toEqual({ valor: "SEGUNDO GRAU" });
    expect(porCampo.orgao_julgador).toBeUndefined();
  });

  it("marca segredo de justiça quando o DataJud tem sigilo", () => {
    const sugestoes = sugestoesDaCapa({ valores: vazio(), datajud: [{ ...G1, nivelSigilo: 2 }], consultadoEm });
    expect(sugestoes.find((item) => item.campo === "segredo_justica")?.valor).toEqual({ valor: true });
  });
});
