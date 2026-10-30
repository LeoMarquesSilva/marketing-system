import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadPeopleDirectory, type DirectoryPerson } from "@/lib/rh/people-directory";
import { RhHttpError, requireAuthenticatedUser, requireHrManager } from "@/lib/rh/qualifications/server";
import {
  AWARD_CATEGORIES,
  AWARD_CATEGORY_KEYS,
  CITATION_MAX,
  JUSTIFICATION_MAX,
  JUSTIFICATION_MIN,
  MAX_FINALISTS,
  awardCategory,
  isNominationComplete,
  isPartner,
  resolveAwardPhase,
  type AwardCategoryKey,
  type AwardEdition,
  type AwardFinalist,
  type AwardInviteStatus,
  type AwardPerson,
  type AwardWinner,
  type CommitteeView,
  type NomineeTally,
  type ParticipationRow,
  type RevealCategory,
  type VoterView,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const LOG = "bp-awards";
const EDITION_SELECT = "id, year, title, voting_opens_at, voting_closes_at, partners_eligible, results_published_at";
const FINALIST_SELECT = "id, category, employee_id, is_winner, citation";

function createAwardsAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function toAwardPerson(person: DirectoryPerson): AwardPerson {
  return {
    id: person.id,
    full_name: person.full_name,
    short_name: person.short_name,
    department: person.department,
    position: person.position,
    avatar_url: person.avatar_url,
  };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Edição corrente = a do ano mais recente. */
async function loadCurrentEdition(db: SupabaseClient): Promise<AwardEdition | null> {
  const { data, error } = await db
    .from("hr_award_editions")
    .select(EDITION_SELECT)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[${LOG}] edição:`, error);
    throw new RhHttpError("Falha ao carregar o BP Awards.", 500, "QUERY_FAILED");
  }
  return (data as AwardEdition | null) ?? null;
}

async function requireCurrentEdition(db: SupabaseClient): Promise<AwardEdition> {
  const edition = await loadCurrentEdition(db);
  if (!edition) throw new RhHttpError("Nenhuma edição do BP Awards cadastrada.", 404, "NOT_FOUND");
  return edition;
}

function requireOpen(edition: AwardEdition) {
  if (resolveAwardPhase(edition) !== "aberta") {
    throw new RhHttpError("A votação não está aberta.", 409, "VOTING_CLOSED");
  }
}

type EmployeeLite = { id: string; full_name: string; department: string | null; position: string | null; is_active: boolean };

/** Cadastro de colaborador ativo do usuário logado (quem não tem não vota). */
async function loadVoterEmployee(db: SupabaseClient, profileId: string): Promise<EmployeeLite | null> {
  const { data, error } = await db
    .from("hr_employees")
    .select("id, full_name, department, position, is_active")
    .eq("user_id", profileId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[${LOG}] votante:`, error);
    throw new RhHttpError("Falha ao identificar o colaborador.", 500, "QUERY_FAILED");
  }
  return (data as EmployeeLite | null) ?? null;
}

/** Por que esta pessoa não pode ser indicada por este votante (null = pode). */
function nomineeProblem(
  nominee: Pick<EmployeeLite, "id" | "department" | "position" | "is_active"> | null | undefined,
  voterEmployeeId: string,
  edition: AwardEdition
): string | null {
  if (!nominee || !nominee.is_active) return "Escolha um colaborador ativo do escritório.";
  if (nominee.id === voterEmployeeId) return "Não vale indicar a si mesmo.";
  if (!edition.partners_eligible && isPartner(nominee)) return "Nesta edição, sócios não concorrem.";
  return null;
}

type BallotRow = { id: string; voter_user_id: string; voter_employee_id: string | null; submitted_at: string | null };
type NominationRow = {
  id: string;
  ballot_id: string;
  category: AwardCategoryKey;
  nominee_employee_id: string;
  justification: string;
  updated_at: string;
};

