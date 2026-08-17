/** Máscaras e validadores brasileiros (CPF, CEP, RG, OAB). */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCPF(rawValue: string): string {
  const digits = onlyDigits(rawValue).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskCEP(rawValue: string): string {
  const digits = onlyDigits(rawValue).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** RG: mantém dígitos e X final; formata como XX.XXX.XXX-X quando possível. */
export function maskRG(rawValue: string): string {
  const cleaned = rawValue
    .toUpperCase()
    .replace(/[^0-9X]/g, "")
    .slice(0, 12);
  const digits = cleaned.replace(/X/g, "");
  const hasX = cleaned.includes("X");
  const body = digits.slice(0, 9);
  let formatted = body;
  if (body.length > 2) formatted = `${body.slice(0, 2)}.${body.slice(2)}`;
  if (body.length > 5) formatted = `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5)}`;
  if (body.length > 8) {
    formatted = `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5, 8)}-${body.slice(8)}`;
  }
  if (hasX && body.length >= 8) {
    if (body.length === 8) formatted = `${formatted}-X`;
    else if (!formatted.endsWith("X")) formatted = `${formatted.slice(0, -1)}X`;
  }
  return formatted;
}

/** OAB: apenas dígitos com pontos de milhar (ex.: 497.646). */
export function maskOAB(rawValue: string): string {
  const digits = onlyDigits(rawValue).slice(0, 8);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, digits.length - 3)}.${digits.slice(-3)}`;
  }
  return `${digits.slice(0, digits.length - 3)}.${digits.slice(-3)}`;
}

export function formatCPF(digits: string | null | undefined): string {
  if (!digits) return "";
  return maskCPF(digits);
}

export function formatCEP(digits: string | null | undefined): string {
  if (!digits) return "";
  return maskCEP(digits);
}

/** Valida CPF pelos dígitos verificadores. */
export function isValidCPF(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factor - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}
