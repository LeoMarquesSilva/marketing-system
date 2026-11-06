import { describe, expect, it } from "vitest";
import {
  ESCOPO_COMPLETO,
  ETAPAS_VISAO,
  estaNoEscopo,
  etapaDoStatus,
  inicioDoPeriodo,
  montarVisaoGeral,
  rankearGrupos,
  periodoValido,
  somarDias,
  type AbertaDaVisao,
  type ChegadaDaVisao,
} from "./visao-geral";
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
  const vistadores = { Trabalhista: { normal: ["Ana Souza"], risco: ["Carla Dias"] } };
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
      {
        area: "Trabalhista",
        tipo: "normal",
        nome: "Ana Souza",
        pessoas: [{ nome: "Ana Souza", foto: "https://foto/ana.jpg" }],
        total: 2,
        risco: 0,
        maisAntiga: "2026-11-04",
        foto: "https://foto/ana.jpg",
      },
      { area: "Trabalhista", tipo: "risco", nome: "Carla Dias", pessoas: [{ nome: "Carla Dias", foto: null }], total: 1, risco: 1, maisAntiga: "2026-11-03", foto: null },
    ]);
  });

  it("várias pessoas no mesmo tipo e quem vista todas as áreas", () => {
    const comVarios = montarVisaoGeral({
      hoje: "2026-11-05",
      dias: 1,
      arquivos: [],
      chegadas: [],
      abertas: [{ status: "juridico_vistar", area: "Cível", risco: false, dataPublicacao: "2026-11-04", duplicidadePendente: false }],
      checadas: [],
      vistadores: { Cível: { normal: ["Giovani", "Maria Caroline"], risco: ["Giancarlo"] }, "Todas as áreas": { normal: ["Ricardo Pires"] } },
    });
    const civel = comVarios.vistadores.filter((linha) => linha.area === "Cível");
    expect(civel.map((linha) => [linha.tipo, linha.pessoas.map((pessoa) => pessoa.nome), linha.total])).toEqual([
      ["normal", ["Giovani", "Maria Caroline"], 1],
      ["risco", ["Giancarlo"], 0],
    ]);
    expect(comVarios.areas.map((area) => area.area)).not.toContain("Todas as áreas");
    expect(comVarios.vistadoresDeTodas).toEqual([{ tipo: "normal", pessoas: [{ nome: "Ricardo Pires", foto: null }] }]);
  });

  it("área sem vistador cadastrado: o total da área, com o vistador a definir", () => {
    expect(visao.vistadores.filter((linha) => linha.area === "Cível")).toEqual([
      { area: "Cível", tipo: null, nome: null, pessoas: [], total: 2, risco: 1, maisAntiga: "2026-11-02", foto: null },
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
      vistadores: { Trabalhista: { normal: ["Ana Souza"], risco: ["Carla Dias"] }, Tributário: { normal: ["Bruno Lima"] } },
    });
    expect(emDia.areas.map((area) => area.area)).toEqual(["Tributário", "Trabalhista"]);
    expect(emDia.vistadores).toEqual([
      { area: "Tributário", tipo: "normal", nome: "Bruno Lima", pessoas: [{ nome: "Bruno Lima", foto: null }], total: 0, risco: 0, maisAntiga: null, foto: null },
      { area: "Tributário", tipo: "risco", nome: null, pessoas: [], total: 1, risco: 1, maisAntiga: "2026-11-01", foto: null },
      { area: "Trabalhista", tipo: "normal", nome: "Ana Souza", pessoas: [{ nome: "Ana Souza", foto: null }], total: 0, risco: 0, maisAntiga: null, foto: null },
      { area: "Trabalhista", tipo: "risco", nome: "Carla Dias", pessoas: [{ nome: "Carla Dias", foto: null }], total: 0, risco: 0, maisAntiga: null, foto: null },
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

describe("recorte do jurídico (áreas e demandas de risco)", () => {
  const aberta = (area: string | null, status: AbertaDaVisao["status"], risco: boolean, data: string, duplicidadePendente = false): AbertaDaVisao => ({
    status,
    area,
    risco,
    dataPublicacao: data,
    duplicidadePendente,
  });
  const chegada = (area: string | null, status: ChegadaDaVisao["status"], grupo: string, risco = false): ChegadaDaVisao => ({
    arquivoId: "a1",
    status,
    area,
    grupo,
    risco,
  });
  const entrada = {
    hoje: "2026-11-05",
    dias: 7 as const,
    arquivos: [{ id: "a1", data: "2026-11-05", linhas: 40 }],
    chegadas: [
      chegada("Trabalhista", "juridico_vistar", "Grupo Mazda"),
      chegada("Trabalhista", "juridico_vistar", "Grupo Mazda", true),
      chegada("Trabalhista", "checado", "Grupo Gaspec"),
      chegada("Cível", "juridico_vistar", "Grupo Mazda"),
      chegada("Tributário", "juridico_vistar", "Grupo Tributo"),
      chegada(null, "triagem_pendente", "Grupo Mazda"),
      chegada(null, "duplicidade", "Grupo Mazda"),
    ],
    abertas: [
      aberta("Trabalhista", "juridico_vistar", false, "2026-11-04"),
      aberta("Trabalhista", "juridico_vistar", true, "2026-11-01"),
      aberta("Trabalhista", "controladoria_vistar", false, "2026-11-03"),
      aberta("Trabalhista", "pronto_para_agendar", true, "2026-11-03"),
      aberta("Trabalhista", "agendado", false, "2026-11-02"),
      aberta("Trabalhista", "duplicidade", false, "2026-11-04", true),
      aberta("Cível", "juridico_vistar", false, "2026-11-05"),
      aberta("Cível", "juridico_vistar", true, "2026-10-30"),
      aberta("Tributário", "juridico_vistar", false, "2026-10-29"),
      aberta(null, "triagem_pendente", false, "2026-11-05"),
      aberta(null, "captada", false, "2026-11-05"),
    ],
    checadas: ["Trabalhista", "Tributário", null],
    vistadores: {
      Trabalhista: { normal: ["Ana Souza"], risco: ["Carla Dias"] },
      Tributário: { normal: ["Bruno Lima"] },
      "Todas as áreas": { normal: ["Ricardo Pires"], risco: ["Rui Mota"] },
    },
  };

  it("estaNoEscopo: só as áreas da pessoa e, sem risco, só as demandas normais", () => {
    expect(estaNoEscopo(ESCOPO_COMPLETO, { area: null, risco: true })).toBe(true);
    const juridico = { areas: ["Trabalhista"], veRisco: false };
    expect(estaNoEscopo(juridico, { area: "Trabalhista", risco: false })).toBe(true);
    expect(estaNoEscopo(juridico, { area: "Trabalhista" })).toBe(true);
    expect(estaNoEscopo(juridico, { area: "Trabalhista", risco: true })).toBe(false);
    expect(estaNoEscopo(juridico, { area: "Cível", risco: false })).toBe(false);
    expect(estaNoEscopo(juridico, { area: null })).toBe(false);
    expect(estaNoEscopo({ areas: [], veRisco: true }, { area: "Trabalhista" })).toBe(false);
  });

  it("a controladoria continua vendo tudo, com o escopo completo", () => {
    const visao = montarVisaoGeral(entrada);
    expect(visao.escopo).toEqual(ESCOPO_COMPLETO);
    expect(visao.etapas).toMatchObject({ triagem: 1, duplicidades: 1, vistagem: 5 });
    expect(visao.aguardandoTriagem).toBe(1);
    expect(visao.porDia).toHaveLength(7);
    expect(visao.chegada.disponiveis).toBe(40);
    expect(visao.areas.map((area) => area.area)).toEqual(expect.arrayContaining(["Trabalhista", "Cível", "Tributário"]));
  });

  it("jurídico que vista risco: só as áreas dele, sem Triagem, Duplicidades nem o arquivo da Kurier", () => {
    const visao = montarVisaoGeral({ ...entrada, escopo: { areas: ["Trabalhista"], veRisco: true } });
    expect(visao.escopo).toEqual({ areas: ["Trabalhista"], veRisco: true });
    // Etapas: só o que é da Trabalhista; Triagem e Duplicidades (abas da controladoria) zeradas.
    expect(visao.etapas).toEqual({ triagem: 0, duplicidades: 0, vistagem: 2, conferencia: 1, envio: 1, check: 1 });
    expect(visao.aguardandoTriagem).toBe(0);
    // Áreas e vistadores: nada das outras áreas, nem "Sem área".
    expect(visao.areas.map((area) => area.area)).toEqual(["Trabalhista"]);
    expect(visao.areas[0]).toMatchObject({ vistagem: 2, chegaram: 3, checadas: 1, maisAntigaParaVistar: "2026-11-01" });
    expect(visao.vistadores.map((linha) => [linha.area, linha.tipo, linha.nome, linha.total])).toEqual([
      ["Trabalhista", "normal", "Ana Souza", 1],
      ["Trabalhista", "risco", "Carla Dias", 1],
    ]);
    expect(visao.vistadoresDeTodas.map((grupo) => grupo.tipo)).toEqual(["normal", "risco"]);
    // A chegada do arquivo não vai para o jurídico (as linhas do arquivo não têm área).
    expect(visao.porDia).toEqual([]);
    expect(visao.chegada).toEqual({ disponiveis: 0, naVistagem: 0, duplicidades: 0, descartadas: 0, soNoArquivo: 0 });
    // Grupos: só o que chegou para a Trabalhista.
    expect(visao.grupos).toEqual([
      { grupo: "Grupo Mazda", total: 2, naTriagem: 0, paraVistar: 2, vistadas: 0 },
      { grupo: "Grupo Gaspec", total: 1, naTriagem: 0, paraVistar: 0, vistadas: 1 },
    ]);
  });

  it("jurídico que não vista risco: sem as demandas de risco em nenhum painel", () => {
    const visao = montarVisaoGeral({ ...entrada, escopo: { areas: ["Trabalhista", "Cível"], veRisco: false } });
    expect(visao.etapas).toEqual({ triagem: 0, duplicidades: 0, vistagem: 2, conferencia: 1, envio: 0, check: 1 });
    const trabalhista = visao.areas.find((area) => area.area === "Trabalhista");
    // A mais antiga para vistar ignora a de risco (01/11).
    expect(trabalhista).toMatchObject({ vistagem: 1, maisAntigaParaVistar: "2026-11-04" });
    expect(visao.areas.map((area) => area.area)).not.toContain("Tributário");
    // Nenhuma linha de risco: Trabalhista só nas normais; Cível (sem vistador) vira "normais" com o vistador a definir.
    expect(visao.vistadores).toEqual([
      { area: "Trabalhista", tipo: "normal", nome: "Ana Souza", pessoas: [{ nome: "Ana Souza", foto: null }], total: 1, risco: 0, maisAntiga: "2026-11-04", foto: null },
      { area: "Cível", tipo: "normal", nome: null, pessoas: [], total: 1, risco: 0, maisAntiga: "2026-11-05", foto: null },
    ]);
    expect(visao.vistadoresDeTodas).toEqual([{ tipo: "normal", pessoas: [{ nome: "Ricardo Pires", foto: null }] }]);
    expect(visao.grupos).toEqual([
      { grupo: "Grupo Mazda", total: 2, naTriagem: 0, paraVistar: 2, vistadas: 0 },
      { grupo: "Grupo Gaspec", total: 1, naTriagem: 0, paraVistar: 0, vistadas: 1 },
    ]);
  });

  it("área do jurídico sem vistador e em dia aparece; sem área cadastrada, nada", () => {
    const emDia = montarVisaoGeral({ ...entrada, abertas: [], escopo: { areas: ["Societário"], veRisco: true } });
    expect(emDia.areas).toEqual([
      { area: "Societário", chegaram: 0, vistagem: 0, conferencia: 0, envio: 0, check: 0, checadas: 0, maisAntigaParaVistar: null },
    ]);
    expect(emDia.vistadores).toEqual([]);

    const semAreas = montarVisaoGeral({ ...entrada, escopo: { areas: [], veRisco: true } });
    expect(semAreas.areas).toEqual([]);
    expect(semAreas.vistadores).toEqual([]);
    expect(semAreas.grupos).toEqual([]);
    expect(Object.values(semAreas.etapas).every((total) => total === 0)).toBe(true);
  });
});
