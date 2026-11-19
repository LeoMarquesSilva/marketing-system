"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Detalhe da tarefa pela URL (?tarefa=<id>): o link do e-mail e do aviso abre
 * direto. Ao fechar, se algo mudou, a tela recarrega a lista (contadores).
 */
export function useTaskDialog(onDirtyClose: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dirty = useRef(false);
  const openId = searchParams.get("tarefa");

  const replace = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("tarefa", id);
      else params.delete("tarefa");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const open = useCallback((id: string) => replace(id), [replace]);

  const close = useCallback(() => {
    replace(null);
    if (dirty.current) {
      dirty.current = false;
      onDirtyClose();
    }
  }, [onDirtyClose, replace]);

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);

  return { openId, open, close, markDirty };
}
