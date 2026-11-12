import { NextResponse } from "next/server";
import { diasDoPeriodo } from "@/lib/vistagem/djen-kurier";
import { conferenciaDjenKurier, detalheDaConferencia, sincronizarDjen } from "@/lib/vistagem/djen-kurier-server";
import { VistagemError } from "@/lib/vistagem/errors";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { hojeEmSaoPaulo } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** O período pedido: um número de dias ou "tudo" (todo o estudo, o padrão). */
const periodoPedido = (valor: unknown): number | "tudo" => (valor === undefined || valor === null || valor === "tudo" ? "tudo" : Number(valor));

/**
 * Conferência DJEN × Kurier dos últimos `dias` dias, ou de todo o estudo (`dias=tudo`, o padrão). Com `dia=AAAA-MM-DD`,
 * o detalhe do dia: o que está nos dois, só na Kurier e só no DJEN. Só leitura.
 */
export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    const parametros = new URL(request.url).searchParams;
    const dia = parametros.get("dia");
    if (dia) return NextResponse.json(await detalheDaConferencia(dia));
    return NextResponse.json(await conferenciaDjenKurier(periodoPedido(parametros.get("dias"))));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível montar a conferência DJEN × Kurier.");
  }
}

/** "Buscar agora": busca no DJEN os últimos `buscar` dias (padrão 2: ontem e hoje; até 31) e devolve a conferência. */
export async function POST(request: Request) {
  try {
    await exigirAcessoVistagem();
    const corpo = (await request.json().catch(() => ({}))) as { buscar?: unknown; dias?: unknown };
    const buscar = Number(corpo.buscar ?? 2);
    if (!Number.isInteger(buscar) || buscar < 1 || buscar > 31) throw new VistagemError("Busque de 1 a 31 dias.", 400);
    const busca = await sincronizarDjen("manual", diasDoPeriodo(hojeEmSaoPaulo(), buscar).reverse());
    const conferencia = await conferenciaDjenKurier(periodoPedido(corpo.dias));
    return NextResponse.json({ busca, ...conferencia });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível buscar no DJEN.");
  }
}
