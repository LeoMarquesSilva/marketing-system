/**
 * "Já falamos disso?": acha, entre os posts do Instagram e as matérias que a
 * equipe já escolheu, os assuntos parecidos com uma notícia nova. É só a
 * pré-seleção (barata, local); quem decide se é repetição ou desdobramento
 * (fato novo no mesmo caso) é a IA, na nota de potencial.
 */

export type RelatedKind = "novo" | "repetido" | "desdobramento";

/** Quem fez o post (vínculo do Instagram) ou escolheu a matéria: recebe o aviso de desdobramento. */
export interface RelatedPerson {
  id: string;
  name: string;
}

export interface RelatedCandidate {
  source: "instagram" | "roteiro";
  id: string;
  title: string;
  text: string;
  url: string | null;
  date: string | null;
  people?: RelatedPerson[];
}

export interface RelatedRef {
  source: "instagram" | "roteiro";
  id: string;
  title: string;
  url: string | null;
  date: string | null;
  people?: RelatedPerson[];
}

export interface RankedCandidate {
  candidate: RelatedCandidate;
  score: number;
  shared: string[];
}

/** Palavras que aparecem em quase toda notícia jurídica e não identificam o assunto. */
const STOP_WORDS = new Set(
  (
    "a ao aos as com como da das de do dos e em entre na nas no nos o os ou para pela pelas pelo pelos por que se sem sob sobre " +
    "um uma uns umas mais menos muito ja nao sim ser foi sao esta este essa esse isso pode podem deve devem tem ter apos ate " +
    "seu sua seus suas ela ele eles elas quando onde qual quais quem novo nova novos novas veja entenda saiba confira " +
    "tempo leitura minutos minuto empresa empresas direito juridico juridica justica lei leis caso casos decisao decide " +
    "tribunal processo acao judicial advogado advogados advocacia brasil brasileiro brasileira ano anos dia dias " +
    // Siglas de tribunal e verbos de manchete aparecem em quase tudo e não dizem qual é o caso.
    "stf stj tst tse trt trf tjsp tjmg tjrj tjrs tjpr cnj oab autoriza autorizou pede pedido entra nega mantem " +
    "aprova aprovado reconhece afasta determina condena garante permite define discute debate etapa grupo papel"
  ).split(/\s+/),
);

const SOURCE_SUFFIX = /\s+[-–|]\s+([^-–|]{2,40})$/;

/** Tira o " - Veículo" que o Google Notícias põe no fim da manchete. */
export function stripSourceSuffix(title: string): string {
  return title.replace(SOURCE_SUFFIX, "").trim();
}

/**
 * Manchete e resumo sem o nome do veículo: o Google Notícias repete o veículo
 * no fim do resumo também ("… Valor Econômico"), e isso não é assunto.
 */
export function withoutSource(title: string, text?: string | null): { title: string; text: string } {
  const source = SOURCE_SUFFIX.exec(title)?.[1]?.trim();
  let cleanText = text ?? "";
  if (source) cleanText = cleanText.split(source).join(" ");
  return { title: stripSourceSuffix(title), text: cleanText };
}

/**
 * Nomes próprios (empresa, caso, norma): palavra com maiúscula fora do início
 * da frase, ou sigla. É o que diz "qual caso" — pesa mais na comparação.
 */
export function entityTerms(...values: Array<string | null | undefined>): Set<string> {
  const { names, acronyms } = entityKinds(...values);
  return new Set([...names, ...acronyms]);
}

