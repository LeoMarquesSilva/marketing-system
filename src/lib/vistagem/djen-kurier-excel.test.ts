import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { ComunicacaoDjenGuardada, DetalheDoDia, PublicacaoKurier, ResumoDoDia } from "./djen-kurier";
import { linhasDaPlanilha, planilhaDaConferencia } from "./djen-kurier-excel";

const comunicacao = (id: number, processo: string, extra: Partial<ComunicacaoDjenGuardada> = {}): ComunicacaoDjenGuardada => ({
  id,
  data: "2026-11-11",
  processo,
  tribunal: "TJSP",
  tipo: "Intimação",
  orgao: "1ª Vara Cível",
  classe: null,
  advogados: ["275477/SP"],
  ativo: true,
  link: `https://comunica.pje.jus.br/${id}`,
  ...extra,
});
const publicacao = (id: string, processo: string, extra: Partial<PublicacaoKurier> = {}): PublicacaoKurier => ({
  id,
  djenId: null,
  data: "2026-11-11",
  processo,
  tribunal: "TJSP",
  nomeLocalizado: "GUSTAVO BISMARCHI MOTTA",
  status: "juridico_vistar",
  fonte: "orquestra",
  arquivo: "2026-11-12",
  publicacao: "2026-11-12",
  ...extra,
});
const resumo = (extra: Partial<ResumoDoDia> = {}): ResumoDoDia => ({
  data: "2026-11-11",
  publicacao: "2026-11-12",
  buscado: true,
  comKurier: true,
  emAberto: false,
  djen: 3,
  kurier: 3,
  doBkp: 1,
  nosDois: 2,
  soDjen: 1,
  soKurier: 1,
  cobertura: 2 / 3,
  ...extra,
});

const DIA_11: DetalheDoDia = {
  resumo: resumo(),
  pares: [
    { kurier: publicacao("k1", "1111111-11.2026.8.26.0100", { djenId: 101 }), djen: [comunicacao(101, "1111111-11.2026.8.26.0100")], como: "id" },
    {
      kurier: publicacao("bkp:5", "2222222-22.2026.8.26.0100", { fonte: "bkp", status: "CIÊNCIA NF", nomeLocalizado: null, arquivo: "2026-11-11" }),
      djen: [comunicacao(201, "2222222-22.2026.8.26.0100"), comunicacao(202, "2222222-22.2026.8.26.0100")],
      como: "bkp",
    },
  ],
  soKurier: [
    {
      kurier: publicacao("k9", "5555555-55.2026.5.02.0001", { djenId: 999, tribunal: "TRT2", nomeLocalizado: "RICARDO VISCARDI PIRES", status: "descartada" }),
      djenEmOutrosDias: ["2026-11-10"],
    },
  ],
  soDjen: [
    {
      djen: comunicacao(777, "0000379-29.2019.5.12.0029", { tribunal: "TRT12", tipo: "Lista de distribuição", advogados: ["275477/SP", "353389/SP"] }),
      kurierEmOutrosDias: [],
    },
  ],
};
const DIA_12: DetalheDoDia = {
  resumo: resumo({ data: "2026-11-12", publicacao: "2026-11-13", comKurier: false, emAberto: true, djen: 1, kurier: 0, doBkp: 0, nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null }),
  pares: [],
  soKurier: [],
  soDjen: [{ djen: comunicacao(888, "3333333-33.2026.8.26.0100", { data: "2026-11-12" }), kurierEmOutrosDias: ["2026-11-11"] }],
};

/** O número de série do Excel de volta para AAAA-MM-DD. */
const data = (valor: unknown) => (typeof valor === "number" ? new Date(Date.UTC(1899, 11, 30) + valor * 86_400_000).toISOString().slice(0, 10) : valor);