async function loadOwnBallot(db: SupabaseClient, editionId: string, profileId: string) {
  const { data: ballot, error } = await db
    .from("hr_award_ballots")
    .select("id, voter_user_id, voter_employee_id, submitted_at")
    .eq("edition_id", editionId)
    .eq("voter_user_id", profileId)
    .maybeSingle();
  if (error) {
    console.error(`[${LOG}] cédula:`, error);
    throw new RhHttpError("Falha ao carregar suas indicações.", 500, "QUERY_FAILED");
  }
  if (!ballot) return { ballot: null, nominations: [] as NominationRow[] };
  const { data: nominations, error: nominationsError } = await db
    .from("hr_award_nominations")
    .select("id, ballot_id, category, nominee_employee_id, justification, updated_at")
    .eq("ballot_id", ballot.id);
  if (nominationsError) {
    console.error(`[${LOG}] indicações:`, nominationsError);
    throw new RhHttpError("Falha ao carregar suas indicações.", 500, "QUERY_FAILED");
  }
  return { ballot: ballot as BallotRow, nominations: (nominations ?? []) as NominationRow[] };
}

async function loadFinalists(db: SupabaseClient, editionId: string): Promise<AwardFinalist[]> {
  const { data, error } = await db.from("hr_award_finalists").select(FINALIST_SELECT).eq("edition_id", editionId);
  if (error) {
    console.error(`[${LOG}] finalistas:`, error);
    throw new RhHttpError("Falha ao carregar os finalistas.", 500, "QUERY_FAILED");
  }
  return (data ?? []) as AwardFinalist[];
}

function categoryOrder(key: AwardCategoryKey): number {
  return AWARD_CATEGORY_KEYS.indexOf(key);
}

/* ------------------------------------------------------------ colaborador */

/**
 * `preview` (só RH): a página como o colaborador verá com a votação aberta,
 * sem cédula própria e sem salvar nada, para revisar antes do lançamento.
 */
export async function getVoterView({ preview = false }: { preview?: boolean } = {}): Promise<VoterView> {
  const user = preview ? await requireHrManager() : await requireAuthenticatedUser();
  const db = createAwardsAdminClient();
  const edition = await loadCurrentEdition(db);
  if (!edition) return { state: "no_edition" };

  const phase = preview ? "aberta" : resolveAwardPhase(edition);
  const [people, own] = await Promise.all([
    loadPeopleDirectory(db, LOG),
    preview ? { ballot: null, nominations: [] as NominationRow[] } : loadOwnBallot(db, edition.id, user.profileId),
  ]);
  const me = people.find((person) => person.user_id === user.profileId && person.is_active) ?? null;
  const candidates =
    me || preview
      ? people
          .filter((person) => !nomineeProblem(person, me?.id ?? "", edition))
          .map(toAwardPerson)
          .sort((a, b) => a.short_name.localeCompare(b.short_name, "pt-BR"))
      : [];

  let winners: AwardWinner[] = [];
  if (phase === "publicada") {
    const byId = new Map(people.map((person) => [person.id, person]));
    winners = (await loadFinalists(db, edition.id))
      .filter((finalist) => finalist.is_winner && byId.has(finalist.employee_id))
      .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category))
      .map((finalist) => ({
        category: finalist.category,
        person: toAwardPerson(byId.get(finalist.employee_id)!),
        citation: finalist.citation,
      }));
  }

  return {
    state: "ready",
    edition,
    phase,
    preview,
    eligible: Boolean(me) || preview,
    voterFirstName: firstName(me?.short_name ?? user.name),
    candidates,
    nominations: own.nominations.map(({ category, nominee_employee_id, justification }) => ({
      category,
      nominee_employee_id,
      justification,
    })),
    submittedAt: own.ballot?.submitted_at ?? null,
    winners,
  };
}

const nominationSchema = z.object({
  category: z.enum(AWARD_CATEGORY_KEYS),
  nominee_employee_id: z.string().uuid("Escolha um colaborador."),
  justification: z.string().max(JUSTIFICATION_MAX, "Texto muito longo.").default(""),
});

