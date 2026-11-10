import type { Metadata } from "next";
import { Pe27Dinamica1 } from "@/components/pe27/dinamica1-client";
import { Pe27AcessoNegado } from "@/components/pe27/shared";
import { loadPe27Board, Pe27HttpError } from "@/lib/pe27/server";
import type { Pe27Board } from "@/lib/pe27/types";

export const metadata: Metadata = {
  title: "Dinâmica 1 · PE27 — ORQESTRAI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function loadBoardOrForbidden(): Promise<Pe27Board | null> {
  try {
    return await loadPe27Board();
  } catch (error) {
    if (error instanceof Pe27HttpError && error.status === 403) return null;
    throw error;
  }
}

export default async function Pe27Dinamica1Page() {
  const board = await loadBoardOrForbidden();
  if (!board) return <Pe27AcessoNegado />;
  return <Pe27Dinamica1 board={board} />;
}
