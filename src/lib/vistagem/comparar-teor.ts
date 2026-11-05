/**
 * Comparação de dois textos de publicação para a conferência de duplicidade: as cópias de um mesmo despacho
 * (uma para cada parte intimada) costumam mudar só o nome do intimado e um ou outro trecho. Compara por frase,
 * sem diferenciar maiúsculas, acentos e espaços, e devolve o que só aparece em cada lado.
 */

export interface Trecho {
  texto: string;
  /** Não aparece no outro texto. */
  diferente: boolean;
}

export interface ComparacaoTeor {
  /** Mesmo texto, palavra por palavra (ignorando maiúsculas, acentos, espaços e a pontuação das pontas). */
  iguais: boolean;
  /** Parte das palavras em comum (0 a 1), pelo maior dos dois textos (por frase, nos textos muito grandes). */
  semelhanca: number;
  /** Trechos pintados na tela (nos dois textos): o que muda entre a principal e a cópia. */
  trechosDiferentes: number;
  /** Frases que só aparecem na principal / só na cópia. */
  soNaPrincipal: string[];
  soNaCopia: string[];
}

/** Sem acento, minúsculas, espaços simples e sem pontuação nas pontas: "Intime-se." e "intime-se" são iguais. */
export function chaveDaFrase(frase: string): string {
  return frase
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:–—-]+|[\s.,;:–—-]+$/g, "")
    .trim();
}

/**
 * Quebra o texto em frases (ponto, ponto e vírgula, interrogação ou exclamação seguidos de espaço, e quebra de
 * linha), mantendo a pontuação na frase. Números como "1.000,00" e "art. 5º" não quebram (o ponto não tem espaço
 * depois ou a palavra é curta).
 */
export function frasesDoTexto(texto: string): string[] {
  const frases: string[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const partes = linha.split(/(?<=[.;!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(])/);
    for (const parte of partes) {
      const frase = parte.trim();
      if (frase) frases.push(frase);
    }
  }
  return frases;
}

export function compararTeor(principal: string, copia: string): ComparacaoTeor {
  const frasesA = frasesDoTexto(principal);
  const frasesB = frasesDoTexto(copia);
  const chavesA = new Set(frasesA.map(chaveDaFrase).filter(Boolean));
  const chavesB = new Set(frasesB.map(chaveDaFrase).filter(Boolean));
  const soNaPrincipal = frasesA.filter((frase) => chaveDaFrase(frase) && !chavesB.has(chaveDaFrase(frase)));
  const soNaCopia = frasesB.filter((frase) => chaveDaFrase(frase) && !chavesA.has(chaveDaFrase(frase)));
  // O resumo conta como a tela pinta: palavra a palavra (por frase só nos textos enormes).
  const trechosDiferentes = [marcarDiferencas(principal, copia), marcarDiferencas(copia, principal)]
    .flat(2)
    .filter((trecho) => trecho.diferente).length;
  const palavrasA = principal.split(/\s+/).map(chaveDaFrase).filter(Boolean);
  const palavrasB = copia.split(/\s+/).map(chaveDaFrase).filter(Boolean);
  const comunsPalavras = comunsPalavraAPalavra(palavrasA, palavrasB);
  const maiorPalavras = Math.max(palavrasA.length, palavrasB.length);
  const comunsFrases = [...chavesA].filter((chave) => chavesB.has(chave)).length;
  const maiorFrases = Math.max(chavesA.size, chavesB.size);
  const semelhanca = comunsPalavras
    ? maiorPalavras
      ? comunsPalavras.filter(Boolean).length / maiorPalavras
      : 1
    : maiorFrases
      ? comunsFrases / maiorFrases
      : 1;
  return { iguais: trechosDiferentes === 0, semelhanca, trechosDiferentes, soNaPrincipal, soNaCopia };
}

/** Palavras da frase, normalizadas (para comparar uma frase com a outra palavra por palavra). */
function palavras(frase: string): string[] {
  return frase.split(/\s+/).map(chaveDaFrase).filter(Boolean);
}

/** Parte das palavras em comum entre duas frases (0 a 1). */
function parecenca(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const conjuntoB = new Set(b);
  const comuns = new Set(a.filter((palavra) => conjuntoB.has(palavra))).size;
  return comuns / new Set([...a, ...b]).size;
}

/** Junta palavras seguidas com a mesma marca num trecho só (o espaço vai junto). */
function juntar(trechos: Trecho[]): Trecho[] {
  const juntos: Trecho[] = [];
  for (const trecho of trechos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && ultimo.diferente === trecho.diferente) ultimo.texto += trecho.texto;
    else juntos.push({ ...trecho });
  }
  return juntos;
}

/**
 * Uma frase que não existe no outro texto: se lá houver uma parecida (metade das palavras ou mais em comum, como o
 * cabeçalho do DJEN com outro intimado), marca só as palavras que mudam; senão, a frase inteira.
 */
