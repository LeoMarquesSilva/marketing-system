// Parser para a nota estruturada que a automação (Responsum → OrquestrAI) grava
// em `description` nos cards de request_type "Certificados". O texto segue sempre
// o mesmo modelo de campos "Rótulo: valor" concatenados em uma única string.

export interface CertificadoWorkshopPresenca {
  status: "preenchida" | "nao_preenchida";
  nomes: string[];
}

export interface CertificadoWorkshopInfo {
  origem?: string;
  ticketId?: string;
  ticketUrl?: string;
  tipo?: string;
  tema?: string;
  responsavelNome?: string;
  responsavelEmail?: string;
  facilitadores?: string;
  dataRealizacao?: string;
  duracao?: string;
  area?: string;
  listaPresencaUrl?: string;
  presenca?: CertificadoWorkshopPresenca;
}

// Bloco que a Edge Function orquestrai-certificados-presenca anexa ao final
// da description depois de consultar o SharePoint (ver appendPresencaBlock).
const PRESENCA_BLOCK_PATTERN = /\n\s*Presença:([\s\S]*)$/;

function extractPresencaBlock(description: string): {
  mainText: string;
  presenca?: CertificadoWorkshopPresenca;
} {
  const match = PRESENCA_BLOCK_PATTERN.exec(description);
  if (!match) return { mainText: description };

  const mainText = description.slice(0, match.index).trim();
  const body = match[1].trim();
  if (/^não preenchida/i.test(body)) {
    return { mainText, presenca: { status: "nao_preenchida", nomes: [] } };
  }
  const nomes = body
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  return { mainText, presenca: { status: "preenchida", nomes } };
}

type TextFieldKey = Exclude<keyof CertificadoWorkshopInfo, "presenca">;

const FIELD_LABELS: { key: TextFieldKey; label: string }[] = [
  { key: "origem", label: "Origem" },
  { key: "ticketId", label: "Ticket ID" },
  { key: "ticketUrl", label: "Ticket" },
  { key: "tipo", label: "Tipo" },
  { key: "tema", label: "Tema" },
  { key: "responsavelNome", label: "Responsável (Gerente da área)" },
  { key: "responsavelEmail", label: "E-mail do responsável" },
  { key: "facilitadores", label: "Facilitador(es)" },
  { key: "dataRealizacao", label: "Data da realização" },
  { key: "duracao", label: "Duração" },
  { key: "area", label: "Área" },
  { key: "listaPresencaUrl", label: "Lista de presença" },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LABEL_PATTERN = new RegExp(
  `(${FIELD_LABELS.map((f) => escapeRegExp(f.label)).join("|")}):\\s*`,
  "g"
);

/**
 * Extrai os campos da nota da automação. Retorna null quando o texto não
 * parece seguir o modelo conhecido (sem "Ticket ID:"/"Tema:"), para não
 * esconder descrições comuns escritas à mão em outros cards de Certificados.
 */
export function parseCertificadoWorkshopDescription(
  description: string | null | undefined
): CertificadoWorkshopInfo | null {
  if (!description) return null;
  if (!description.includes("Ticket ID:") || !description.includes("Tema:")) return null;

  const { mainText, presenca } = extractPresencaBlock(description);

  const matches: { key: TextFieldKey; start: number; end: number }[] = [];
  LABEL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LABEL_PATTERN.exec(mainText)) !== null) {
    const field = FIELD_LABELS.find((f) => f.label === match![1]);
    if (field) {
      matches.push({ key: field.key, start: match.index, end: LABEL_PATTERN.lastIndex });
    }
  }
  if (matches.length === 0) return null;

  const info: CertificadoWorkshopInfo = {};
  matches.forEach((m, i) => {
    const valueEnd = matches[i + 1]?.start ?? mainText.length;
    const value = mainText.slice(m.end, valueEnd).trim();
    if (value) info[m.key] = value;
  });
  if (presenca) info.presenca = presenca;

  return Object.keys(info).length > 0 ? info : null;
}