/** Salva (rascunho) a indicação de um valor. Depois do envio, continua editável até o prazo. */
export async function saveNomination(input: unknown): Promise<{ savedAt: string }> {
  const parsed = nominationSchema.safeParse(input);
  if (!parsed.success) {
    throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  }
  const value = parsed.data;
  const user = await requireAuthenticatedUser();
  const db = createAwardsAdminClient();
  const edition = await requireCurrentEdition(db);
  requireOpen(edition);

  const voter = await loadVoterEmployee(db, user.profileId);
  if (!voter) throw new RhHttpError("A votação é para colaboradores ativos do escritório.", 403, "NOT_ELIGIBLE");

  const { data: nominee, error: nomineeError } = await db
    .from("hr_employees")
    .select("id, department, position, is_active")
    .eq("id", value.nominee_employee_id)
    .maybeSingle();
  if (nomineeError) throw new RhHttpError("Falha ao conferir o colaborador.", 500, "QUERY_FAILED");
  const problem = nomineeProblem(nominee as EmployeeLite | null, voter.id, edition);
  if (problem) throw new RhHttpError(problem, 400, "INVALID_NOMINEE");

  const { data: ballot, error: ballotError } = await db
    .from("hr_award_ballots")
    .upsert(
      { edition_id: edition.id, voter_user_id: user.profileId, voter_employee_id: voter.id },
      { onConflict: "edition_id,voter_user_id" }
    )
    .select("id, submitted_at")
    .single();
  if (ballotError || !ballot) {
    console.error(`[${LOG}] cédula:`, ballotError);
    throw new RhHttpError("Não foi possível salvar.", 500, "SAVE_FAILED");
  }

  const justification = value.justification.trim();
  if (ballot.submitted_at && justification.length < JUSTIFICATION_MIN) {
    throw new RhHttpError(
      `Suas indicações já foram enviadas: descreva a situação com pelo menos ${JUSTIFICATION_MIN} caracteres.`,
      400,
      "JUSTIFICATION_TOO_SHORT"
    );
  }

  const { data: saved, error } = await db
    .from("hr_award_nominations")
    .upsert(
      {
        ballot_id: ballot.id,
        edition_id: edition.id,
        category: value.category,
        nominee_employee_id: value.nominee_employee_id,
        justification,
      },
      { onConflict: "ballot_id,category" }
    )
    .select("updated_at")
    .single();
  if (error || !saved) {
    console.error(`[${LOG}] indicação:`, error);
    throw new RhHttpError("Não foi possível salvar.", 500, "SAVE_FAILED");
  }
  return { savedAt: saved.updated_at as string };
}

/** Envia as 5 indicações para o comitê. */
export async function submitBallot(): Promise<{ submittedAt: string }> {
  const user = await requireAuthenticatedUser();
  const db = createAwardsAdminClient();
  const edition = await requireCurrentEdition(db);
  requireOpen(edition);

  const voter = await loadVoterEmployee(db, user.profileId);
  if (!voter) throw new RhHttpError("A votação é para colaboradores ativos do escritório.", 403, "NOT_ELIGIBLE");

  const { ballot, nominations } = await loadOwnBallot(db, edition.id, user.profileId);
  if (!ballot) throw new RhHttpError(`Falta completar ${AWARD_CATEGORIES[0].name}.`, 400, "INCOMPLETE");
  const byCategory = new Map(nominations.map((nomination) => [nomination.category, nomination]));
  for (const category of AWARD_CATEGORIES) {
    if (!isNominationComplete(byCategory.get(category.key))) {
      throw new RhHttpError(`Falta completar ${category.name}.`, 400, "INCOMPLETE");
    }
  }

  const { data: nominees, error: nomineesError } = await db
    .from("hr_employees")
    .select("id, department, position, is_active")
    .in("id", nominations.map((nomination) => nomination.nominee_employee_id));
  if (nomineesError) throw new RhHttpError("Falha ao conferir os colaboradores.", 500, "QUERY_FAILED");
  const nomineeById = new Map(((nominees ?? []) as EmployeeLite[]).map((nominee) => [nominee.id, nominee]));
  for (const nomination of nominations) {
    const problem = nomineeProblem(nomineeById.get(nomination.nominee_employee_id), voter.id, edition);
    if (problem) {
      throw new RhHttpError(`${awardCategory(nomination.category)?.name}: ${problem}`, 400, "INVALID_NOMINEE");
    }
  }

  if (ballot.submitted_at) return { submittedAt: ballot.submitted_at };
  const submittedAt = new Date().toISOString();
  const { error } = await db.from("hr_award_ballots").update({ submitted_at: submittedAt }).eq("id", ballot.id);
  if (error) {
    console.error(`[${LOG}] envio:`, error);
    throw new RhHttpError("Não foi possível enviar.", 500, "SAVE_FAILED");
  }
  return { submittedAt };
}

