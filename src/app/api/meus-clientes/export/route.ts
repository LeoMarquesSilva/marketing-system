import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchMeusClientesPayload } from "@/lib/meus-clientes-server";
import {
  clientProfileIsIncomplete,
  contactToClientProfile,
  listClientMissingFieldLabels,
  personToClientProfile,
} from "@/lib/email-marketing-enrichment";
import {
  buildClientGroupKeysForAreaFilter,
  resolveClientGroupKey,
  resolveContactGroupKey,
  filterPeopleNotInContacts,
} from "@/lib/meus-clientes";
import { getPartyInviteTipoLabel, parsePartyInviteTipo } from "@/lib/party-invite-types";
import type { PartyInviteTipo } from "@/lib/party-invite-types";
import {
  parseInviteFilterParam,
  memberMatchesInviteFilter,
  resolveGestorInviteFilter,
} from "@/lib/meus-clientes-invite-filter";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvRow(cols: string[]): string {
  return cols.map(csvEscape).join(",");
}

function rowMatchesSearch(values: Array<string | null | undefined>, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return values.some((value) => (value ?? "").toLowerCase().includes(q));
}

/** Exporta CSV respeitando escopo e filtros da listagem. */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const viewAll = url.searchParams.get("viewAll") === "1";
    const filterGestorId = url.searchParams.get("gestorId") || null;
    const filterArea = url.searchParams.get("area") || null;
    const filterStatus = url.searchParams.get("status") || "all";
    const inviteFilterParam = parseInviteFilterParam(url.searchParams.get("invite"));
    const partyTipoFilter = parsePartyInviteTipo(url.searchParams.get("partyTipo"));
    const search = (url.searchParams.get("search") ?? "").trim();
    const excludeSemGrupo = url.searchParams.get("excludeSemGrupo") === "1";

    const { companies, contacts, people, responsibles, isAdmin, areaContactByGroupId, systemUsers } =
      await fetchMeusClientesPayload({
      authUserId: user.id,
      viewAll,
      filterGestorId,
    });
    const inviteFilter = resolveGestorInviteFilter(isAdmin, inviteFilterParam);
    const partyTipo: PartyInviteTipo | "all" = partyTipoFilter ?? "all";

    const companiesById = new Map(companies.map((c) => [c.id, c]));
    const personAreas = new Map<string, string[]>();
    for (const responsible of responsibles) {
      if (!responsible.personId || !responsible.area) continue;
      const areas = personAreas.get(responsible.personId) ?? [];
      areas.push(responsible.area);
      personAreas.set(responsible.personId, areas);
    }
    const collectorDepartmentByGroupId = new Map<string, string | null>();
    const departmentByUserId = new Map(
      (systemUsers ?? []).map((user) => [user.id, user.department])
    );
    for (const [groupId, userId] of Object.entries(areaContactByGroupId ?? {})) {
      if (!userId) continue;
      collectorDepartmentByGroupId.set(groupId, departmentByUserId.get(userId) ?? null);
    }
    const groupKeysForAreaFilter = filterArea
      ? buildClientGroupKeysForAreaFilter(
          filterArea,
          companies,
          people,
          personAreas,
          responsibles,
          collectorDepartmentByGroupId
        )
      : null;

    const filteredContacts = contacts.filter((contact) => {
      const groupKey = resolveContactGroupKey(contact, companiesById);
      if (excludeSemGrupo && !contact.clientGroupId) return false;
      if (groupKeysForAreaFilter && !groupKeysForAreaFilter.has(groupKey)) return false;
      if (filterStatus === "pending" && !clientProfileIsIncomplete(contactToClientProfile(contact))) {
        return false;
      }
      if (filterStatus === "complete" && clientProfileIsIncomplete(contactToClientProfile(contact))) {
        return false;
      }
      const company = contact.companyId ? companiesById.get(contact.companyId) : null;
      if (
        !rowMatchesSearch(
          [
            contact.clientGroupName,
            company?.clientGroupName,
            contact.name,
            contact.email,
            contact.phone,
            contact.cargo,
            contact.company,
          ],
          search
        )
      ) {
        return false;
      }
      if (!memberMatchesInviteFilter(contact, inviteFilter, partyTipo)) return false;
      return true;
    });

    const filteredPeopleRaw = people.filter((person) => {
      if (excludeSemGrupo && !person.clientGroupId) return false;
      if (
        groupKeysForAreaFilter &&
        !groupKeysForAreaFilter.has(resolveClientGroupKey(person))
      ) {
        return false;
      }
      if (filterStatus === "pending" && !clientProfileIsIncomplete(personToClientProfile(person))) {
        return false;
      }
      if (filterStatus === "complete" && clientProfileIsIncomplete(personToClientProfile(person))) {
        return false;
      }
      if (
        !rowMatchesSearch(
          [
            person.clientGroupName,
            person.name,
            person.email,
            person.phone,
            person.cargo,
            person.area,
          ],
          search
        )
      ) {
        return false;
      }
      if (!memberMatchesInviteFilter(person, inviteFilter, partyTipo)) return false;
      return true;
    });
    const filteredPeople = filterPeopleNotInContacts(filteredPeopleRaw, filteredContacts);

    const lines = [
      csvRow([
        "Grupo",
        "Tipo",
        "Nome",
        "E-mail",
        "Telefone",
        "Cargo",
        "Áreas",
        "Pendências",
        "NPS",
        "Festa 10 anos",
        "Critério festa",
      ]),
    ];

    for (const contact of filteredContacts) {
      const company = contact.companyId ? companiesById.get(contact.companyId) : null;
      const groupName = contact.clientGroupName ?? company?.clientGroupName ?? "Sem grupo";
      const missing = listClientMissingFieldLabels(contactToClientProfile(contact));
      lines.push(
        csvRow([
          groupName,
          "Contato",
          contact.name ?? "",
          contact.email,
          contact.phone ?? "",
          contact.cargo ?? "",
          (company?.legalAreas ?? []).join("; "),
          missing.join("; "),
          contact.npsEligible ? "Sim" : "Não",
          contact.partyInvite ? "Sim" : "Não",
          getPartyInviteTipoLabel(contact.partyInviteTipo) ?? "",
        ])
      );
    }

    for (const person of filteredPeople) {
      const groupName = person.clientGroupName ?? resolveClientGroupKey(person);
      const missing = listClientMissingFieldLabels(personToClientProfile(person));
      lines.push(
        csvRow([
          groupName,
          "Pessoa",
          person.name,
          person.email ?? "",
          person.phone ?? "",
          person.cargo ?? "",
          person.area ?? "",
          missing.join("; "),
          person.npsEligible ? "Sim" : "Não",
          person.partyInvite ? "Sim" : "Não",
          getPartyInviteTipoLabel(person.partyInviteTipo) ?? "",
        ])
      );
    }

    const body = `\uFEFF${lines.join("\r\n")}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="meus-clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao exportar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
