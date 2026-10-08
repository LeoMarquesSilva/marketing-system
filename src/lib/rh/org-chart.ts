/**
 * Organograma do escritório.
 *
 * A estrutura (áreas executivas, equipes e subequipes) é fixa e fica aqui.
 * Quem ocupa cada posição fica em `org_chart_members` (banco), ligado a
 * `hr_employees` — assim colaborador novo do VIOS aparece como pendente até a
 * RH posicioná-lo. Carga inicial: onboarding de setembro/2026.
 */

export type OrgPlacement = "partner" | "division_leader" | "team" | "committee" | "hidden";

export type OrgMember = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  placement: OrgPlacement;
  divisionKey: string | null;
  teamKey: string | null;
  groupLabel: string | null;
  tier: number;
  sortOrder: number;
  photoUrl: string | null;
  /** Nome completo no cadastro do RH. */
  employeeName: string;
  isActive: boolean;
};

/** Colaborador ativo no RH que ainda não tem posição no organograma. */
export type OrgPendingEmployee = {
  employeeId: string;
  fullName: string;
  department: string | null;
  position: string | null;
  photoUrl: string | null;
};

export type OrgChartData = {
  members: OrgMember[];
  pending: OrgPendingEmployee[];
};

export type OrgTeamDef = {
  key: string;
  label: string;
  summary: string;
  /** Subequipes, na ordem em que aparecem (ex.: Reestruturação). */
  groups?: string[];
};

export type OrgDivisionDef = {
  key: string;
  label: string;
  summary: string;
  teams: OrgTeamDef[];
};

export type OrgCommitteeDef = {
  key: string;
  label: string;
  summary: string;
};

export const ORG_DIVISIONS: OrgDivisionDef[] = [
  {
    key: "operacoes-legais",
    label: "Operações Legais",
    summary: "Sustenta a operação do escritório: controle, processos, pessoas e tecnologia.",
    teams: [
      {
        key: "controladoria",
        label: "Controladoria Jurídica",
        summary: "Agenda e revisa prazos, protocola peças e opera as centrais de solicitações.",
      },
      {
        key: "financeiro",
        label: "Financeiro",
        summary: "Contas a pagar e a receber, faturamento de honorários e cobrança.",
      },
      {
        key: "lexnext-lab",
        label: "LexNext Lab",
        summary: "Processos, dados e tecnologia aplicados à operação, como Responsum e SIOE.",
      },
      {
        key: "marketing",
        label: "Marketing",
        summary: "Comunicação, identidade visual, conteúdo, site e eventos institucionais.",
      },
      {
        key: "comercial",
        label: "Comercial",
        summary: "Relacionamento com clientes e desenvolvimento de novos negócios.",
      },
      {
        key: "pessoas-e-cultura",
        label: "Pessoas e Cultura",
        summary: "Admissão, remuneração, benefícios, clima e cultura organizacional.",
      },
      {
        key: "facilities",
        label: "Adm e Facilities",
        summary: "Infraestrutura, materiais, equipamentos, salas de reunião e reembolsos.",
      },
    ],
  },
  {
    key: "juridica",
    label: "Jurídica",
    summary: "Áreas de atuação jurídica, cada uma conduzida por um sócio ou gerente de área.",
    teams: [
      {
        key: "trabalhista",
        label: "Trabalhista",
        summary: "Consultivo e contencioso trabalhista empresarial, compliance e gestão de passivo.",
      },
      {
        key: "civel",
        label: "Cível",
        summary: "Contratos, responsabilidade civil, cobranças, indenizações, família e sucessões.",
      },
      {
        key: "reestruturacao",
        label: "Reestruturação",
        summary: "Recuperação judicial e extrajudicial, insolvência e soerguimento de empresas.",
        groups: ["Insolvência", "Cível Insolvência"],
      },
      {
        key: "recuperacao-de-credito",
        label: "Recuperação de Crédito",
        summary: "Recuperação de ativos, da fase preventiva e extrajudicial até a judicial.",
      },
      {
        key: "societario-e-contratos",
        label: "Societário e Contratos",
        summary: "Contratos, instrumentos societários, acordos de sócios e governança corporativa.",
      },
      {
        key: "tributario",
        label: "Tributário",
        summary: "Assessoria tributária consultiva e contenciosa para empresas.",
      },
    ],
  },
];

