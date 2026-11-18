/**
 * Texto dos autos, página a página, com pdfjs-dist (build "legacy", que roda em Node sem DOM).
 * Só lê a camada de texto: página digitalizada (imagem) volta vazia e fica fora da leitura da IA.
 */

export interface TextoDoPdf {
  /** Total de páginas do arquivo. */
  total: number;
  /** Texto de cada página lida (índice 0 = página 1). Para em `limite` páginas. */
  paginas: string[];
}

type ItemDeTexto = { str?: string; hasEOL?: boolean };

export async function extrairPaginas(bytes: Uint8Array, limite = Number.POSITIVE_INFINITY): Promise<TextoDoPdf> {
  // Fora do bundle: o Node carrega o pdfjs (e o worker dele) direto de node_modules. Empacotado, o pdfjs não acha
  // o próprio worker; e marcar o pacote como externo no next.config quebra as telas que usam o pdfjs no navegador.
  const pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs");
  const tarefa = pdfjs.getDocument({
    // O pdfjs fica com o buffer: a cópia mantém o original utilizável por quem chamou.
    data: bytes.slice(),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const documento = await tarefa.promise;
  try {
    const total = documento.numPages;
    const paginas: string[] = [];
    for (let numero = 1; numero <= Math.min(total, limite); numero += 1) {
      const pagina = await documento.getPage(numero);
      const conteudo = await pagina.getTextContent();
      let texto = "";
      for (const item of conteudo.items as ItemDeTexto[]) {
        if (typeof item.str !== "string") continue;
        // Os itens já trazem os próprios espaços; só a quebra de linha precisa ser reposta.
        texto += item.hasEOL ? `${item.str}\n` : item.str;
      }
      paginas.push(
        texto
          .replace(/[ \t]+/g, " ")
          .replace(/ ?\n ?/g, "\n")
          .trim()
      );
      pagina.cleanup();
    }
    return { total, paginas };
  } finally {
    await tarefa.destroy();
  }
}
