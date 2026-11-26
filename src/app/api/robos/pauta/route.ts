import { after, NextResponse } from "next/server";
import { conferirComViosSeDevido } from "@/lib/audiencias/conferencia-server";
import { exigirRobo, respostaDeErro } from "@/lib/audiencias/http";
import { registrarLeituraPje } from "@/lib/audiencias/leitura-server";
import { reagirAMudanca } from "@/lib/audiencias/rotina-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * O robô da pauta (robos/autos, comando `pauta`) manda aqui o que leu na Minha Pauta do PJe:
 * { tribunal: "TRT15", origem: "robô do Mac", registros: [...] } com Authorization: Bearer ROBO_AUTOS_TOKEN.
 * Depois de responder ao robô, confere a pauta com o VIOS (a rotina diária não pega as leituras das 11h45 e 16h45) e
 * reage "na hora": acerta os convites do Outlook (só sai o que mudou), lê as respostas e manda os alertas novos.
 * O robô lê vários tribunais seguidos (uma chamada por tribunal): leitura sem nada novo só confere com o VIOS uma vez
 * por rodada e não refaz os convites (ver conferirComViosSeDevido).
 */
export async function POST(request: Request) {
  try {
    exigirRobo(request);
    const resumo = await registrarLeituraPje(await request.json());
    const novidade = resumo.novas + resumo.alteradas + resumo.canceladas > 0;
    after(async () => {
      let conferiu = false;
      try {
        conferiu = (await conferirComViosSeDevido(new Date(), { semNovidade: !novidade })) !== "em dia";
      } catch (erro) {
        console.error("[pauta] conferência com o VIOS após a leitura:", erro instanceof Error ? erro.message : erro);
      }
      await reagirAMudanca(novidade || conferiu ? { respostas: true } : { convites: false, respostas: true, alertas: "se recusou" });
    });
    return NextResponse.json(resumo);
  } catch (error) {
    return respostaDeErro(error);
  }
}
