/** Título normalizado para dedupe/histórico — mesma ideia do pipeline institucional. */
export function normalizeTitleKey(title: string): string {
  return (title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+[-–|]\s+[^-–|]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 12)
    .join(" ");
}

/**
 * Separa um post de LinkedIn em gancho (primeiro parágrafo) e o restante.
 * Sem linha em branco no texto, não presume que tudo é gancho descartável:
 * devolve o texto inteiro como `hook` e `rest` vazio.
 */
export function splitLinkedInBlocks(text: string | null | undefined): {
  hook: string;
  rest: string;
} {
  const normalized = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return { hook: "", rest: "" };
  const match = normalized.match(/^([\s\S]*?)\n\s*\n([\s\S]*)$/);
  if (match) {
    return { hook: match[1].trim(), rest: match[2].trim() };
  }
  return { hook: normalized, rest: "" };
}

/**
 * Aplica um gancho alternativo preservando o desenvolvimento do post.
 * Post de um parágrafo só vira corpo sob o novo gancho, em vez de ser apagado.
 * Aplicações sucessivas não acumulam aberturas: sempre parte do estado atual.
 */
export function applyAlternativeHook(
  current: string | null | undefined,
  hook: string | null | undefined
): string {
  const normalizedHook = (hook ?? "").replace(/\r\n/g, "\n").trim();
  const { hook: currentHook, rest } = splitLinkedInBlocks(current);
  if (!currentHook) return normalizedHook;
  if (rest) return `${normalizedHook}\n\n${rest}`;
  return `${normalizedHook}\n\n${currentHook}`;
}

/** Normaliza apenas hashtags, preservando nomes, siglas e fragmentos de URLs. */
export function lowercaseHashtags(text: string): string {
  return text.replace(
    /(^|[^\p{L}\p{M}\p{N}_/#])#([\p{L}\p{M}\p{N}_]+)/gu,
    (_match, prefix: string, tag: string) => `${prefix}#${tag.toLocaleLowerCase("pt-BR")}`
  );
}

/** Aplica regras mecânicas que não podem depender da obediência do modelo. */
export function normalizeGeneratedText(text: string): string {
  return lowercaseHashtags(text).replace(/\s*[—–]\s*/gu, ", ");
}

/** Monta o post final garantindo que o gancho seja sempre a primeira parte. */
export function assembleLinkedInPost(input: {
  hook: string;
  body: string[];
  closing?: string | null;
  hashtags?: string[] | null;
}): string {
  const parts = [
    input.hook.trim(),
    ...input.body.map((paragraph) => paragraph.trim()).filter(Boolean),
  ];
  if (input.closing?.trim()) parts.push(input.closing.trim());
  if (input.hashtags?.length) {
    parts.push(
      input.hashtags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .join(" ")
    );
  }
  return normalizeGeneratedText(parts.filter(Boolean).join("\n\n"));
}
