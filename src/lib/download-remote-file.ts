/** Baixa um arquivo remoto; se falhar (CORS etc.), abre em nova aba. */
export async function downloadRemoteFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download falhou");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function filenameFromUrl(url: string, fallback: string): string {
  try {
    const segment = new URL(url).pathname.split("/").pop();
    if (segment?.trim()) return decodeURIComponent(segment);
  } catch {
    // ignore
  }
  return fallback;
}
