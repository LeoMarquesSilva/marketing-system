/**
 * Helpers de moeda BRL para inputs (pt-BR).
 * Evita o bug de `type="number"` onde "2.323" vira 2.32.
 */

/** Converte texto digitado/colado (pt-BR ou US) em número em reais. */
export function parseBrlInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // 2.323,20 → milhares com ponto, decimal com vírgula
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // 2323,20 ou 38,72
    s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    // 2.323 → milhares BR (último grupo com 3 dígitos e mais de um grupo)
    // 2323.20 → decimal US
    if (parts.length > 2) {
      s = parts.join("");
    } else if (parts.length === 2 && parts[1]!.length === 3 && parts[0]!.length <= 3) {
      // Ambíguo: "2.323" (mil) vs "2.320" (2 + 320 centavos?). Em PT-BR,
      // três dígitos após o ponto sem vírgula = milhares.
      s = parts.join("");
    }
    // senão mantém ponto decimal US (2323.20)
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Formata dígitos em centavos para exibição R$ X.XXX,XX. */
export function formatBrlInput(centsDigits: string): string {
  const digits = centsDigits.replace(/\D/g, "");
  if (!digits) return "";
  const value = Number(digits) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Número em reais → apenas dígitos de centavos (para máscara). */
export function numberToCentsDigits(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "";
  return String(Math.round(Math.abs(value) * 100));
}

/** Número em reais → string canônica "2323.20" para formulários. */
export function brlNumberToFormString(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}
