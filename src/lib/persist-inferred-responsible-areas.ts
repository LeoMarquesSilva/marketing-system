/**
 * Persiste responsible_area inferida (área única envolvida) em grupos
 * cuja coluna ainda está vazia — o mesmo caso que bloqueava “quem contata”.
 */

import { getAdminClient } from "@/lib/email-marketing-server";
import {
  mapCompany,
  mapGroupResponsible,
  mapPerson,
} from "@/lib/email-marketing";
import {
  filterInternalResponsibles,
  filterOutInternalClientGroups,
  inferResponsibleAreasToPersist,
  type InferredResponsibleAreaUpdate,
} from "@/lib/meus-clientes";

const PAGE_SIZE = 1000;
const UPDATE_CHUNK = 25;

async function fetchAllRows(
  admin: ReturnType<typeof getAdminClient>,
  table: string,
  select: string
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export async function persistInferredClientGroupResponsibleAreas(
  admin: ReturnType<typeof getAdminClient> = getAdminClient()
): Promise<{ updated: InferredResponsibleAreaUpdate[] }> {
  const [companyRows, peopleRows, responsibleRows, groupRows] = await Promise.all([
    fetchAllRows(admin, "email_companies", "*, email_client_groups(id, name, responsible_area)"),
    fetchAllRows(admin, "email_people", "*, email_client_groups(id, name, responsible_area)"),
    fetchAllRows(
      admin,
      "email_group_responsibles",
      "id, client_group_id, company_id, person_id, area, advogado_responsavel_name, responsible_user_id, open_processes_count"
    ),
    fetchAllRows(admin, "email_client_groups", "id, name, responsible_area"),
  ]);

  const allCompanies = filterOutInternalClientGroups(companyRows.map(mapCompany));
  const allPeople = filterOutInternalClientGroups(peopleRows.map(mapPerson));
  const allResponsibles = filterInternalResponsibles(
    responsibleRows.map(mapGroupResponsible),
    allCompanies,
    allPeople
  );

  const groups = groupRows.map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    responsibleArea: (row.responsible_area as string | null) ?? null,
  }));

  const updates = inferResponsibleAreasToPersist(groups, allCompanies, allPeople, allResponsibles);
  const now = new Date().toISOString();

  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    const results = await Promise.all(
      chunk.map((update) =>
        admin
          .from("email_client_groups")
          .update({ responsible_area: update.area, updated_at: now })
          .eq("id", update.id)
          .is("responsible_area", null)
      )
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
  }

  return { updated: updates };
}
