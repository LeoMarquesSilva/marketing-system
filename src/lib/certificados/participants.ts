// Lista de participantes vinda de planilha (Excel/CSV) ou colada na tela.

export interface CertificateParticipant {
  id: string;
  nome: string;
  email: string | null;
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

const NAME_HEADERS = ["nome", "nome completo", "participante", "nome do participante", "colaborador", "aluno", "name"];
const EMAIL_HEADERS = ["email", "e-mail", "e mail", "endereco de email", "endereco de e-mail", "mail"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let sequence = 0;
export const newParticipantId = () => `p${Date.now().toString(36)}${(sequence++).toString(36)}`;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function findHeader(rows: string[][]): { row: number; name: number; email: number } | null {
  for (let row = 0; row < Math.min(rows.length, 10); row++) {
    const cells = rows[row].map(normalize);
    const name = cells.findIndex((cell) => NAME_HEADERS.includes(cell));
    if (name >= 0) {
      return { row, name, email: cells.findIndex((cell) => EMAIL_HEADERS.includes(cell)) };
    }
  }
  return null;
}

/**
 * Lê as linhas da primeira aba. Procura a coluna "Nome" (e "E-mail", se houver)
 * nas primeiras linhas; sem cabeçalho, usa a 1ª coluna como nome e pega o
 * e-mail de qualquer célula da linha que pareça um.
 */
export function participantsFromRows(rawRows: unknown[][]): CertificateParticipant[] {
  const rows = rawRows.map((row) => (Array.isArray(row) ? row.map(cellText) : []));
  const header = findHeader(rows);
  const body = header ? rows.slice(header.row + 1) : rows;
  const list = body.map((cells) => {
    const nome = header ? cells[header.name] ?? "" : cells.find((cell) => cell && !EMAIL_PATTERN.test(cell)) ?? "";
    const emailCell = header && header.email >= 0 ? cells[header.email] : cells.find((cell) => EMAIL_PATTERN.test(cell));
    const email = emailCell && EMAIL_PATTERN.test(emailCell) ? emailCell.toLowerCase() : null;
    return { id: newParticipantId(), nome, email };
  });
  return dedupeParticipants(list.filter((p) => p.nome && !EMAIL_PATTERN.test(p.nome)));
}

/** Um participante por linha: "Nome", "Nome; e-mail", "Nome, e-mail" ou separado por tab. */
export function participantsFromText(text: string): CertificateParticipant[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|;|,(?=[^,]*@)/).map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean));
  return participantsFromRows(rows);
}

/** Remove repetidos pelo nome (sem acento/caixa), mantendo o primeiro e completando o e-mail. */
export function dedupeParticipants(list: CertificateParticipant[]): CertificateParticipant[] {
  const byName = new Map<string, CertificateParticipant>();
  for (const participant of list) {
    const key = normalize(participant.nome);
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) byName.set(key, { ...participant, nome: participant.nome.replace(/\s+/g, " ").trim() });
    else if (!existing.email && participant.email) existing.email = participant.email;
  }
  return [...byName.values()];
}
