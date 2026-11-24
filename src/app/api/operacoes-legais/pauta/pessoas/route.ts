import { comAcesso, comAdmin, lerJson } from "@/lib/audiencias/http";
import { salvarPessoa } from "@/lib/audiencias/pessoas-server";
import { semearEquipe } from "@/lib/audiencias/pastas-server";
import { carregarPessoasComFotos } from "@/lib/audiencias/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return comAcesso(async () => ({ pessoas: await carregarPessoasComFotos() }));
}

/** Traz a equipe trabalhista do cadastro do VIOS (só quem ainda não está na pauta). */
export async function POST() {
  return comAdmin(async () => semearEquipe());
}

/** Corpo: { id, whatsapp?, email?, fazAudiencia?, coordenacao?, ativo?, nomeCurto? }. */
export async function PATCH(request: Request) {
  return comAdmin(async () => ({ pessoa: await salvarPessoa(await lerJson(request)) }));
}
