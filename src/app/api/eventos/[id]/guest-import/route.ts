import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { canAccessPath } from "@/lib/access-control";
import { getAdminClient } from "@/lib/email-marketing-server";
import { createClient } from "@/utils/supabase/server";
import { matchesGuest, type GuestImportSource } from "@/lib/event-guest-import";
import { fetchGuestCandidates, guestImportId } from "@/lib/event-guest-import-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
class ImportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const sourceSchema = z.enum(["office", "clients"]);
const inputSchema = z.object({ source: sourceSchema, keys: z.array(z.string().min(1).max(100)).min(1).max(2000) });

async function importContext(context: Context) {
  const user = await requireAuthenticatedUser();
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) throw new ImportError("Evento inválido.", 400);
  const { data: profile, error } = await getAdminClient().from("users")
    .select("id, role, permissions").eq("auth_id", user.id).maybeSingle();
  if (error) throw new Error("Falha ao verificar permissões.");
  if (!profile || !canAccessPath(profile, "/eventos")) throw new ImportError("Sem permissão para Eventos.", 403);
  const db = await createClient();
  const { data: event, error: eventError } = await db.from("events").select("id").eq("id", id).maybeSingle();
  if (eventError) throw new Error("Falha ao carregar evento.");
  if (!event) throw new ImportError("Evento não encontrado.", 404);
  return { db, id, user, profile };
}

function errorResponse(error: unknown) {
  if (error instanceof ImportError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Erro ao importar convidados.";
  const status = /não autenticado/i.test(message) ? 401 : /sem permissão|inativo/i.test(message) ? 403 : 500;
  return NextResponse.json({ error: status === 500 ? "Não foi possível carregar ou importar convidados. Tente novamente." : message }, { status });
}

export async function GET(request: Request, context: Context) {
  try {
    const { user } = await importContext(context);
    const source = sourceSchema.safeParse(new URL(request.url).searchParams.get("source"));
    if (!source.success) throw new ImportError("Origem inválida.", 400);
    return NextResponse.json({ candidates: await fetchGuestCandidates(source.data, user.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const { db, id, user, profile } = await importContext(context);
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ImportError("Selecione pelo menos uma pessoa válida.", 400);
    const { source, keys } = parsed.data;
    // Reload the authorized source; never trust names/emails submitted by the browser.
    const candidates = await fetchGuestCandidates(source as GuestImportSource, user.id);
    const wanted = new Set(keys);
    const selected = candidates.filter(candidate => wanted.has(candidate.key));
    if (selected.length !== wanted.size) throw new ImportError("A lista de origem mudou. Atualize a seleção e tente novamente.", 409);
    const { data: existing, error } = await db.from("event_invites").select("id, name, email, company, notes").eq("event_id", id);
    if (error) throw new Error("Falha ao verificar convidados existentes.");
    const pending = selected.filter(candidate => !(existing ?? []).some(guest => matchesGuest(candidate, guest)));
    let inserted = 0;
    if (pending.length) {
      const rows = pending.map(candidate => ({
        id: guestImportId(id, candidate.key), event_id: id, name: candidate.name,
        email: candidate.email?.trim() || null, phone: candidate.phone, company: candidate.company,
        guest_type: candidate.guestType, invite_status: "nao_enviado", confirmation_status: "sem_resposta",
        notes: `${source === "office" ? "Cadastro do escritório" : "Meus Clientes — Festa de 10 anos"}${candidate.detail ? ` · ${candidate.detail}` : ""}\n[event-guest-source:${candidate.key}]`,
      }));
      // Stable IDs make retries/concurrent imports of the same source non-destructive.
      const { data, error: insertError } = await db.from("event_invites")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true }).select("id");
      if (insertError) throw new Error("Falha ao importar convidados.");
      inserted = data?.length ?? 0;
      if (inserted) {
        await db.from("event_history").insert({ event_id: id, action_type: "convidado", action_label: "Convidados importados", payload: { source, count: inserted }, actor_user_id: profile.id });
      }
    }
    return NextResponse.json({ imported: inserted, skipped: selected.length - inserted });
  } catch (error) { return errorResponse(error); }
}
