import { DocAcervoClient } from "@/components/documentario/acervo-client";
import { DocAcessoNegado } from "@/components/documentario/shared";
import { loadArchiveOrEmpty, loadBoardOrForbidden } from "@/lib/documentario/page-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const board = await loadBoardOrForbidden();
  if (!board) return <DocAcessoNegado />;
  const items = await loadArchiveOrEmpty();
  return <DocAcervoClient initialBoard={board} initialItems={items} />;
}
