import { after, NextResponse } from "next/server";
import { conferirComViosSeDevido } from "@/lib/audiencias/conferencia-server";
import { sincronizarConvitesDe } from "@/lib/audiencias/convites-server";
import { exigirRobo, respostaDeErro } from "@/lib/audiencias/http";
import { registrarLeituraPje } from "@/lib/audiencias/leitura-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * O robô da pauta (robos/autos, comando `pauta`) manda aqui o que leu na Minha Pauta do PJe:
 * { tribunal: "TRT15", origem: "robô do Mac", registros: [...] } com Authorization: Bearer ROBO_AUTOS_TOKEN.
 * Depois de responder ao robô, confere a pauta com o VIOS (a rotina diária não pega as leituras das 11h45 e 16h45) e
 * acerta os convites do Outlook (audiência nova, horário ou link mudado, cancelada): só sai o que mudou.
 */
export async function POST(request: Request) {
  try {
    exigirRobo(request);
    const resumo = await registrarLeituraPje(await request.json());
    after(async () => {
      try {
        await conferirComViosSeDevido();
      } catch (erro) {
        console.error("[pauta] conferência com o VIOS após a leitura:", erro instanceof Error ? erro.message : erro);
      }
      await sincronizarConvitesDe();
    });
    return NextResponse.json(resumo);
  } catch (error) {
    return respostaDeErro(error);
  }
}
