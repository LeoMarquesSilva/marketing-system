import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/users-server";
import { canSeeContentRoteiro } from "@/lib/content-areas";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import {
  buildEscolhaItems,
  collectPersonRefs,
  type EscolhaSourceRow,
  type EscolhaUserRow,
} from "@/lib/content-escolhas";

export const dynamic = "force-dynamic";

const ESCOLHA_COLUMNS =
  "id, title, link, area, status, image_url, source, created_at, published_at, approved_by_id, approved_by_name, approved_at, created_by_id, created_by_name, edited_by_id, edited_by_name, edited_at, has_alterations, reviewer_approved_at, sent_to_mkt_at, sent_to_mkt_by_name, rejected_by_id, rejected_by_name, rejected_at";

/**
 * Escolhas da equipe: toda matéria que alguém escolheu, descartou ou trouxe por
 * link, sem o corte de 60 dias da lista de Posts. Recortado pelas áreas que a
 * pessoa enxerga (Marketing/admin veem todas).
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth?.profile) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const db = await getServerDb();
    const { data, error } = await db
      .from("content_roteiros")
      .select(ESCOLHA_COLUMNS)
      .or("approved_by_id.not.is.null,rejected_by_id.not.is.null,created_by_id.not.is.null,status.eq.rejeitado")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error("Não foi possível consultar as escolhas.");

    const profile = auth.profile;
    const rows = ((data ?? []) as EscolhaSourceRow[]).filter((row) =>
      canSeeContentRoteiro(profile, { area: row.area, createdById: row.created_by_id ?? null }),
    );

    const { ids, names } = collectPersonRefs(rows);
    const [byId, byName] = await Promise.all([
      ids.length
        ? db.from("users").select("id, name, avatar_url, department").in("id", ids)
        : Promise.resolve({ data: [], error: null }),
      names.length
        ? db.from("users").select("id, name, avatar_url, department").in("name", names)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const users = [...((byId.data ?? []) as EscolhaUserRow[]), ...((byName.data ?? []) as EscolhaUserRow[])];

    return NextResponse.json({ items: buildEscolhaItems(rows, users) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar as escolhas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
