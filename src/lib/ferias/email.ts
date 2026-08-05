/**
 * Normaliza e-mail para match RH ↔ VIOS.
 * `bpplaw.com.br` e `bismarchipires.com.br` são tratados como o mesmo domínio.
 */
export function normalizeHrEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.endsWith("@bismarchipires.com.br")) {
    return `${normalized.slice(0, -"@bismarchipires.com.br".length)}@bpplaw.com.br`;
  }
  if (normalized.endsWith("@bismarchipires.com")) {
    return `${normalized.slice(0, -"@bismarchipires.com".length)}@bpplaw.com.br`;
  }
  return normalized;
}

export function hrEmailsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizeHrEmail(a);
  const right = normalizeHrEmail(b);
  return Boolean(left && right && left === right);
}
