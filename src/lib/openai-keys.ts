/**
 * Uma chave da OpenAI por categoria do sistema, para o painel de uso da OpenAI
 * mostrar onde vai o gasto. Sem a chave da categoria, usa a chave geral
 * (NEXT_OPENAI_API_KEY ou OPENAI_API_KEY), então dá para trocar aos poucos.
 */
export const OPENAI_KEY_ENV = {
  conteudo: "OPENAI_API_KEY_CONTEUDO",
  atendimento: "OPENAI_API_KEY_ATENDIMENTO",
  pessoas: "OPENAI_API_KEY_PESSOAS",
  relacionamento: "OPENAI_API_KEY_RELACIONAMENTO",
  facilities: "OPENAI_API_KEY_FACILITIES",
  operacoes: "OPENAI_API_KEY_OPERACOES",
} as const;

export type OpenAIKeyCategory = keyof typeof OPENAI_KEY_ENV;

export function openAIKey(category: OpenAIKeyCategory): string | null {
  return (
    process.env[OPENAI_KEY_ENV[category]]?.trim() ||
    process.env.NEXT_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    null
  );
}