/** Nomes (Xuxa, Casas Bahia) e siglas (ISS, LGPD) separados: sigla de lei sozinha não identifica um caso. */
function entityKinds(...values: Array<string | null | undefined>): { names: Set<string>; acronyms: Set<string> } {
  const names = new Set<string>();
  const acronyms = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const sentence of value.split(/[.!?:\n]+/)) {
      const words = sentence.trim().split(/\s+/);
      words.forEach((word, index) => {
        const clean = word.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
        if (!clean) return;
        const isAcronym = /^[A-Z\d]{2,}(?:-\d+)?$/.test(clean) && /[A-Z]/.test(clean);
        const isName = index > 0 && /^\p{Lu}\p{Ll}+/u.test(clean);
        if (!isAcronym && !isName) return;
        for (const term of subjectTerms(clean)) (isAcronym ? acronyms : names).add(term);
      });
    }
  }
  return { names, acronyms };
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // "NR-1", "Lei 14.112" e "6x1" viram um termo só.
    .replace(/\b([a-z]{1,4})[-\s](\d{1,3})\b/g, "$1$2")
    .replace(/(\d)\.(\d)/g, "$1$2");
}

/** Termos que identificam o assunto (sem acento, sem palavras genéricas). */
export function subjectTerms(...values: Array<string | null | undefined>): Set<string> {
  const terms = new Set<string>();
  for (const word of normalize(values.filter(Boolean).join(" ")).split(/[^a-z0-9]+/)) {
    if (word.length < 3 && !/\d/.test(word)) continue;
    if (/^\d{1,2}$/.test(word)) continue;
    if (STOP_WORDS.has(word)) continue;
    terms.add(word);
  }
  return terms;
}

/**
 * Ordena os candidatos pela parte do assunto da notícia que eles cobrem,
 * dando mais peso a termos raros (nome de empresa, número de lei) do que a
 * termos comuns ("recuperação"). Devolve os mais próximos acima do mínimo.
 */
