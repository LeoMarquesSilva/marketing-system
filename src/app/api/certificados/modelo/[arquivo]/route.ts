import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { canAccessPath } from "@/lib/access-control";
import { getAdminClient } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

// Fundo, assinaturas dos sócios e fontes do modelo ficam fora de /public:
// as assinaturas e a Gotham (licenciada) só saem para quem gera certificados.
const ASSETS_DIR = path.join(process.cwd(), "src/lib/certificados/assets");

const FILES: Record<string, { candidates: string[]; type: string }> = {
  fundo: { candidates: ["educacao-continuada/fundo.pdf"], type: "application/pdf" },
  "assinatura-ricardo": { candidates: ["educacao-continuada/assinatura-ricardo.pdf"], type: "application/pdf" },
  "assinatura-gustavo": { candidates: ["educacao-continuada/assinatura-gustavo.pdf"], type: "application/pdf" },
  // Gotham é a fonte do modelo; enquanto os arquivos não estiverem aqui, usa a Montserrat.
  "fonte-regular": { candidates: ["fonts/Gotham-Book.otf", "fonts/Montserrat-Regular.ttf"], type: "font/sfnt" },
  "fonte-medium": { candidates: ["fonts/Gotham-Medium.otf", "fonts/Montserrat-Medium.ttf"], type: "font/sfnt" },
  "fonte-bold": { candidates: ["fonts/Gotham-Bold.otf", "fonts/Montserrat-Bold.ttf"], type: "font/sfnt" },
};

async function firstExisting(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const fullPath = path.join(ASSETS_DIR, candidate);
    try {
      await access(fullPath);
      return fullPath;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { data: profile, error } = await getAdminClient()
      .from("users")
      .select("id, role, permissions")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (error) throw new Error("Falha ao verificar permissões.");
    if (!profile || !canAccessPath(profile, "/certificados")) {
      return NextResponse.json({ error: "Sem permissão para Certificados." }, { status: 403 });
    }

    const { arquivo } = await params;
    const file = FILES[arquivo];
    const fullPath = file ? await firstExisting(file.candidates) : null;
    if (!file || !fullPath) return NextResponse.json({ error: "Arquivo do modelo não encontrado." }, { status: 404 });

    const bytes = await readFile(fullPath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = /não autenticado/i.test(message) ? 401 : /inativo/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Não foi possível carregar o modelo." : message }, { status });
  }
}
