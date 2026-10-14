import { chaveDecisao, indicesDePrincipal, normalizarTexto } from "./duplicidade";
import { lerComunicacaoDjen } from "./djen";
import { normalizarProcesso } from "./processo";
import { normalizarTribunal } from "./tribunal";
import type { KurierLinha, PublicacaoCapturada } from "./types";

export const MOTIVO_INDICE = "Índice de advogados do diário, não é publicação.";

/** Linhas "ÍNDICE POR ADVOGADOS" de alguns diários (ex.: DJMG) listam OABs, não publicações. */
export function ehIndiceDeAdvogados(teor: string): boolean {
  return /^ÍNDICE POR ADVOGADOS/i.test(teor.trim());
}

/**
 * Transforma as linhas do xlsx em publicações: normaliza processo e tribunal,
 * lê o cabeçalho do DJEN, descarta índices e aponta duplicidades (mesmo
 * despacho enviado uma vez por parte intimada) para a primeira ocorrência.
 */
export function montarPublicacoes(linhas: KurierLinha[]): PublicacaoCapturada[] {
  const base = linhas.map((linha) => {
    const indice = ehIndiceDeAdvogados(linha.teor);
    const processo = normalizarProcesso(linha.numeroProcesso, linha.teor);
    const djen = indice ? null : lerComunicacaoDjen(linha.teor);
    const grupo = `${processo.digitos}|${normalizarTexto(djen?.orgao ?? "")}|${djen?.dataDisponibilizacao ?? linha.dataDivulgacao}`;
    return { linha, indice, processo, djen, grupo };
  });

  // Cada cópia do DJEN pode listar só a própria parte; os nomes de todas as
  // cópias do mesmo processo/órgão/data são ocultados antes da comparação.
  const nomesPorGrupo = new Map<string, string[]>();
  for (const item of base) {
    if (!item.djen) continue;
    const nomes = nomesPorGrupo.get(item.grupo) ?? [];
    nomes.push(...item.djen.partes.map((parte) => parte.nome), ...item.djen.intimados);
    nomesPorGrupo.set(item.grupo, nomes);
  }

  const chaves = base.map((item) =>
    item.indice
      ? null
      : chaveDecisao({
          cnjDigitos: item.processo.digitos,
          dataDivulgacao: item.linha.dataDivulgacao,
          teor: item.linha.teor,
          djen: item.djen,
          nomesDasPartes: nomesPorGrupo.get(item.grupo) ?? [],
        })
  );
  const principais = indicesDePrincipal(chaves);

  return base.map((item, posicao): PublicacaoCapturada => {
    const principal = principais[posicao];
    const status = item.indice ? "descartada" : principal >= 0 ? "duplicidade" : "captada";
    return {
      linha: item.linha.linha,
      dataDivulgacao: item.linha.dataDivulgacao,
      dataPublicacao: item.linha.dataPublicacao,
      numeroProcessoOriginal: item.linha.numeroProcesso,
      processo: item.processo,
      estado: item.linha.estado,
      diario: item.linha.diario,
      tribunal: normalizarTribunal(item.linha.diario),
      nomeLocalizado: item.linha.nomeLocalizado,
      caderno: item.linha.caderno,
      comarca: item.linha.comarca,
      titulo: item.linha.titulo,
      teor: item.linha.teor,
      djen: item.djen,
      chaveDecisao: chaves[posicao],
      status,
      motivoDescarte: item.indice ? MOTIVO_INDICE : null,
      duplicidadeDeLinha: principal >= 0 ? base[principal].linha.linha : null,
    };
  });
}
