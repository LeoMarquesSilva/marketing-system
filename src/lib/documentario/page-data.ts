import "server-only";

import { DocHttpError, loadDocArchive, loadDocBoard } from "./server";
import type { DocArchiveItem, DocBoard } from "./types";

/** Board do projeto, ou null quando a pessoa não tem acesso (a página mostra o aviso). */
export async function loadBoardOrForbidden(): Promise<DocBoard | null> {
  try {
    return await loadDocBoard();
  } catch (error) {
    if (error instanceof DocHttpError && (error.status === 403 || error.status === 401)) return null;
    throw error;
  }
}

export async function loadArchiveOrEmpty(): Promise<DocArchiveItem[]> {
  return loadDocArchive();
}
