import { comAcesso, comAcessoBruto } from "@/lib/processos/http";
import { montarPlanilhaDaCarteira } from "@/lib/processos/rec-credito-excel";
import { carregarCarteira } from "@/lib/processos/rec-credito-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Carteira de Recuperação de Crédito: uma linha por processo, com o cálculo do TJSP. */
export async function GET() {
  return comAcesso(async () => carregarCarteira());
}

/** POST { ids?: string[] } — planilha da carteira filtrada na tela (sem ids, toda). */
export async function POST(request: Request) {
  return comAcessoBruto(async () => {
    const corpo = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(corpo.ids) ? corpo.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 5000) : null;
    const { linhas, indicesAte } = await carregarCarteira(ids);
    const planilha = montarPlanilhaDaCarteira(linhas, indicesAte);
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return new Response(new Uint8Array(planilha), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="carteira-rec-credito-${dia}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
