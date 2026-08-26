import { describe, expect, it } from "vitest";
import { mapResponsumAbsences, selectResponsumServiceKey } from "./responsum-domain";

describe("selectResponsumServiceKey", () => {
  it("seleciona somente a chave service_role retornada pela Management API", () => {
    expect(
      selectResponsumServiceKey([
        { name: "anon", api_key: "anon-key" },
        { name: "service_role", api_key: "service-key" },
      ])
    ).toBe("service-key");
  });

  it("não aceita chave pública como fallback", () => {
    expect(selectResponsumServiceKey([{ name: "anon", api_key: "anon-key" }])).toBeNull();
  });
});

describe("mapResponsumAbsences", () => {
  const users = [
    { id: "11111111-1111-4111-8111-111111111111", email: "ana@bp.com" },
    { id: "22222222-2222-4222-8222-222222222222", email: "bia@bp.com" },
  ];

  it("agrupa tickets da data da edição pelo UUID do colaborador", () => {
    const result = mapResponsumAbsences(
      [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          title: "Ausência 28/08",
          description: "Consulta médica previamente agendada.",
          createdBy: users[0].id,
          createdByEmail: "ana@bp.com",
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
          title: "Aula dia 28/08",
          description: null,
          createdBy: users[0].id,
          createdByEmail: "ana@bp.com",
        },
      ],
      users,
      "2026-08-28"
    );

    expect(result.matches).toEqual([
      {
        userId: users[0].id,
        ticketIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"],
        justifications: [
          {
            ticketId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            title: "Ausência 28/08",
            description: "Consulta médica previamente agendada.",
          },
          {
            ticketId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
            title: "Aula dia 28/08",
            description: null,
          },
        ],
      },
    ]);
    expect(result.unmatchedTicketIds).toEqual([]);
  });

  it("usa e-mail como fallback e separa ticket sem data inequívoca", () => {
    const result = mapResponsumAbsences(
      [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          title: "Café 28/08",
          description: null,
          createdBy: "99999999-9999-4999-8999-999999999999",
          createdByEmail: " BIA@BP.COM ",
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
          title: "Não comparecerei",
          description: "Conforme conversado com Pessoas e Cultura.",
          createdBy: users[0].id,
          createdByEmail: "ana@bp.com",
        },
      ],
      users,
      "2026-08-28"
    );

    expect(result.matches).toEqual([
      {
        userId: users[1].id,
        ticketIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
        justifications: [
          {
            ticketId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
            title: "Café 28/08",
            description: null,
          },
        ],
      },
    ]);
    expect(result.unmatchedTicketIds).toEqual(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"]);
  });

  it("ignora ticket de outra edição sem classificá-lo como erro", () => {
    const result = mapResponsumAbsences(
      [
        {
          id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
          title: "Café 25/09",
          description: null,
          createdBy: users[0].id,
          createdByEmail: "ana@bp.com",
        },
      ],
      users,
      "2026-08-28"
    );
    expect(result).toEqual({ matches: [], unmatchedTicketIds: [] });
  });
});
