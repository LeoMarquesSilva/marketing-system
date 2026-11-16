/**
 * Download das fotos em ZIP montado no navegador (client-zip): as fotos vêm direto do Storage,
 * nada passa pelo servidor do ORQESTRAI. No Chrome/Edge o ZIP é gravado direto no disco
 * (showSaveFilePicker), sem limite de tamanho; nos outros navegadores vai para a memória,
 * por isso a tela divide em partes (splitIntoParts).
 */

import { makeZip } from "client-zip";

export interface ZipFile {
  url: string;
  name: string;
  size: number | null;
}

type SavePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;

function savePicker(): SavePicker | null {
  if (typeof window === "undefined") return null;
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  // Dentro de iframe o seletor é bloqueado.
  return typeof picker === "function" && window.self === window.top ? picker.bind(window) : null;
}

export function canSaveZipToDisk(): boolean {
  return savePicker() !== null;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Baixa uma foto por vez; `onFile(n)` avisa quando a n-ésima já entrou no ZIP. */
async function* zipEntries(files: ZipFile[], signal: AbortSignal, onFile: (done: number) => void) {
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const response = await fetch(file.url, { signal });
    if (!response.ok) throw new Error(`Não foi possível baixar ${file.name} (erro ${response.status}).`);
    yield { input: response, name: file.name, lastModified: new Date() };
    onFile(i + 1);
  }
}

/** Chrome/Edge: a pessoa escolhe onde salvar e o ZIP é gravado aos poucos. */
export async function saveZipToDisk(
  files: ZipFile[],
  suggestedName: string,
  signal: AbortSignal,
  onFile: (done: number) => void,
  onReady?: () => void
): Promise<void> {
  const picker = savePicker();
  if (!picker) throw new Error("Este navegador não grava direto na pasta.");
  // Precisa ser a primeira espera depois do clique (o navegador exige o gesto da pessoa).
  const handle = await picker({
    suggestedName,
    types: [{ description: "Arquivo ZIP", accept: { "application/zip": [".zip"] } }],
  });
  const writable = await handle.createWritable();
  onReady?.();
  await makeZip(zipEntries(files, signal, onFile)).pipeTo(writable, { signal });
}

/** Monta o ZIP na memória e dispara o download (partes menores ou fotos leves). */
export async function downloadZipInMemory(
  files: ZipFile[],
  fileName: string,
  signal: AbortSignal,
  onFile: (done: number) => void
): Promise<void> {
  const blob = await new Response(makeZip(zipEntries(files, signal, onFile))).blob();
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
