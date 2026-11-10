import { describe, expect, it } from "vitest";
import { awardPhotoUrl, formatAwardDateTime, fromBrasiliaInput, toBrasiliaInput } from "./format";
import {
  AWARD_HUB_KEYS,
  DEFAULT_AREA_HUBS,
  TOTAL_AWARDS,
  buildAwardRules,
  hubAreas,
  hubOfDepartment,
  isNominationComplete,
  isPartner,
  resolveAwardPhase,
  resolveParticipant,
  slotKey,
  type ParticipantOverride,
} from "./types";

const rulesWith = (overrides: ParticipantOverride[] = [], partners_eligible = false, area_hubs = DEFAULT_AREA_HUBS) =>
  buildAwardRules({ area_hubs, partners_eligible }, overrides);

const edition = {
  voting_opens_at: "2026-11-03T09:00:00-03:00",
  voting_closes_at: "2026-11-14T18:00:00-03:00",
  results_published_at: null,
};

describe("resolveAwardPhase", () => {
  it("sem datas fica em rascunho", () => {
    expect(resolveAwardPhase({ voting_opens_at: null, voting_closes_at: null, results_published_at: null })).toBe("rascunho");
  });

  it("segue as datas da votação", () => {
    expect(resolveAwardPhase(edition, new Date("2026-11-03T11:59:00Z"))).toBe("agendada");
    expect(resolveAwardPhase(edition, new Date("2026-11-03T12:00:00Z"))).toBe("aberta");
    expect(resolveAwardPhase(edition, new Date("2026-11-14T20:59:00Z"))).toBe("aberta");
    expect(resolveAwardPhase(edition, new Date("2026-11-14T21:00:00Z"))).toBe("apuracao");
  });

  it("resultado publicado vence as datas", () => {
    expect(resolveAwardPhase({ ...edition, results_published_at: "2026-12-18T10:00:00Z" }, new Date("2026-11-05T12:00:00Z"))).toBe(
      "publicada"
    );
  });
});

describe("hubs", () => {
  it("cada área cai no seu hub", () => {
    for (const area of ["Cível", "Trabalhista", "Contratos", "Recuperação de Crédito", "Tributário"]) {
      expect(hubOfDepartment(area)).toBe("empresarial");
    }
    expect(hubOfDepartment("Reestruturação")).toBe("reestruturacao");
    expect(hubOfDepartment("Operações Legais")).toBe("operacoes");
  });

  it("ignora acento e caixa, e não inventa hub para outras áreas", () => {
    expect(hubOfDepartment("recuperacao de credito")).toBe("empresarial");
    expect(hubOfDepartment("Sócio")).toBeNull();
    expect(hubOfDepartment("Marketing")).toBeNull();
    expect(hubOfDepartment(null)).toBeNull();
  });

  it("colaborador vota e concorre só no próprio hub; sócio patrimonial vota nos três e não concorre", () => {
    expect(resolveParticipant({ id: "a", department: "Trabalhista", position: "Advogado Pleno" }, rulesWith())).toEqual({
      hub: "empresarial",
      voteHubs: ["empresarial"],
      canCompete: true,
      adjusted: false,
    });
    expect(resolveParticipant({ id: "b", department: "Sócio", position: "Sócio Patrimonial" }, rulesWith())).toEqual({
      hub: null,
      voteHubs: [...AWARD_HUB_KEYS],
      canCompete: false,
      adjusted: false,
    });
    expect(resolveParticipant({ id: "c", department: null, position: null }, rulesWith()).voteHubs).toEqual([]);
  });

  it("sócio de área vota no hub dele e só concorre se a edição liberar", () => {
    const socio = { id: "d", department: "Cível", position: "Sócio de Área" };
    expect(resolveParticipant(socio, rulesWith())).toMatchObject({ hub: "empresarial", voteHubs: ["empresarial"], canCompete: false });
    expect(resolveParticipant(socio, rulesWith([], true)).canCompete).toBe(true);
  });

  it("trocar a área de hub move quem segue a regra", () => {
    const rules = rulesWith([], false, { ...DEFAULT_AREA_HUBS, Tributário: "operacoes" });
    expect(resolveParticipant({ id: "e", department: "Tributário", position: "Advogado" }, rules)).toMatchObject({
      hub: "operacoes",
      voteHubs: ["operacoes"],
    });
    expect(hubAreas(rules.areaHubs).operacoes).toEqual(["Operações Legais", "Tributário"]);
  });

  it("a exceção da pessoa vence a regra da área", () => {
    const person = { id: "f", department: "Trabalhista", position: "Advogado Pleno" };
    const rules = rulesWith([{ employee_id: "f", hub: "operacoes", vote_hubs: ["reestruturacao", "empresarial"], can_compete: true }]);
    expect(resolveParticipant(person, rules)).toEqual({
      hub: "operacoes",
      voteHubs: ["empresarial", "reestruturacao"],
      canCompete: true,
      adjusted: true,
    });
  });

  it("fora dos hubs nunca concorre, mesmo com a exceção marcada", () => {
    const person = { id: "g", department: "Trabalhista", position: "Advogado Pleno" };
    const rules = rulesWith([{ employee_id: "g", hub: null, vote_hubs: [], can_compete: true }]);
    expect(resolveParticipant(person, rules)).toMatchObject({ hub: null, voteHubs: [], canCompete: false, adjusted: true });
  });

  it("são 5 premiações em cada um dos 3 hubs", () => {
    expect(TOTAL_AWARDS).toBe(15);
    expect(slotKey("operacoes", "cliente")).toBe("operacoes:cliente");
  });
});

