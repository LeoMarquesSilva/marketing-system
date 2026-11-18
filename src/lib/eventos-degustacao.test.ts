import { describe, expect, it } from "vitest";
import {
  columnLabels,
  formatAverage,
  missingVoters,
  overallRanking,
  participantKey,
  scoreTable,
  splitLocation,
  type Score,
  type TastingDrink,
  type TastingVote,
} from "@/lib/eventos-degustacao";
import type { EventTasting, TastingParticipant } from "@/lib/eventos-programa";

const people: TastingParticipant[] = [
  { name: "Leonardo Marques Silva", userId: "u-leo", status: "confirmado", note: null },
  { name: "Mariana Manuel Araújo", userId: "u-mari", status: "confirmado", note: null },
  { name: "Jessica", userId: null, status: "confirmado", note: "Convidada" },
];

function drink(id: string, name: string, sortOrder = 0): TastingDrink {
  return { id, tastingId: "t1", eventId: "e1", name, photoPath: null, photoUrl: null, note: null, shortlisted: false, menuItemId: null, sortOrder, createdAt: `2026-11-18T21:0${sortOrder}:00Z` };
}

function vote(drinkId: string, person: TastingParticipant, score: Score, tastingId = "t1"): TastingVote {
  return { id: `${drinkId}-${participantKey(person)}`, drinkId, tastingId, participantKey: participantKey(person), participantName: person.name, userId: person.userId, score, recordedBy: null };
}

describe("participantKey", () => {
  it("usa o id do usuário ou o nome do convidado sem acento", () => {
    expect(participantKey(people[0])).toBe("u-leo");
    expect(participantKey({ name: "  Jéssica  Souza ", userId: null })).toBe("convidado:jessica souza");
  });
});

describe("columnLabels", () => {
  it("mostra o primeiro nome e desempata com a inicial do sobrenome", () => {
    expect(columnLabels(people)).toEqual(["Leonardo", "Mariana", "Jessica"]);
    expect(columnLabels([{ name: "Lucas Sebinel Miranda" }, { name: "Lucas Prado" }])).toEqual(["Lucas M.", "Lucas P."]);
  });
});

describe("scoreTable", () => {
  it("soma, tira a média e ordena pela média com empate na mesma posição", () => {
    const drinks = [drink("d1", "Negroni", 1), drink("d2", "Fitzgerald", 2), drink("d3", "Bramble", 3), drink("d4", "Sem nota", 4)];
    const votes = [
      vote("d1", people[0], 2), vote("d1", people[1], 4), vote("d1", people[2], 4),
      vote("d2", people[0], 4), vote("d2", people[1], 5), vote("d2", people[2], 5),
      vote("d3", people[0], 5), vote("d3", people[1], 5),
    ];
    const rows = scoreTable(drinks, votes, people);
    expect(rows.map((row) => row.drink.name)).toEqual(["Bramble", "Fitzgerald", "Negroni", "Sem nota"]);
    expect(rows[0]).toMatchObject({ total: 10, votes: 2, average: 5, rank: 1, scores: [5, 5, null] });
    expect(rows[1]).toMatchObject({ total: 14, average: 4.67, rank: 2 });
    expect(rows[2]).toMatchObject({ total: 10, average: 3.33, rank: 3 });
    expect(rows[3]).toMatchObject({ total: 0, votes: 0, average: null, rank: null });
    expect(formatAverage(rows[1].average)).toBe("4,67");
  });

  it("empate de média divide a posição", () => {
    const rows = scoreTable([drink("a", "A", 1), drink("b", "B", 2), drink("c", "C", 3)], [vote("a", people[0], 4), vote("b", people[0], 4), vote("c", people[0], 3)], people);
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3]);
  });
});

describe("overallRanking", () => {
  it("junta as degustações e ordena pela média de cada drink", () => {
    const tasting = (id: string, vendorName: string): EventTasting => ({ id, eventId: "e1", menuType: "bebida", vendorName, tastingDate: null, tastingTime: null, location: null, linkUrl: null, status: "realizada", resultNote: null, participants: people, sortOrder: 0 });
    const drinks = [drink("a", "A"), { ...drink("b", "B"), tastingId: "t2" }];
    const votes = [vote("a", people[0], 3), vote("b", people[0], 5, "t2")];
    const rows = overallRanking([tasting("t1", "Madison"), tasting("t2", "Clico")], drinks, votes);
    expect(rows.map((row) => `${row.tasting.vendorName}:${row.drink.name}:${row.rank}`)).toEqual(["Clico:B:1", "Madison:A:2"]);
  });
});

describe("splitLocation", () => {
  it("separa o endereço do link do mapa", () => {
    expect(splitLocation("Rua Álvaro Müller, 160 https://maps.app.goo.gl/abc")).toEqual({ address: "Rua Álvaro Müller, 160", mapUrl: "https://maps.app.goo.gl/abc" });
    expect(splitLocation("Endereço: Av. Dr. Heitor Penteado, 725 - Jardim https://g.co/kgs/x")).toEqual({ address: "Av. Dr. Heitor Penteado, 725 - Jardim", mapUrl: "https://g.co/kgs/x" });
    expect(splitLocation(null)).toEqual({ address: null, mapUrl: null });
  });
});

describe("missingVoters", () => {
  it("lista quem ainda não deu nota", () => {
    expect(missingVoters("d1", [vote("d1", people[1], 3)], people).map((person) => person.name)).toEqual(["Leonardo Marques Silva", "Jessica"]);
  });
});