export const ORG_COMMITTEES: OrgCommitteeDef[] = [
  {
    key: "clima",
    label: "Equipe de Clima Organizacional",
    summary: "Ações de integração e bem-estar e cuidado com a cultura do escritório.",
  },
];

// ---------------------------------------------------------------------------
// Níveis (legenda de cores do onboarding)

export type OrgLevel =
  | "lideranca"
  | "coordenacao"
  | "supervisao"
  | "pleno"
  | "junior"
  | "auxiliar"
  | "estagio";

export const ORG_LEVELS: { key: OrgLevel; label: string }[] = [
  { key: "lideranca", label: "Sócios e gestão" },
  { key: "coordenacao", label: "Coordenação" },
  { key: "supervisao", label: "Supervisão" },
  { key: "pleno", label: "Analista, Pleno e Sênior" },
  { key: "junior", label: "Júnior e Assistente" },
  { key: "auxiliar", label: "Auxiliar" },
  { key: "estagio", label: "Estágio" },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function roleLevel(role: string): OrgLevel {
  const r = normalize(role);
  if (/\bsocio\b|gerente/.test(r)) return "lideranca";
  if (/coorden/.test(r)) return "coordenacao";
  if (/supervis/.test(r)) return "supervisao";
  if (/estagi/.test(r)) return "estagio";
  if (/auxiliar/.test(r)) return "auxiliar";
  if (/analista|pleno|senior|consultor|especialista|controller/.test(r)) return "pleno";
  if (/junior|\bjr\b|assistente/.test(r)) return "junior";
  return "pleno";
}

// ---------------------------------------------------------------------------
// Montagem da árvore

export type OrgTier = OrgMember[];

export type OrgTeamView = Omit<OrgTeamDef, "groups"> & {
  divisionKey: string;
  tiers: OrgTier[];
  groups: { label: string; tiers: OrgTier[] }[];
  /** Pessoas da equipe, sem repetir. */
  members: OrgMember[];
};

export type OrgDivisionView = Omit<OrgDivisionDef, "teams"> & {
  leaders: OrgTier[];
  teams: OrgTeamView[];
};

export type OrgCommitteeView = OrgCommitteeDef & { members: OrgMember[] };

export type OrgChartView = {
  partners: OrgMember[];
  divisions: OrgDivisionView[];
  committees: OrgCommitteeView[];
  /** Ainda posicionados, mas inativos no RH (saíram do escritório). */
  departed: OrgMember[];
  /** Pessoas visíveis no organograma, sem repetir. */
  totalPeople: number;
};

function byPosition(a: OrgMember, b: OrgMember): number {
  return a.tier - b.tier || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR");
}

/**
 * Cargo/senioridade comparável dentro de uma equipe. Mais fino que o nível
 * da legenda: "Advogada Júnior" e "Assistente Jurídico" têm a mesma cor, mas
 * não precisam ficar lado a lado.
 */
export function seniorityGrade(role: string): string {
  const r = normalize(role);
  if (/estagi/.test(r)) return "estagio";
  if (/auxiliar/.test(r)) return "auxiliar";
  if (/\bsocio\b/.test(r)) return "socio";
  if (/gerente/.test(r)) return "gerente";
  if (/coorden/.test(r)) return "coordenacao";
  if (/supervis/.test(r)) return "supervisao";
  if (/especialista/.test(r)) return "especialista";
  if (/senior/.test(r)) return "senior";
  if (/pleno/.test(r)) return "pleno";
  if (/junior|\bjr\b/.test(r)) return "junior";
  if (/assistente/.test(r)) return "assistente";
  if (/analista/.test(r)) return "analista";
  if (/consultor/.test(r)) return "consultor";
  return r;
}

/**
 * Nível em que alguém com esse cargo precisa ficar, se já houver colega com
 * a mesma senioridade no mesmo grupo (mesmo cargo fica sempre lado a lado).
 */
export function alignedTierFor(
  peers: Pick<OrgMember, "role" | "tier">[],
  role: string
): number | null {
  const grade = seniorityGrade(role);
  const tiers = peers.filter((p) => seniorityGrade(p.role) === grade).map((p) => p.tier);
  return tiers.length ? Math.min(...tiers) : null;
}

/**
 * Agrupa por nível, compactando buracos (tier 0, 2 e 5 viram três linhas).
 * Quem tem a mesma senioridade sobe para o nível do colega mais alto, então
 * um dado inconsistente no banco nunca desenha pares um embaixo do outro.
 */
export function groupTiers(members: OrgMember[]): OrgTier[] {
  const topTierByGrade = new Map<string, number>();
  for (const m of members) {
    const grade = seniorityGrade(m.role);
    topTierByGrade.set(grade, Math.min(topTierByGrade.get(grade) ?? m.tier, m.tier));
  }
  const aligned = members.map((m) => {
    const tier = topTierByGrade.get(seniorityGrade(m.role)) ?? m.tier;
    return tier === m.tier ? m : { ...m, tier };
  });

  const tiers: OrgTier[] = [];
  let current: number | null = null;
  for (const member of aligned.sort(byPosition)) {
    if (member.tier !== current) {
      tiers.push([]);
      current = member.tier;
    }
    tiers[tiers.length - 1].push(member);
  }
  return tiers;
}

function uniqueByEmployee(members: OrgMember[]): OrgMember[] {
  const seen = new Set<string>();
  return members.filter((m) => {
    if (seen.has(m.employeeId)) return false;
    seen.add(m.employeeId);
    return true;
  });
}

export function buildOrgChart(members: OrgMember[]): OrgChartView {
  const placed = members.filter((m) => m.placement !== "hidden");
  const visible = placed.filter((m) => m.isActive);
  const departed = uniqueByEmployee(placed.filter((m) => !m.isActive));

  const divisions: OrgDivisionView[] = ORG_DIVISIONS.map((division) => ({
    key: division.key,
    label: division.label,
    summary: division.summary,
    leaders: groupTiers(
      visible.filter((m) => m.placement === "division_leader" && m.divisionKey === division.key)
    ),
    teams: division.teams.map((team) => {
      const teamMembers = visible.filter(
        (m) => m.placement === "team" && m.divisionKey === division.key && m.teamKey === team.key
      );
      const labels = [
        ...(team.groups ?? []),
        ...new Set(
          teamMembers
            .map((m) => m.groupLabel)
            .filter((l): l is string => Boolean(l) && !(team.groups ?? []).includes(l as string))
        ),
      ];
      const groups = labels
        .map((label) => ({
          label,
          tiers: groupTiers(teamMembers.filter((m) => m.groupLabel === label)),
        }))
        .filter((g) => g.tiers.length > 0);
      const tiers = groupTiers(teamMembers.filter((m) => !m.groupLabel));
      const ordered = [...tiers.flat(), ...groups.flatMap((g) => g.tiers.flat())];
      return { ...team, divisionKey: division.key, tiers, groups, members: uniqueByEmployee(ordered) };
    }),
  }));

  const committees = ORG_COMMITTEES.map((committee) => ({
    ...committee,
    members: visible
      .filter((m) => m.placement === "committee" && m.teamKey === committee.key)
      .sort(byPosition),
  }));

  const inChart = visible.filter((m) => m.placement !== "committee");
  return {
    partners: visible.filter((m) => m.placement === "partner").sort(byPosition),
    divisions,
    committees,
    departed,
    totalPeople: new Set(inChart.map((m) => m.employeeId)).size,
  };
}

export function findTeamView(
  view: OrgChartView,
  teamKey: string
): { division: OrgDivisionView; team: OrgTeamView } | null {
  for (const division of view.divisions) {
    const team = division.teams.find((t) => t.key === teamKey);
    if (team) return { division, team };
  }
  return null;
}

/** Onde a pessoa aparece, em texto curto (ex.: "LexNext Lab · Marketing"). */
export function memberContext(view: OrgChartView, employeeId: string): string {
  const labels: string[] = [];
  if (view.partners.some((m) => m.employeeId === employeeId)) labels.push("Sócios patrimoniais");
  for (const division of view.divisions) {
    if (division.leaders.flat().some((m) => m.employeeId === employeeId)) {
      labels.push(`Liderança · ${division.label}`);
    }
    for (const team of division.teams) {
      if (team.members.some((m) => m.employeeId === employeeId)) labels.push(team.label);
    }
  }
  return labels.join(" · ");
}

/** Primeira equipe da pessoa, para abrir na visão por equipe. */
export function firstTeamOf(view: OrgChartView, employeeId: string): string | null {
  for (const division of view.divisions) {
    for (const team of division.teams) {
      if (team.members.some((m) => m.employeeId === employeeId)) return team.key;
    }
  }
  return null;
}

/** Busca por nome, nome completo ou cargo, sem diferenciar acentos. */
export function searchOrgMembers(view: OrgChartView, query: string): OrgMember[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const all = uniqueByEmployee([
    ...view.partners,
    ...view.divisions.flatMap((d) => [...d.leaders.flat(), ...d.teams.flatMap((t) => t.members)]),
  ]);
  return all
    .filter((m) => {
      const haystack = normalize(`${m.name} ${m.employeeName} ${m.role}`);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Destinos possíveis ao posicionar alguém (diálogo de ajuste)

export type OrgTarget = {
  value: string;
  label: string;
  section: string;
  placement: OrgPlacement;
  divisionKey: string | null;
  teamKey: string | null;
  groups: string[];
};

export function listOrgTargets(): OrgTarget[] {
  const targets: OrgTarget[] = [
    {
      value: "partner",
      label: "Sócios patrimoniais",
      section: "Topo",
      placement: "partner",
      divisionKey: null,
      teamKey: null,
      groups: [],
    },
  ];
  for (const division of ORG_DIVISIONS) {
    targets.push({
      value: `division_leader:${division.key}`,
      label: `Liderança de ${division.label}`,
      section: division.label,
      placement: "division_leader",
      divisionKey: division.key,
      teamKey: null,
      groups: [],
    });
    for (const team of division.teams) {
      targets.push({
        value: `team:${division.key}:${team.key}`,
        label: team.label,
        section: division.label,
        placement: "team",
        divisionKey: division.key,
        teamKey: team.key,
        groups: team.groups ?? [],
      });
    }
  }
  for (const committee of ORG_COMMITTEES) {
    targets.push({
      value: `committee:${committee.key}`,
      label: committee.label,
      section: "Comitês",
      placement: "committee",
      divisionKey: null,
      teamKey: committee.key,
      groups: [],
    });
  }
  targets.push({
    value: "hidden",
    label: "Não exibir no organograma",
    section: "Outros",
    placement: "hidden",
    divisionKey: null,
    teamKey: null,
    groups: [],
  });
  return targets;
}

export function targetValueOf(member: Pick<OrgMember, "placement" | "divisionKey" | "teamKey">): string {
  switch (member.placement) {
    case "division_leader":
      return `division_leader:${member.divisionKey}`;
    case "team":
      return `team:${member.divisionKey}:${member.teamKey}`;
    case "committee":
      return `committee:${member.teamKey}`;
    default:
      return member.placement;
  }
}

/** Valida um destino recebido pela API. */
export function resolveOrgTarget(input: {
  placement: string;
  divisionKey?: string | null;
  teamKey?: string | null;
  groupLabel?: string | null;
}): { target: OrgTarget; groupLabel: string | null } | null {
  const value = targetValueOf({
    placement: input.placement as OrgPlacement,
    divisionKey: input.divisionKey ?? null,
    teamKey: input.teamKey ?? null,
  });
  const target = listOrgTargets().find((t) => t.value === value);
  if (!target) return null;
  const groupLabel = input.groupLabel?.trim() || null;
  if (groupLabel && !target.groups.includes(groupLabel)) return null;
  return { target, groupLabel };
}

/** "Francisco de Assis Barbosa Campos Zanin" → "Francisco Zanin" (sugestão editável). */
export function suggestDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
