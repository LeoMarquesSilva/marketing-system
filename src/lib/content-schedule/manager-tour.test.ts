import { describe, expect, it } from "vitest";
import {
  CONTENT_SCHEDULE_MANAGER_TOUR_STEPS,
  shouldShowContentScheduleManagerTour,
} from "./manager-tour";

describe("guia do gestor no cronograma", () => {
  it("é exibido somente para gestor que ainda não concluiu", () => {
    const profile = {
      must_change_password: false,
      content_schedule_tutorial_completed_at: null as string | null,
    };

    expect(shouldShowContentScheduleManagerTour(profile, { managerMode: true })).toBe(true);
    expect(shouldShowContentScheduleManagerTour(profile, { managerMode: false })).toBe(false);

    profile.content_schedule_tutorial_completed_at = "2026-09-15T12:00:00.000Z";
    expect(shouldShowContentScheduleManagerTour(profile, { managerMode: true })).toBe(false);
    expect(shouldShowContentScheduleManagerTour(profile, { managerMode: true, forced: true })).toBe(true);
  });

  it("não sobrepõe a troca obrigatória de senha", () => {
    expect(shouldShowContentScheduleManagerTour({
      must_change_password: true,
      content_schedule_tutorial_completed_at: null,
    }, { managerMode: true })).toBe(false);
  });

  it("cobre escopo, indicadores, filtros e atribuição", () => {
    const targets = CONTENT_SCHEDULE_MANAGER_TOUR_STEPS.map((step) => step.target);
    expect(targets).toContain('[data-tour="schedule-manager-scope"]');
    expect(targets).toContain('[data-tour="schedule-summary"]');
    expect(targets).toContain('[data-tour="schedule-filters"]');
    expect(targets).toContain('[data-tour="schedule-workspace"]');
  });
});