export function rankRelatedCandidates(
  item: { title: string; snippet?: string | null },
  candidates: RelatedCandidate[],
  options: { limit?: number; minScore?: number } = {},
): RankedCandidate[] {
  const limit = options.limit ?? 4;
  const minScore = options.minScore ?? 0.3;
  const cleanItem = withoutSource(item.title, item.snippet);
  const itemTerms = subjectTerms(cleanItem.title, cleanItem.text);
  const itemEntities = entityTerms(cleanItem.title, cleanItem.text);
  if (itemTerms.size === 0 || candidates.length === 0) return [];

  const candidateTerms = candidates.map((candidate) => {
    const clean = withoutSource(candidate.title, candidate.text);
    return subjectTerms(clean.title, clean.text);
  });
  const documentFrequency = new Map<string, number>();
  for (const terms of candidateTerms) {
    for (const term of terms) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const total = candidates.length;
  // Termo raro pesa mais (IDF); nome próprio pesa o dobro.
  const weight = (term: string) =>
    Math.log(1 + total / (1 + (documentFrequency.get(term) ?? 0))) * (itemEntities.has(term) ? 2 : 1);
  const itemWeight = [...itemTerms].reduce((sum, term) => sum + weight(term), 0);
  if (itemWeight === 0) return [];

  return candidates
    .map((candidate, index) => {
      const shared = [...itemTerms].filter((term) => candidateTerms[index].has(term));
      const score = shared.reduce((sum, term) => sum + weight(term), 0) / itemWeight;
      return { candidate, score: Math.round(score * 1000) / 1000, shared };
    })
    // Precisa dividir um nome próprio (o mesmo caso) ou boa parte do assunto. Um nome só
    // basta quando identifica sozinho: norma/lei com número (NR-1, 6x1) ou nome raro (empresa).
    .filter((entry) => {
      const strongEntity = entry.shared.some(
        (term) => itemEntities.has(term) && (/\d/.test(term) || (documentFrequency.get(term) ?? 0) <= 2),
      );
      const broadMatch =
        entry.shared.length >= 2 &&
        entry.score >= minScore &&
        (entry.shared.some((term) => itemEntities.has(term)) || entry.score >= 0.45);
      return broadMatch || (strongEntity && entry.score >= 0.2);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function toRelatedRef(candidate: RelatedCandidate): RelatedRef {
  return {
    source: candidate.source,
    id: candidate.id,
    title: candidate.title,
    url: candidate.url,
    date: candidate.date,
    ...(candidate.people?.length ? { people: candidate.people } : {}),
  };
}

/** Termos de uma manchete para comparar "mesma notícia em outro veículo". */
export interface StoryTerms {
  terms: Set<string>;
  names: Set<string>;
  acronyms: Set<string>;
}

export function storyTerms(title: string): StoryTerms {
  const clean = stripSourceSuffix(title);
  return { terms: subjectTerms(clean), ...entityKinds(clean) };
}

/**
 * A mesma notícia publicada por outro veículo (ex.: "STJ reduz indenização por
 * plágio contra empresa de Xuxa" no Jurinews e "STJ ajusta cálculo de indenização
 * … de Xuxa" no Migalhas). Exige um nome próprio (ou duas siglas) em comum e boa
 * parte do assunto, ou quase tudo igual. Não junta dois vazamentos de dados de
 * empresas diferentes nem dois artigos que só falam de LGPD.
 */
export function isSameStory(a: StoryTerms, b: StoryTerms): boolean {
  const smaller = Math.min(a.terms.size, b.terms.size);
  if (smaller === 0) return false;
  const shared = [...a.terms].filter((term) => b.terms.has(term));
  const coverage = shared.length / smaller;
  const sharedNames = shared.filter((term) => a.names.has(term) && b.names.has(term)).length;
  const sharedAcronyms = shared.filter((term) => a.acronyms.has(term) && b.acronyms.has(term)).length;
  const sameCase = sharedNames >= 1 || sharedAcronyms >= 2;
  return (sameCase && shared.length >= 3 && coverage >= 0.5) || (shared.length >= 4 && coverage >= 0.8);
}

/** Pessoas distintas, sem vazios (o vínculo do Instagram às vezes repete a mesma pessoa). */
export function uniquePeople(people: Array<RelatedPerson | null | undefined>): RelatedPerson[] {
  const seen = new Map<string, RelatedPerson>();
  for (const person of people) {
    if (person?.id && !seen.has(person.id)) seen.set(person.id, { id: person.id, name: person.name?.trim() || "Sem nome" });
  }
  return [...seen.values()];
}

function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "data não registrada";
}

/** Lista numerada que entra no prompt da nota, para a IA comparar. */
export function relatedCandidatesBlock(ranked: RankedCandidate[]): string {
  if (ranked.length === 0) return "";
  return [
    "JÁ PUBLICAMOS OU ESCOLHEMOS ANTES (compare com a notícia):",
    ...ranked.map(({ candidate }, index) => {
      const origin = candidate.source === "instagram" ? "post no nosso Instagram" : "matéria escolhida pela equipe";
      const text = candidate.text && candidate.text !== candidate.title ? ` — ${candidate.text.slice(0, 280)}` : "";
      return `[${index + 1}] ${origin} em ${shortDate(candidate.date)}: ${candidate.title}${text}`;
    }),
  ].join("\n");
}

/** Orientação para o carrossel quando a notícia continua (ou repete) um assunto nosso. */
export function relatedCarouselGuidance(kind: RelatedKind | null | undefined, ref: RelatedRef | null | undefined, note?: string | null): string {
  if (!ref || !kind || kind === "novo") return "";
  const when = shortDate(ref.date);
  if (kind === "desdobramento") {
    return [
      `CONTINUAÇÃO DE UM ASSUNTO NOSSO: já publicamos sobre isso em ${when} ("${ref.title}").`,
      "Escreva como atualização: situe o leitor em uma frase (ex.: \"Atualização:\" ou \"Lembra de…?\") e foque no que mudou desde então.",
      note ? `O que há de novo: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return `ASSUNTO JÁ ABORDADO em ${when} ("${ref.title}"): traga um ângulo diferente e não repita a abordagem anterior.`;
}