/** Aviso no sistema: votação aberta e o colaborador ainda não enviou. */
export async function getInviteStatus(): Promise<AwardInviteStatus> {
  const user = await requireAuthenticatedUser();
  const db = createAwardsAdminClient();
  const edition = await loadCurrentEdition(db);
  const idle: AwardInviteStatus = { pending: false, closesAt: edition?.voting_closes_at ?? null, filled: 0 };
  if (!edition || resolveAwardPhase(edition) !== "aberta") return idle;
  if (!(await loadVoterEmployee(db, user.profileId))) return idle;
  const { ballot, nominations } = await loadOwnBallot(db, edition.id, user.profileId);
  if (ballot?.submitted_at) return idle;
  return { pending: true, closesAt: edition.voting_closes_at, filled: nominations.filter(isNominationComplete).length };
}

/* ----------------------------------------------------------------- comitê */

export async function getCommitteeView(): Promise<CommitteeView> {
  await requireHrManager();
  const db = createAwardsAdminClient();
  const edition = await requireCurrentEdition(db);

  const [people, ballotsResult, nominationsResult, finalists] = await Promise.all([
    loadPeopleDirectory(db, LOG),
    db.from("hr_award_ballots").select("id, voter_user_id, voter_employee_id, submitted_at").eq("edition_id", edition.id),
    db
      .from("hr_award_nominations")
      .select("id, ballot_id, category, nominee_employee_id, justification, updated_at")
      .eq("edition_id", edition.id),
    loadFinalists(db, edition.id),
  ]);
  if (ballotsResult.error || nominationsResult.error) {
    console.error(`[${LOG}] apuração:`, ballotsResult.error ?? nominationsResult.error);
    throw new RhHttpError("Falha ao carregar as indicações.", 500, "QUERY_FAILED");
  }
  const ballots = (ballotsResult.data ?? []) as BallotRow[];
  const nominations = (nominationsResult.data ?? []) as NominationRow[];

  const personById = new Map(people.map((person) => [person.id, person]));
  const personByUser = new Map(people.filter((person) => person.user_id).map((person) => [person.user_id!, person]));
  const ballotById = new Map(ballots.map((ballot) => [ballot.id, ballot]));
  const ballotByUser = new Map(ballots.map((ballot) => [ballot.voter_user_id, ballot]));
  const filledByBallot = new Map<string, number>();
  for (const nomination of nominations) {
    if (isNominationComplete(nomination)) {
      filledByBallot.set(nomination.ballot_id, (filledByBallot.get(nomination.ballot_id) ?? 0) + 1);
    }
  }

  const participation: ParticipationRow[] = people
    .filter((person) => person.is_active && person.user_id)
    .map((person) => {
      const ballot = ballotByUser.get(person.user_id!);
      const filled = ballot ? (filledByBallot.get(ballot.id) ?? 0) : 0;
      return {
        person: toAwardPerson(person),
        status: ballot?.submitted_at ? "enviou" : ballot && filled > 0 ? "rascunho" : "pendente",
        filled,
        submitted_at: ballot?.submitted_at ?? null,
      };
    });

  const tallies = Object.fromEntries(AWARD_CATEGORY_KEYS.map((key) => [key, [] as NomineeTally[]])) as Record<
    AwardCategoryKey,
    NomineeTally[]
  >;
  const tallyIndex = new Map<string, NomineeTally>();
  for (const nomination of nominations) {
    const ballot = ballotById.get(nomination.ballot_id);
    const nominee = personById.get(nomination.nominee_employee_id);
    if (!ballot?.submitted_at || !nominee) continue;
    const key = `${nomination.category}:${nominee.id}`;
    let tally = tallyIndex.get(key);
    if (!tally) {
      tally = { person: toAwardPerson(nominee), count: 0, testimonies: [] };
      tallyIndex.set(key, tally);
      tallies[nomination.category].push(tally);
    }
    const voter =
      (ballot.voter_employee_id ? personById.get(ballot.voter_employee_id) : undefined) ??
      personByUser.get(ballot.voter_user_id);
    tally.count += 1;
    tally.testimonies.push({
      id: nomination.id,
      justification: nomination.justification,
      voter: voter ? toAwardPerson(voter) : null,
      updated_at: nomination.updated_at,
    });
  }
  for (const key of AWARD_CATEGORY_KEYS) {
    tallies[key].sort((a, b) => b.count - a.count || a.person.short_name.localeCompare(b.person.short_name, "pt-BR"));
  }

  return {
    edition,
    phase: resolveAwardPhase(edition),
    participation,
    tallies,
    finalists,
    people: people.filter((person) => person.is_active).map(toAwardPerson),
  };
}

