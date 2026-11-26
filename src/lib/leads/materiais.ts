/**
 * Vocabulário comum dos materiais de produto (e-books com formulário): quem é a pessoa, de onde veio
 * e os passos do funil. Usado pela página pública, pelas APIs e pela aba Materiais do E-mail marketing.
 */

export type Perfil = "empresario" | "rh" | "contador_advogado" | "funcionario";

/** "Você é:" — uma escolha de um toque que separa cliente em potencial de curioso. */
export const PERFIS: { valor: Perfil; rotulo: string }[] = [
  { valor: "empresario", rotulo: "Empresário(a) ou sócio(a)" },
  { valor: "rh", rotulo: "RH ou gestor(a)" },
  { valor: "contador_advogado", rotulo: "Contador(a) ou advogado(a)" },
  { valor: "funcionario", rotulo: "Funcionário(a)" },
];

export const PERFIL_ROTULO: Record<Perfil, string> = Object.fromEntries(PERFIS.map((p) => [p.valor, p.rotulo])) as Record<
  Perfil,
  string
>;

export function ehPerfil(valor: unknown): valor is Perfil {
  return PERFIS.some((p) => p.valor === valor);
}

export type Origem = "email" | "whatsapp" | "instagram" | "linkedin" | "site" | "direto";

export const ORIGEM_ROTULO: Record<Origem, string> = {
  instagram: "Instagram",
  email: "E-mail",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  site: "Site",
  direto: "Direto",
};

/**
 * Origem pelo ?origem= do link e, sem ele, pelo utm_source (o Linktree marca "linktree" quando o UTM
 * está ligado, e o Linktree do escritório fica na bio do Instagram).
 */
export function normalizarOrigem(origem?: string | null, utm?: string | null): Origem | null {
  const o = origem?.trim().toLowerCase();
  if (o === "instagram" || o === "ig" || o === "linktree") return "instagram";
  if (o === "whatsapp" || o === "linkedin" || o === "site" || o === "email") return o;
  const u = utm?.trim().toLowerCase();
  if (!u) return null;
  if (u.includes("linktree") || u.includes("instagram") || u === "ig") return "instagram";
  if (u.includes("linkedin")) return "linkedin";
  if (u.includes("whatsapp")) return "whatsapp";
  return null;
}

export type EventoMaterial = "visita" | "inicio" | "lead" | "download" | "qualificacao";

/** Eventos que a página manda sozinha (os outros nascem no servidor). */
export const EVENTOS_DA_PAGINA: EventoMaterial[] = ["visita", "inicio"];

/** Só dígitos; aceita +55 e devolve DDD + número (10 ou 11 dígitos). */
export function normalizarTelefone(valor: string | null | undefined): string | null {
  let digits = (valor ?? "").replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

/** "11912345678" → "(11) 91234-5678". */
export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
