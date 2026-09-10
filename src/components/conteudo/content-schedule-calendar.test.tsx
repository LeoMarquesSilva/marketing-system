import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCalendarDays, ContentScheduleCalendar } from "./content-schedule-calendar";

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
      />
    );
    expect(html).toContain("Seg");
    expect(html).toContain("Nome antigo");
    expect(html).toContain("Reel");
    expect(html).toContain("Agenda do mês");
    expect(html).toContain("Nome da planilha sem vínculo");
  });
});
