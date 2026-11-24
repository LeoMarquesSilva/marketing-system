import { DURACAO_PADRAO, ROTULO_MUDANCA, ROTULO_TIPO, type AlertaAudiencia, type Audiencia, type ConvitePauta, type ModalidadeEquipe, type Papel, type PessoaPauta, type RespostaConvite, type TipoAudiencia } from "./tipos";

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

/* ------------------------------------------------------------------ conferência com o VIOS */

/** Mesmo horário no PJe e no VIOS. Tarefa do VIOS à meia-noite é tarefa sem horário: aí basta o mesmo dia. */
export function mesmoHorario(pje: string, vios: string): boolean {
  const v = local(vios);
  if (v.hora === "00:00") return local(pje).dia === v.dia;
  return Math.abs(new Date(pje).getTime() - new Date(vios).getTime()) < 60_000;
}

/**
 * Como a audiência está no VIOS, pela última conferência:
 * - confere: tarefa aberta no mesmo horário (ou, cancelada no PJe, nenhuma tarefa aberta);
 * - horario: a tarefa está em outro dia ou hora;
 * - falta: nenhuma tarefa de audiência para ela (ou só uma cancelada);
 * - concluida: a tarefa já foi concluída e a audiência ainda não aconteceu;
 * - aberta: cancelada no PJe e a tarefa segue aberta no VIOS.
 * Null: ainda não conferida (o relatório CSV antigo só deixa a data, e aí só "horario" aparece).
 */
export type EstadoNoVios = "confere" | "horario" | "falta" | "concluida" | "aberta";

export function estadoNoVios(
  aud: Pick<Audiencia, "situacao" | "inicio" | "viosConferidoEm" | "viosTarefaCi" | "viosSituacao" | "viosInicio">,
  agora = Date.now()
): EstadoNoVios | null {
  const conferida = Boolean(aud.viosConferidoEm);
  if (aud.situacao === "cancelada") {
    if (aud.viosTarefaCi && aud.viosSituacao === "aberta") return "aberta";
    return conferida ? "confere" : null;
  }
  if (aud.situacao !== "designada") return null;
  if (conferida && (!aud.viosTarefaCi || aud.viosSituacao === "cancelada")) return "falta";
  if (aud.viosSituacao === "concluida") return new Date(aud.inicio).getTime() > agora ? "concluida" : "confere";
  if (aud.viosInicio && !mesmoHorario(aud.inicio, aud.viosInicio)) return "horario";
  return conferida ? "confere" : null;
}

/**
 * Alguém marcou "Conferido no VIOS" depois da cópia do VIOS usada na conferência: vale o que a pessoa viu. Quando
 * chega uma cópia mais nova do VIOS e ainda não bate, o alerta volta.
 */
export function conferidaDepoisDaCopia(aud: Pick<Audiencia, "mudancaConferidaEm" | "viosConferidoEm">): boolean {
  if (!aud.mudancaConferidaEm) return false;
  if (!aud.viosConferidoEm) return true;
  return new Date(aud.mudancaConferidaEm).getTime() > new Date(aud.viosConferidoEm).getTime();
}

/** Alertas que somem com "Conferido no VIOS". */
export const ALERTAS_DO_VIOS: AlertaAudiencia["tipo"][] = ["mudou", "cancelada", "vios_diverge", "vios_falta", "vios_concluida", "vios_aberta"];

function diaHora(iso: string): string {
  const v = local(iso);
  const dia = `${v.dia.slice(8, 10)}/${v.dia.slice(5, 7)}`;
  return v.hora === "00:00" ? `${dia} (sem horário)` : `${dia} às ${v.hora}`;
}

function alertaDoVios(aud: Audiencia, estado: EstadoNoVios | null): AlertaAudiencia | null {
  const ci = aud.viosTarefaCi ? ` (CI ${aud.viosTarefaCi})` : "";
  if (estado === "falta")
    return { tipo: "vios_falta", grave: true, texto: aud.viosSituacao === "cancelada" ? `A tarefa${ci} está cancelada no VIOS.` : "Não está agendada no VIOS." };
  if (estado === "concluida") return { tipo: "vios_concluida", grave: true, texto: `A tarefa${ci} já foi concluída no VIOS.` };
  if (estado === "horario" && aud.viosInicio) return { tipo: "vios_diverge", grave: true, texto: `No VIOS está ${diaHora(aud.viosInicio)}.` };
  return null;
}

/** Resposta de cada papel ao convite do Outlook, por audiência (só convites que saíram de verdade). */
export type RespostasDosConvites = Map<string, Partial<Record<Papel, RespostaConvite>>>;

export interface Contexto {
  pessoas: Map<string, PessoaPauta>;
  todas: Audiencia[];
  duracoes?: Partial<Record<TipoAudiencia, number>>;
  respostas?: RespostasDosConvites;
}

/**
 * As respostas que valem: só convite enviado de verdade (o simulado não tem resposta) e da pessoa que está hoje no
 * papel (depois de uma troca, o convite antigo foi cancelado e o novo ainda não tem resposta).
 */
