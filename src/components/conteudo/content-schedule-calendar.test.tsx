import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCalendarDays, ContentScheduleCalendar } from "./content-schedule-calendar";

const denseDaySlots = Array.from({ length: 5 }, (_, index) => ({
  id: `slot-${index + 1}`,
  area: "Tributário",
  date: "2026-09-18",
  format: index % 2 === 0 ? ("post" as const) : ("reel" as const),
  status: "open" as const,
  collaboratorId: `person-${index + 1}`,
  collaborator: {
    id: `person-${index + 1}`,
    name: `Pessoa ${index + 1}`,
  },
}));

function renderDenseDay() {
  return renderToStaticMarkup(
    <ContentScheduleCalendar
      month="2026-09"
      slots={denseDaySlots}
      onSelectSlot={() => undefined}
    />
  );
}

describe("ContentScheduleCalendar", () => {
  it("monta o mês de segunda a domingo incluindo as bordas necessárias", () => {
    const days = buildCalendarDays("2026-09");
    expect(days).toHaveLength(35);
    expect(days[0]).toEqual({ date: "2026-08-31", inCurrentMonth: false });
    expect(days.at(-1)).toEqual({ date: "2026-10-04", inCurrentMonth: false });
  });

  it("posiciona a tarefa no dia e oferece agenda mobile", () => {
    const html = renderToStaticMarkup(
      <ContentScheduleCalendar
        month="2026-09"
        slots={[{
          id: "slot-1",
          area: "Tributário",
          date: "2026-09-18",
          format: "reel",
          status: "open",
          unmatchedAssigneeName: "Nome antigo",
        }]}
        onSelectSlot={() => undefined}
      />
    );
    expect(html).toContain("Seg");
    expect(html).toContain("Nome antigo");
    expect(html).toContain("Reel");
    expect(html).toContain("Agenda do mês");
    expect(html).toContain("Nome da planilha sem vínculo");
  });

  it("limita o dia a três cards e oferece o overflow em um botão", () => {
    const html = renderDenseDay();

    expect(html).toContain('type="button"');
    expect(html).toContain("+ 2 neste dia");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>\+ 2 neste dia<\/button>/);
    for (const slot of denseDaySlots) {
      expect(html).toContain(slot.collaborator.name);
    }
  });

  it("identifica nos cards a ação acessível de abrir detalhes", () => {
    const html = renderDenseDay();
    const slotButtons = html.match(/<button[^>]*aria-label="Abrir detalhes[^>]*>/g) ?? [];

    expect(slotButtons.length).toBeGreaterThan(0);
    expect(slotButtons.every((button) => button.includes('type="button"'))).toBe(true);
  });

  it("mantém os cards neutros sem borda ou faixa colorida", () => {
    const html = renderDenseDay();
    const slotButtons = html.match(/<button[^>]*aria-label="Abrir detalhes[^>]*>/g) ?? [];

    expect(slotButtons.length).toBeGreaterThan(0);
    for (const button of slotButtons) {
      expect(button).not.toContain("border-amber-200");
      expect(button).not.toContain("hover:border");
      expect(button).not.toContain("border-[#dce9eb]");
    }
    expect(html).not.toContain("absolute inset-y-0 left-0 w-0.5");
  });
});
