import { describe, expect, it } from "vitest";
import { pedeEsocial, pedeTarefaEsocial, tarefaEsocialDaLista, validarEsocial } from "./esocial";

const PROVIDENCIAS = [
  { id: "455", nome: "SOLICITAR/ATUALIZAR CÁLCULOS" },
  { id: "900", nome: "Inserir eSocial" },
];

describe("pedeEsocial", () => {
  it("só na área Trabalhista do VIOS", () => {
    expect(pedeEsocial("Trabalhista")).toBe(true);
    expect(pedeEsocial("TRABALHISTA")).toBe(true);
    expect(pedeEsocial("Cível")).toBe(false);
    expect(pedeEsocial(null)).toBe(false);
  });
});

describe("pedeTarefaEsocial", () => {
  it("Acordo homologado e Homologação de cálculo", () => {
    expect(pedeTarefaEsocial("Acordo homologado")).toBe(true);
    expect(pedeTarefaEsocial("Homologação de cálculo")).toBe(true);
    expect(pedeTarefaEsocial("Sentença – Conhecimento")).toBe(false);
    expect(pedeTarefaEsocial("Não Identificado")).toBe(false);
  });
});

describe("tarefaEsocialDaLista", () => {
  it("acha o tipo com qualquer grafia de e-social", () => {
    expect(tarefaEsocialDaLista(PROVIDENCIAS)?.id).toBe("900");
    expect(tarefaEsocialDaLista([{ id: "901", nome: "INSERIR E-SOCIAL" }])?.id).toBe("901");
    expect(tarefaEsocialDaLista([{ id: "902", nome: "INSERIR E-SOCIAL (tipo 902)", nomeVios: "INSERIR E-SOCIAL" }])?.id).toBe("902");
  });

  it("null quando o VIOS ainda não tem o tipo", () => {
    expect(tarefaEsocialDaLista(PROVIDENCIAS.slice(0, 1))).toBeNull();
  });
});

describe("validarEsocial", () => {
  const base = { areaDoCatalogo: "Trabalhista", providencias: PROVIDENCIAS, itens: [{ tarefaId: "455" }] };

  it("fora do Trabalhista grava null, seja o que vier", () => {
    expect(validarEsocial({ ...base, areaDoCatalogo: "Cível", classificacao: "Acordo homologado" })).toEqual({ ok: true, valor: null });
  });

  it("no Trabalhista a classificação é obrigatória e da lista da BKP", () => {
    expect(validarEsocial({ ...base, classificacao: null }).ok).toBe(false);
    expect(validarEsocial({ ...base, classificacao: "Sentença - Conhecimento" }).ok).toBe(false);
    expect(validarEsocial({ ...base, classificacao: "Sentença – Conhecimento" })).toEqual({ ok: true, valor: "Sentença – Conhecimento" });
  });

  it("Acordo homologado exige a tarefa Inserir E-social", () => {
    const sem = validarEsocial({ ...base, classificacao: "Acordo homologado" });
    expect(sem).toEqual({ ok: false, erro: "Acordo homologado: agende também a tarefa INSERIR E-SOCIAL." });
    const com = validarEsocial({ ...base, classificacao: "Acordo homologado", itens: [{ tarefaId: "455" }, { tarefaId: "900" }] });
    expect(com).toEqual({ ok: true, valor: "Acordo homologado" });
  });

  it("recusa quando o VIOS não tem o tipo Inserir E-social", () => {
    const resultado = validarEsocial({ ...base, classificacao: "Homologação de cálculo", providencias: PROVIDENCIAS.slice(0, 1) });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("não está na lista do VIOS");
  });
});
