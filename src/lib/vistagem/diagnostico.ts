import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import { verificarSama } from "./sama";
import { listarArquivosKurierSharePoint } from "./sharepoint";

export interface Integracao {
  nome: string;
  ok: boolean;
  detalhe: string;
}

/** Testa as conexões usadas pela vistagem (SharePoint, SIOE e SAMA) sem gravar nada. */
export async function verificarIntegracoes(): Promise<Integracao[]> {
  const sharepoint = listarArquivosKurierSharePoint()
    .then(({ arquivos }) => ({ nome: "SharePoint (Kurier)", ok: true, detalhe: `${arquivos.length} arquivos na pasta` }))
    .catch((erro: unknown) => ({ nome: "SharePoint (Kurier)", ok: false, detalhe: erro instanceof Error ? erro.message : String(erro) }));
  const sioe = (async () => {
    try {
      const { count, error } = await getSioeClient().from("processos_completo").select("id", { count: "exact", head: true });
      if (error) return { nome: "SIOE (processos)", ok: false, detalhe: error.message };
      return { nome: "SIOE (processos)", ok: true, detalhe: `${count ?? 0} processos` };
    } catch (erro) {
      return { nome: "SIOE (processos)", ok: false, detalhe: erro instanceof Error ? erro.message : String(erro) };
    }
  })();
  const sama = verificarSama().then((resultado) => ({ nome: "SAMA (robô de agendamento)", ...resultado }));
  return Promise.all([sharepoint, sioe, sama]);
}
