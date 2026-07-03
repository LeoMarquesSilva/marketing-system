import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchMeusClientesPayload } from "@/lib/meus-clientes-server";
import {
  contactToEnrichable,
  listClientMissingFieldLabels,
  personToEnrichable,
} from "@/lib/email-marketing-enrichment";
import { resolveClientGroupKey, resolveContactGroupKey } from "@/lib/meus-clientes";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvRow(cols: string[]): string {
  return cols.map(csvEscape).join(",");
}

/** Exporta CSV do escopo visível (mesmos filtros de escopo da listagem). */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const viewAll = url.searchParams.get("viewAll") === "1";
    const filterGestorId = url.searchParams.get("gestorId") || null;

    const { companies, contacts, people } = await fetchMeusClientesPayload({
      authUserId: user.id,
      viewAll,
      filterGestorId,
    });

    const companiesById = new Map(companies.map((c) => [c.id, c]));
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
      ]),
    ];

    for (const contact of contacts) {
      const groupKey = resolveContactGroupKey(contact, companiesById);
      const company = contact.companyId ? companiesById.get(contact.companyId) : null;
      const groupName = contact.clientGroupName ?? company?.clientGroupName ?? groupKey;
      const missing = listClientMissingFieldLabels(contactToEnrichable(contact));
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
        ])
      );
    }

    const contactEmails = new Set(contacts.map((c) => c.email.toLowerCase()));
    for (const person of people) {
      if (person.email && contactEmails.has(person.email.toLowerCase())) continue;
      const groupName = person.clientGroupName ?? resolveClientGroupKey(person);
      const missing = listClientMissingFieldLabels(personToEnrichable(person));
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
