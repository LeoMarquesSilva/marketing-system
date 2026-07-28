/**
 * Importação assistida da planilha de colaboradores.
 *
 * Duas garantias centrais:
 *
 * 1. Privacidade — o parser é uma allowlist de colunas. A planilha real tem
 *    "DATA DE NASC.", CPF e dados de empresa; nada disso atravessa esta
 *    fronteira, porque só as colunas mapeadas abaixo são lidas.
 * 2. Nada é aplicado às cegas — `buildImportPreview` classifica cada linha e
 *    mostra a diferença campo a campo antes de qualquer escrita. A importação
 *    nunca altera atividade, papel ou permissão de usuário.
 */

import * as XLSX from "xlsx";
import { makeProfileSlug, nextProfileSlugCandidate } from "@/lib/profiles/slug";
import type {
  ImportExistingProfile,
  ImportFieldDifference,
  ImportRowOutcome,
  ImportUserCandidate,
  ProfessionalProfileImportPreview,
  ProfessionalProfileImportPreviewRow,
  ProfessionalProfileImportRow,
} from "@/lib/profiles/types";

/**
 * Colunas lidas da planilha, por rótulo do cabeçalho. Buscar por nome (e não
 * por índice fixo) mantém a importação funcionando se a ordem mudar.
 * Tudo que não estiver aqui é ignorado por construção.
 */