describe("linhasDaPlanilha", () => {
  it("uma linha por publicação, com a situação e o porquê", () => {
    const { publicacoes } = linhasDaPlanilha([DIA_11]);
    expect(publicacoes.map((linha) => [linha["Situação"], linha.Processo])).toEqual([
      ["Nos dois", "1111111-11.2026.8.26.0100"],
      ["Nos dois", "2222222-22.2026.8.26.0100"],
      ["Só na Kurier", "5555555-55.2026.5.02.0001"],
      ["Só no DJEN", "0000379-29.2019.5.12.0029"],
    ]);
    const [porId, peloBkp, soKurier, soDjen] = publicacoes;
    expect(data(porId["Publicação"])).toBe("2026-11-12");
    expect(data(porId["Disponibilização / divulgação"])).toBe("2026-11-11");
    expect(porId).toMatchObject({
      "Por quê": "Mesmo ID de comunicação nos dois.",
      "Kurier: ID da comunicação": 101,
      "Kurier: situação": "No jurídico, para vistar",
      "Kurier: origem": "Orquestra",
      "DJEN: ID da comunicação": "101",
      "Entra nos totais": "Sim",
    });
    expect(data(porId["Kurier: arquivo de"])).toBe("2026-11-12");
    expect(peloBkp).toMatchObject({
      "Por quê": "Do BKP do SIOE, que não tem o ID: casou pelo processo, no mesmo dia (2 comunicações do DJEN).",
      "Kurier: origem": "BKP do SIOE",
      "Kurier: situação": "CIÊNCIA NF",
      "DJEN: ID da comunicação": "201 | 202",
    });
    expect(soKurier).toMatchObject({
      "Por quê": "O DJEN, buscado pela OAB do Gustavo e do Ricardo, não trouxe esta comunicação.",
      "Kurier: situação": "Descartada",
      "Outro lado em outros dias": "DJEN trouxe o processo em 10/11",
      "DJEN: ID da comunicação": null,
    });
    expect(soDjen).toMatchObject({
      "Por quê": "A Kurier não trouxe esta comunicação (nem o ID, nem o processo) neste dia.",
      "DJEN: advogados": "GBM + RVP",
      "DJEN: link": "https://comunica.pje.jus.br/777",
      "Kurier: origem": null,
    });
  });

  it("o dia que ainda espera a Kurier: o DJEN aparece, com o motivo, fora dos totais", () => {
    const { publicacoes, resumo: dias } = linhasDaPlanilha([DIA_12]);
    expect(publicacoes).toHaveLength(1);
    expect(publicacoes[0]).toMatchObject({
      Situação: "Só no DJEN",
      "Por quê": "A Kurier deste dia ainda não chegou: vem no arquivo do dia da publicação.",
      "Outro lado em outros dias": "Kurier trouxe o processo em 11/11",
      "Entra nos totais": "Não: a Kurier deste dia ainda não chegou",
    });
    expect(dias[0]).toMatchObject({ DJEN: 1, Kurier: 0, "Só no DJEN": null, "Situação do dia": "Aguardando a Kurier" });
  });
});

describe("planilhaDaConferencia", () => {
  it("gera o .xlsx com as três abas, as datas certas (sem virar o dia anterior) e a cobertura em %", () => {
    const livro = XLSX.read(planilhaDaConferencia([DIA_12, DIA_11]), { type: "buffer", cellNF: true });
    expect(livro.SheetNames).toEqual(["Publicações", "Resumo por dia", "Como ler"]);
    // Como o Excel mostra: dd/mm/aaaa, no dia certo.
    const publicacoes = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets["Publicações"], { raw: false });
    expect(publicacoes).toHaveLength(5);
    expect(publicacoes.map((linha) => [linha["Publicação"], linha["Disponibilização / divulgação"], linha.Processo])).toEqual([
      ["13/11/2026", "12/11/2026", "3333333-33.2026.8.26.0100"],
      ["12/11/2026", "11/11/2026", "1111111-11.2026.8.26.0100"],
      ["12/11/2026", "11/11/2026", "2222222-22.2026.8.26.0100"],
      ["12/11/2026", "11/11/2026", "5555555-55.2026.5.02.0001"],
      ["12/11/2026", "11/11/2026", "0000379-29.2019.5.12.0029"],
    ]);
    expect(publicacoes[1]["Kurier: arquivo de"]).toBe("12/11/2026");
    expect(livro.Sheets["Publicações"]["!autofilter"]).toBeTruthy();
    const resumoPorDia = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets["Resumo por dia"], { raw: false });
    expect(resumoPorDia[1]).toMatchObject({ Publicação: "12/11/2026", Cobertura: "66.7%" });
    const comoLer = XLSX.utils.sheet_to_json<string[]>(livro.Sheets["Como ler"], { header: 1 }).flat().join(" ");
    expect(comoLer).toContain("O que o DJEN disponibilizou hoje só chega na Kurier no arquivo de amanhã");
  });

  it("avisa no Como ler quando o BKP do SIOE não veio", () => {
    const livro = XLSX.read(planilhaDaConferencia([DIA_11], { erroBkp: "o SIOE não respondeu em 20 segundos" }), { type: "buffer" });
    const comoLer = XLSX.utils.sheet_to_json<string[]>(livro.Sheets["Como ler"], { header: 1 }).flat().join(" ");
    expect(comoLer).toContain("não deu para ler o BKP do SIOE (o SIOE não respondeu em 20 segundos)");
  });
});
