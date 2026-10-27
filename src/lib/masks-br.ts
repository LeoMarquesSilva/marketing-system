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

/** Telefone: (11) 99999-9999 ou (11) 9999-9999. */
export function maskPhoneBR(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Agência bancária: 0000 ou 0000-0 (dígito pode ser X). */
export function maskBankAgency(rawValue: string): string {
  const cleaned = rawValue.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 5);
  return cleaned.length === 5 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}

/** Conta bancária: número com o último caractere como dígito (ex.: 12345-6; dígito pode ser X). */
export function maskBankAccount(rawValue: string): string {
  const cleaned = rawValue.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 14);
  return cleaned.length >= 2 ? `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}` : cleaned;
}

/** Nome de pessoa: sem números nem símbolos (mantém acentos, apóstrofo, hífen e ponto). */
export function maskPersonName(rawValue: string): string {
  return rawValue.replace(/[^\p{L}\s'’.-]/gu, "").replace(/\s{2,}/g, " ").slice(0, 120);
}

/** E-mail: minúsculo e sem espaços. */
export function maskEmail(rawValue: string): string {
  return rawValue.replace(/\s/g, "").toLowerCase().slice(0, 120);
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

/** CNPJ: 00.000.000/0000-00. */
export function maskCNPJ(rawValue: string): string {
  const digits = onlyDigits(rawValue).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** CPF até 11 dígitos, CNPJ a partir do 12º (campo único de fornecedor). */
export function maskCpfCnpj(rawValue: string): string {
  return onlyDigits(rawValue).length > 11 ? maskCNPJ(rawValue) : maskCPF(rawValue);
}

/** Valida CNPJ pelos dígitos verificadores. */
export function isValidCNPJ(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcDigit = (base: string) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(base[i]) * weight, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calcDigit(cnpj.slice(0, 12)) === Number(cnpj[12]) && calcDigit(cnpj.slice(0, 13)) === Number(cnpj[13]);
}
