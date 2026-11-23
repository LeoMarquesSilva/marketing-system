import { comAcesso, comAdmin, lerJson } from "@/lib/audiencias/http";
import { lerConfig, modoOutlook, modoWhatsapp, salvarConfig } from "@/lib/audiencias/config-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return comAcesso(async () => ({ config: await lerConfig(), modos: { outlook: modoOutlook(), whatsapp: modoWhatsapp() } }));
}

export async function PUT(request: Request) {
  return comAdmin(async (ator) => ({ config: await salvarConfig(await lerJson(request), ator.nome) }));
}
