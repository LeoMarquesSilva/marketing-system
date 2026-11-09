import { describe, expect, it } from "vitest";
import { enviarDoPrazo, mudancasNaTarefa, podeEditarNaConferencia, type CamposDaTarefa } from "./ajuste-conferencia";

const BASE: CamposDaTarefa = {
  data: "2026-11-17",
  dataFatal: "2026-11-20",
  hora: null,
  horaFim: null,
  responsavel: "Ana Souza",
  revisor: "Bia Lima",
  fluxoDatas: [],
};

describe("podeEditarNaConferencia", () => {
  it("só enquanto a mudança ainda chega ao VIOS", () => {
    expect(podeEditarNaConferencia("controladoria_vistar", "nao_enviado")).toBe(true);
    expect(podeEditarNaConferencia("pronto_para_agendar", "erro")).toBe(true);
    // Com o robô ou já lançada.
    expect(podeEditarNaConferencia("pronto_para_agendar", "pendente")).toBe(false);
    expect(podeEditarNaConferencia("pronto_para_agendar", "processando")).toBe(false);
    expect(podeEditarNaConferencia("pronto_para_agendar", "concluido")).toBe(false);
    expect(podeEditarNaConferencia("agendado", "concluido")).toBe(false);
    // Voltou para o jurídico: quem mexe agora é ele.
    expect(podeEditarNaConferencia("juridico_vistar", "nao_enviado")).toBe(false);
  });
});

describe("mudancasNaTarefa", () => {
  it("SESSÃO DE JULGAMENTO: registra a data limite que mudou (sem gravada, era a própria data)", () => {
    const sessao: CamposDaTarefa = { ...BASE, dataFatal: null, data: "2026-11-19", hora: "09:00", horaFim: "18:00", dataLimite: null };
    expect(mudancasNaTarefa(sessao, { ...sessao, dataLimite: "2026-11-19" })).toEqual([]);
    expect(mudancasNaTarefa(sessao, { ...sessao, dataLimite: "2026-11-25" })).toEqual([{ campo: "Data limite", de: "19/11/2026", para: "25/11/2026" }]);
  });

  it("sem mudança, lista vazia", () => {
    expect(mudancasNaTarefa(BASE, { ...BASE })).toEqual([]);
  });

  it("data fatal e Enviar, em dd/mm/aaaa", () => {
    expect(mudancasNaTarefa(BASE, { ...BASE, dataFatal: "2026-11-24", data: "2026-11-19" })).toEqual([
      { campo: "Data fatal", de: "20/11/2026", para: "24/11/2026" },
      { campo: "Enviar no VIOS", de: "17/11/2026", para: "19/11/2026" },
    ]);
  });

  it("sem fatal, a data é só a data no VIOS", () => {
    const providencia = { ...BASE, dataFatal: null, revisor: null };
    expect(mudancasNaTarefa(providencia, { ...providencia, data: "2026-11-18" })).toEqual([{ campo: "Data no VIOS", de: "17/11/2026", para: "18/11/2026" }]);
  });

  it("horário do Compromisso", () => {
    const compromisso = { ...BASE, dataFatal: null, hora: "09:00", horaFim: "10:00" };
    expect(mudancasNaTarefa(compromisso, { ...compromisso, hora: "14:30", horaFim: "15:30" })).toEqual([
      { campo: "Horário", de: "09:00", para: "14:30" },
      { campo: "Hora final", de: "10:00", para: "15:30" },
    ]);
  });

  it("pessoas: acento, maiúscula e ordem não contam como mudança", () => {
    const duas = { ...BASE, responsavel: "Ana Souza, João Melo" };
    expect(mudancasNaTarefa(duas, { ...duas, responsavel: "JOÃO MELO, Ana Souza" })).toEqual([]);
    expect(mudancasNaTarefa(duas, { ...duas, responsavel: "Joao Melo, Ana Souza" })).toEqual([]);
    expect(mudancasNaTarefa(BASE, { ...BASE, responsavel: "Carla Dias" })).toEqual([{ campo: "Responsável", de: "Ana Souza", para: "Carla Dias" }]);
  });

  it("tirar o revisor diz que ficou sem revisor", () => {
    expect(mudancasNaTarefa(BASE, { ...BASE, revisor: null })).toEqual([{ campo: "Revisor", de: "Bia Lima", para: "sem revisor" }]);
  });

  it("no fluxo, data e responsável pelo caminho da tarefa, e a volta ao padrão do VIOS", () => {
    const caminho = ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"];
    expect(mudancasNaTarefa(BASE, { ...BASE, fluxoDatas: [{ caminho, data: "2026-11-18", responsaveis: ["Carla Dias"] }] })).toEqual([
      { campo: "EMBARGOS DE DECLARAÇÃO › 2. REVISAR: data", de: "a do VIOS", para: "18/11/2026" },
      { campo: "EMBARGOS DE DECLARAÇÃO › 2. REVISAR: responsável", de: "o padrão", para: "Carla Dias" },
    ]);
    expect(mudancasNaTarefa({ ...BASE, fluxoDatas: [{ caminho, data: "2026-11-18" }] }, BASE)).toEqual([
      { campo: "EMBARGOS DE DECLARAÇÃO › 2. REVISAR: data", de: "18/11/2026", para: "a do VIOS" },
    ]);
  });

  it("o mesmo tipo em dois caminhos do fluxo conta separado", () => {
    const antes = { ...BASE, fluxoDatas: [{ caminho: ["2. REVISAR"], data: "2026-11-18" }] };
    const depois = { ...BASE, fluxoDatas: [{ caminho: ["2. REVISAR"], data: "2026-11-18" }, { caminho: ["EMBARGOS", "2. REVISAR"], data: "2026-11-12" }] };
    expect(mudancasNaTarefa(antes, depois)).toEqual([{ campo: "EMBARGOS › 2. REVISAR: data", de: "a do VIOS", para: "12/11/2026" }]);
  });
});

describe("enviarDoPrazo", () => {
  const contexto = { calculado: "2026-11-17", anterior: "2026-11-17", fatal: "2026-11-20", hoje: "2026-11-09" };

  it("vazio ou inválido segue a conta pela fatal", () => {
    expect(enviarDoPrazo("", contexto)).toEqual({ ok: true, data: "2026-11-17" });
    expect(enviarDoPrazo(null, contexto)).toEqual({ ok: true, data: "2026-11-17" });
    expect(enviarDoPrazo("2026-13-40", contexto)).toEqual({ ok: true, data: "2026-11-17" });
  });

  it("escolhido à mão vale como está", () => {
    expect(enviarDoPrazo("2026-11-12", contexto)).toEqual({ ok: true, data: "2026-11-12" });
    expect(enviarDoPrazo("2026-11-20", contexto)).toEqual({ ok: true, data: "2026-11-20" });
  });

  it("não passa da fatal", () => {
    expect(enviarDoPrazo("2026-11-21", contexto)).toEqual({ ok: false, erro: "A data do Enviar não pode ficar depois da data fatal." });
  });

  it("não vai para o passado, a não ser que já fosse a da tarefa", () => {
    expect(enviarDoPrazo("2026-11-06", contexto)).toEqual({ ok: false, erro: "A data do Enviar não pode ficar no passado." });
    expect(enviarDoPrazo("2026-11-06", { ...contexto, anterior: "2026-11-06" })).toEqual({ ok: true, data: "2026-11-06" });
    expect(enviarDoPrazo("2026-11-09", contexto)).toEqual({ ok: true, data: "2026-11-09" });
  });
});
