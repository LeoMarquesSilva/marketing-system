import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ordem: string[] = [];
function etapa<T>(nome: string, resultado: T) {
  return vi.fn(async () => {
    ordem.push(nome);
    return resultado;
  });
}

const mocks = vi.hoisted(() => ({
  sincronizarPastasVios: vi.fn(),
  sincronizarKurierSharePoint: vi.fn(),
  repassarPendentesACentral: vi.fn(),
  repassarAoBkp: vi.fn(),
  gerarSugestoesDeTriagem: vi.fn(),
  gerarSugestoesPendentes: vi.fn(),
  atualizarEnvios: vi.fn(),
}));

vi.mock("./pastas-vios", () => ({ sincronizarPastasVios: mocks.sincronizarPastasVios }));
vi.mock("./server", () => ({ sincronizarKurierSharePoint: mocks.sincronizarKurierSharePoint }));
vi.mock("./central-server", () => ({ repassarPendentesACentral: mocks.repassarPendentesACentral }));
vi.mock("./bkp-sioe-server", () => ({ repassarAoBkp: mocks.repassarAoBkp }));
vi.mock("./sugestao-triagem-server", () => ({ gerarSugestoesDeTriagem: mocks.gerarSugestoesDeTriagem }));
vi.mock("./sugestao-ia-server", () => ({ gerarSugestoesPendentes: mocks.gerarSugestoesPendentes }));
vi.mock("./juridico-server", () => ({ atualizarEnvios: mocks.atualizarEnvios }));

import { completarRodadaDaKurier, rodarRodadaDaKurier } from "./rodada-kurier-server";

const sincronizacao = {
  verificados: 1,
  importados: 0,
  resultados: [{ nome: "bismarchi.pires.adv2_Lote-01_23112026.xlsx", situacao: "ja_importado" as const }],
  triagem: { triadas: 5, juridico: 0, pendentes: 5, descartadas: 0, porEscritorio: {} },
};

beforeEach(() => {
  ordem.length = 0;
  for (const mock of Object.values(mocks)) mock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.sincronizarPastasVios.mockImplementation(etapa("pastas", { pastas: 35109 }));
  mocks.sincronizarKurierSharePoint.mockImplementation(etapa("sharepoint", sincronizacao));
  mocks.repassarPendentesACentral.mockImplementation(etapa("central", { pendentes: 0, enviadas: 0, erros: 0 }));
  mocks.repassarAoBkp.mockImplementation(etapa("bkp", { ligado: true, gravadas: 1204, faltavam: 0 }));
  mocks.gerarSugestoesDeTriagem.mockImplementation(
    etapa("sugestoesPasta", { pendentes: 0, geradas: 0, porNumero: 0, porParte: 0, porIa: 0, erros: 0, custoUS: 0 })
  );
  mocks.gerarSugestoesPendentes.mockImplementation(etapa("sugestoesIa", { pendentes: 28, geradas: 28, erros: 0, custoUS: 0.0055 }));
  mocks.atualizarEnvios.mockImplementation(etapa("envios", { consultadas: 0, concluidas: 0, erros: 0, checadasSozinhas: 0 }));
});

describe("rodada da Kurier (cron e botão Buscar no SharePoint)", () => {
  it("roda tudo o que o cron roda, na mesma ordem: pastas do VIOS antes de triar o dia", async () => {
    const rodada = await rodarRodadaDaKurier();
    expect(ordem).toEqual(["pastas", "sharepoint", "central", "bkp", "sugestoesPasta", "sugestoesIa", "envios"]);
    expect(rodada).toMatchObject({
      ...sincronizacao,
      pastasVios: { pastas: 35109 },
      bkp: { ligado: true, gravadas: 1204 },
      sugestoesIa: { geradas: 28 },
    });
    expect(mocks.gerarSugestoesDeTriagem).toHaveBeenCalledWith(60_000);
    expect(mocks.gerarSugestoesPendentes).toHaveBeenCalledWith(150_000);
  });

  it("uma etapa que falha vira { erro } e as seguintes rodam", async () => {
    mocks.repassarAoBkp.mockRejectedValue(new Error("SIOE fora do ar"));
    mocks.sincronizarPastasVios.mockRejectedValue(new Error("Processos Lista não encontrado"));
    const rodada = await rodarRodadaDaKurier();
    expect(rodada.bkp).toEqual({ erro: "SIOE fora do ar" });
    expect(rodada.pastasVios).toEqual({ erro: "Processos Lista não encontrado" });
    expect(ordem).toEqual(["sharepoint", "central", "sugestoesPasta", "sugestoesIa", "envios"]);
    expect(rodada.envios).toMatchObject({ consultadas: 0 });
  });

  it("sem conseguir listar o SharePoint, a rodada para (o cron responde 500, o botão mostra o erro)", async () => {
    mocks.sincronizarKurierSharePoint.mockRejectedValue(new Error("Graph 503"));
    await expect(rodarRodadaDaKurier()).rejects.toThrow("Graph 503");
    expect(ordem).toEqual(["pastas"]);
  });

  it("o envio do xlsx completa a rodada sem ir ao SharePoint", async () => {
    const etapas = await completarRodadaDaKurier();
    expect(ordem).toEqual(["central", "bkp", "sugestoesPasta", "sugestoesIa", "envios"]);
    expect(Object.keys(etapas).sort()).toEqual(["bkp", "central", "envios", "sugestoesIa", "sugestoesPasta"]);
    expect(mocks.sincronizarKurierSharePoint).not.toHaveBeenCalled();
  });
});
