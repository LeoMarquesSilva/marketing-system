import { NextResponse } from "next/server";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

/** Admin — exclui contatos e pessoas em lote. */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);

    const body = (await request.json()) as {
      contactIds?: string[];
      personIds?: string[];
    };

    const contactIds = (body.contactIds ?? []).filter(Boolean);
    const personIds = (body.personIds ?? []).filter(Boolean);

    if (contactIds.length === 0 && personIds.length === 0) {
      return NextResponse.json({ error: "Nenhum item informado." }, { status: 400 });
    }

    const admin = getAdminClient();
    let deletedContacts = 0;
    let deletedPeople = 0;

    if (contactIds.length > 0) {
      const { data, error } = await admin
        .from("email_contacts")
        .delete()
        .in("id", contactIds)
        .select("id");
      if (error) throw new Error(error.message);
      deletedContacts = data?.length ?? 0;

      const { data: usedRows } = await admin
        .from("email_contacts")
        .select("company_id")
        .not("company_id", "is", null);
      const usedCompanyIds = new Set(
        (usedRows ?? []).map((r) => r.company_id as string).filter(Boolean)
      );

      const { data: orphanCompanies } = await admin
        .from("email_companies")
        .select("id")
        .eq("source", "rd-station")
        .is("client_group_id", null);

      const orphanIds = (orphanCompanies ?? [])
        .map((c) => c.id as string)
        .filter((id) => !usedCompanyIds.has(id));

      if (orphanIds.length > 0) {
        await admin.from("email_companies").delete().in("id", orphanIds);
      }
    }

    if (personIds.length > 0) {
      const { data, error } = await admin
        .from("email_people")
        .delete()
        .in("id", personIds)
        .select("id");
      if (error) throw new Error(error.message);
      deletedPeople = data?.length ?? 0;
    }

    return NextResponse.json({
      success: true,
      deletedContacts,
      deletedPeople,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir itens.";
    const status = msg.includes("Não autenticado")
      ? 401
      : msg.includes("administradores")
        ? 403
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
