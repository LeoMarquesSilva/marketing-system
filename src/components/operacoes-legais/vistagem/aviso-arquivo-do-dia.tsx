"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import type { ArquivoDoDia } from "@/lib/vistagem/alerta-arquivo";
import { formatarData } from "./publicacao-ui";

/** Faixa vermelha quando o arquivo da Kurier de hoje não chegou (dia útil, depois das 8h). */
export function AvisoArquivoDoDia() {
  const [situacao, setSituacao] = useState<ArquivoDoDia | null>(null);

  useEffect(() => {
    let cancelado = false;
    authFetch("/api/operacoes-legais/vistagem/arquivo-do-dia")
      .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as ArquivoDoDia) : null))
      .then((dados) => !cancelado && setSituacao(dados))
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  if (!situacao?.atrasado) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>
        {situacao.erro
          ? `O arquivo da Kurier de ${formatarData(situacao.hoje)} chegou, mas a importação falhou (${situacao.erro}). Reenvie o .xlsx aqui na Captura.`
          : `O arquivo da Kurier de ${formatarData(situacao.hoje)} ainda não chegou. O Orquestra tenta de novo entre 9h e 10h; se não vier, confira o e-mail da Kurier e o Power Automate, ou envie o .xlsx aqui na Captura.`}
      </p>
    </div>
  );
}
