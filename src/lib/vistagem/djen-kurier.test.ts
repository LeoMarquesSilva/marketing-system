import { describe, expect, it } from "vitest";
import {
  comunicacaoDaApi,
  compararDjenKurier,
  diaAnterior,
  diasDoPeriodo,
  totaisDaConferencia,
  type ComunicacaoDjenGuardada,
  type PublicacaoKurier,
} from "./djen-kurier";

const djen = (id: number, data: string, processo: string, extra: Partial<ComunicacaoDjenGuardada> = {}): ComunicacaoDjenGuardada => ({
  id,
  data,
  processo,
  tribunal: "TJSP",
  tipo: "Intimação",
  orgao: null,
  classe: null,
  advogados: ["275477/SP"],
  ativo: true,
  link: null,
  ...extra,
});
const kurier = (id: string, djenId: number | null, data: string, processo: string): PublicacaoKurier => ({
  id,
  djenId,
  data,
  processo,
  tribunal: "TJSP",
  nomeLocalizado: "GUSTAVO BISMARCHI MOTTA",
  status: "juridico_vistar",
});

describe("dias do período", () => {
  it("do mais novo ao mais antigo, atravessando o mês", () => {
    expect(diasDoPeriodo("2026-11-02", 3)).toEqual(["2026-11-02", "2026-11-01", "2026-10-31"]);
    expect(diaAnterior("2026-11-01")).toBe("2026-10-31");
  });
});

describe("compararDjenKurier", () => {
  const DIAS = ["2026-11-11", "2026-11-10"];
  const BUSCADOS = new Set(DIAS);

  it("casa pelo ID de comunicação e conta a Kurier repetida uma vez só", () => {
    const [dia11, dia10] = compararDjenKurier(
      [djen(1, "2026-11-10", "0001"), djen(2, "2026-11-10", "0002"), djen(3, "2026-11-11", "0003")],
      [kurier("k1", 1, "2026-11-10", "0001"), kurier("k1-repetida", 1, "2026-11-10", "0001"), kurier("k2", 2, "2026-11-10", "0002")],
      DIAS,
      BUSCADOS
    );
    expect(dia10).toMatchObject({ djen: 2, kurier: 2, nosDois: 2, cobertura: 1 });
    expect(dia10.soDjen).toEqual([]);
    expect(dia10.soKurier).toEqual([]);
    // 11/11: o DJEN trouxe uma que a Kurier não trouxe.
    expect(dia11).toMatchObject({ djen: 1, kurier: 0, nosDois: 0, cobertura: null });
    expect(dia11.soDjen.map((item) => item.id)).toEqual([3]);
  });

  it("sem o ID, casa pelo processo no mesmo dia; o que sobra fica só de um lado", () => {
    const [, dia10] = compararDjenKurier(
      [djen(10, "2026-11-10", "1234567-89.2026.8.26.0100"), djen(11, "2026-11-10", "9999999-99.2026.8.26.0100")],
      [kurier("k10", null, "2026-11-10", "12345678920268260100"), kurier("k-so", 555, "2026-11-10", "5555555-55.2026.5.02.0001")],
      DIAS,
      BUSCADOS
    );
    expect(dia10).toMatchObject({ djen: 2, kurier: 2, nosDois: 1, cobertura: 0.5 });
    expect(dia10.soKurier.map((item) => item.id)).toEqual(["k-so"]);
    expect(dia10.soDjen.map((item) => item.id)).toEqual([11]);
  });

  it("o par pelo ID vale mesmo com o dia diferente nos dois lados", () => {
    const [, dia10] = compararDjenKurier([djen(20, "2026-11-09", "0020")], [kurier("k20", 20, "2026-11-10", "0020")], DIAS, BUSCADOS);
    expect(dia10).toMatchObject({ kurier: 1, nosDois: 1, soKurier: [] });
  });

  it("dia sem busca no DJEN: não acusa nada da Kurier e fica fora dos totais", () => {
    const dias = compararDjenKurier([], [kurier("k1", 1, "2026-11-10", "0001")], DIAS, new Set(["2026-11-11"]));
    expect(dias[1]).toMatchObject({ buscado: false, kurier: 1, nosDois: 0, soKurier: [], cobertura: null });
    expect(totaisDaConferencia(dias)).toEqual({ djen: 0, kurier: 0, nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null });
  });

  it("totais: somam os dias buscados e dão a cobertura da Kurier pelo DJEN", () => {
    const dias = compararDjenKurier(
      [djen(1, "2026-11-10", "0001"), djen(2, "2026-11-11", "0002"), djen(3, "2026-11-11", "0003")],
      [kurier("k1", 1, "2026-11-10", "0001"), kurier("k2", 2, "2026-11-11", "0002"), kurier("k9", 9, "2026-11-11", "0009")],
      DIAS,
      BUSCADOS
    );
    expect(totaisDaConferencia(dias)).toEqual({ djen: 3, kurier: 3, nosDois: 2, soDjen: 1, soKurier: 1, cobertura: 2 / 3 });
  });
});

describe("comunicacaoDaApi", () => {
  it("guarda o que a conferência usa, com o advogado que a achou", () => {
    expect(
      comunicacaoDaApi(
        {
          id: 780620758,
          data_disponibilizacao: "2026-11-10",
          numeroprocessocommascara: "0000379-29.2019.5.12.0029",
          siglaTribunal: "TRT12",
          tipoComunicacao: "Lista de distribuição",
          nomeOrgao: "Gab. Des. Marcos Vinicio Zanchetta",
          ativo: true,
          link: "https://comunica.pje.jus.br/x",
        },
        "275477/SP"
      )
    ).toEqual({
      id: 780620758,
      data: "2026-11-10",
      processo: "0000379-29.2019.5.12.0029",
      tribunal: "TRT12",
      tipo: "Lista de distribuição",
      orgao: "Gab. Des. Marcos Vinicio Zanchetta",
      classe: null,
      advogados: ["275477/SP"],
      ativo: true,
      link: "https://comunica.pje.jus.br/x",
    });
  });

  it("sem ID ou sem data, não vale", () => {
    expect(comunicacaoDaApi({ data_disponibilizacao: "2026-11-10" }, "275477/SP")).toBeNull();
    expect(comunicacaoDaApi({ id: 1, data_disponibilizacao: "10/11/2026" }, "275477/SP")).toBeNull();
  });
});
