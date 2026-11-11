import { DocProjetoClient } from "@/components/documentario/projeto-client";
import { DocAcessoNegado } from "@/components/documentario/shared";
import { loadBoardOrForbidden } from "@/lib/documentario/page-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const board = await loadBoardOrForbidden();
  if (!board) return <DocAcessoNegado />;
  return <DocProjetoClient initialBoard={board} />;
}
