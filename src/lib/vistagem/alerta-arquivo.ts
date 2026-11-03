import { criarCalendario } from "./dias-uteis";

/** A partir desta hora (Brasília) o arquivo do dia já devia estar no Orquestra: a 1ª busca roda entre 7h e 8h. */
export const HORA_ARQUIVO_ESPERADO = 8;

export interface ArquivoDoDia {
  /** AAAA-MM-DD em Brasília. */
  hoje: string;
  diaUtil: boolean;
  /** Arquivo de hoje importado sem erro. */
  chegou: boolean;
  /** Arquivo de hoje que chegou, mas falhou na importação. */
  erro: string | null;
  /** Dia útil, depois das 8h, e o arquivo não chegou (ou falhou). */
  atrasado: boolean;
}

/** Situação do arquivo de hoje a partir dos arquivos importados com a data de hoje. */
export function situacaoDoDia(entrada: {
  hoje: string;
  hora: number;
  feriados: Iterable<string>;
  arquivosDeHoje: { status: string; erro: string | null }[];
}): ArquivoDoDia {
  const diaUtil = criarCalendario(entrada.feriados)(entrada.hoje);
  const chegou = entrada.arquivosDeHoje.some((arquivo) => arquivo.status === "processado");
  const falha = chegou ? null : entrada.arquivosDeHoje.find((arquivo) => arquivo.status === "erro");
  return {
    hoje: entrada.hoje,
    diaUtil,
    chegou,
    erro: falha ? falha.erro ?? "erro na importação" : null,
    atrasado: diaUtil && !chegou && entrada.hora >= HORA_ARQUIVO_ESPERADO,
  };
}

/** Mensagem de WhatsApp para a controladoria quando o arquivo do dia não chegou. */
export function mensagemArquivoAtrasado(situacao: ArquivoDoDia): string {
  const [ano, mes, dia] = situacao.hoje.split("-");
  const data = `${dia}/${mes}/${ano}`;
  return situacao.erro
    ? `⚠️ Vistagem: o arquivo da Kurier de ${data} chegou, mas a importação falhou (${situacao.erro}). Confira na aba Captura do Orquestra e reenvie o arquivo.`
    : `⚠️ Vistagem: o arquivo da Kurier de ${data} ainda não chegou ao Orquestra (nem na 2ª tentativa, entre 9h e 10h). Confira o e-mail da Kurier e o Power Automate; dá para enviar o .xlsx pela aba Captura.`;
}
