import { describe, expect, it } from "vitest";
import { validarInconsistencia } from "./inconsistencias";

describe("validarInconsistencia", () => {
  it("aceita inconsistência do jurídico com tipo da lista e descrição", () => {
    expect(validarInconsistencia("juridico", { tipo: "CONTAGEM DE PRAZO", descricao: " prazo é de 8 dias " })).toEqual({
      ok: true,
      valor: { tipo: "CONTAGEM DE PRAZO", subtipo: null, descricao: "prazo é de 8 dias" },
    });
  });

  it("exige descrição e tipo da lista", () => {
    expect(validarInconsistencia("juridico", { tipo: "CONTAGEM DE PRAZO", descricao: "  " }).ok).toBe(false);
    expect(validarInconsistencia("juridico", { tipo: "AGENDAMENTO", descricao: "x" }).ok).toBe(false);
  });

  it("exige subtipo da lista na inconsistência de agendamento", () => {
    expect(validarInconsistencia("agendamento", { tipo: "AGENDAMENTO", descricao: "data errada" }).ok).toBe(false);
    expect(validarInconsistencia("agendamento", { tipo: "AGENDAMENTO", subtipo: "INVENTADO", descricao: "data errada" }).ok).toBe(false);
    expect(validarInconsistencia("agendamento", { tipo: "AGENDAMENTO", subtipo: "DATA", descricao: "data errada" })).toEqual({
      ok: true,
      valor: { tipo: "AGENDAMENTO", subtipo: "DATA", descricao: "data errada" },
    });
  });
});
