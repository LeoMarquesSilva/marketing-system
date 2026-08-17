import { describe, expect, it } from "vitest";
import {
  listQualificationAreas,
  qualificationMatchesArea,
  qualificationAreaLabel,
} from "@/lib/rh/qualifications/areas";
import type { QualificationListItem } from "@/lib/rh/qualifications/types";

function item(department: string): QualificationListItem {
  return {
    user_id: department,
    user_name: department,
    user_email: null,
    department,
    position: null,
    avatar_url: null,
    qualification_required_at: null,
    qualification_completed_at: null,
    qualification: null,
  };
}

describe("áreas canônicas das qualificações", () => {
  it("agrupa departamentos administrativos em Operações Legais como Férias", () => {
    const items = [
      item("Marketing"),
      item("Financeiro"),
      item("RH"),
      item("Limpeza"),
      item("Operações Legais"),
      item("Reestruturação"),
    ];

    expect(listQualificationAreas(items)).toEqual([
      "Operações Legais",
      "Reestruturação",
    ]);
  });

  it("exibe o rótulo canônico em vez do departamento bruto", () => {
    expect(qualificationAreaLabel("Marketing")).toBe("Operações Legais");
    expect(qualificationAreaLabel("Insolvência")).toBe("Reestruturação");
  });

  it("filtra Operações Legais incluindo todos os departamentos agrupados", () => {
    expect(qualificationMatchesArea(item("Marketing"), "Operações Legais")).toBe(true);
    expect(qualificationMatchesArea(item("RH"), "Operações Legais")).toBe(true);
    expect(qualificationMatchesArea(item("Cível"), "Operações Legais")).toBe(false);
  });
});
