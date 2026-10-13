import { describe, expect, it } from "vitest";
import type { MarketingRequest } from "@/lib/marketing-requests";
import type { PlannerReel } from "@/lib/reel-deliveries/types";
import {
  buildAreaRotation,
  calendarItemDayKey,
  calendarItemFromReel,
  calendarItemFromRequest,
  findAreaRepeats,
  isCalendarItemInBank,
  isCalendarItemPosted,
  rotationAreaOf,
  sortBankByRotation,
  withCalendarDay,
  type CalendarItem,
} from "./planner-calendar";

const AREAS = [
  "Cível",
  "Operações Legais",
  "Recuperação de Crédito",
  "Reestruturação",
  "Societário e Contratos",
  "Trabalhista",
];

function post(id: string, area: string, postedOn: string | null): CalendarItem {
  return calendarItemFromRequest({
    id,
    title: `Post ${id}`,
    description: null,
    requesting_area: area,
    request_type: "Post Redes Sociais",
    workflow_stage: "concluido",
    completion_type: postedOn ? "postagem_feita" : "design_concluido",
    posted_at: postedOn ? `${postedOn}T12:00:00.000Z` : null,
    requested_at: "2026-09-01T12:00:00.000Z",
    delivered_at: null,
    stage_changed_at: null,
  } as unknown as MarketingRequest);
}

function reel(id: string, area: string, status: PlannerReel["status"], publishedOn: string | null = null): CalendarItem {
  return calendarItemFromReel({
    id,
    area,
    dueDate: "2026-09-23",
    coverTitle: `REEL ${id}`,
    coverSubtitle: null,
    caption: "Legenda",
    status,
    readyAt: status === "ready" || status === "published" ? "2026-10-07T12:00:00.000Z" : null,
    publishedAt: publishedOn ? `${publishedOn}T12:00:00.000Z` : null,
    coverThumbUrl: null,
    participants: [],
  });
}

describe("rotationAreaOf", () => {
  it("usa o nome oficial das áreas legadas", () => {
    expect(rotationAreaOf("Contratos", AREAS)).toBe("Societário e Contratos");
    expect(rotationAreaOf("Insolvência", AREAS)).toBe("Reestruturação");
  });

  it("deixa institucional, geral e Marketing fora do rodízio", () => {
    expect(rotationAreaOf("Institucional", AREAS)).toBeNull();
    expect(rotationAreaOf("Geral", AREAS)).toBeNull();
    expect(rotationAreaOf("Marketing", AREAS)).toBeNull();
    expect(rotationAreaOf("Sócio", AREAS)).toBeNull();
  });
});

describe("itens do calendário", () => {
  it("reel pronto fica no banco e publicado vai para o dia", () => {
    expect(isCalendarItemInBank(reel("r1", "Cível", "ready"))).toBe(true);
    expect(isCalendarItemInBank(reel("r2", "Cível", "approved"))).toBe(false);
    const published = reel("r3", "Cível", "published", "2026-10-09");
    expect(isCalendarItemPosted(published)).toBe(true);
    expect(calendarItemDayKey(published)).toBe("2026-10-09");
  });

  it("arrastar para o dia publica o item nesse dia", () => {
    const moved = withCalendarDay(reel("r1", "Cível", "ready"), "2026-10-14");
    expect(isCalendarItemPosted(moved)).toBe(true);
    expect(calendarItemDayKey(moved)).toBe("2026-10-14");
    const movedPost = withCalendarDay(post("p1", "Cível", null), "2026-10-15");
    expect(calendarItemDayKey(movedPost)).toBe("2026-10-15");
  });
});

