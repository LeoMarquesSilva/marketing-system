import { DURACAO_PADRAO, ROTULO_MUDANCA, ROTULO_TIPO, type AlertaAudiencia, type Audiencia, type ModalidadeEquipe, type PessoaPauta, type TipoAudiencia } from "./tipos";

/** Regras de agenda: horário de Brasília, choques, deslocamento, dias úteis e alertas de cada audiência. */

const FUSO_MS = 3 * 60 * 60 * 1000; // Brasília, sem horário de verão desde 2019.
/** Tempo mínimo entre uma audiência presencial e outra audiência da mesma pessoa. */
export const DESLOCAMENTO_MIN = 60;
/** Audiência que começa antes desta hora pede atenção (a reunião diária costuma ser depois). */
export const HORA_CEDO = 10;

export function local(iso: string): { dia: string; hora: string; minutos: number } {
  const d = new Date(new Date(iso).getTime() - FUSO_MS);
  const texto = d.toISOString();
  return { dia: texto.slice(0, 10), hora: texto.slice(11, 16), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function hojeEmBrasilia(agora = new Date()): string {
  return new Date(agora.getTime() - FUSO_MS).toISOString().slice(0, 10);
}

export function somarDias(diaIso: string, n: number): string {
  const d = new Date(`${diaIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Os próximos `n` dias úteis depois de `hoje` (a reunião de quarta antes de feriado na sexta vê quinta e segunda). */
export function proximosDiasUteis(hoje: string, n: number, ehDiaUtil: (iso: string) => boolean): string[] {
  const dias: string[] = [];
  let atual = hoje;
  for (let i = 0; dias.length < n && i < 30; i += 1) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual)) dias.push(atual);
  }
  return dias;
}

export function duracaoMin(aud: Pick<Audiencia, "tipo" | "inicio" | "fim">, duracoes: Partial<Record<TipoAudiencia, number>> = {}): number {
  const padrao = duracoes[aud.tipo] ?? DURACAO_PADRAO[aud.tipo];
  const doPje = aud.fim ? Math.round((new Date(aud.fim).getTime() - new Date(aud.inicio).getTime()) / 60000) : 0;
  return Math.max(padrao, doPje);
}

export function intervalo(aud: Pick<Audiencia, "tipo" | "inicio" | "fim">, duracoes?: Partial<Record<TipoAudiencia, number>>): [number, number] {
  const ini = new Date(aud.inicio).getTime();
  return [ini, ini + duracaoMin(aud, duracoes) * 60000];
}

/** Como a equipe vai: a escolha dela na híbrida; senão, o que o tribunal marcou. */
export function modalidadeEfetiva(aud: Pick<Audiencia, "modalidadeTribunal" | "modalidadeEquipe">): ModalidadeEquipe | null {
  if (aud.modalidadeEquipe) return aud.modalidadeEquipe;
  if (aud.modalidadeTribunal === "presencial" || aud.modalidadeTribunal === "video") return aud.modalidadeTribunal;
  return null;
}

/** "CON1 - Campinas", "CEJUSC ARARAQUARA - JT ...", "1ª Vara do Trabalho de Jundiaí" → "campinas", "araraquara", "jundiai". */
export function cidadeDoOrgao(orgao: string | null | undefined): string | null {
  const t = (orgao ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!t) return null;
  const traco = t.match(/^(?:con\d*|cejusc)\s*-?\s*([a-z ]+?)(?:\s+-\s+|$)/);
  if (traco?.[1]) return traco[1].trim();
  const cejusc = t.match(/^cejusc\s+([a-z ]+?)\s+-/);
  if (cejusc?.[1]) return cejusc[1].trim();
  const de = t.match(/\bde\s+([a-z ]+)$/);
  if (de?.[1]) return de[1].trim();
  return t;
}

function ativas(todas: Audiencia[]): Audiencia[] {
  return todas.filter((a) => a.situacao === "designada");
}

function sobrepoe(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function rotulo(aud: Audiencia): string {
  const { hora } = local(aud.inicio);
  const cidade = cidadeDoOrgao(aud.orgao);
  return `${ROTULO_TIPO[aud.tipo]} das ${hora}${cidade ? ` (${cidade.replace(/\b\w/g, (c) => c.toUpperCase())})` : ""}`;
}

/** As outras audiências em que a pessoa é titular no mesmo dia. */
export function compromissosDoDia(pessoaId: string, dia: string, todas: Audiencia[], exceto?: string): Audiencia[] {
  return ativas(todas).filter((a) => a.id !== exceto && a.titularId === pessoaId && local(a.inicio).dia === dia);
}

/** Choque ou deslocamento apertado entre `aud` e as audiências em que a pessoa já é titular. */
export function conflitoDaPessoa(
  pessoaId: string,
  aud: Audiencia,
  todas: Audiencia[],
  duracoes?: Partial<Record<TipoAudiencia, number>>
): { tipo: "choque" | "deslocamento"; com: Audiencia } | null {
  const [ini, fim] = intervalo(aud, duracoes);
  const minha = modalidadeEfetiva(aud);
  let deslocamento: { tipo: "deslocamento"; com: Audiencia } | null = null;
  for (const outra of compromissosDoDia(pessoaId, local(aud.inicio).dia, todas, aud.id)) {
    const faixa = intervalo(outra, duracoes);
    if (sobrepoe([ini, fim], faixa)) return { tipo: "choque", com: outra };
    const dela = modalidadeEfetiva(outra);
    if (minha !== "presencial" && dela !== "presencial") continue;
    const folga = Math.min(Math.abs(ini - faixa[1]), Math.abs(faixa[0] - fim)) / 60000;
    const mesmaCidade = minha === "presencial" && dela === "presencial" && cidadeDoOrgao(aud.orgao) === cidadeDoOrgao(outra.orgao);
    if (folga < DESLOCAMENTO_MIN && !mesmaCidade) deslocamento ??= { tipo: "deslocamento", com: outra };
  }
  return deslocamento;
}

export interface Contexto {
  pessoas: Map<string, PessoaPauta>;
  todas: Audiencia[];
  duracoes?: Partial<Record<TipoAudiencia, number>>;
}

function nome(ctx: Contexto, id: string | null): string {
  return (id && ctx.pessoas.get(id)?.nomeCurto) || "—";
}

/** Tudo o que pede atenção numa audiência. `grave` vai para o vermelho da distribuição. */
export function alertasDaAudiencia(aud: Audiencia, ctx: Contexto): AlertaAudiencia[] {
  const alertas: AlertaAudiencia[] = [];
  const conferida = Boolean(aud.mudancaConferidaEm);
  if (aud.situacao === "cancelada") {
    if (!conferida) alertas.push({ tipo: "cancelada", grave: true, texto: "Cancelada no PJe: conferir se já saiu do VIOS." });
    return alertas;
  }
  if (aud.situacao !== "designada") return alertas;
  if (!aud.titularId) alertas.push({ tipo: "sem_titular", grave: true, texto: "Sem titular." });
  else {
    const conflito = conflitoDaPessoa(aud.titularId, aud, ctx.todas, ctx.duracoes);
    if (conflito?.tipo === "choque") alertas.push({ tipo: "choque", grave: true, texto: `${nome(ctx, aud.titularId)} está na ${rotulo(conflito.com)} no mesmo horário.` });
    if (conflito?.tipo === "deslocamento")
      alertas.push({ tipo: "deslocamento", grave: true, texto: `${nome(ctx, aud.titularId)} tem a ${rotulo(conflito.com)}: sem tempo de deslocamento.` });
  }
  if (aud.backupId) {
    const ocupado = ativas(ctx.todas).find((o) => o.id !== aud.id && o.titularId === aud.backupId && sobrepoe(intervalo(o, ctx.duracoes), intervalo(aud, ctx.duracoes)));
    if (ocupado) alertas.push({ tipo: "backup_ocupado", grave: false, texto: `A backup ${nome(ctx, aud.backupId)} está na ${rotulo(ocupado)}.` });
  }
  if (aud.mudancas.length && !conferida) {
    alertas.push({ tipo: "mudou", grave: true, texto: `${aud.mudancas.map((m) => ROTULO_MUDANCA[m]).join(", ")} no PJe: conferir no VIOS.` });
  }
  if (aud.viosInicio && Math.abs(new Date(aud.viosInicio).getTime() - new Date(aud.inicio).getTime()) >= 60000 && !conferida) {
    const v = local(aud.viosInicio);
    alertas.push({ tipo: "vios_diverge", grave: true, texto: `No VIOS está ${v.dia.slice(8, 10)}/${v.dia.slice(5, 7)} às ${v.hora}.` });
  }
  if (local(aud.inicio).minutos < HORA_CEDO * 60) alertas.push({ tipo: "cedo", grave: false, texto: `Antes das ${HORA_CEDO}h.` });
  if (aud.modalidadeTribunal === "video" && !aud.linkSala) alertas.push({ tipo: "sem_link", grave: false, texto: "Por vídeo e ainda sem link da sala." });
  if (aud.modalidadeTribunal === "hibrida" && !aud.modalidadeEquipe) alertas.push({ tipo: "a_completar", grave: false, texto: "Híbrida: dizer se a equipe vai presencial ou por vídeo." });
  if (!aud.modalidadeTribunal) alertas.push({ tipo: "a_completar", grave: false, texto: "Modalidade a completar." });
  return alertas;
}

export interface OpcaoDeTroca {
  pessoa: PessoaPauta;
  estado: "livre" | "atencao" | "choque" | "atual";
  texto: string;
}

/** Quem pode assumir o papel na audiência, do mais livre para o mais ocupado. */
export function opcoesDeTroca(aud: Audiencia, papel: "titular" | "backup", ctx: Contexto): OpcaoDeTroca[] {
  const atual = papel === "titular" ? aud.titularId : aud.backupId;
  const outro = papel === "titular" ? aud.backupId : aud.titularId;
  const opcoes: OpcaoDeTroca[] = [];
  for (const pessoa of ctx.pessoas.values()) {
    if (!pessoa.ativo || !pessoa.fazAudiencia) continue;
    if (pessoa.id === atual) {
      opcoes.push({ pessoa, estado: "atual", texto: papel === "titular" ? "Titular atual" : "Backup atual" });
      continue;
    }
    if (pessoa.id === outro) {
      opcoes.push({ pessoa, estado: "atencao", texto: papel === "titular" ? "É a backup desta audiência; a backup ficaria vazia" : "É a titular desta audiência" });
      continue;
    }
    const conflito = conflitoDaPessoa(pessoa.id, aud, ctx.todas, ctx.duracoes);
    if (conflito?.tipo === "choque") opcoes.push({ pessoa, estado: "choque", texto: `Choque · ${rotulo(conflito.com)}` });
    else if (conflito) opcoes.push({ pessoa, estado: "atencao", texto: `Deslocamento · ${rotulo(conflito.com)}` });
    else {
      const dia = compromissosDoDia(pessoa.id, local(aud.inicio).dia, ctx.todas, aud.id);
      opcoes.push({ pessoa, estado: "livre", texto: dia.length ? `Livre no horário · ${dia.length} outra(s) no dia` : "Livre no dia" });
    }
  }
  const peso = { atual: 0, livre: 1, atencao: 2, choque: 3 } as const;
  return opcoes.sort((a, b) => peso[a.estado] - peso[b.estado] || a.pessoa.nomeCurto.localeCompare(b.pessoa.nomeCurto, "pt-BR"));
}
