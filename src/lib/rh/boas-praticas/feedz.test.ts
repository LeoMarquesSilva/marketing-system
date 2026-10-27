import { describe, expect, it } from "vitest";
import {
  feedzChange,
  feedzDateTime,
  feedzMentionedPerson,
  feedzOccurrenceText,
  feedzPrefill,
  matchFeedzRows,
  parseFeedzSheet,
  sameName,
} from "./feedz";
import type { FeedbackPerson, GoodPracticeFeedback } from "./types";

const HEADER = ["De", "Matrícula", "Para", "Matrícula", "Para Unidade", "Para Departamento", "Cargo", "Anônimo", "Template", "Feedback", "Avaliação", "Data", "Data de Visualização do Feedback"];

function line(to: string, message: string, sent: string, viewed: string | null, department = "Diretoria") {
  return ["Ana RH", "01", to, null, "Sócios e Diretoria", department, "Assistente", "Não", "N/A", message, null, sent, viewed];
}

const people: FeedbackPerson[] = [
  { id: "p-gestor", full_name: "Paulo Teixeira Rocha", short_name: "Paulo Rocha", department: "Sócio", position: "Sócio", is_active: true, avatar_url: null },
  { id: "p-gestora", full_name: "Marta Lima Souza", short_name: "Marta Lima", department: "Reestruturação", position: "Gerente", is_active: true, avatar_url: null },
  { id: "p-bruno", full_name: "Bruno Alves Costa", short_name: "Bruno Costa", department: "Trabalhista", position: "Advogado", is_active: true, avatar_url: null },
  { id: "p-diego", full_name: "Diego Martins Prado", short_name: "Diego Prado", department: "Contratos", position: "Sócio", is_active: true, avatar_url: null },
  { id: "p-otavio", full_name: "Otávio Nunes", short_name: "Otávio Nunes", department: "Cível", position: "Advogado", is_active: true, avatar_url: null },
];

let seq = 0;
function feedback(overrides: Partial<GoodPracticeFeedback>): GoodPracticeFeedback {
  seq += 1;
  return {
    id: `f${seq}`,
    occurred_on: "2026-09-28",
    sent_on: "2026-09-29",
    employee_id: null,
    employee_name: "Pessoa",
    is_team: false,
    manager_employee_id: "p-gestor",
    manager_name: "Paulo Teixeira Rocha",
    area: "Trabalhista",
    category: "Outros",
    subtopic: null,
    description: "Ocorrência",
    manager_action: null,
    responded_on: null,
    viewed: null,
    viewed_on: null,
    source: "planilha",
    created_at: "2026-09-29T12:00:00Z",
    updated_at: "2026-09-29T12:00:00Z",
    created_by_name: null,
    photo_count: 0,
    feedz_key: null,
    feedz_sent_at: null,
    feedz_viewed_at: null,
    ...overrides,
  };
}

const sheet = [
  HEADER,
  line("Paulo Rocha", "REGISTRO DE OCORRÊNCIA | BOAS PRÁTICAS NO ESCRITÓRIO Prezado(a) Dr. Paulo, boa tarde. Identificamos em 28/09/2026 que o colaborador BRUNO ALVES, utilizou a Sala de Reunião 01 para reunião ao final, deixou o fio de extensão sobre a mesa. Diante do ocorrido, solicitamos...", "2026-09-29 12:14:23", null),
  line("Paulo Rocha", "REGISTRO DE OCORRÊNCIA | BOAS PRÁTICAS NO ESCRITÓRIO Prezado(a) Dr. Paulo, boa tarde. Identificamos em 28/09/2026 que o colaborador DIEGO MARTINS, utilizou a Sala de Reunião 01 para reunião ao final, deixou o fio de extensão sobre a mesa. Diante do ocorrido...", "2026-09-29 12:15:38", null),
  line("Paulo Rocha", "REGISTRO DE OCORRÊNCIA | BOAS PRÁTICAS NO ESCRITÓRIO Prezado Dr. Paulo, boa tarde. Informamos que o colaborador BRUNO ALVES utilizou a Biblioteca para a realização de uma reunião online. Após a finalização, foram deixadas poltronas desalinhadas e o menu de cafés fora do lugar. Diante do ocorrido...", "2026-09-29 12:25:50", "2026-10-02 09:10:00"),
  line("Marta Lima", "Registro de ocorrência | Boas práticas no escritório Prezado(a) Marta, boa tarde. Identificamos que em uma das paredes da sala de Reestruturação tem vários respingos de café. Diante do ocorrido...", "2026-09-18 17:38:44", "2026-09-18 17:43:05", "Reestruturação"),
  line("Paulo Rocha", "Prezado Dr. Paulo, bom dia. O colaborador OTÁVIO usou a vaga de clientes. Diante do ocorrido...", "2026-09-30 10:00:00", null),
];