function marcarFrase(frase: string, frasesDoOutro: { frase: string; palavras: string[] }[]): Trecho[] {
  const minhas = palavras(frase);
  let melhor: { palavras: string[]; nota: number } | null = null;
  for (const candidata of frasesDoOutro) {
    const nota = parecenca(minhas, candidata.palavras);
    if (!melhor || nota > melhor.nota) melhor = { palavras: candidata.palavras, nota };
  }
  if (!melhor || melhor.nota < 0.5) return [{ texto: frase, diferente: true }];
  const restantes = new Map<string, number>();
  for (const palavra of melhor.palavras) restantes.set(palavra, (restantes.get(palavra) ?? 0) + 1);
  const trechos = frase.split(/(\s+)/).map((pedaco): Trecho => {
    const chave = chaveDaFrase(pedaco);
    if (!chave) return { texto: pedaco, diferente: false };
    const sobra = restantes.get(chave) ?? 0;
    if (sobra > 0) {
      restantes.set(chave, sobra - 1);
      return { texto: pedaco, diferente: false };
    }
    return { texto: pedaco, diferente: true };
  });
  // O espaço entre duas palavras diferentes fica pintado junto, para o trecho não sair picotado.
  for (let i = 1; i < trechos.length - 1; i++) {
    if (!chaveDaFrase(trechos[i].texto) && trechos[i - 1].diferente && trechos[i + 1].diferente) trechos[i].diferente = true;
  }
  return juntar(trechos);
}

/** Acima disto (palavras de um × palavras do outro), a comparação palavra a palavra pesaria: compara por frase. */
const LIMITE_PALAVRA_A_PALAVRA = 2_500_000;

/**
 * Palavra a palavra, como o "comparar documentos": a maior sequência de palavras em comum (LCS) fica sem marca e o
 * resto do texto é o que muda. Devolve, para cada palavra do texto, se ela está na sequência comum; null quando os
 * textos são grandes demais para isso.
 */
function comunsPalavraAPalavra(chavesA: string[], chavesB: string[]): boolean[] | null {
  const n = chavesA.length;
  const m = chavesB.length;
  if (!n || !m) return new Array(n).fill(false);
  if (n * m > LIMITE_PALAVRA_A_PALAVRA) return null;
  // tabela[i][j] = tamanho da maior sequência comum entre A[i..] e B[j..], numa linha corrida.
  const largura = m + 1;
  const tabela = new Uint16Array((n + 1) * largura);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabela[i * largura + j] =
        chavesA[i] === chavesB[j] ? tabela[(i + 1) * largura + j + 1] + 1 : Math.max(tabela[(i + 1) * largura + j], tabela[i * largura + j + 1]);
    }
  }
  const comuns = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (chavesA[i] === chavesB[j]) {
      comuns[i] = true;
      i++;
      j++;
    } else if (tabela[(i + 1) * largura + j] >= tabela[i * largura + j + 1]) i++;
    else j++;
  }
  return comuns;
}

/**
 * O texto em parágrafos, cada um em trechos, marcando o que não existe no outro texto, palavra a palavra (o cabeçalho
 * do DJEN com outro intimado fica pintado só no nome). Textos muito grandes caem na comparação por frase. É o que a
 * tela pinta para a pessoa ver de relance onde as cópias diferem. Os trechos já trazem os espaços.
 */
export function marcarDiferencas(texto: string, outro: string): Trecho[][] {
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
  const pedacosPorLinha = linhas.map((linha) => linha.split(/(\s+)/).filter((pedaco) => pedaco !== ""));
  const chavesA: string[] = [];
  for (const pedacos of pedacosPorLinha) for (const pedaco of pedacos) if (chaveDaFrase(pedaco)) chavesA.push(chaveDaFrase(pedaco));
  const chavesB = outro.split(/\s+/).map(chaveDaFrase).filter(Boolean);
  const comuns = comunsPalavraAPalavra(chavesA, chavesB);
  if (!comuns) return marcarPorFrase(texto, outro);

  let posicao = 0;
  return pedacosPorLinha.map((pedacos) => {
    const trechos: Trecho[] = pedacos.map((pedaco) => {
      if (!chaveDaFrase(pedaco)) return { texto: pedaco, diferente: false };
      return { texto: pedaco, diferente: !comuns[posicao++] };
    });
    // O espaço (ou a pontuação solta) entre duas palavras diferentes fica pintado junto: o trecho não sai picotado.
    for (let k = 1; k < trechos.length - 1; k++) {
      if (!chaveDaFrase(trechos[k].texto) && trechos[k - 1].diferente && trechos[k + 1].diferente) trechos[k].diferente = true;
    }
    return juntar(trechos);
  });
}

/** Comparação por frase (textos grandes demais para palavra a palavra). */
function marcarPorFrase(texto: string, outro: string): Trecho[][] {
  const frasesDoOutro = frasesDoTexto(outro);
  const chavesDoOutro = new Set(frasesDoOutro.map(chaveDaFrase).filter(Boolean));
  const indiceDoOutro = frasesDoOutro.map((frase) => ({ frase, palavras: palavras(frase) }));
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const frases = frasesDoTexto(linha);
      return juntar(
        frases.flatMap((frase, indice) => {
          const separador = indice < frases.length - 1 ? " " : "";
          const chave = chaveDaFrase(frase);
          const trechos = !chave || chavesDoOutro.has(chave) ? [{ texto: frase, diferente: false }] : marcarFrase(frase, indiceDoOutro);
          return separador ? [...trechos, { texto: separador, diferente: false }] : trechos;
        })
      );
    });
}
