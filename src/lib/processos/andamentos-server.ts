import "server-only";

import type { Andamento, LinhaDoTempo } from "./andamentos";
import { ProcessosError } from "./errors";
import { db, falhou } from "./server";

/**
 * Linha do tempo do processo: os andamentos guardados (movimentos do DataJud; depois prazos e providências) e o
 * último andamento manual do VIOS, que fica no cadastro do processo.
 */
export async function linhaDoTempo(processoId: string): Promise<LinhaDoTempo> {
  if (!/^[0-9a-f-]{36}$/i.test(processoId)) throw new ProcessosError("Processo não encontrado.", 404);
  const [processo, guardados] = await Promise.all([
    db().from("proc_processos").select("ultimo_andamento_texto, ultimo_andamento_data, datajud_consultado_em, datajud_erro").eq("id", processoId).maybeSingle(),
    db().from("proc_andamentos").select("id, quando, fonte, titulo, detalhe, grau").eq("processo_id", processoId).order("quando", { ascending: false }).limit(2000),
  ]);
  if (processo.error) falhou("carregar o processo", processo.error);
  if (!processo.data) throw new ProcessosError("Processo não encontrado.", 404);
  // Tabela ainda não criada (migration pendente): a ficha abre com o que houver.
  if (guardados.error && !/proc_andamentos/.test(guardados.error.message)) falhou("carregar a linha do tempo", guardados.error);
  const andamentos: Andamento[] = ((guardados.data ?? []) as Andamento[]).map((item) => ({ ...item }));
  const texto = processo.data.ultimo_andamento_texto as string | null;
  const data = processo.data.ultimo_andamento_data as string | null;
  if (texto && data) {
    const quando = new Date(`${data}T12:00:00-03:00`).toISOString();
    // O DataJud pode já ter o mesmo movimento no mesmo dia: não repete.
    const repetido = andamentos.some((item) => item.quando.slice(0, 10) === data && item.titulo.toLowerCase() === texto.split(" - ")[0].trim().toLowerCase());
    if (!repetido) andamentos.push({ id: "vios-ultimo", quando, fonte: "vios", titulo: texto, detalhe: null, grau: null });
  }
  andamentos.sort((a, b) => b.quando.localeCompare(a.quando));
  return {
    andamentos,
    consultadoEm: (processo.data.datajud_consultado_em as string | null) ?? null,
    erroDataJud: (processo.data.datajud_erro as string | null) ?? null,
  };
}