const records = [
  feedback({ id: "extensao-bruno", employee_id: "p-bruno", employee_name: "Bruno Alves Costa", description: "Uso incorreto da sala de reunião 01 - deixou o cabo de extensão sobre a mesa" }),
  feedback({ id: "extensao-diego", employee_id: "p-diego", employee_name: "Diego Martins Prado", area: "Societário e Contratos", description: "Uso incorreto da sala de reunião 01 - deixou o cabo de extensão sobre a mesa" }),
  feedback({ id: "biblioteca-bruno", employee_id: "p-bruno", employee_name: "Bruno Alves Costa", occurred_on: "2026-09-29", description: "Uso incorreto da biblioteca - após reunião online deixou poltronas desalinhadas e menu de cafés fora do lugar" }),
  feedback({ id: "parede", employee_name: "Equipe Reestruturação", is_team: true, manager_employee_id: "p-gestora", manager_name: "Marta Lima Souza", sent_on: "2026-09-18", area: "Reestruturação", description: "Respingos de café na parede", viewed: true, viewed_on: "2026-09-18" }),
];

describe("parseFeedzSheet", () => {
  it("acha as colunas pelo nome e normaliza as datas", () => {
    const { rows, error } = parseFeedzSheet(sheet);
    expect(error).toBeNull();
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ line: 2, to: "Paulo Rocha", sentAt: "2026-09-29T12:14:23-03:00", sentOn: "2026-09-29", viewedAt: null });
    expect(rows[2].viewedAt).toBe("2026-10-02T09:10:00-03:00");
    expect(rows[0].key).toBe("paulo rocha|2026-09-29T12:14:23");
  });

  it("recusa arquivo que não é do Feedz", () => {
    expect(parseFeedzSheet([["Nome", "E-mail"], ["x", "y"]]).error).toMatch(/colunas do relatório/);
  });
});

describe("feedzDateTime", () => {
  it("aceita texto, data brasileira e serial do Excel", () => {
    expect(feedzDateTime("29/09/2026 12:14")).toBe("2026-09-29T12:14:00-03:00");
    expect(feedzDateTime(46294.5)).toBe("2026-09-29T12:00:00-03:00");
    expect(feedzDateTime("")).toBeNull();
  });
});

describe("matchFeedzRows", () => {
  const { rows } = parseFeedzSheet(sheet);
  const matches = matchFeedzRows(rows, records, people);

  it("separa os dois feedbacks da mesma pessoa no mesmo dia pelo assunto", () => {
    expect(matches[0]).toMatchObject({ feedbackId: "extensao-bruno", status: "encontrado" });
    expect(matches[1]).toMatchObject({ feedbackId: "extensao-diego", status: "encontrado" });
    expect(matches[2]).toMatchObject({ feedbackId: "biblioteca-bruno", status: "encontrado" });
  });

  it("calcula a mudança de visualização", () => {
    expect(matches[0].change).toEqual({ viewed: false, viewedOn: null });
    expect(matches[2].change).toEqual({ viewed: true, viewedOn: "2026-10-02" });
    // Equipe: já estava visto na mesma data.
    expect(matches[3]).toMatchObject({ feedbackId: "parede", change: null });
  });

  it("linha sem registro no módulo fica para registrar", () => {
    expect(matches[4]).toMatchObject({ status: "sem_registro", feedbackId: null });
  });

  it("na reimportação acha pela chave", () => {
    const linked = records.map((record) => (record.id === "extensao-diego" ? { ...record, feedz_key: rows[1].key } : record));
    const again = matchFeedzRows(rows, linked, people);
    expect(again[1]).toMatchObject({ status: "ligado", feedbackId: "extensao-diego" });
    expect(again[0].feedbackId).toBe("extensao-bruno");
  });
});

describe("feedzChange", () => {
  it("nunca rebaixa visto para não visto", () => {
    const row = parseFeedzSheet(sheet).rows[0];
    expect(feedzChange(row, { viewed: true, viewed_on: "2026-09-20" })).toEqual({ change: null, keptViewed: true });
  });
});

describe("registrar a partir do Feedz", () => {
  it("tira cabeçalho, saudação e texto padrão", () => {
    const text = feedzOccurrenceText(String(sheet[4][9]));
    expect(text).toBe("Identificamos que em uma das paredes da sala de Reestruturação tem vários respingos de café.");
  });

  it("acha o colaborador citado, inclusive só pelo primeiro nome", () => {
    expect(feedzMentionedPerson(String(sheet[1][9]), people, "Paulo Rocha")?.id).toBe("p-bruno");
    expect(feedzMentionedPerson(String(sheet[5][9]), people, "Paulo Rocha")?.id).toBe("p-otavio");
  });

  it("compara nomes abreviados", () => {
    expect(sameName("Dr. Paulo Rocha", "Paulo Teixeira Rocha")).toBe(true);
    expect(sameName("Paulo Rocha", "Paula Rocha")).toBe(false);
  });
});

describe("feedzPrefill", () => {
  it("preenche gestor, colaborador, área, texto e o vínculo", () => {
    const { rows } = parseFeedzSheet(sheet);
    const input = feedzPrefill(rows[0], people);
    expect(input).toMatchObject({
      sent_on: "2026-09-29",
      manager_name: "Paulo Teixeira Rocha",
      employee_name: "Bruno Alves Costa",
      area: "Trabalhista",
      viewed: false,
      feedz: { key: rows[0].key, sent_at: rows[0].sentAt, viewed_at: null },
    });
    expect(input.description.startsWith("Identificamos em 28/09/2026")).toBe(true);
  });
});
