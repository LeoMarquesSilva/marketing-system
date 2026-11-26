import { local, modalidadeEfetiva, cidadeDoOrgao } from "./agenda";
import { ROTULO_MUDANCA, ROTULO_TIPO, type Audiencia, type PessoaPauta } from "./tipos";

/**
 * Textos dos avisos no grupo de WhatsApp da área. Para a marcação aparecer, o texto leva "@<número>" e o envio
 * leva a lista `mentioned` com os mesmos números (Evolution API). Sem número cadastrado, sai só o nome.
 */

export interface Mensagem {
  texto: string;
  mencoes: string[];
}

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function soDigitos(numero: string | null | undefined): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

class Marcador {
  readonly mencoes = new Set<string>();
  constructor(private readonly pessoas: Map<string, PessoaPauta>) {}
  pessoa(id: string | null | undefined): string {
    const p = id ? this.pessoas.get(id) : null;
    if (!p) return "—";
    const numero = soDigitos(p.whatsapp);
    if (!numero) return p.nomeCurto.split(" ")[0]!;
    this.mencoes.add(numero);
    return `@${numero}`;
  }
}

export function diaCurto(diaIso: string): string {
  const d = new Date(`${diaIso}T12:00:00Z`);
  return `${DIAS_SEMANA[d.getUTCDay()]} ${diaIso.slice(8, 10)}/${diaIso.slice(5, 7)}`;
}

function onde(aud: Audiencia): string {
  const m = modalidadeEfetiva(aud);
  if (m === "presencial") {
    const cidade = cidadeDoOrgao(aud.orgao);
    return `presencial${cidade ? ` ${cidade.replace(/\b\w/g, (c) => c.toUpperCase())}` : ""}`;
  }
  if (m === "video") return "online";
  return aud.modalidadeTribunal === "hibrida" ? "híbrida" : "modalidade a confirmar";
}

function cliente(aud: Audiencia): string {
  return aud.grupoCliente?.replace(/^grupo\s+/i, "") || aud.cliente || aud.cnj;
}

const LINHA = "\n";
const ESPACO = "\n\n";

/**
 * Cada audiência num bloco, separado por uma linha em branco (a equipe achou a versão de uma linha por audiência muito
 * "grudada", 24/11/2026): horário e tipo em negrito, cliente e modalidade, titular e backup um embaixo do outro.
 */
function bloco(aud: Audiencia, m: Marcador): string {
  const { hora } = local(aud.inicio);
  const linhas = [`*${hora} · ${ROTULO_TIPO[aud.tipo]}*`, `${cliente(aud)} · ${onde(aud)}`, `Titular: ${m.pessoa(aud.titularId)}`, `Backup: ${m.pessoa(aud.backupId)}`];
  // Só no VIOS ou na Vistagem (o tribunal ainda não mostrou): vai com o aviso.
  if (aud.origem === "vios") linhas.push("_a confirmar no tribunal_");
  return linhas.join(LINHA);
}

/** "Inicial 08:40 · Cliente · qui 19/11": a audiência numa linha, nos avisos de troca, mudança e alerta. */
function qual(aud: Audiencia): string {
  const { dia, hora } = local(aud.inicio);
  return `${ROTULO_TIPO[aud.tipo]} ${hora} · ${cliente(aud)} · ${diaCurto(dia)}`;
}

function chamadaDaCoordenacao(coordenacao: string[], m: Marcador): string {
  return coordenacao.length ? `${ESPACO}${coordenacao.map((id) => m.pessoa(id)).join(" ")}, dá para resolver na distribuição?` : "";
}

/** "📅 Pauta de amanhã · qui 19/11" com titular e backup marcados. */
export function mensagemDaPauta(titulo: string, dia: string, audiencias: Audiencia[], pessoas: Map<string, PessoaPauta>): Mensagem | null {
  const doDia = audiencias.filter((a) => a.situacao === "designada" && local(a.inicio).dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!doDia.length) return null;
  const m = new Marcador(pessoas);
  const blocos = doDia.map((a) => bloco(a, m));
  return { texto: `📅 *${titulo} · ${diaCurto(dia)}*${ESPACO}${blocos.join(ESPACO)}`, mencoes: [...m.mencoes] };
}

export function mensagemDeTroca(
  aud: Audiencia,
  papel: "titular" | "backup",
  de: string | null,
  para: string,
  motivo: string | null,
  pessoas: Map<string, PessoaPauta>
): Mensagem {
  const m = new Marcador(pessoas);
  const titulo = de ? (papel === "titular" ? "Troca de titular" : "Troca de backup") : papel === "titular" ? "Titular definido" : "Backup definido";
  const titularId = papel === "titular" ? para : aud.titularId;
  const backupId = papel === "backup" ? para : aud.backupId;
  const linhas = [qual(aud), `Titular: ${m.pessoa(titularId)}`];
  if (backupId) linhas.push(`Backup: ${m.pessoa(backupId)}`);
  if (de) linhas.push(`Sai: ${pessoas.get(de)?.nomeCurto ?? "—"}${motivo ? ` (${motivo.toLowerCase()})` : ""}`);
  return { texto: `🔁 *${titulo}*${ESPACO}${linhas.join(LINHA)}`, mencoes: [...m.mencoes] };
}

export function mensagemDeMudanca(aud: Audiencia, pessoas: Map<string, PessoaPauta>): Mensagem {
  const m = new Marcador(pessoas);
  const oque = aud.situacao === "cancelada" ? "Cancelada no PJe" : aud.mudancas.map((x) => ROTULO_MUDANCA[x]).join(", ");
  const link = aud.mudancas.includes("link") && aud.linkSala ? `${LINHA}O convite do Outlook já tem a sala nova.` : "";
  return {
    texto: `⚠️ *${oque}*${ESPACO}${qual(aud)}${LINHA}${aud.cnj}${ESPACO}${m.pessoa(aud.titularId)} e ${m.pessoa(aud.backupId)}, conferir no VIOS.${link}`,
    mencoes: [...m.mencoes],
  };
}

export function mensagemDeAlerta(aud: Audiencia, alerta: string, coordenacao: string[], pessoas: Map<string, PessoaPauta>): Mensagem {
  const m = new Marcador(pessoas);
  return { texto: `⚠️ *Precisa de decisão*${ESPACO}${qual(aud)}${LINHA}${alerta}${chamadaDaCoordenacao(coordenacao, m)}`, mencoes: [...m.mencoes] };
}

/**
 * Os alertas novos de uma rodada numa mensagem só (para não encher o grupo: numa manhã chegam a 11), cada um no seu
 * bloco. Com um alerta, a mensagem é a mesma de `mensagemDeAlerta`, como no desenho da pauta.
 */
export function mensagemDeAlertas(itens: { aud: Audiencia; texto: string }[], coordenacao: string[], pessoas: Map<string, PessoaPauta>): Mensagem {
  if (itens.length === 1) return mensagemDeAlerta(itens[0]!.aud, itens[0]!.texto, coordenacao, pessoas);
  const m = new Marcador(pessoas);
  const blocos = [...itens].sort((a, b) => a.aud.inicio.localeCompare(b.aud.inicio)).map(({ aud, texto }) => `*${qual(aud)}*${LINHA}${texto}`);
  return { texto: `⚠️ *Precisa de decisão (${itens.length})*${ESPACO}${blocos.join(ESPACO)}${chamadaDaCoordenacao(coordenacao, m)}`, mencoes: [...m.mencoes] };
}
