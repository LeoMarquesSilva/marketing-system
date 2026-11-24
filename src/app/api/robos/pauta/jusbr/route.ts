import { after, NextResponse } from "next/server";
import { conferirComVios, ORIGEM_AUTOMATICA } from "@/lib/audiencias/conferencia-server";
import { sincronizarConvitesDe } from "@/lib/audiencias/convites-server";
import { exigirRobo, respostaDeErro } from "@/lib/audiencias/http";
import { registrarLeituraJusbr } from "@/lib/audiencias/jusbr-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * O robô da pauta manda aqui as audiências que leu no Jus.br para processos fora da Minha Pauta (as "só no VIOS" e as
 * que já vieram de lá): { origem, consultados: [CNJ], audiencias: [{ cnj, inicio, descricao, situacao, sala, orgao,
 * movimentoEm }] }, com Authorization: Bearer ROBO_AUTOS_TOKEN. Se algo entrou ou mudou, confere com o VIOS em
 * seguida, depois de responder ao robô.
 */
export async function POST(request: Request) {
  try {
    exigirRobo(request);
    const resumo = await registrarLeituraJusbr(await request.json());
    if (resumo.novas || resumo.atualizadas) {
      after(async () => {
        try {
          await conferirComVios(ORIGEM_AUTOMATICA);
        } catch (erro) {
          console.error("[pauta] conferência com o VIOS após o Jus.br:", erro instanceof Error ? erro.message : erro);
        }
        await sincronizarConvitesDe();
      });
    }
    return NextResponse.json(resumo);
  } catch (error) {
    return respostaDeErro(error);
  }
}
