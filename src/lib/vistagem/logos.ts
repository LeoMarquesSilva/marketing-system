import { chaveNome } from "./agendamento";

/** Chave do grupo para achar o logo: sem acento, em caixa alta e sem o "Grupo" do começo ("Grupo Ádamo" → "ADAMO"). */
export function chaveGrupo(nome: string | null | undefined): string {
  return chaveNome(nome).replace(/^GRUPO\s+/, "");
}

/** Iniciais do grupo para quando não há logo: "Grupo Rápido 900" → "R9", "Grupo CDA" → "CD". */
export function iniciaisDoGrupo(nome: string): string {
  const palavras = nome
    .replace(/^grupo\s+/i, "")
    .split(/[\s&./-]+/)
    .filter((palavra) => /^[\p{L}\d]/u.test(palavra));
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return palavras
    .slice(0, 2)
    .map((palavra) => palavra[0])
    .join("")
    .toUpperCase();
}
