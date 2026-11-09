import type { Metadata } from "next";
import { Pe27VisaoGeral } from "@/components/pe27/visao-geral-client";
import { Pe27AcessoNegado } from "@/components/pe27/shared";
import { loadPe27Board, Pe27HttpError } from "@/lib/pe27/server";
import type { Pe27Board } from "@/lib/pe27/types";

export const metadata: Metadata = {
  title: "PE27 · Planejamento Estratégico 2027 — ORQESTRAI",
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

export default async function Pe27Page() {
  const board = await loadBoardOrForbidden();
  if (!board) return <Pe27AcessoNegado />;
  return <Pe27VisaoGeral initialBoard={board} />;
}
