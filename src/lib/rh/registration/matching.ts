import { onlyDigits } from "@/lib/masks-br";
import type { RegistrationMatchSuggestion } from "./types";

/**
 * Sugestão de vínculo entre a ficha cadastral (respondida antes do VIOS) e o
 * colaborador criado pelo sync. O VIOS não traz CPF e o e-mail corporativo
 * ainda não existia quando a pessoa respondeu, então só sobra nome (e o CPF,
 * quando a RH já o digitou na ficha do colaborador). Sempre é sugestão: a RH
 * confirma, nunca vinculamos sozinhos — homônimos misturariam dados bancários.
 */

const NAME_PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

export function nameTokens(value: string | null | undefined): string[] {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !NAME_PARTICLES.has(token));
}

/** 0 = sem relação; 1 = mesmo nome. Limiar de sugestão: 0.75. */
export function scoreNameMatch(a: string | null | undefined, b: string | null | undefined): number {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (left.length === 0 || right.length === 0) return 0;
  if (left.join(" ") === right.join(" ")) return 1;
  if (left[0] !== right[0]) return 0;

  const rightSet = new Set(right);
  const shared = left.filter((token) => rightSet.has(token)).length;
  const sameLast = left[left.length - 1] === right[right.length - 1];
  const shorter = Math.min(left.length, right.length);

  // Um nome contido no outro ("Ana Souza" ⊂ "Ana Paula Lima Souza").
  if (shared === shorter && shorter >= 2) return sameLast ? 0.9 : 0.8;
  if (sameLast) return 0.85;
  if (shared >= 2) return 0.75;
  return 0;
}

export const NAME_MATCH_THRESHOLD = 0.75;

export interface MatchCandidate {
  id: string;
  full_name: string;
  cpf: string | null;
  department: string | null;
  position: string | null;
}

export function suggestRegistrationMatches(
  form: { names: (string | null | undefined)[]; cpf: string | null | undefined },
  candidates: MatchCandidate[],
  limit = 3
): RegistrationMatchSuggestion[] {
  const cpf = onlyDigits(form.cpf ?? "");
  const suggestions: RegistrationMatchSuggestion[] = [];

  for (const candidate of candidates) {
    const candidateCpf = onlyDigits(candidate.cpf ?? "");
    if (cpf.length === 11 && candidateCpf === cpf) {
      suggestions.push({
        employeeId: candidate.id,
        fullName: candidate.full_name,
        department: candidate.department,
        position: candidate.position,
        reason: "cpf",
        score: 1.1,
      });
      continue;
    }
    // CPF diferente já preenchido: é outra pessoa, mesmo com nome igual.
    if (cpf.length === 11 && candidateCpf.length === 11) continue;

    const score = Math.max(...form.names.map((name) => scoreNameMatch(name, candidate.full_name)));
    if (score >= NAME_MATCH_THRESHOLD) {
      suggestions.push({
        employeeId: candidate.id,
        fullName: candidate.full_name,
        department: candidate.department,
        position: candidate.position,
        reason: "nome",
        score,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName, "pt-BR"))
    .slice(0, limit);
}
