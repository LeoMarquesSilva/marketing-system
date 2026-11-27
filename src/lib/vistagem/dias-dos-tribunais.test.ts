import { describe, expect, it } from "vitest";
import { avisoDaFatal, expedienteDoTribunal, fatalComExpediente } from "./dias-dos-tribunais";
import { criarCalendarioDePrazo } from "./dias-uteis";

// Dia útil fora do recesso forense, sem outros feriados.
const ehDiaDePrazo = criarCalendarioDePrazo([]);
const semExpediente = (tribunal: string, djen_orgao: string | null = null) => expedienteDoTribunal({ tribunal, djen_orgao }).semExpediente;
const fatal = (iso: string, tribunal: string, orgao: string | null = null) => fatalComExpediente(iso, semExpediente(tribunal, orgao), ehDiaDePrazo);

describe("expediente do tribunal (Dia da Justiça 2026, planilha do Samuel)", () => {
  it("TJSP e TRT-15 fecham em 07 e 08/12", () => {
    for (const tribunal of ["TJSP", "TRT15"]) expect(Object.keys(semExpediente(tribunal)).sort()).toEqual(["2026-12-07", "2026-12-08"]);
  });

  it("TRF-3 fecha só em 08/12; TRT-2 só em 07/12, e em 08/12 nas 5 cidades com feriado municipal", () => {
    expect(Object.keys(semExpediente("TRF3"))).toEqual(["2026-12-08"]);
    expect(Object.keys(semExpediente("TRT2", "1ª Vara do Trabalho de Santo André"))).toEqual(["2026-12-07"]);
    expect(Object.keys(semExpediente("TRT2", "15ª Turma"))).toEqual(["2026-12-07"]);
    for (const orgao of ["6ª Vara do Trabalho de Guarulhos", "1ª Vara do Trabalho de Mauá", "Vara do Trabalho de Franco da Rocha"]) {
      expect(Object.keys(semExpediente("TRT2", orgao)).sort()).toEqual(["2026-12-07", "2026-12-08"]);
    }
  });

  it("TJRO: 08/12 só fecha em Guajará-Mirim e Candeias do Jamari", () => {
    expect(expedienteDoTribunal({ tribunal: "TJRO", djen_orgao: "1ª Vara Cível de Porto Velho" }).comExpediente).toEqual(["2026-12-08"]);
    expect(Object.keys(semExpediente("TJRO", "Vara Única de Guajara Mirim")).sort()).toEqual(["2026-12-07", "2026-12-08"]);
  });

  it("TJPR, TJTO e TRT-9: 07 e 08/12 com expediente; o feriado é 18/12", () => {
    for (const tribunal of ["TJPR", "TJTO", "TRT9"]) {
      const { semExpediente: sem, comExpediente } = expedienteDoTribunal({ tribunal });
      expect(comExpediente).toEqual(["2026-12-07", "2026-12-08"]);
      expect(Object.keys(sem)).toEqual(["2026-12-18"]);
    }
  });

  it("aceita o tribunal escrito de outro jeito (TRT-02, trt2, TJDF); sem tribunal ou fora da lista (STM), nada", () => {
    expect(expedienteDoTribunal({ tribunal: "TRT-02" }).comExpediente).toEqual(["2026-12-08"]);
    expect(expedienteDoTribunal({ tribunal: "trt2" }).comExpediente).toEqual(["2026-12-08"]);
    expect(Object.keys(semExpediente("TJDF")).sort()).toEqual(["2026-12-07", "2026-12-08"]);
    expect(semExpediente("STM")).toEqual({});
    expect(expedienteDoTribunal({ tribunal: null }).semExpediente).toEqual({});
  });
});

describe("data fatal em dia sem expediente (regra de 27/11/2026)", () => {
  it("TJSP: fatal em 07 ou 08/12 vai para 09/12; 09/12 e outros dias ficam", () => {
    expect(fatal("2026-12-07", "TJSP")).toBe("2026-12-09");
    expect(fatal("2026-12-08", "TJSP")).toBe("2026-12-09");
    expect(fatal("2026-12-09", "TJSP")).toBe("2026-12-09");
    expect(fatal("2026-12-04", "TJSP")).toBe("2026-12-04");
  });

  it("TRT-2: 07/12 vai para 08/12, menos em Guarulhos (vai para 09/12); TRF-3: 07/12 fica, 08/12 vai para 09/12", () => {
    expect(fatal("2026-12-07", "TRT2", "3ª Vara do Trabalho de Santo André")).toBe("2026-12-08");
    expect(fatal("2026-12-07", "TRT2", "5ª Vara do Trabalho de Guarulhos")).toBe("2026-12-09");
    expect(fatal("2026-12-07", "TRF3")).toBe("2026-12-07");
    expect(fatal("2026-12-08", "TRF3")).toBe("2026-12-09");
  });

  it("TJPR: 07 e 08/12 ficam; 18/12 (sexta) cai no recesso e vai para 21/01/2027", () => {
    expect(fatal("2026-12-07", "TJPR")).toBe("2026-12-07");
    expect(fatal("2026-12-08", "TJPR")).toBe("2026-12-08");
    expect(fatal("2026-12-18", "TJPR")).toBe("2027-01-21");
  });

  it("data vazia ou inválida volta como veio", () => {
    expect(fatal("", "TJSP")).toBe("");
    expect(fatal("07/12/2026", "TJSP")).toBe("07/12/2026");
  });

  it("aviso: bloqueia a fatal gravada num dia sem expediente e explica a de 09/12", () => {
    const sem = semExpediente("TJSP");
    expect(avisoDaFatal("2026-12-07", sem, ehDiaDePrazo)).toEqual({
      bloqueia: true,
      texto: "A data fatal 07/12/2026 não pode ficar nesse dia (Dia da Justiça: sem expediente no TJSP). Use 09/12/2026.",
    });
    expect(avisoDaFatal("2026-12-09", sem, ehDiaDePrazo)).toEqual({
      bloqueia: false,
      texto: "Em 07/12/2026 e 08/12/2026, Dia da Justiça: sem expediente no TJSP. A fatal desses dias passa para 09/12/2026.",
    });
    expect(avisoDaFatal("2026-12-10", sem, ehDiaDePrazo)).toBeNull();
    expect(avisoDaFatal(null, sem, ehDiaDePrazo)).toBeNull();
    expect(avisoDaFatal("2026-12-07", semExpediente("TRF3"), ehDiaDePrazo)).toBeNull();
  });
});
