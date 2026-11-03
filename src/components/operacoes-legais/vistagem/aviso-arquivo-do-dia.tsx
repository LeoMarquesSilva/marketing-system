"use client";

import { useEffect, useState, type ReactNode } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type { ArquivoDoDia } from "@/lib/vistagem/alerta-arquivo";
import { formatarData } from "./publicacao-ui";
import { Aviso } from "./ui";

/**
 * Situação do arquivo da Kurier de hoje. `undefined` enquanto consulta; `null` se a consulta
 * falhar (aí nenhuma faixa aparece).
 */
export function useArquivoDoDia(): ArquivoDoDia | null | undefined {
  const [situacao, setSituacao] = useState<ArquivoDoDia | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    authFetch("/api/operacoes-legais/vistagem/arquivo-do-dia")
      .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as ArquivoDoDia) : null))
      .then((dados) => !cancelado && setSituacao(dados))
      .catch(() => !cancelado && setSituacao(null));
    return () => {
      cancelado = true;
    };
  }, []);

  return situacao;
}

/**
 * Faixa vermelha quando o arquivo de hoje não chegou ou falhou na importação (dia útil, depois
 * das 8h). `naCaptura` ajusta a orientação para quem já está na aba onde se envia o .xlsx.
 */
export function FaixaArquivoDoDia({
  situacao,
  naCaptura = false,
  acao,
}: {
  situacao: ArquivoDoDia | null | undefined;
  naCaptura?: boolean;
  acao?: ReactNode;
}) {
  if (!situacao?.atrasado) return null;
  const data = formatarData(situacao.hoje);
  const onde = naCaptura ? "aqui" : "na aba Captura";

  if (situacao.erro) {
    return (
      <Aviso tom="erro" titulo={`O arquivo da Kurier de ${data} chegou, mas a importação falhou`} acao={acao}>
        <span className="block">{situacao.erro}</span>
        Reenvie o .xlsx {onde}.
      </Aviso>
    );
  }
  return (
    <Aviso tom="erro" titulo={`O arquivo da Kurier de ${data} ainda não chegou`} acao={acao}>
      O Orquestra tenta de novo entre 9h e 10h. Se não vier, confira o e-mail da Kurier e o Power Automate, ou envie o .xlsx {onde}.
    </Aviso>
  );
}

/** Faixa do arquivo do dia que busca a própria situação (abas fora da Captura). */
export function AvisoArquivoDoDia({ acao }: { acao?: ReactNode }) {
  const situacao = useArquivoDoDia();
  return <FaixaArquivoDoDia situacao={situacao} acao={acao} />;
}
