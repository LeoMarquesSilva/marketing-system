import { describe, expect, it } from "vitest";
import {
  buildEscolhaItems,
  canSeeContentChoices,
  collectPersonRefs,
  decisionActor,
  filterByPeriod,
  findStalled,
  summarizeByArea,
  summarizeByPerson,
  summarizeTotals,
  type EscolhaSourceRow,
} from "./content-escolhas";

const users = [
  { id: "u-wagner", name: "Wagner José Penereiro Armani", avatar_url: "https://foto/wagner.jpg", department: "Societário e Contratos" },
  { id: "u-thayna", name: "Thayná Rodrigues Cabalin", avatar_url: null, department: "Reestruturação" },
];

function row(partial: Partial<EscolhaSourceRow> & { id: string }): EscolhaSourceRow {
  return {
    title: `Matéria ${partial.id}`,
    link: null,
    area: "Cível",
    status: "aguardando_aprovacao",
    created_at: "2026-11-01T10:00:00.000Z",
    ...partial,
  };
}

const NOW = new Date("2026-11-17T12:00:00.000Z");

describe("escolhas da equipe", () => {
  it("usa o nome atual do cadastro pelo id e acha quem enviou pelo nome", () => {
    const [item] = buildEscolhaItems(
      [
        row({
          id: "a",
          status: "enviado_mkt",
          approved_by_id: "u-wagner",
          approved_by_name: "Wagner Armani",
          approved_at: "2026-11-10T10:00:00.000Z",
          sent_to_mkt_by_name: "Thayná Rodrigues Cabalin",
          sent_to_mkt_at: "2026-11-12T10:00:00.000Z",
        }),
      ],
      users,
    );
    expect(item.chosenBy).toMatchObject({ name: "Wagner José Penereiro Armani", avatarUrl: "https://foto/wagner.jpg" });
    expect(item.sentBy).toMatchObject({ id: "u-thayna" });
    expect(decisionActor(item).verb).toBe("escolheu");
  });

  it("separa ids e nomes que precisam ser buscados", () => {
    const refs = collectPersonRefs([
      row({ id: "a", approved_by_id: "u-1", sent_to_mkt_by_name: " Fulana " }),
      row({ id: "b", created_by_id: "u-2", rejected_by_id: "u-1" }),
    ]);
    expect(refs.ids.sort()).toEqual(["u-1", "u-2"]);
    expect(refs.names).toEqual(["Fulana"]);
  });

  it("conta por pessoa o que escolheu, onde parou, o que trouxe por link e o que descartou", () => {
    const items = buildEscolhaItems(
      [
        row({ id: "a", status: "em_revisao", approved_by_id: "u-wagner", approved_at: "2026-11-10T10:00:00.000Z" }),
        row({ id: "b", status: "enviado_mkt", approved_by_id: "u-wagner", approved_at: "2026-11-12T10:00:00.000Z", area: "Trabalhista" }),
        row({ id: "c", status: "rejeitado", rejected_by_id: "u-wagner", rejected_at: "2026-11-13T10:00:00.000Z" }),
        row({ id: "d", source: "manual", created_by_id: "u-thayna", created_at: "2026-11-14T10:00:00.000Z" }),
      ],
      users,
    );
    const [wagner, thayna] = summarizeByPerson(items);
    expect(wagner).toMatchObject({ chosen: 2, inReview: 1, sent: 1, rejected: 1, lastAt: "2026-11-13T10:00:00.000Z" });
    expect(wagner.areas).toEqual(["Cível", "Trabalhista"]);
    expect(thayna).toMatchObject({ chosen: 0, fromLink: 1 });
    expect(summarizeTotals(items)).toEqual({ chosen: 2, sent: 1, fromLink: 1, rejected: 1, people: 1 });
  });

  it("mostra todas as áreas, inclusive as que ninguém escolheu", () => {
    const items = buildEscolhaItems(
      [row({ id: "a", status: "em_revisao", approved_by_id: "u-wagner", approved_at: "2026-11-10T10:00:00.000Z" })],
      users,
    );
    const areas = summarizeByArea(items);
    expect(areas[0]).toMatchObject({ area: "Cível", chosen: 1 });
    expect(areas.find((area) => area.area === "Trabalhista")).toMatchObject({ chosen: 0, people: [] });
  });

  it("aponta escolhas paradas com o gestor e aprovadas sem envio", () => {
    const items = buildEscolhaItems(
      [
        row({ id: "velha", status: "em_revisao", approved_by_id: "u-wagner", approved_at: "2026-10-01T10:00:00.000Z" }),
        row({ id: "nova", status: "em_revisao", approved_by_id: "u-wagner", approved_at: "2026-11-15T10:00:00.000Z" }),
        row({ id: "sem-envio", status: "aprovado_revisor", approved_by_id: "u-wagner", approved_at: "2026-11-01T10:00:00.000Z", reviewer_approved_at: "2026-11-10T10:00:00.000Z" }),
      ],
      users,
    );
    expect(findStalled(items, NOW).map((entry) => [entry.item.id, entry.reason, entry.days])).toEqual([
      ["velha", "revisao", 47],
      ["sem-envio", "envio", 7],
    ]);
  });

  it("filtra o período pela data da decisão", () => {
    const items = buildEscolhaItems(
      [
        row({ id: "antiga", created_at: "2026-06-01T10:00:00.000Z", approved_by_id: "u-wagner", approved_at: "2026-11-16T10:00:00.000Z", status: "em_revisao" }),
        row({ id: "junho", approved_by_id: "u-wagner", approved_at: "2026-06-02T10:00:00.000Z", status: "enviado_mkt" }),
      ],
      users,
    );
    expect(filterByPeriod(items, "30d", NOW).map((item) => item.id)).toEqual(["antiga"]);
    expect(filterByPeriod(items, "tudo", NOW)).toHaveLength(2);
  });

  it("libera a aba para Marketing, admin e líderes, não para o colaborador comum", () => {
    expect(canSeeContentChoices({ role: "admin" })).toBe(true);
    expect(canSeeContentChoices({ role: null, department: "Marketing" })).toBe(true);
    expect(canSeeContentChoices({ role: null, department: "Trabalhista", ferias_view_enabled: true })).toBe(true);
    expect(canSeeContentChoices({ role: null, department: "Trabalhista" })).toBe(false);
  });
});