const isoDateTime = z.string().datetime({ offset: true }).nullable();
const editionSchema = z.object({
  voting_opens_at: isoDateTime.optional(),
  voting_closes_at: isoDateTime.optional(),
  partners_eligible: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export async function updateEdition(input: unknown): Promise<AwardEdition> {
  const parsed = editionSchema.safeParse(input);
  if (!parsed.success) {
    throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  }
  const value = parsed.data;
  const manager = await requireHrManager();
  const db = createAwardsAdminClient();
  const edition = await requireCurrentEdition(db);

  const next = {
    voting_opens_at: value.voting_opens_at === undefined ? edition.voting_opens_at : value.voting_opens_at,
    voting_closes_at: value.voting_closes_at === undefined ? edition.voting_closes_at : value.voting_closes_at,
    partners_eligible: value.partners_eligible ?? edition.partners_eligible,
    results_published_at: edition.results_published_at,
  };
  if (
    next.voting_opens_at &&
    next.voting_closes_at &&
    new Date(next.voting_closes_at).getTime() <= new Date(next.voting_opens_at).getTime()
  ) {
    throw new RhHttpError("O encerramento precisa ser depois da abertura.", 400, "INVALID_DATES");
  }
  if (value.publish === true) {
    if (resolveAwardPhase({ ...next, results_published_at: null }) !== "apuracao") {
      throw new RhHttpError("Só dá para publicar depois que a votação encerrar.", 409, "NOT_CLOSED");
    }
    const winners = (await loadFinalists(db, edition.id)).filter((finalist) => finalist.is_winner);
    if (new Set(winners.map((winner) => winner.category)).size < AWARD_CATEGORY_KEYS.length) {
      throw new RhHttpError("Defina o vencedor dos 5 valores antes de publicar.", 409, "MISSING_WINNERS");
    }
    next.results_published_at = new Date().toISOString();
  } else if (value.publish === false) {
    next.results_published_at = null;
  }

  const { data, error } = await db
    .from("hr_award_editions")
    .update({ ...next, updated_by: manager.profileId })
    .eq("id", edition.id)
    .select(EDITION_SELECT)
    .single();
  if (error || !data) {
    console.error(`[${LOG}] edição:`, error);
    throw new RhHttpError("Não foi possível salvar a edição.", 500, "SAVE_FAILED");
  }
  return data as AwardEdition;
}

const finalistCreateSchema = z.object({
  category: z.enum(AWARD_CATEGORY_KEYS),
  employee_id: z.string().uuid(),
});

export async function addFinalist(input: unknown): Promise<AwardFinalist> {
  const parsed = finalistCreateSchema.safeParse(input);
  if (!parsed.success) throw new RhHttpError("Dados inválidos.", 400, "INVALID_INPUT");
  const manager = await requireHrManager();
  const db = createAwardsAdminClient();
  const edition = await requireCurrentEdition(db);

  const current = (await loadFinalists(db, edition.id)).filter((finalist) => finalist.category === parsed.data.category);
  if (current.some((finalist) => finalist.employee_id === parsed.data.employee_id)) {
    throw new RhHttpError("Essa pessoa já é finalista neste valor.", 409, "DUPLICATE");
  }
  if (current.length >= MAX_FINALISTS) {
    throw new RhHttpError(`Cada valor tem no máximo ${MAX_FINALISTS} finalistas.`, 409, "TOO_MANY_FINALISTS");
  }
  const { data, error } = await db
    .from("hr_award_finalists")
    .insert({
      edition_id: edition.id,
      category: parsed.data.category,
      employee_id: parsed.data.employee_id,
      created_by: manager.profileId,
      updated_by: manager.profileId,
    })
    .select(FINALIST_SELECT)
    .single();
  if (error || !data) {
    console.error(`[${LOG}] finalista:`, error);
    throw new RhHttpError("Não foi possível adicionar o finalista.", 500, "SAVE_FAILED");
  }
  return data as AwardFinalist;
}

const finalistUpdateSchema = z.object({
  is_winner: z.boolean().optional(),
  citation: z
    .string()
    .max(CITATION_MAX, "Homenagem muito longa.")
    .transform((text) => text.trim() || null)
    .optional(),
});

/** Marca o vencedor (desmarca o anterior do mesmo valor) e/ou grava a homenagem. */
export async function updateFinalist(id: string, input: unknown): Promise<AwardFinalist[]> {
  const parsed = finalistUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  }
  const manager = await requireHrManager();
  const db = createAwardsAdminClient();
  const { data: finalist, error: readError } = await db
    .from("hr_award_finalists")
    .select("id, edition_id, category")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new RhHttpError("Falha ao carregar o finalista.", 500, "QUERY_FAILED");
  if (!finalist) throw new RhHttpError("Finalista não encontrado.", 404, "NOT_FOUND");

  if (parsed.data.is_winner === true) {
    const { error } = await db
      .from("hr_award_finalists")
      .update({ is_winner: false, updated_by: manager.profileId })
      .eq("edition_id", finalist.edition_id)
      .eq("category", finalist.category)
      .neq("id", id)
      .eq("is_winner", true);
    if (error) throw new RhHttpError("Não foi possível trocar o vencedor.", 500, "SAVE_FAILED");
  }
  const patch: Record<string, unknown> = { updated_by: manager.profileId };
  if (parsed.data.is_winner !== undefined) patch.is_winner = parsed.data.is_winner;
  if (parsed.data.citation !== undefined) patch.citation = parsed.data.citation;
  const { error } = await db.from("hr_award_finalists").update(patch).eq("id", id);
  if (error) {
    console.error(`[${LOG}] finalista:`, error);
    throw new RhHttpError("Não foi possível salvar.", 500, "SAVE_FAILED");
  }
  return loadFinalists(db, finalist.edition_id as string);
}

export async function removeFinalist(id: string): Promise<void> {
  await requireHrManager();
  const db = createAwardsAdminClient();
  const { error } = await db.from("hr_award_finalists").delete().eq("id", id);
  if (error) {
    console.error(`[${LOG}] finalista:`, error);
    throw new RhHttpError("Não foi possível remover o finalista.", 500, "SAVE_FAILED");
  }
}

/** Telão da festa: finalistas em ordem alfabética (sem ranking) e o vencedor de cada valor. */
export async function getRevealData(): Promise<{ edition: AwardEdition; categories: RevealCategory[] }> {
  await requireHrManager();
  const db = createAwardsAdminClient();
  const edition = await requireCurrentEdition(db);
  const [people, finalists] = await Promise.all([loadPeopleDirectory(db, LOG), loadFinalists(db, edition.id)]);
  const byId = new Map(people.map((person) => [person.id, toAwardPerson(person)]));

  const categories = AWARD_CATEGORIES.map((category) => {
    const own = finalists.filter((finalist) => finalist.category === category.key && byId.has(finalist.employee_id));
    const winner = own.find((finalist) => finalist.is_winner) ?? null;
    return {
      category,
      finalists: own
        .map((finalist) => byId.get(finalist.employee_id)!)
        .sort((a, b) => a.short_name.localeCompare(b.short_name, "pt-BR")),
      winner: winner ? byId.get(winner.employee_id)! : null,
      citation: winner?.citation ?? null,
    };
  });
  return { edition, categories };
}