describe("buildAreaRotation", () => {
  const posted = [
    post("a", "Operações Legais", "2026-09-08"),
    post("b", "Cível", "2026-09-24"),
    post("c", "Insolvência", "2026-09-29"),
    post("d", "Contratos", "2026-09-30"),
    post("e", "Institucional", "2026-10-05"),
    post("f", "Trabalhista", "2026-10-07"),
  ];

  it("recomenda a área há mais tempo sem post que tem conteúdo pronto", () => {
    const rotation = buildAreaRotation({
      rotationAreas: AREAS,
      posted,
      bank: [post("g", "Cível", null), reel("r1", "Operações Legais", "ready"), reel("r2", "Reestruturação", "ready")],
      inProductionAreas: ["Recuperação de Crédito"],
      today: "2026-10-13",
    });
    expect(rotation.entries.map((e) => e.area)).toEqual([
      "Recuperação de Crédito",
      "Operações Legais",
      "Cível",
      "Reestruturação",
      "Societário e Contratos",
      "Trabalhista",
    ]);
    // Recuperação de Crédito nunca postou, mas não tem nada pronto no banco.
    expect(rotation.recommendedArea).toBe("Operações Legais");
    expect(rotation.lastPostedArea).toBe("Trabalhista");
    const credito = rotation.entries[0];
    expect(credito.daysSince).toBeNull();
    expect(credito.inProduction).toBe(1);
    expect(rotation.entries[1].daysSince).toBe(35);
    expect(rotation.entries[1].bankReels).toBe(1);
  });

  it("evita repetir a área do último post quando há outra opção", () => {
    const rotation = buildAreaRotation({
      rotationAreas: AREAS,
      posted: [post("a", "Cível", "2026-09-01"), post("b", "Trabalhista", "2026-10-10")],
      bank: [post("g", "Trabalhista", null), post("h", "Cível", null)],
      inProductionAreas: [],
      today: "2026-10-13",
    });
    expect(rotation.recommendedArea).toBe("Cível");
  });

  it("repete a área do último post só quando é a única com conteúdo", () => {
    const rotation = buildAreaRotation({
      rotationAreas: AREAS,
      posted: [post("a", "Trabalhista", "2026-10-10")],
      bank: [post("g", "Trabalhista", null)],
      inProductionAreas: [],
      today: "2026-10-13",
    });
    expect(rotation.recommendedArea).toBe("Trabalhista");
  });

  it("post institucional depois libera a área anterior", () => {
    const rotation = buildAreaRotation({
      rotationAreas: AREAS,
      posted: [post("a", "Trabalhista", "2026-10-10"), post("b", "Institucional", "2026-10-11")],
      bank: [],
      inProductionAreas: [],
      today: "2026-10-13",
    });
    expect(rotation.lastPostedArea).toBeNull();
    expect(rotation.recommendedArea).toBeNull();
  });

  it("conta posts já agendados como a vez da área", () => {
    const rotation = buildAreaRotation({
      rotationAreas: AREAS,
      posted: [post("a", "Cível", "2026-10-20")],
      bank: [],
      inProductionAreas: [],
      today: "2026-10-13",
    });
    const civel = rotation.entries.find((e) => e.area === "Cível")!;
    expect(civel.daysSince).toBe(-7);
    expect(civel.isLastPosted).toBe(true);
  });
});

describe("sortBankByRotation", () => {
  it("coloca a área recomendada primeiro e o institucional no fim", () => {
    const bank = [
      post("inst", "Institucional", null),
      post("trab", "Trabalhista", null),
      post("civ", "Cível", null),
      reel("ops", "Operações Legais", "ready"),
    ];
    const rotation = buildAreaRotation({
      rotationAreas: AREAS,
      posted: [post("a", "Operações Legais", "2026-09-01"), post("b", "Cível", "2026-09-20"), post("c", "Trabalhista", "2026-10-10")],
      bank,
      inProductionAreas: [],
      today: "2026-10-13",
    });
    expect(sortBankByRotation(bank, rotation, AREAS).map((i) => i.id)).toEqual(["ops", "civ", "trab", "inst"]);
  });
});

describe("findAreaRepeats", () => {
  it("marca o post que repete a área do anterior", () => {
    const repeats = findAreaRepeats(
      [
        post("a", "Cível", "2026-10-12"),
        post("b", "Contratos", "2026-10-13"),
        post("c", "Societário e Contratos", "2026-10-14"),
        post("d", "Institucional", "2026-10-15"),
        post("e", "Societário e Contratos", "2026-10-16"),
      ],
      AREAS
    );
    expect([...repeats]).toEqual(["c"]);
  });
});
