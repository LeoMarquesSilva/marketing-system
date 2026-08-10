/**
 * Atualiza cargo/área dos perfis do NFC Hub a partir da planilha
 * "Lista de Colaboradores.xlsx" enviada pelo usuário (versão "totalmente
 * atualizada" de cargo/área).
 *
 * O cargo da planilha vem em CAIXA ALTA e sem tentar resolver gênero
 * (ex.: "ADVOGADO(A) PLENO"). Normalizamos para Title Case preservando o
 * sufixo inclusivo "(a)" tal como a própria planilha já sinaliza — nunca
 * adivinhamos o gênero da pessoa por conta própria (uma tentativa anterior
 * com regex de flexão produziu erro gramatical real, ex. "Advogadoo").
 *
 * Área usa o mesmo mapeamento department->practice_area já usado no resto
 * do sistema (verificado contra Fernanda Camolesi/Daniela/Ana). Gustavo e
 * Ricardo mantêm a área mais específica já curada manualmente, em vez de
 * ser rebaixada para o rótulo genérico "Sócio".
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { getProfessionalProfileAdmin, saveProfessionalProfile } from "@/lib/profiles/admin";
import { createProfileAdminClient } from "@/lib/profiles/admin";

const ACTOR_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8"; // Leonardo Marques (admin)
const SHEET_PATH = "C:/Users/Leonardo Marques/Downloads/Lista de Colaboradores.xlsx";
const DRY_RUN = process.env.DRY_RUN === "1";

const AREA_MAP: Record<string, string> = {
  "CÍVEL": "Cível",
  "TRABALHISTA": "Trabalhista",
  "REESTRUTURAÇÃO": "Reestruturação",
  "RECUPERAÇÃO CRÉDITO": "Recuperação de Crédito",
  "OPERAÇÕES LEGAIS": "Operações Legais",
  "SÓCIO": "Sócio",
  "CONTRATOS E SOCIETÁRIO": "Societário e Contratos",
};

const PRACTICE_AREA_LABEL: Record<string, string> = {
  "Cível": "Cível",
  "Trabalhista": "Trabalhista",
  "Reestruturação": "Reestruturação e Insolvência",
  "Recuperação de Crédito": "Recuperação de Crédito",
  "Operações Legais": "Operações Legais",
  "Societário e Contratos": "Societário e Contratos",
  "Sócio": "Sócio",
};

const PRESERVE_AREA = new Set(["gustavo bismarchi motta", "ricardo viscardi pires"]);

const TITLE_CASE_EXCEPTIONS = new Set(["de", "da", "do", "das", "dos", "e", "em"]);
const TYPO_FIXES: Array<[RegExp, string]> = [
  [/\bFINACEIRO\b/gi, "FINANCEIRO"],
  [/\bJURIDIC(O|A)\b/gi, "JURÍDIC$1"],
  [/\bESTAGIARI(O|A)\b/gi, "ESTAGIÁRI$1"],
  [/\bJUNIOR\b/gi, "JÚNIOR"],
];

function normalizeCargo(raw: string): string {
  let text = raw.trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of TYPO_FIXES) text = text.replace(pattern, replacement);

  return text
    .split(" ")
    .map((word) => {
      const suffixMatch = word.match(/^(\p{L}+)\((A)\)$/u);
      if (suffixMatch) {
        const root = suffixMatch[1].toLowerCase();
        return `${root.charAt(0).toUpperCase()}${root.slice(1)}(a)`;
      }
      const lower = word.toLowerCase();
      if (TITLE_CASE_EXCEPTIONS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

interface SheetPerson {
  nome: string;
  areaRaw: string;
  cargoRaw: string;
  email: string;
}

function readSheet(): SheetPerson[] {
  const buffer = readFileSync(SHEET_PATH);
  const book = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["Planilha1"], {
    header: 1,
    defval: null,
    raw: false,
  });
  return rows
    .slice(1)
    .filter((r) => r[1] && String(r[1]).trim())
    .map((r) => ({
      nome: String(r[1]).trim(),
      areaRaw: String(r[2] ?? "").trim(),
      cargoRaw: String(r[3] ?? "").trim(),
      email: String(r[13] ?? "").trim().toLowerCase(),
    }));
}

async function main() {
  const people = readSheet();
  const db = createProfileAdminClient();
  // professional_profiles tem 3 FKs pra users (user_id/created_by/updated_by):
  // precisa nomear a constraint, senão o PostgREST rejeita o embed por ambiguidade.
  const { data: profileRows, error: profileError } = await db
    .from("professional_profiles")
    .select("id, user_id, users!professional_profiles_user_id_fkey(email)");
  if (profileError) throw new Error("Falha ao listar perfis: " + profileError.message);

  type Row = { id: string; user_id: string; users: { email: string | null } | { email: string | null }[] | null };
  const profileIdByEmail = new Map<string, string>();
  for (const row of (profileRows ?? []) as unknown as Row[]) {
    const userRel = Array.isArray(row.users) ? row.users[0] : row.users;
    const email = userRel?.email?.trim().toLowerCase();
    if (email) profileIdByEmail.set(email, row.id);
  }

  let updated = 0;
  let unchanged = 0;
  let semPerfil = 0;

  for (const p of people) {
    const profileId = profileIdByEmail.get(p.email);
    if (!profileId) {
      semPerfil += 1;
      continue;
    }

    const detail = await getProfessionalProfileAdmin(profileId);
    const currentPt = detail.localizations.find((l) => l.locale === "pt-BR");
    const dept = AREA_MAP[p.areaRaw] ?? null;
    const cargoNormalizado = normalizeCargo(p.cargoRaw);
    const areaFinal = PRESERVE_AREA.has(p.nome.toLowerCase())
      ? (currentPt?.practiceArea ?? null)
      : dept
        ? (PRACTICE_AREA_LABEL[dept] ?? dept)
        : (currentPt?.practiceArea ?? null);

    const roleChanged = cargoNormalizado !== (currentPt?.role ?? "");
    const areaChanged = areaFinal !== (currentPt?.practiceArea ?? null);

    if (!roleChanged && !areaChanged) {
      unchanged += 1;
      continue;
    }

    console.log(
      `${DRY_RUN ? "[faria]" : "[fazendo]"} ${p.nome}` +
        (roleChanged ? ` | cargo: "${currentPt?.role}" -> "${cargoNormalizado}"` : "") +
        (areaChanged ? ` | área: "${currentPt?.practiceArea}" -> "${areaFinal}"` : "")
    );

    if (DRY_RUN) continue;

    await saveProfessionalProfile(
      profileId,
      {
        localizations: [
          {
            locale: "pt-BR",
            role: cargoNormalizado,
            practiceArea: areaFinal,
          },
        ],
      },
      ACTOR_ID
    );
    updated += 1;
  }

  console.log("\n=== RESUMO ===");
  console.log(`${DRY_RUN ? "Atualizariam" : "Atualizados"}: ${DRY_RUN ? "-" : updated}`);
  console.log(`Já corretos: ${unchanged}`);
  console.log(`Sem perfil no NFC Hub: ${semPerfil}`);
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
