import { linkPastaVios, linkTarefaVios } from "@/lib/vistagem/vios-links";
import { duracaoMin, local, modalidadeEfetiva } from "./agenda";
import { ROTULO_MODALIDADE, ROTULO_TIPO, type Audiencia, type Papel, type PessoaPauta, type TipoAudiencia } from "./tipos";

/**
 * Convites do Outlook (Microsoft Graph, POST /users/{organizador}/events): um por papel. A titular recebe o
 * compromisso como "ocupado"; a backup, com "[BACKUP]" no título e como "livre", para não travar a agenda.
 * A `versao` muda quando muda algo que a pessoa vê: só então o convite é atualizado.
 */

export interface EventoGraph {
  subject: string;
  body: { contentType: "HTML"; content: string };
  start: { dateTime: string; timeZone: "America/Sao_Paulo" };
  end: { dateTime: string; timeZone: "America/Sao_Paulo" };
  location: { displayName: string };
  attendees: { emailAddress: { address: string; name: string }; type: "required" }[];
  showAs: "busy" | "free";
  isReminderOn: true;
  reminderMinutesBeforeStart: number;
  responseRequested: true;
  allowNewTimeProposals: false;
  transactionId?: string;
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function horaLocal(ms: number): string {
  return new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

function cliente(aud: Audiencia): string {
  return aud.grupoCliente?.replace(/^grupo\s+/i, "") || aud.cliente || aud.cnj;
}

export function tituloDoConvite(aud: Audiencia, papel: Papel): string {
  const m = modalidadeEfetiva(aud);
  const modalidade = m ? ROTULO_MODALIDADE[m] : aud.modalidadeTribunal ? ROTULO_MODALIDADE[aud.modalidadeTribunal] : "A confirmar";
  const base = `${ROTULO_TIPO[aud.tipo]} · ${cliente(aud)} · ${local(aud.inicio).hora} · ${modalidade}`;
  return papel === "backup" ? `[BACKUP] ${base}` : base;
}

/**
 * Local do convite: a vara e, na audiência por vídeo (ou híbrida com a equipe por vídeo), o link da sala, como no
 * desenho da pauta ("CON1 - Piracicaba · us02web.zoom.us/j/…"); presencial, a vara e a sala.
 */
export function localDoConvite(aud: Audiencia): string {
  const link = aud.linkSala ? partesDoLink(aud.linkSala) : null;
  const partes = modalidadeEfetiva(aud) === "video" && link ? [aud.orgao, link.url ?? link.resto] : [aud.orgao, aud.sala];
  return partes.filter(Boolean).join(" · ") || "A confirmar";
}

/**
 * O link da sala às vezes vem com o ID e a senha da reunião no mesmo campo ("https://… ID da reunião: 883 0782 …
 * Senha de acesso: 277454", com espaços sobrando). Separa o endereço (o que vai no link) do resto (o que vai ao lado).
 */
export function partesDoLink(link: string): { url: string | null; resto: string } {
  const texto = link.replace(/\s+/g, " ").trim();
  const url = texto.match(/https?:\/\/\S+/)?.[0] ?? null;
  if (!url) return { url: null, resto: texto };
  return { url, resto: texto.replace(url, "").replace(/^[\s·,;|-]+|[\s·,;|-]+$/g, "").trim() };
}

function linkHtml(url: string, texto: string): string {
  return `<a href="${escapar(url)}">${escapar(texto)}</a>`;
}

export function eventoDoConvite(
  aud: Audiencia,
  papel: Papel,
  pessoa: PessoaPauta,
  pessoas: Map<string, PessoaPauta>,
  opcoes: { urlPauta?: string; duracoes?: Partial<Record<TipoAudiencia, number>> } = {}
): EventoGraph {
  if (!pessoa.email) throw new Error(`${pessoa.nomeCurto} não tem e-mail cadastrado.`);
  const inicio = new Date(aud.inicio).getTime();
  const fim = inicio + duracaoMin(aud, opcoes.duracoes) * 60000;
  const outra = papel === "titular" ? aud.backupId : aud.titularId;
  // Cada linha já em HTML (valor escapado); os links do VIOS seguem o padrão do resto do sistema (CI clicável).
  const linhas: [string, string][] = [
    ["Processo", escapar(aud.cnj)],
    ["Vara", escapar(aud.orgao ?? "—")],
    ["Modalidade", escapar(aud.modalidadeTribunal ? ROTULO_MODALIDADE[aud.modalidadeTribunal] : "A confirmar")],
  ];
  if (aud.juizoDigital) linhas.push(["Juízo 100% Digital", "Sim"]);
  if (aud.reclamanteIniciais) linhas.push(["Reclamante", escapar(aud.reclamanteIniciais)]);
  linhas.push([papel === "titular" ? "Backup" : "Titular", escapar((outra && pessoas.get(outra)?.nomeCurto) || "—")]);
  if (papel === "backup") linhas.push(["Seu papel", "Assumir se a titular não puder"]);
  if (aud.correspondente) linhas.push(["Correspondente", escapar(aud.correspondente)]);
  if (aud.observacao) linhas.push(["Observação", escapar(aud.observacao)]);
  if (aud.viosTarefaCi) linhas.push(["Tarefa no VIOS", linkHtml(linkTarefaVios(aud.viosTarefaCi), `CI ${aud.viosTarefaCi}`)]);
  if (aud.ciProcesso) linhas.push(["Pasta no VIOS", linkHtml(linkPastaVios(aud.ciProcesso), `CI ${aud.ciProcesso}`)]);
  // As linhas do VIOS levam data-vios: a versão não conta com elas (ver versaoDoEvento).
  const tabela = linhas
    .map(([k, v]) => `<tr${k.endsWith("no VIOS") ? " data-vios" : ""}><td style="color:#6b7d8c;padding:2px 12px 2px 0">${escapar(k)}</td><td>${v}</td></tr>`)
    .join("");
  const link = aud.linkSala ? partesDoLink(aud.linkSala) : null;
  const sala = link
    ? `<p><b>Sala:</b> ${[link.url ? linkHtml(link.url, link.url) : null, link.resto ? escapar(link.resto) : null].filter(Boolean).join(" · ")}</p>`
    : "";
  const papelTexto =
    papel === "backup"
      ? "<p>Você é o backup desta audiência. Se a titular recusar ou for trocada, você é avisado aqui e no grupo.</p>"
      : "<p>Não consegue ir? Recuse este convite com o motivo: a coordenação vê na hora.</p>";
  const rodape = opcoes.urlPauta ? `<p>${linkHtml(opcoes.urlPauta, "Abrir na Pauta de Audiências")}</p>` : "";
  return {
    subject: tituloDoConvite(aud, papel),
    body: {
      contentType: "HTML",
      content: `${sala}<table style="font-size:13px">${tabela}</table>${papelTexto}<p style="color:#6b7d8c">Mudou no VIOS ou no tribunal? Este convite é atualizado sozinho. Aceitar vale como ciência.</p>${rodape}`,
    },
    start: { dateTime: horaLocal(inicio), timeZone: "America/Sao_Paulo" },
    end: { dateTime: horaLocal(fim), timeZone: "America/Sao_Paulo" },
    location: { displayName: localDoConvite(aud) },
    attendees: [{ emailAddress: { address: pessoa.email, name: pessoa.nomeVios }, type: "required" }],
    showAs: papel === "titular" ? "busy" : "free",
    isReminderOn: true,
    reminderMinutesBeforeStart: papel === "titular" ? 120 : 60,
    responseRequested: true,
    allowNewTimeProposals: false,
  };
}

/**
 * FNV-1a de 32 bits: basta para saber se o convite mudou. Os links do VIOS ficam de fora: a tarefa do VIOS costuma
 * aparecer depois do convite, e cada atualização manda um e-mail à pessoa; o link entra na próxima mudança de verdade.
 */
export function versaoDoEvento(evento: EventoGraph): string {
  const corpo = evento.body.content.replace(/<tr data-vios>.*?<\/tr>/g, "");
  const base = JSON.stringify([evento.subject, corpo, evento.start, evento.end, evento.location, evento.attendees, evento.showAs]);
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i += 1) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Resposta do convidado no Graph (attendees[].status.response) → como a pauta mostra. */
export function respostaDoGraph(valor: string | null | undefined): "aceito" | "recusado" | "provisorio" | "sem_resposta" {
  switch ((valor ?? "").toLowerCase()) {
    case "accepted":
      return "aceito";
    case "declined":
      return "recusado";
    case "tentativelyaccepted":
      return "provisorio";
    default:
      return "sem_resposta";
  }
}
