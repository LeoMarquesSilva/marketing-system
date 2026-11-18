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
  if (m === "video") return "vídeo";
  return aud.modalidadeTribunal === "hibrida" ? "híbrida" : "modalidade a confirmar";
}

function cliente(aud: Audiencia): string {
  return aud.grupoCliente?.replace(/^grupo\s+/i, "") || aud.cliente || aud.cnj;
}

function linha(aud: Audiencia, m: Marcador): string {
  const { hora } = local(aud.inicio);
  return `${hora} ${ROTULO_TIPO[aud.tipo]} · ${cliente(aud)} · ${onde(aud)} · ${m.pessoa(aud.titularId)} (backup ${m.pessoa(aud.backupId)})`;
}

/** "📅 Pauta de amanhã · qui 19/11" com titular e backup marcados. */
export function mensagemDaPauta(titulo: string, dia: string, audiencias: Audiencia[], pessoas: Map<string, PessoaPauta>): Mensagem | null {
  const doDia = audiencias.filter((a) => a.situacao === "designada" && local(a.inicio).dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!doDia.length) return null;
  const m = new Marcador(pessoas);
  const linhas = doDia.map((a) => `• ${linha(a, m)}`);
  return { texto: `📅 *${titulo} · ${diaCurto(dia)}*\n${linhas.join("\n")}`, mencoes: [...m.mencoes] };
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
  const { dia, hora } = local(aud.inicio);
  const titulo = de ? (papel === "titular" ? "Troca de titular" : "Troca de backup") : papel === "titular" ? "Titular definido" : "Backup definido";
  const quem = papel === "titular" ? `Titular: ${m.pessoa(para)}${aud.backupId ? ` · backup: ${m.pessoa(aud.backupId)}` : ""}` : `Backup: ${m.pessoa(para)} · titular: ${m.pessoa(aud.titularId)}`;
  const saida = de ? `\nSai: ${pessoas.get(de)?.nomeCurto ?? "—"}${motivo ? ` (${motivo.toLowerCase()})` : ""}` : "";
  return { texto: `🔁 *${titulo}*\n${ROTULO_TIPO[aud.tipo]} ${hora} · ${cliente(aud)} · ${diaCurto(dia)}\n${quem}${saida}`, mencoes: [...m.mencoes] };
}

export function mensagemDeMudanca(aud: Audiencia, pessoas: Map<string, PessoaPauta>): Mensagem {
  const m = new Marcador(pessoas);
  const { dia, hora } = local(aud.inicio);
  const oque = aud.situacao === "cancelada" ? "Cancelada no PJe" : aud.mudancas.map((x) => ROTULO_MUDANCA[x]).join(", ");
  const link = aud.mudancas.includes("link") && aud.linkSala ? "\nO convite do Outlook já tem a sala nova." : "";
  return {
    texto: `⚠️ *${oque}*\n${ROTULO_TIPO[aud.tipo]} ${hora} · ${cliente(aud)} · ${diaCurto(dia)} · ${aud.cnj}\n${m.pessoa(aud.titularId)} e ${m.pessoa(aud.backupId)}, conferir no VIOS.${link}`,
    mencoes: [...m.mencoes],
  };
}

export function mensagemDeAlerta(aud: Audiencia, alerta: string, coordenacao: string[], pessoas: Map<string, PessoaPauta>): Mensagem {
  const m = new Marcador(pessoas);
  const { dia, hora } = local(aud.inicio);
  const chamada = coordenacao.length ? `\n${coordenacao.map((id) => m.pessoa(id)).join(" ")}, dá para resolver na distribuição?` : "";
  return { texto: `⚠️ *Precisa de decisão*\n${ROTULO_TIPO[aud.tipo]} ${hora} · ${cliente(aud)} · ${diaCurto(dia)}\n${alerta}${chamada}`, mencoes: [...m.mencoes] };
}
