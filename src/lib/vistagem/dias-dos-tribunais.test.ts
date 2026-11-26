import { describe, expect, it } from "vitest";
import { comOExpedienteDoTribunal, expedienteDoTribunal } from "./dias-dos-tribunais";

// O feriado 434 do VIOS (Dia da Justiça, 07 e 08/12/2026, 1º e 2º grau de SP), como o calendário recebe.
const VIOS_SP = { "2026-12-07": "Dia da Justiça", "2026-12-08": "Dia da Justiça" };

describe("expediente do tribunal (Dia da Justiça 2026, planilha do Samuel)", () => {
  it("TJSP e TRT-15 fecham nos dois dias, com ou sem o feriado no VIOS", () => {
    for (const tribunal of ["TJSP", "TRT15"]) {
      expect(Object.keys(comOExpedienteDoTribunal({}, { tribunal })).sort()).toEqual(["2026-12-07", "2026-12-08"]);
      expect(Object.keys(comOExpedienteDoTribunal(VIOS_SP, { tribunal })).sort()).toEqual(["2026-12-07", "2026-12-08"]);
    }
  });

  it("TRF-3 funciona em 07/12 (sai do feriado do VIOS) e fecha em 08/12", () => {
    const dias = comOExpedienteDoTribunal(VIOS_SP, { tribunal: "TRF3", djen_orgao: "1ª Vara Federal de São Paulo" });
    expect(Object.keys(dias)).toEqual(["2026-12-08"]);
    expect(dias["2026-12-08"]).toBe("Dia da Justiça: sem expediente no TRF3");
  });

  it("TRT-2 fecha em 07/12 e funciona em 08/12, menos nas 5 cidades com feriado municipal", () => {
    expect(Object.keys(comOExpedienteDoTribunal(VIOS_SP, { tribunal: "TRT2", djen_orgao: "1ª Vara do Trabalho de Santo André" }))).toEqual([
      "2026-12-07",
    ]);
    expect(Object.keys(comOExpedienteDoTribunal(VIOS_SP, { tribunal: "TRT2", djen_orgao: "15ª Turma" }))).toEqual(["2026-12-07"]);
    for (const orgao of ["6ª Vara do Trabalho de Guarulhos", "1ª Vara do Trabalho de Mauá", "Vara do Trabalho de Franco da Rocha"]) {
      const dias = comOExpedienteDoTribunal(VIOS_SP, { tribunal: "TRT2", djen_orgao: orgao });
      expect(Object.keys(dias).sort()).toEqual(["2026-12-07", "2026-12-08"]);
      expect(dias["2026-12-08"]).toBe("Dia da Justiça (feriado municipal): sem expediente no TRT2");
    }
  });

  it("TJRO: 08/12 só fecha em Guajará-Mirim e Candeias do Jamari", () => {
    expect(expedienteDoTribunal({ tribunal: "TJRO", djen_orgao: "1ª Vara Cível de Porto Velho" }).comExpediente).toEqual(["2026-12-08"]);
    expect(Object.keys(expedienteDoTribunal({ tribunal: "TJRO", djen_orgao: "Vara Única de Guajara Mirim" }).semExpediente).sort()).toEqual([
      "2026-12-07",
      "2026-12-08",
    ]);
  });

  it("TJPR, TJTO e TRT-9: 07 e 08/12 livres; o feriado vai para 18/12", () => {
    for (const tribunal of ["TJPR", "TJTO", "TRT9"]) {
      const { semExpediente, comExpediente } = expedienteDoTribunal({ tribunal });
      expect(comExpediente).toEqual(["2026-12-07", "2026-12-08"]);
      expect(Object.keys(semExpediente)).toEqual(["2026-12-18"]);
    }
  });

  it("superiores fecham nos dois dias; sem tribunal ou fora da lista (STM), fica o que o VIOS diz", () => {
    expect(Object.keys(comOExpedienteDoTribunal({}, { tribunal: "STJ" })).sort()).toEqual(["2026-12-07", "2026-12-08"]);
    expect(comOExpedienteDoTribunal(VIOS_SP, { tribunal: "STM" })).toEqual(VIOS_SP);
    expect(comOExpedienteDoTribunal(VIOS_SP, { tribunal: null })).toEqual(VIOS_SP);
  });

  it("aceita o tribunal escrito de outro jeito (TRT-02, trt2, TJDF)", () => {
    expect(expedienteDoTribunal({ tribunal: "TRT-02" }).comExpediente).toEqual(["2026-12-08"]);
    expect(expedienteDoTribunal({ tribunal: "trt2" }).comExpediente).toEqual(["2026-12-08"]);
    expect(Object.keys(expedienteDoTribunal({ tribunal: "TJDF" }).semExpediente).sort()).toEqual(["2026-12-07", "2026-12-08"]);
  });

  it("não mexe nos outros feriados do VIOS (Natal, Carnaval)", () => {
    const vios = { "2026-12-25": "Natal", "2027-02-08": "Carnaval" };
    expect(comOExpedienteDoTribunal(vios, { tribunal: "TRF3" })).toEqual({ ...vios, "2026-12-08": "Dia da Justiça: sem expediente no TRF3" });
  });
});
