import { describe, expect, it } from "vitest";
import { ETAPAS_VISAO, etapaDoStatus, inicioDoPeriodo, montarVisaoGeral, rankearGrupos, periodoValido, somarDias } from "./visao-geral";
import { nomesDosVistadores, vistadorDa } from "./vistadores";

describe("datas do período", () => {
  it("soma e volta dias atravessando o mês", () => {
    expect(somarDias("2026-11-01", -1)).toBe("2026-10-31");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("período de 1 dia começa hoje; de 7, seis dias antes", () => {
    expect(inicioDoPeriodo("2026-11-05", 1)).toBe("2026-11-05");
    expect(inicioDoPeriodo("2026-11-05", 7)).toBe("2026-10-30");
  });

  it("aceita só 1, 7 ou 30 (o resto vira 7)", () => {
    expect(periodoValido("30")).toBe(30);
    expect(periodoValido("5")).toBe(7);
    expect(periodoValido(null)).toBe(7);
  });
});

describe("etapa de cada status", () => {
  it("põe cada status na aba em que ele aparece", () => {
    expect(etapaDoStatus("triagem_pendente")).toBe("triagem");
    expect(etapaDoStatus("juridico_vistar")).toBe("vistagem");
    expect(etapaDoStatus("controladoria_vistar")).toBe("conferencia");
    expect(etapaDoStatus("pronto_para_agendar")).toBe("envio");
    expect(etapaDoStatus("revisar")).toBe("check");
    expect(etapaDoStatus("checado")).toBeNull();
  });

  it("duplicidade revisada já saiu da aba Duplicidades", () => {
    expect(etapaDoStatus("duplicidade", true)).toBe("duplicidades");
    expect(etapaDoStatus("duplicidade", false)).toBeNull();
  });

  it("segue a ordem das abas do cabeçalho", () => {
    expect(ETAPAS_VISAO).toEqual(["triagem", "duplicidades", "vistagem", "conferencia", "envio", "check"]);
  });
});

describe("vistadores", () => {
  it("Trabalhista: Isadora Godoy nas normais e Caroline Abdalla nas de risco", () => {
    expect(vistadorDa("Trabalhista", "normal")).toBe("Isadora Godoy");
    expect(vistadorDa("Trabalhista", "risco")).toBe("Caroline Abdalla");
    expect(nomesDosVistadores()).toEqual(expect.arrayContaining(["Isadora Godoy", "Caroline Abdalla"]));
  });

  it("área sem cadastro não tem vistador (nada de deduzir pelo advogado da pasta)", () => {
    expect(vistadorDa("Cível", "normal")).toBeNull();
    expect(vistadorDa("Área que não existe", "risco")).toBeNull();
  });
});

describe("montarVisaoGeral", () => {
  const vistadores = { Trabalhista: { normal: "Ana Souza", risco: "Carla Dias" } };
  const visao = montarVisaoGeral({
    hoje: "2026-11-05",
    dias: 7,
    arquivos: [
      { id: "a1", data: "2026-11-05", linhas: 10 },
      { id: "a2", data: "2026-11-04", linhas: 3 },
    ],
    chegadas: [
      { arquivoId: "a1", status: "juridico_vistar", area: "Trabalhista" },
      { arquivoId: "a1", status: "checado", area: "Trabalhista" },
      { arquivoId: "a1", status: "triagem_pendente", area: null },
      { arquivoId: "a1", status: "duplicidade", area: null },
      { arquivoId: "a1", status: "descartada", area: null },
      { arquivoId: "a2", status: "juridico_vistar", area: "Cível" },
    ],
    abertas: [
      { status: "juridico_vistar", area: "Trabalhista", risco: false, dataPublicacao: "2026-11-06", duplicidadePendente: false },
      { status: "juridico_vistar", area: "Trabalhista", risco: false, dataPublicacao: "2026-11-04", duplicidadePendente: false },
      { status: "juridico_vistar", area: "Trabalhista", risco: true, dataPublicacao: "2026-11-03", duplicidadePendente: false },
      { status: "juridico_vistar", area: "Cível", risco: false, dataPublicacao: "2026-11-05", duplicidadePendente: false },
      { status: "juridico_vistar", area: "Cível", risco: true, dataPublicacao: "2026-11-02", duplicidadePendente: false },
      { status: "controladoria_vistar", area: "Trabalhista", risco: false, dataPublicacao: "2026-11-05", duplicidadePendente: false },
      { status: "triagem_pendente", area: null, risco: false, dataPublicacao: "2026-11-05", duplicidadePendente: false },
      { status: "duplicidade", area: null, risco: false, dataPublicacao: "2026-11-05", duplicidadePendente: true },
      { status: "duplicidade", area: null, risco: false, dataPublicacao: "2026-11-05", duplicidadePendente: false },
      { status: "captada", area: null, risco: false, dataPublicacao: "2026-11-05", duplicidadePendente: false },
    ],
    checadas: ["Trabalhista", "Trabalhista"],
    fotos: { "ANA SOUZA": "https://foto/ana.jpg" },
    chaveNome: (nome) => nome.toUpperCase(),
    vistadores,
  });

  it("monta um dia por data do período, marcando os dias sem arquivo", () => {
    expect(visao.porDia).toHaveLength(7);
    expect(visao.porDia[0]).toMatchObject({ data: "2026-10-30", semArquivo: true, disponiveis: 0 });
    expect(visao.porDia[6]).toMatchObject({
      data: "2026-11-05",
      semArquivo: false,
      disponiveis: 10,
      naVistagem: 3,
      duplicidades: 1,
      descartadas: 1,
      soNoArquivo: 5,
    });
  });

  it("soma o período igual ao gráfico", () => {
    expect(visao.chegada).toEqual({ disponiveis: 13, naVistagem: 4, duplicidades: 1, descartadas: 1, soNoArquivo: 7 });
  });

  it("conta cada aba agora (duplicidade revisada e captada ficam de fora)", () => {
    expect(visao.etapas).toEqual({ duplicidades: 1, triagem: 1, vistagem: 5, conferencia: 1, envio: 0, check: 0 });
    expect(visao.aguardandoTriagem).toBe(1);
  });

  it("separa por área o que chegou, o que está para vistar e o que foi checado", () => {
    const trabalhista = visao.areas.find((area) => area.area === "Trabalhista");
    expect(trabalhista).toMatchObject({ chegaram: 2, vistagem: 3, conferencia: 1, checadas: 2, maisAntigaParaVistar: "2026-11-03" });
    expect(visao.areas[0].area).toBe("Trabalhista");
    expect(visao.areas.at(-1)?.area).toBe("Sem área");
  });

  it("uma linha por vistador (normais e de risco), com a foto quando tem", () => {
    expect(visao.vistadores.filter((linha) => linha.area === "Trabalhista")).toEqual([
      { area: "Trabalhista", tipo: "normal", nome: "Ana Souza", total: 2, risco: 0, maisAntiga: "2026-11-04", foto: "https://foto/ana.jpg" },
      { area: "Trabalhista", tipo: "risco", nome: "Carla Dias", total: 1, risco: 1, maisAntiga: "2026-11-03", foto: null },
    ]);
  });

  it("área sem vistador cadastrado: o total da área, com o vistador a definir", () => {
    expect(visao.vistadores.filter((linha) => linha.area === "Cível")).toEqual([
      { area: "Cível", tipo: null, nome: null, total: 2, risco: 1, maisAntiga: "2026-11-02", foto: null },
    ]);
  });

  it("área com vistador aparece mesmo sem nada para vistar; tipo sem vistador só com publicação", () => {
    const emDia = montarVisaoGeral({
      hoje: "2026-11-05",
      dias: 1,
      arquivos: [],
      chegadas: [],
      abertas: [
        { status: "juridico_vistar", area: "Tributário", risco: true, dataPublicacao: "2026-11-01", duplicidadePendente: false },
      ],
      checadas: [],
      vistadores: { Trabalhista: { normal: "Ana Souza", risco: "Carla Dias" }, Tributário: { normal: "Bruno Lima" } },
    });
    expect(emDia.areas.map((area) => area.area)).toEqual(["Tributário", "Trabalhista"]);
    expect(emDia.vistadores).toEqual([
      { area: "Tributário", tipo: "normal", nome: "Bruno Lima", total: 0, risco: 0, maisAntiga: null, foto: null },
      { area: "Tributário", tipo: "risco", nome: null, total: 1, risco: 1, maisAntiga: "2026-11-01", foto: null },
      { area: "Trabalhista", tipo: "normal", nome: "Ana Souza", total: 0, risco: 0, maisAntiga: null, foto: null },
      { area: "Trabalhista", tipo: "risco", nome: "Carla Dias", total: 0, risco: 0, maisAntiga: null, foto: null },
    ]);
  });

  it("disponível nunca fica menor do que o que entrou (colado sem total de linhas)", () => {
    const colado = montarVisaoGeral({
      hoje: "2026-11-05",
      dias: 1,
      arquivos: [{ id: "c1", data: "2026-11-05", linhas: 0 }],
      chegadas: [{ arquivoId: "c1", status: "juridico_vistar", area: "Cível" }],
      abertas: [],
      checadas: [],
    });
    expect(colado.porDia[0]).toMatchObject({ disponiveis: 1, naVistagem: 1, soNoArquivo: 0 });
  });
});

describe("grupos de clientes", () => {
  it("separa o que chegou por grupo e por onde está agora", () => {
    const visao = montarVisaoGeral({
      hoje: "2026-11-05",
      dias: 1,
      arquivos: [{ id: "a", data: "2026-11-05", linhas: 6 }],
      chegadas: [
        { arquivoId: "a", status: "juridico_vistar", area: "Trabalhista", grupo: "Grupo Mazda" },
        { arquivoId: "a", status: "checado", area: "Trabalhista", grupo: "Grupo Mazda" },
        { arquivoId: "a", status: "triagem_pendente", area: null, grupo: null },
        { arquivoId: "a", status: "juridico_vistar", area: "Trabalhista", grupo: "Grupo Gaspec" },
        { arquivoId: "a", status: "duplicidade", area: null, grupo: "Grupo Mazda" },
      ],
      abertas: [],
      checadas: [],
    });
    expect(visao.grupos).toEqual([
      { grupo: "Grupo Mazda", total: 2, naTriagem: 0, paraVistar: 1, vistadas: 1 },
      { grupo: "Grupo Gaspec", total: 1, naTriagem: 0, paraVistar: 1, vistadas: 0 },
      { grupo: "Sem grupo", total: 1, naTriagem: 1, paraVistar: 0, vistadas: 0 },
    ]);
  });

  it("soma os grupos menores em Outros grupos e deixa Sem grupo por último", () => {
    const grupo = (nome: string, total: number) => ({ grupo: nome, total, naTriagem: 0, paraVistar: total, vistadas: 0 });
    const ranking = rankearGrupos([grupo("Sem grupo", 9), grupo("A", 5), grupo("B", 3), grupo("C", 2), grupo("D", 1)], 2);
    expect(ranking.map((item) => [item.grupo, item.total])).toEqual([
      ["A", 5],
      ["B", 3],
      ["Outros grupos", 3],
      ["Sem grupo", 9],
    ]);
    expect(ranking[2].outros).toBe(2);
  });
});
