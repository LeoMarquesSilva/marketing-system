import {
  DIETARY_NONE,
  dietaryLabel,
  EMPLOYEE_FICHA_STATUS_LABEL,
  GENDER_OPTIONS,
  optionLabel,
  RACE_COLOR_OPTIONS,
  type EmployeeFichaStatus,
  type EmployeeRegistrationRow,
} from "./types";

/**
 * Filtros da aba Colaboradores (Fichas cadastrais) e o "Perfil da equipe".
 * Cada filtro transforma a linha em um ou mais valores (ex.: faixa etária);
 * dentro de um filtro as escolhas somam (OU), entre filtros restringem (E),
 * como na lista de colaboradores do BambooHR.
 */

export const NOT_INFORMED = "__nao_informado";
export const NOT_INFORMED_LABEL = "Não informado";

export type PeopleFilterKey =
  | "status"
  | "fill"
  | "vinculo"
  | "area"
  | "gender"
  | "race"
  | "age"
  | "tenure"
  | "city"
  | "diet"
  | "oab";

export type PeopleFilterSelection = Partial<Record<PeopleFilterKey, string[]>>;

export interface PeopleFilterOption {
  value: string;
  label: string;
  count: number;
}

const dateOnly = (value: string) => value.slice(0, 10);

/** Anos completos entre a data (aaaa-mm-dd) e hoje. */
export function yearsSince(isoDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return null;
  const [y, m, d] = dateOnly(isoDate).split("-").map(Number);
  let years = now.getUTCFullYear() - y;
  const before = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (before) years -= 1;
  return years >= 0 ? years : null;
}

export const AGE_BANDS: { value: string; label: string; min: number; max: number }[] = [
  { value: "ate24", label: "Até 24 anos", min: 0, max: 24 },
  { value: "25a34", label: "25 a 34 anos", min: 25, max: 34 },
  { value: "35a44", label: "35 a 44 anos", min: 35, max: 44 },
  { value: "45a54", label: "45 a 54 anos", min: 45, max: 54 },
  { value: "55mais", label: "55 anos ou mais", min: 55, max: 200 },
];

export function ageBand(age: number | null): string {
  if (age === null) return NOT_INFORMED;
  return AGE_BANDS.find((band) => age >= band.min && age <= band.max)?.value ?? NOT_INFORMED;
}

export const TENURE_BANDS: { value: string; label: string; min: number; max: number }[] = [
  { value: "menos1", label: "Menos de 1 ano", min: 0, max: 0 },
  { value: "1a3", label: "1 a 3 anos", min: 1, max: 2 },
  { value: "3a5", label: "3 a 5 anos", min: 3, max: 4 },
  { value: "5a10", label: "5 a 10 anos", min: 5, max: 9 },
  { value: "10mais", label: "10 anos ou mais", min: 10, max: 200 },
];

export function tenureBand(admissionDate: string | null, now: Date = new Date()): string {
  const years = yearsSince(admissionDate, now);
  if (years === null) return NOT_INFORMED;
  return TENURE_BANDS.find((band) => years >= band.min && years <= band.max)?.value ?? NOT_INFORMED;
}

export const STATUS_ORDER: EmployeeFichaStatus[] = ["sem_envio", "aguardando", "devolvida", "para_revisar", "aprovada"];

const OAB_LABEL: Record<string, string> = { sim: "Tem OAB", nao: "Não tem OAB", na: "Não se aplica ao vínculo" };

export interface PeopleFilterDef {
  key: PeopleFilterKey;
  label: string;
  /** Valores da linha neste filtro (vazio = não informado). */
  values: (row: EmployeeRegistrationRow, now: Date) => string[];
  /** Rótulo de cada valor. */
  optionLabel: (value: string) => string;
  /** Ordem fixa das opções; sem ela, ordena por quantidade. */
  order?: string[];
}

const single = (value: string) => [value || NOT_INFORMED];

