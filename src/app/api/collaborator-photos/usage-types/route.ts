import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { isCollaboratorPhotosManager } from "@/lib/access-control";
import {
  PhotoHttpError,
  createUsageType,
  listUsageTypes,
  resolveAppUser,
} from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("all") === "1";
    if (includeInactive && !isCollaboratorPhotosManager({ id: actor.id, role: actor.role, permissions: actor.permissions })) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const usageTypes = await listUsageTypes(includeInactive);
    return NextResponse.json({ usageTypes });
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao listar usos.";
    const status = message.includes("Não autenticado") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json()) as { label?: string };
    const usageType = await createUsageType(actor, body.label ?? "");
    return NextResponse.json({ usageType });
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao criar uso.";
    const status = message.includes("Não autenticado") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
