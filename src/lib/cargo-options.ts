/**
 * Opções pré-definidas de cargo/função para contatos e pessoas de clientes,
 * usadas no preenchimento em "Meus Clientes".
 */
export const CARGO_OPTIONS = [
  "Sócio(a) / Proprietário(a)",
  "Diretor(a)",
  "Gerente",
  "Coordenador(a)",
  "Financeiro",
  "Jurídico / Compliance",
  "Recursos Humanos",
  "Contabilidade",
  "Assistente / Secretário(a)",
  "Outro",
] as const;

export const CARGO_OUTRO = "Outro";

/**
 * Resolve o valor salvo de cargo para a opção do select: se bater com uma
 * opção conhecida usa ela, senão cai em "Outro" (mantendo o texto original
 * para exibir no campo de detalhe).
 */
export function resolveCargoOption(cargo: string | null | undefined): string {
  if (!cargo) return "";
  const trimmed = cargo.trim();
  if (!trimmed) return "";
  return (CARGO_OPTIONS as readonly string[]).includes(trimmed) ? trimmed : CARGO_OUTRO;
}