const COLUMN_ALIASES = {
  active: ["colaborador ativo?", "colaborador ativo", "ativo"],
  name: ["nome"],
  area: ["area", "área"],
  role: ["cargo"],
  joinedOn: ["dt. admissao", "dt. admissão", "dt admissao", "data de admissao", "data de admissão"],
  phone: ["telefone"],
  email: ["e-mail", "email"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function headerKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function aliasKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Mapeia rótulo do cabeçalho para índice de coluna. */
function resolveColumnIndexes(header: unknown[]): Partial<Record<ColumnKey, number>> {
  const indexes: Partial<Record<ColumnKey, number>> = {};
  header.forEach((cell, index) => {
    const key = headerKey(cell);
    if (!key) return;
    for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as Array<
      [ColumnKey, readonly string[]]
    >) {
      if (indexes[column] !== undefined) continue;
      // "TELEFONE EMPRESA" não pode ser confundido com "TELEFONE" do colaborador.
      if (aliases.some((alias) => aliasKey(alias) === key)) {
        indexes[column] = index;
      }
    }
  });
  return indexes;
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/** Data de admissão em AAAA-MM-DD. Serial do Excel e Date são aceitos. */
function cellDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }

  const text = String(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // dd/mm/aaaa — formato brasileiro da planilha.
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = Number(br[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return null;
}

function isActiveFlag(value: unknown): boolean {
  const text = headerKey(value);
  return text === "sim" || text === "s" || text === "true" || text === "1";
}

/**
 * Lê a planilha de colaboradores. Não depende de macro (o arquivo é `.xlsm`,
 * mas só as células importam) e devolve exclusivamente o contrato de import.
 */
export function parseCollaboratorWorkbook(
  buffer: ArrayBuffer
): ProfessionalProfileImportRow[] {
  const book = XLSX.read(buffer, { type: "array", cellDates: true, bookVBA: false });
  const sheetName = book.SheetNames[0];
  if (!sheetName) return [];

  const sheet = book.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (matrix.length < 2) return [];

  const indexes = resolveColumnIndexes(matrix[0]);
  if (indexes.email === undefined) return [];

  const rows: ProfessionalProfileImportRow[] = [];
  for (const line of matrix.slice(1)) {
    if (!Array.isArray(line)) continue;

    const rawEmail = cellText(line[indexes.email]);
    if (!rawEmail) continue;

    const name = indexes.name !== undefined ? cellText(line[indexes.name]) : null;
    const area = indexes.area !== undefined ? cellText(line[indexes.area]) : null;
    const role = indexes.role !== undefined ? cellText(line[indexes.role]) : null;
    const phone = indexes.phone !== undefined ? cellText(line[indexes.phone]) : null;
    const joinedOn = indexes.joinedOn !== undefined ? cellDate(line[indexes.joinedOn]) : null;
    const sourceIsActive =
      indexes.active !== undefined ? isActiveFlag(line[indexes.active]) : true;

    // Nenhuma outra coluna é lida: data de nascimento e CPF ficam na planilha.
    rows.push({
      email: rawEmail.toLowerCase(),
      name,
      area,
      role,
      phone,
      joinedOn,
      sourceIsActive,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Reconciliação
// ---------------------------------------------------------------------------

const DIFFERENCE_LABELS: Record<string, string> = {
  displayName: "Nome público",
  role: "Cargo",
  practiceArea: "Área de atuação",
  professionalEmail: "E-mail institucional",
  professionalPhone: "Telefone profissional",
  joinedOn: "Data de admissão",
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Um e-mail só é utilizável se tiver formato mínimo de endereço. */
function isUsableEmail(value: string): boolean {
  return /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(value);
}

function compare(
  field: string,
  current: string | null,
  incoming: string | null
): ImportFieldDifference | null {
  const currentValue = current?.trim() || null;
  const incomingValue = incoming?.trim() || null;
  if (!incomingValue) return null;
  if (currentValue === incomingValue) return null;
  return {
    field,
    label: DIFFERENCE_LABELS[field] ?? field,
    current: currentValue,
    incoming: incomingValue,
  };
}

/**
 * Classifica cada linha contra os usuários do sistema e os perfis existentes.
 * A correspondência usa exclusivamente o e-mail corporativo normalizado.
 */
export function buildImportPreview(
  rows: ProfessionalProfileImportRow[],
  users: ImportUserCandidate[],
  profiles: ImportExistingProfile[]
): ProfessionalProfileImportPreview {
  const userByEmail = new Map<string, ImportUserCandidate>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    if (key && !userByEmail.has(key)) userByEmail.set(key, user);
  }

  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

  // Slugs já ocupados: garante sufixo determinístico em vez de colisão.
  const takenSlugs = new Set(profiles.map((profile) => profile.slug));

  const seenEmails = new Set<string>();
  const previewRows: ProfessionalProfileImportPreviewRow[] = [];

  for (const row of rows) {
    const email = normalizeEmail(row.email);

    let outcome: ImportRowOutcome;
    let userId: string | null = null;
    let slug: string | null = null;
    let differences: ImportFieldDifference[] = [];

    if (seenEmails.has(email)) {
      // Duplicata dentro da própria planilha: nunca aplicada automaticamente.
      outcome = "duplicate";
    } else {
      seenEmails.add(email);

      const user = isUsableEmail(email) ? userByEmail.get(email) : undefined;

      if (!user) {
        // Sem correspondência (ou e-mail malformado): nada é adivinhado.
        outcome = "unmatched";
      } else {
        userId = user.id;
        const existing = profileByUserId.get(user.id) ?? null;

        if (!existing) {
          const base = makeProfileSlug(row.name ?? user.name ?? "") || "perfil";
          slug = nextProfileSlugCandidate(base, takenSlugs);
          takenSlugs.add(slug);
          outcome = row.sourceIsActive ? "create" : "inactiveSource";
        } else {
          slug = existing.slug;
          differences = [
            compare("displayName", existing.displayName, row.name),
            compare("role", existing.role, row.role),
            compare("practiceArea", existing.practiceArea, row.area),
            compare("professionalEmail", existing.professionalEmail, row.email),
            compare("professionalPhone", existing.professionalPhone, row.phone),
            compare("joinedOn", existing.joinedOn, row.joinedOn),
          ].filter((item): item is ImportFieldDifference => item !== null);

          if (!row.sourceIsActive) {
            outcome = "inactiveSource";
          } else {
            outcome = differences.length > 0 ? "update" : "unchanged";
          }
        }
      }
    }

    previewRows.push({
      email: row.email,
      name: row.name,
      role: row.role,
      area: row.area,
      outcome,
      userId,
      slug,
      sourceIsActive: row.sourceIsActive,
      differences,
      // Só criação/atualização de colaborador ativo já vem marcada.
      selectedByDefault: outcome === "create" || outcome === "update",
    });
  }

  const counts = {
    total: previewRows.length,
    create: 0,
    update: 0,
    unchanged: 0,
    unmatched: 0,
    inactiveSource: 0,
    duplicate: 0,
  };
  for (const row of previewRows) counts[row.outcome] += 1;

  return { rows: previewRows, counts, sourceRows: rows };
}

/**
 * Payload enviado à função atômica do banco, já reduzido aos e-mails
 * selecionados pelo administrador.
 */
export function buildImportPayload(
  preview: ProfessionalProfileImportPreview,
  selectedEmails: string[],
  overwrite: boolean
): Array<{
  email: string;
  name: string | null;
  role: string | null;
  area: string | null;
  phone: string | null;
  joinedOn: string | null;
  slug: string | null;
  overwrite: boolean;
}> {
  const selected = new Set(selectedEmails.map(normalizeEmail));
  const rowsByEmail = new Map(preview.rows.map((row) => [normalizeEmail(row.email), row]));
  const sourceByEmail = new Map(
    preview.sourceRows.map((row) => [normalizeEmail(row.email), row])
  );

  const payload: Array<{
    email: string;
    name: string | null;
    role: string | null;
    area: string | null;
    phone: string | null;
    joinedOn: string | null;
    slug: string | null;
    overwrite: boolean;
  }> = [];

  for (const email of selected) {
    const row = rowsByEmail.get(email);
    if (!row) continue;
    // Linha sem correspondência ou duplicada nunca vira escrita.
    if (row.outcome === "unmatched" || row.outcome === "duplicate") continue;
    // Telefone entra como candidato privado (show_whatsapp nasce desligado) e
    // a admissão alimenta o tempo de casa — ambos só para linhas selecionadas.
    const source = sourceByEmail.get(email);
    payload.push({
      email: row.email,
      name: row.name,
      role: row.role,
      area: row.area,
      phone: source?.phone ?? null,
      joinedOn: source?.joinedOn ?? null,
      slug: row.slug,
      overwrite,
    });
  }

  return payload;
}
