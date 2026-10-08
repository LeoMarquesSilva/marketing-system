import { describe, expect, it } from "vitest";
import {
  alignedTierFor,
  buildOrgChart,
  findTeamView,
  groupTiers,
  memberContext,
  resolveOrgTarget,
  roleLevel,
  searchOrgMembers,
  seniorityGrade,
  suggestDisplayName,
  type OrgMember,
} from "@/lib/rh/org-chart";

let seq = 0;
function member(partial: Partial<OrgMember> & Pick<OrgMember, "name">): OrgMember {
  seq += 1;
  return {
    id: `m${seq}`,
    employeeId: partial.employeeId ?? `e-${partial.name}`,
    role: "Advogada Pleno",
    placement: "team",
    divisionKey: "juridica",
    teamKey: "civel",
    groupLabel: null,
    tier: 0,
    sortOrder: 0,
    photoUrl: null,
    employeeName: partial.name,
    isActive: true,
    ...partial,
  };
}

describe("níveis do organograma", () => {
  it("segue a legenda do onboarding", () => {
    expect(roleLevel("Sócio de Área")).toBe("lideranca");
    expect(roleLevel("Sócio Patrimonial")).toBe("lideranca");
    expect(roleLevel("Gerente")).toBe("lideranca");
    expect(roleLevel("Advogada Sênior Coordenadora I")).toBe("coordenacao");
    expect(roleLevel("Supervisora")).toBe("supervisao");
    expect(roleLevel("Analista Júnior de Pessoas e Cultura")).toBe("pleno");
    expect(roleLevel("Advogada Júnior")).toBe("junior");
    expect(roleLevel("Assistente Administrativo")).toBe("junior");
    expect(roleLevel("Auxiliar de Limpeza")).toBe("auxiliar");
    expect(roleLevel("Estagiária")).toBe("estagio");
  });
});

