import { montarPlanilhaDeProcessos } from "@/lib/processos/export-excel";
import { comAcessoBruto } from "@/lib/processos/http";
import { carregarParaPlanilha } from "@/lib/processos/processos-server";

export const dynamic = "force-dynamic";

/** POST { ids?: string[] } — planilha dos processos filtrados na tela (sem ids, todos). */
export async function POST(request: Request) {
  return comAcessoBruto(async () => {
    const corpo = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(corpo.ids) ? corpo.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 5000) : null;
    const planilha = montarPlanilhaDeProcessos(await carregarParaPlanilha(ids));
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return new Response(new Uint8Array(planilha), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="processos-${dia}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
