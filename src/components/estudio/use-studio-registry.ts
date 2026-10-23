"use client";

import { useEffect, useState } from "react";
import { toCollection, toTemplateDef, type CollectionInput, type DynamicTemplateRow } from "@/lib/estudio/dynamic";
import { registerDynamic } from "@/lib/estudio/templates";

/** Uma carga por página; a tela Modelos pede de novo depois de salvar. */
let pending: Promise<void> | null = null;

export function loadStudioRegistry(fresh = false): Promise<void> {
  if (fresh) pending = null;
  pending ??= fetch("/api/estudio/modelos", { credentials: "include", cache: "no-store" })
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível carregar os modelos.");
      registerDynamic({
        colecoes: (body.colecoes as CollectionInput[]).map(toCollection),
        modelos: (body.modelos as DynamicTemplateRow[]).map(toTemplateDef),
      });
    })
    .catch((err) => {
      // sem os modelos do banco o Estúdio segue com os do código
      console.error("[estudio] modelos", err);
      pending = null;
    });
  return pending;
}

/** true quando os modelos criados na tela já estão no registro. */
export function useStudioRegistry(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadStudioRegistry().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