describe("montagem do organograma", () => {
  it("compacta níveis com buracos", () => {
    const tiers = groupTiers([
      member({ name: "C", role: "Estagiária", tier: 5 }),
      member({ name: "A", role: "Sócio de Área", tier: 0 }),
      member({ name: "B", role: "Advogada Pleno", tier: 2 }),
      member({ name: "D", role: "Advogado Pleno", tier: 2, sortOrder: -1 }),
    ]);
    expect(tiers.map((t) => t.map((m) => m.name))).toEqual([["A"], ["D", "B"], ["C"]]);
  });

  it("nunca põe mesmo cargo um embaixo do outro", () => {
    // Caso real do PPT: Mariana (Pleno) acima de Gabriela e Thayná (Pleno).
    const tiers = groupTiers([
      member({ name: "Mariana", role: "Advogada Pleno", tier: 2 }),
      member({ name: "Gabriela", role: "Advogada Pleno", tier: 3 }),
      member({ name: "Thayná", role: "Advogada pleno", tier: 3, sortOrder: 1 }),
      member({ name: "Júnior", role: "Advogada Júnior", tier: 4 }),
    ]);
    expect(tiers.map((t) => t.map((m) => m.name))).toEqual([["Gabriela", "Mariana", "Thayná"], ["Júnior"]]);
  });

  it("deixa senioridades diferentes lado a lado quando o desenho pede", () => {
    // Cível: Sênior, Pleno e Júnior juntos abaixo da coordenação.
    const tiers = groupTiers([
      member({ name: "Maria", role: "Advogada Sênior Coordenadora I", tier: 0 }),
      member({ name: "Giovani", role: "Advogado Sênior Consultor I", tier: 1 }),
      member({ name: "Midian", role: "Advogada Pleno", tier: 1, sortOrder: 1 }),
      member({ name: "Raíssa", role: "Advogada Júnior", tier: 1, sortOrder: 2 }),
    ]);
    expect(tiers.map((t) => t.map((m) => m.name))).toEqual([["Maria"], ["Giovani", "Midian", "Raíssa"]]);
  });

  it("compara senioridade, não a cor da legenda", () => {
    expect(seniorityGrade("Advogada Pleno Controller")).toBe(seniorityGrade("Advogado Pleno"));
    expect(seniorityGrade("Advogada Sênior Coordenadora I")).toBe("coordenacao");
    expect(seniorityGrade("Advogado Sênior Consultor I")).toBe("senior");
    expect(seniorityGrade("Assistente Jurídico")).not.toBe(seniorityGrade("Advogada Júnior"));
    expect(
      alignedTierFor(
        [
          { role: "Advogada Pleno", tier: 3 },
          { role: "Advogada Júnior", tier: 4 },
        ],
        "Advogado Pleno"
      )
    ).toBe(3);
    expect(alignedTierFor([{ role: "Advogada Pleno", tier: 3 }], "Estagiária")).toBeNull();
  });

  it("separa sócios, liderança, equipes, subequipes e comitês", () => {
    const view = buildOrgChart([
      member({ name: "Gustavo", placement: "partner", divisionKey: null, teamKey: null }),
      member({ name: "Felipe", placement: "division_leader", divisionKey: "operacoes-legais", teamKey: null }),
      member({ name: "Leonardo", teamKey: "reestruturacao" }),
      member({ name: "Gabriela", teamKey: "reestruturacao", groupLabel: "Insolvência", tier: 2 }),
      member({ name: "Mariana", teamKey: "reestruturacao", groupLabel: "Cível Insolvência", tier: 2 }),
      member({ name: "Midian", employeeId: "e-midian", placement: "committee", divisionKey: null, teamKey: "clima" }),
      member({ name: "Midian", employeeId: "e-midian" }),
      member({ name: "Robô", placement: "hidden", divisionKey: null, teamKey: null }),
    ]);
    expect(view.partners.map((m) => m.name)).toEqual(["Gustavo"]);
    expect(view.divisions[0].leaders.flat().map((m) => m.name)).toEqual(["Felipe"]);
    const restr = findTeamView(view, "reestruturacao")!.team;
    expect(restr.tiers.flat().map((m) => m.name)).toEqual(["Leonardo"]);
    expect(restr.groups.map((g) => g.label)).toEqual(["Insolvência", "Cível Insolvência"]);
    expect(restr.members).toHaveLength(3);
    expect(view.committees[0].members.map((m) => m.name)).toEqual(["Midian"]);
    // Comitê e robô oculto não contam; Midian conta uma vez.
    expect(view.totalPeople).toBe(6);
  });

  it("tira do desenho quem ficou inativo e lista como saída", () => {
    const view = buildOrgChart([
      member({ name: "Ativa" }),
      member({ name: "Saiu", isActive: false }),
    ]);
    expect(findTeamView(view, "civel")!.team.members.map((m) => m.name)).toEqual(["Ativa"]);
    expect(view.departed.map((m) => m.name)).toEqual(["Saiu"]);
  });

  it("descreve onde a pessoa aparece e busca sem acentos", () => {
    const view = buildOrgChart([
      member({ name: "Leonardo Marques", employeeId: "leo", divisionKey: "operacoes-legais", teamKey: "lexnext-lab" }),
      member({ name: "Leonardo Marques", employeeId: "leo", divisionKey: "operacoes-legais", teamKey: "marketing" }),
      member({ name: "Letícia Rodrigues", role: "Advogada Júnior", teamKey: "societario-e-contratos" }),
    ]);
    expect(memberContext(view, "leo")).toBe("LexNext Lab · Marketing");
    expect(searchOrgMembers(view, "leticia").map((m) => m.name)).toEqual(["Letícia Rodrigues"]);
    expect(searchOrgMembers(view, "leonardo")).toHaveLength(1);
    expect(searchOrgMembers(view, "  ")).toEqual([]);
  });
});

describe("destinos de posicionamento", () => {
  it("aceita equipes e subequipes conhecidas", () => {
    expect(resolveOrgTarget({ placement: "team", divisionKey: "juridica", teamKey: "tributario" })).not.toBeNull();
    expect(
      resolveOrgTarget({
        placement: "team",
        divisionKey: "juridica",
        teamKey: "reestruturacao",
        groupLabel: "Insolvência",
      })?.groupLabel
    ).toBe("Insolvência");
  });

  it("recusa equipe, área ou subequipe inexistente", () => {
    expect(resolveOrgTarget({ placement: "team", divisionKey: "juridica", teamKey: "marketing" })).toBeNull();
    expect(
      resolveOrgTarget({ placement: "team", divisionKey: "juridica", teamKey: "civel", groupLabel: "X" })
    ).toBeNull();
    expect(resolveOrgTarget({ placement: "qualquer" })).toBeNull();
  });

  it("sugere nome curto", () => {
    expect(suggestDisplayName("Francisco de Assis Barbosa Campos Zanin")).toBe("Francisco Zanin");
    expect(suggestDisplayName("Manuela Lutke")).toBe("Manuela Lutke");
  });
});
