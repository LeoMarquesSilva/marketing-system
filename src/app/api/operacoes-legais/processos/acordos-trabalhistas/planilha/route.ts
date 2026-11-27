import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, comAcessoBruto } from "@/lib/processos/http";
import { importarPlanilhaDeNegociacao, planilhaDeNegociacao } from "@/lib/processos/negociacao-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { ids?: string[] } — planilha dos processos filtrados na tela (sem ids, todos), para o cliente preencher. */
export async function POST(request: Request) {
  return comAcessoBruto(async () => {
    const corpo = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(corpo.ids) ? corpo.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 5000) : null;
    const planilha = await planilhaDeNegociacao(ids);
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return new Response(new Uint8Array(planilha), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="acordos-trabalhistas-${dia}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

/** PUT (multipart, campo "arquivo") — a planilha devolvida pelo cliente, com o valor máximo de cada processo. */
export async function PUT(request: Request) {
  return comAcesso(async (ator) => {
    const arquivo = (await request.formData()).get("arquivo");
    if (!(arquivo instanceof File)) throw new ProcessosError("Envie a planilha no campo \"arquivo\".", 400);
    if (arquivo.size > 10 * 1024 * 1024) throw new ProcessosError("Planilha grande demais (até 10 MB).", 400);
    return importarPlanilhaDeNegociacao(new Uint8Array(await arquivo.arrayBuffer()), ator);
  });
}