export function respostasDosConvites(convites: ConvitePauta[], audiencias: Pick<Audiencia, "id" | "titularId" | "backupId">[]): RespostasDosConvites {
  const porId = new Map(audiencias.map((a) => [a.id, a]));
  const saida: RespostasDosConvites = new Map();
  for (const c of convites) {
    const aud = porId.get(c.audienciaId);
    if (!aud || c.status !== "enviado") continue;
    if (c.pessoaId !== (c.papel === "titular" ? aud.titularId : aud.backupId)) continue;
    const resposta: RespostaConvite = c.resposta === "aceito" || c.resposta === "recusado" || c.resposta === "provisorio" ? c.resposta : "sem_resposta";
    saida.set(aud.id, { ...saida.get(aud.id), [c.papel]: resposta });
  }
  return saida;
}

function nome(ctx: Contexto, id: string | null): string {
  return (id && ctx.pessoas.get(id)?.nomeCurto) || "—";
}

/** Tudo o que pede atenção numa audiência. `grave` vai para o vermelho da distribuição. */
export function alertasDaAudiencia(aud: Audiencia, ctx: Contexto): AlertaAudiencia[] {
  const alertas: AlertaAudiencia[] = [];
  const conferida = Boolean(aud.mudancaConferidaEm);
  const vistaDepois = conferidaDepoisDaCopia(aud);
  const estado = estadoNoVios(aud);
  if (aud.situacao === "cancelada") {
    const ci = aud.viosTarefaCi ? ` (CI ${aud.viosTarefaCi})` : "";
    if (estado === "aberta" && !vistaDepois) alertas.push({ tipo: "vios_aberta", grave: true, texto: `Cancelada no PJe e a tarefa${ci} segue aberta no VIOS.` });
    else if (!conferida && estado !== "confere" && estado !== "aberta") alertas.push({ tipo: "cancelada", grave: true, texto: "Cancelada no PJe: conferir se já saiu do VIOS." });
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
  // Recusou o convite do Outlook: a titular vai para o vermelho (precisa de troca); a backup, só aviso.
  const respostas = ctx.respostas?.get(aud.id);
  if (aud.titularId && respostas?.titular === "recusado")
    alertas.push({ tipo: "recusou", grave: true, texto: `${nome(ctx, aud.titularId)} recusou o convite do Outlook: trocar a titular.` });
  if (aud.backupId && respostas?.backup === "recusado")
    alertas.push({ tipo: "backup_recusou", grave: false, texto: `A backup ${nome(ctx, aud.backupId)} recusou o convite do Outlook.` });
  if (aud.mudancas.length && !conferida) {
    alertas.push({ tipo: "mudou", grave: true, texto: `${aud.mudancas.map((m) => ROTULO_MUDANCA[m]).join(", ")} no PJe: conferir no VIOS.` });
  }
  const doVios = vistaDepois ? null : alertaDoVios(aud, estado);
  if (doVios) alertas.push(doVios);
  if (local(aud.inicio).minutos < HORA_CEDO * 60) alertas.push({ tipo: "cedo", grave: false, texto: `Antes das ${HORA_CEDO}h.` });
  if (aud.modalidadeTribunal === "video" && !aud.linkSala) alertas.push({ tipo: "sem_link", grave: false, texto: "Online e ainda sem link da sala." });
  if (aud.modalidadeTribunal === "hibrida" && !aud.modalidadeEquipe) alertas.push({ tipo: "a_completar", grave: false, texto: "Híbrida: dizer se a equipe vai presencial ou online." });
  if (!aud.modalidadeTribunal) alertas.push({ tipo: "a_completar", grave: false, texto: "Modalidade a completar." });
  return alertas;
}

/** Falta alguém conferir no VIOS: mudança do PJe ainda não conferida ou divergência da última conferência. */
export function pendenteNoVios(aud: Audiencia): boolean {
  return alertasDaAudiencia(aud, { pessoas: new Map(), todas: [] }).some((a) => ALERTAS_DO_VIOS.includes(a.tipo));
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
    if (conflito?.tipo === "choque") opcoes.push({ pessoa, estado: "choque", texto: `Conflito de horário · ${rotulo(conflito.com)}` });
    else if (conflito) opcoes.push({ pessoa, estado: "atencao", texto: `Deslocamento · ${rotulo(conflito.com)}` });
    else {
      const dia = compromissosDoDia(pessoa.id, local(aud.inicio).dia, ctx.todas, aud.id);
      opcoes.push({ pessoa, estado: "livre", texto: dia.length ? `Livre no horário · ${dia.length} outra(s) no dia` : "Livre no dia" });
    }
  }
  const peso = { atual: 0, livre: 1, atencao: 2, choque: 3 } as const;
  return opcoes.sort((a, b) => peso[a.estado] - peso[b.estado] || a.pessoa.nomeCurto.localeCompare(b.pessoa.nomeCurto, "pt-BR"));
}
