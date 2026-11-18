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
  const linhas: [string, string][] = [
    ["Processo", aud.cnj],
    ["Vara", aud.orgao ?? "—"],
    ["Modalidade", aud.modalidadeTribunal ? ROTULO_MODALIDADE[aud.modalidadeTribunal] : "A confirmar"],
  ];
  if (aud.reclamanteIniciais) linhas.push(["Reclamante", aud.reclamanteIniciais]);
  linhas.push([papel === "titular" ? "Backup" : "Titular", (outra && pessoas.get(outra)?.nomeCurto) || "—"]);
  if (aud.correspondente) linhas.push(["Correspondente", aud.correspondente]);
  if (aud.observacao) linhas.push(["Observação", aud.observacao]);
  const tabela = linhas.map(([k, v]) => `<tr><td style="color:#6b7d8c;padding:2px 12px 2px 0">${escapar(k)}</td><td>${escapar(v)}</td></tr>`).join("");
  const sala = aud.linkSala ? `<p><b>Sala:</b> <a href="${escapar(aud.linkSala)}">${escapar(aud.linkSala)}</a></p>` : "";
  const papelTexto =
    papel === "backup"
      ? "<p>Você é o backup desta audiência. Se a titular recusar ou for trocada, você é avisado aqui e no grupo.</p>"
      : "<p>Não consegue ir? Recuse este convite com o motivo: a coordenação vê na hora.</p>";
  const rodape = opcoes.urlPauta ? `<p><a href="${escapar(opcoes.urlPauta)}">Abrir na Pauta de Audiências</a></p>` : "";
  return {
    subject: tituloDoConvite(aud, papel),
    body: {
      contentType: "HTML",
      content: `${sala}<table style="font-size:13px">${tabela}</table>${papelTexto}<p style="color:#6b7d8c">Mudou no VIOS ou no tribunal? Este convite é atualizado sozinho.</p>${rodape}`,
    },
    start: { dateTime: horaLocal(inicio), timeZone: "America/Sao_Paulo" },
    end: { dateTime: horaLocal(fim), timeZone: "America/Sao_Paulo" },
    location: { displayName: [aud.orgao, aud.sala].filter(Boolean).join(" · ") || "A confirmar" },
    attendees: [{ emailAddress: { address: pessoa.email, name: pessoa.nomeVios }, type: "required" }],
    showAs: papel === "titular" ? "busy" : "free",
    isReminderOn: true,
    reminderMinutesBeforeStart: papel === "titular" ? 120 : 60,
    responseRequested: true,
    allowNewTimeProposals: false,
  };
}

/** FNV-1a de 32 bits: basta para saber se o convite mudou. */
export function versaoDoEvento(evento: EventoGraph): string {
  const base = JSON.stringify([evento.subject, evento.body.content, evento.start, evento.end, evento.location, evento.attendees, evento.showAs]);
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