describe("isPartner", () => {
  it("reconhece sócio patrimonial e sócio de área", () => {
    expect(isPartner({ department: "Sócio", position: "Sócio Patrimonial" })).toBe(true);
    expect(isPartner({ department: "Trabalhista", position: "Sócio de Área" })).toBe(true);
    expect(isPartner({ department: "Cível", position: "Sócia de Área" })).toBe(true);
  });

  it("não confunde outros cargos", () => {
    expect(isPartner({ department: "Reestruturação", position: "Coordenador" })).toBe(false);
    expect(isPartner({ department: "Contratos", position: "Assistente Jurídico" })).toBe(false);
    expect(isPartner({ department: null, position: null })).toBe(false);
  });
});

describe("isNominationComplete", () => {
  it("exige a situação descrita com o mínimo de caracteres", () => {
    expect(isNominationComplete(undefined)).toBe(false);
    expect(isNominationComplete({ justification: "   curto   " })).toBe(false);
    expect(isNominationComplete({ justification: "Atendeu o cliente no fim de semana." })).toBe(true);
  });
});

describe("awardPhotoUrl", () => {
  it("pede ao Supabase a foto reduzida", () => {
    expect(
      awardPhotoUrl("https://abc123.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-FOTOS/colab/foto%201.jpg", 128)
    ).toBe(
      "https://abc123.supabase.co/storage/v1/render/image/public/MARKETING-SYSTEM-FOTOS/colab/foto%201.jpg?width=128&height=128&resize=cover&quality=75"
    );
  });

  it("deixa outras origens como estão", () => {
    expect(awardPhotoUrl("https://www.bismarchipires.com.br/foto.jpg", 128)).toBe("https://www.bismarchipires.com.br/foto.jpg");
    expect(awardPhotoUrl(null, 128)).toBeNull();
  });
});

describe("datas no horário de Brasília", () => {
  it("ida e volta do campo datetime-local", () => {
    expect(fromBrasiliaInput("2026-11-14T18:00")).toBe("2026-11-14T18:00:00-03:00");
    expect(toBrasiliaInput("2026-11-14T21:00:00Z")).toBe("2026-11-14T18:00");
    expect(fromBrasiliaInput("")).toBeNull();
  });

  it("escreve a data por extenso", () => {
    expect(formatAwardDateTime("2026-11-14T21:00:00Z")).toBe("14 de novembro, às 18h");
    expect(formatAwardDateTime("2026-11-03T12:30:00Z")).toBe("3 de novembro, às 9h30");
  });
});
