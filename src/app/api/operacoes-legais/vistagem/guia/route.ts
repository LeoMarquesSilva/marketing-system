import { NextResponse } from "next/server";
import { ehModuloGuia, guiasVistos } from "@/lib/vistagem/guia";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { admin } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

/** Coluna ainda não criada (migração 20261105210000): o guia segue só com o que o navegador guardou. */
function semColuna(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42703" || /vistagem_guias/.test(error.message ?? "")));
}

/** Abas da Vistagem cujo guia a pessoa já viu. */
export async function GET() {
  try {
    const perfil = await exigirPerfilVistagem();
    const { data, error } = await admin().from("users").select("vistagem_guias").eq("auth_id", perfil.authUserId).maybeSingle();
    if (semColuna(error)) return NextResponse.json({ vistos: {}, gravado: false }, { headers: { "Cache-Control": "no-store" } });
    if (error) throw new Error(error.message);
    return NextResponse.json({ vistos: guiasVistos(data?.vistagem_guias), gravado: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível ler os guias da Vistagem.");
  }
}

/** Marca o guia de uma aba como visto (até o fim ou pulando): não abre sozinho de novo. */
export async function POST(request: Request) {
  try {
    const perfil = await exigirPerfilVistagem();
    const corpo = (await request.json().catch(() => null)) as { modulo?: unknown } | null;
    if (!ehModuloGuia(corpo?.modulo)) return NextResponse.json({ error: "Aba da Vistagem inválida." }, { status: 400 });
    const db = admin();
    const { data, error } = await db.from("users").select("vistagem_guias").eq("auth_id", perfil.authUserId).maybeSingle();
    if (semColuna(error)) return NextResponse.json({ gravado: false });
    if (error) throw new Error(error.message);
    const vistos = { ...guiasVistos(data?.vistagem_guias), [corpo.modulo]: new Date().toISOString() };
    const { error: erroGravar } = await db.from("users").update({ vistagem_guias: vistos }).eq("auth_id", perfil.authUserId);
    if (semColuna(erroGravar)) return NextResponse.json({ gravado: false });
    if (erroGravar) throw new Error(erroGravar.message);
    return NextResponse.json({ gravado: true, vistos });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível gravar o guia da Vistagem.");
  }
}
