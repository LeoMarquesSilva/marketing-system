import { local } from "./agenda";
import { tribunalDoCnj } from "./conferencia-vios";
import { cnjComMascara, horaLocalParaIso, modalidadeDaDescricao, tipoDaDescricao } from "./pje";
import type { Audiencia, Modalidade, Situacao, TipoAudiencia } from "./tipos";

/**
 * Audiências fora da Minha Pauta, lidas no Jus.br (parte sem banco). O robô da pauta procura no Jus.br as audiências
 * "só no VIOS" (o processo não está na pauta do certificado e a consulta do processo no PJe pede captcha) e manda, por
 * processo, as audiências de hoje em diante que os movimentos mostram: dia e hora, descrição, situação, sala e órgão.
 * Sem id do tribunal, a audiência é identificada pelo processo, dia e hora ("jusbr:<cnj>:<aaaa-mm-ddThh:mm>").
 */

/** O que o robô manda em POST /api/robos/pauta/jusbr, para cada audiência. */
export interface RegistroJusbr {
  cnj: string;
  /** Horário de Brasília, sem fuso: "2026-12-10T14:05". */
  inicio: string;
  /** "inicial (rito sumaríssimo) por videoconferência". */
  descricao: string;
  situacao: Situacao;
  sala: string | null;
  orgao: string | null;
  movimentoEm: string | null;
}

export interface LinhaDoJusbr {
  chave: string;
  origem: "jusbr";
  tribunal: string | null;
  cnj: string;
  inicio: string;
  tipo: TipoAudiencia;
  tipo_descricao: string;
  rito_sumarissimo: boolean;
  modalidade_tribunal: Modalidade;
  orgao: string | null;
  sala: string | null;
  situacao: Situacao;
}

/** A linha da tabela para um registro do robô; null se o número do processo ou a data não servirem. */
export function linhaDoJusbr(r: RegistroJusbr): LinhaDoJusbr | null {
  const cnj = cnjComMascara(r.cnj);
  const inicio = horaLocalParaIso(`${r.inicio}:00`);
  if (!cnj || !inicio) return null;
  const descricao = r.descricao.replace(/\s+/g, " ").trim();
  return {
    chave: `jusbr:${cnj}:${r.inicio}`,
    origem: "jusbr",
    tribunal: tribunalDoCnj(cnj),
    cnj,
    inicio,
    tipo: tipoDaDescricao(descricao),
    tipo_descricao: descricao ? descricao[0]!.toUpperCase() + descricao.slice(1) : "Audiência",
    rito_sumarissimo: /sumar[ií]ssimo/i.test(descricao),
    modalidade_tribunal: modalidadeDaDescricao(descricao),
    orgao: r.orgao?.trim() || null,
    sala: r.sala?.trim() || null,
    situacao: r.situacao,
  };
}

/**
 * Audiências que vieram do Jus.br e que o PJe agora também mostra (mesmo processo, mesmo dia): a do PJe passa a valer
 * e herda titular, backup e o que a equipe completou; a do Jus.br sai da pauta.
 */
export function jusbrComPje(audiencias: Audiencia[]): { jusbr: Audiencia; pje: Audiencia }[] {
  const pjePorDia = new Map<string, Audiencia>();
  for (const a of audiencias) if (a.origem === "pje" && a.situacao === "designada") pjePorDia.set(`${a.cnj}|${local(a.inicio).dia}`, a);
  const pares: { jusbr: Audiencia; pje: Audiencia }[] = [];
  for (const a of audiencias) {
    if (a.origem !== "jusbr" || a.situacao !== "designada") continue;
    const pje = pjePorDia.get(`${a.cnj}|${local(a.inicio).dia}`);
    if (pje) pares.push({ jusbr: a, pje });
  }
  return pares;
}

/** O que passa da audiência do Jus.br para a do PJe que a substitui (só o que a do PJe ainda não tem). */
export function heranca(jusbr: Audiencia, pje: Audiencia): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  if (!pje.titularId && jusbr.titularId) campos.titular_id = jusbr.titularId;
  if (!pje.backupId && jusbr.backupId) campos.backup_id = jusbr.backupId;
  if (!pje.observacao && jusbr.observacao) campos.observacao = jusbr.observacao;
  if (!pje.correspondente && jusbr.correspondente) campos.correspondente = jusbr.correspondente;
  if (!pje.modalidadeEquipe && jusbr.modalidadeEquipe) campos.modalidade_equipe = jusbr.modalidadeEquipe;
  if (!pje.linkSala && jusbr.linkSala) Object.assign(campos, { link_sala: jusbr.linkSala, link_fonte: jusbr.linkFonte, link_fonte_data: jusbr.linkFonteData });
  if (!pje.substituiId) campos.substitui_id = jusbr.id;
  return campos;
}
