import type { Metadata } from "next";
import { Pe27Insumos } from "@/components/pe27/insumos-client";
import { Pe27AcessoNegado } from "@/components/pe27/shared";
import { loadPe27Board, Pe27HttpError } from "@/lib/pe27/server";
import { DIMENSIONS, type Dimension, type Pe27Board } from "@/lib/pe27/types";

export const metadata: Metadata = {
  title: "Dinâmica 2 · PE27 — ORQESTRAI",
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

export default async function Pe27InsumosPage({ searchParams }: { searchParams: Promise<{ dimensao?: string }> }) {
  const [board, params] = await Promise.all([loadBoardOrForbidden(), searchParams]);
  if (!board) return <Pe27AcessoNegado />;
  const dimension = DIMENSIONS.includes(params.dimensao as Dimension) ? (params.dimensao as Dimension) : null;
  return <Pe27Insumos initialBoard={board} initialDimension={dimension} />;
}