export const PEOPLE_FILTERS: PeopleFilterDef[] = [
  {
    key: "status",
    label: "Ficha",
    values: (row) => [row.status],
    optionLabel: (value) => EMPLOYEE_FICHA_STATUS_LABEL[value as EmployeeFichaStatus] ?? value,
    order: STATUS_ORDER,
  },
  {
    key: "fill",
    label: "Preenchimento",
    values: (row) => [row.missingFields.length === 0 ? "completa" : "pendente"],
    optionLabel: (value) => (value === "completa" ? "Ficha completa" : "Com pendências"),
    order: ["completa", "pendente"],
  },
  { key: "vinculo", label: "Vínculo", values: (row) => single(row.vinculoLabel), optionLabel: (value) => value },
  { key: "area", label: "Área", values: (row) => single(row.department ?? ""), optionLabel: (value) => value },
  {
    key: "gender",
    label: "Gênero",
    values: (row) => single(row.gender),
    optionLabel: (value) => optionLabel(GENDER_OPTIONS, value),
    order: [...GENDER_OPTIONS.map((option) => option.value), NOT_INFORMED],
  },
  {
    key: "race",
    label: "Raça/cor",
    values: (row) => single(row.raceColor),
    optionLabel: (value) => optionLabel(RACE_COLOR_OPTIONS, value),
    order: [...RACE_COLOR_OPTIONS.map((option) => option.value), NOT_INFORMED],
  },
  {
    key: "age",
    label: "Idade",
    values: (row) => [ageBand(row.age)],
    optionLabel: (value) => AGE_BANDS.find((band) => band.value === value)?.label ?? value,
    order: [...AGE_BANDS.map((band) => band.value), NOT_INFORMED],
  },
  {
    key: "tenure",
    label: "Tempo de casa",
    values: (row, now) => [tenureBand(row.admissionDate, now)],
    optionLabel: (value) => TENURE_BANDS.find((band) => band.value === value)?.label ?? value,
    order: [...TENURE_BANDS.map((band) => band.value), NOT_INFORMED],
  },
  {
    key: "city",
    label: "Onde mora",
    values: (row) => single(row.residenceCity ? `${row.residenceCity}${row.residenceState ? `/${row.residenceState}` : ""}` : ""),
    optionLabel: (value) => value,
  },
  {
    key: "diet",
    label: "Alimentação",
    values: (row) => {
      const items = row.dietaryRestrictions;
      if (items.length === 0) return [NOT_INFORMED];
      return items;
    },
    optionLabel: (value) => (value === DIETARY_NONE ? "Sem restrição" : dietaryLabel(value)),
  },
  {
    key: "oab",
    label: "OAB",
    values: (row) => single(row.oab),
    optionLabel: (value) => OAB_LABEL[value] ?? value,
    order: ["sim", "nao", "na", NOT_INFORMED],
  },
];

const FILTER_BY_KEY = new Map(PEOPLE_FILTERS.map((def) => [def.key, def]));

export function filterLabel(key: PeopleFilterKey, value: string): string {
  if (value === NOT_INFORMED) return NOT_INFORMED_LABEL;
  return FILTER_BY_KEY.get(key)?.optionLabel(value) || value;
}

function matchesFilter(
  row: EmployeeRegistrationRow,
  def: PeopleFilterDef,
  selected: string[] | undefined,
  now: Date
): boolean {
  if (!selected || selected.length === 0) return true;
  return def.values(row, now).some((value) => selected.includes(value));
}

/** Aplica todos os filtros (opcionalmente ignorando um, para contar as opções dele). */
export function applyPeopleFilters(
  rows: EmployeeRegistrationRow[],
  selection: PeopleFilterSelection,
  now: Date = new Date(),
  except?: PeopleFilterKey
): EmployeeRegistrationRow[] {
  return rows.filter((row) =>
    PEOPLE_FILTERS.every((def) => def.key === except || matchesFilter(row, def, selection[def.key], now))
  );
}

/**
 * Opções de um filtro com a contagem considerando os demais filtros ativos
 * (o número mostra quantas pessoas a lista teria ao marcar a opção).
 */
export function peopleFilterOptions(
  key: PeopleFilterKey,
  rows: EmployeeRegistrationRow[],
  selection: PeopleFilterSelection,
  now: Date = new Date()
): PeopleFilterOption[] {
  const def = FILTER_BY_KEY.get(key);
  if (!def) return [];
  const base = applyPeopleFilters(rows, selection, now, key);
  const counts = new Map<string, number>();
  for (const row of base) {
    for (const value of new Set(def.values(row, now))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  // Escolhas já marcadas continuam na lista mesmo com zero.
  for (const value of selection[key] ?? []) if (!counts.has(value)) counts.set(value, 0);
  const options = [...counts.entries()].map(([value, count]) => ({ value, label: filterLabel(key, value), count }));
  if (def.order) {
    const position = (value: string) => {
      const index = def.order!.indexOf(value);
      return index === -1 ? def.order!.length : index;
    };
    return options.sort((a, b) => position(a.value) - position(b.value) || a.label.localeCompare(b.label, "pt-BR"));
  }
  return options.sort(
    (a, b) =>
      Number(a.value === NOT_INFORMED) - Number(b.value === NOT_INFORMED) ||
      b.count - a.count ||
      a.label.localeCompare(b.label, "pt-BR")
  );
}

export interface ProfileBucket {
  value: string;
  label: string;
  count: number;
  percent: number;
}

/** Distribuição de um recorte (ex.: gênero) entre as linhas, na ordem do filtro. */
export function profileDistribution(
  key: PeopleFilterKey,
  rows: EmployeeRegistrationRow[],
  now: Date = new Date()
): ProfileBucket[] {
  const total = rows.length;
  return peopleFilterOptions(key, rows, {}, now)
    .filter((option) => option.count > 0)
    .map((option) => ({ ...option, percent: total ? Math.round((option.count / total) * 100) : 0 }));
}

/** Idade média das linhas com data de nascimento. */
export function averageAge(rows: EmployeeRegistrationRow[]): number | null {
  const ages = rows.map((row) => row.age).filter((age): age is number => age !== null);
  if (ages.length === 0) return null;
  return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
}

export function countActiveFilters(selection: PeopleFilterSelection): number {
  return Object.values(selection).reduce((sum, values) => sum + (values?.length ? 1 : 0), 0);
}
