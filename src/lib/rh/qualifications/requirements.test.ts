import { describe, expect, it } from "vitest";
import {
  listQualificationPeopleForArea,
  matchesQualificationRequirementTarget,
} from "@/lib/rh/qualifications/requirements";

describe("matchesQualificationRequirementTarget", () => {
  it("seleciona apenas as pessoas escolhidas", () => {
    expect(
      matchesQualificationRequirementTarget(
        { user_id: "u-1", department: "Cível", position: "Gerente" },
        { user_ids: ["u-1", "u-2"] }
      )
    ).toBe(true);
    expect(
      matchesQualificationRequirementTarget(
        { user_id: "u-3", department: "Cível", position: "Gerente" },
        { user_ids: ["u-1", "u-2"] }
      )
    ).toBe(false);
  });

  it("não seleciona ninguém sem user_id", () => {
    expect(
      matchesQualificationRequirementTarget(
        { department: "Cível", position: "Gerente" },
        { user_ids: ["u-1"] }
      )
    ).toBe(false);
    expect(
      matchesQualificationRequirementTarget(
        { user_id: "u-1", department: "Cível", position: "Gerente" },
        { user_ids: [] }
      )
    ).toBe(false);
  });
});

describe("listQualificationPeopleForArea", () => {
  it("lista somente as pessoas da área canônica, ordenadas por nome", () => {
    expect(
      listQualificationPeopleForArea(
        [
          { user_id: "2", user_name: "Zoe", department: "Cível" },
          { user_id: "1", user_name: "Ana", department: "Cível" },
          { user_id: "3", user_name: "Caio", department: "Contratos" },
          { user_id: "4", user_name: "Lia", department: "Financeiro" },
        ],
        "Cível"
      ).map((item) => item.user_name)
    ).toEqual(["Ana", "Zoe"]);
  });
});
