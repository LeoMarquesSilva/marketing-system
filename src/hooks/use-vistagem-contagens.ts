"use client";

import { useEffect, useRef, useState } from "react";
import { lerContagens, type ContagensVistagem } from "@/lib/vistagem/contagens";

/** Com a aba do navegador visível, os números se renovam a cada 2 minutos. */
const INTERVALO_MS = 2 * 60 * 1000;
/** Trocar de aba da Vistagem renova os números, mas nunca antes de 15 s da última consulta. */
const MINIMO_MS = 15 * 1000;
const CONFERIR_MS = 30 * 1000;

/** Evento que uma tela da Vistagem pode disparar depois de mexer numa publicação, para os números mudarem na hora. */
export const EVENTO_CONTAGENS_VISTAGEM = "vistagem:contagens";

/**
 * Quanto falta para zerar cada aba da Vistagem (números do cabeçalho). Só consulta enquanto a pessoa está na
 * Vistagem e com a aba do navegador visível: cada consulta é uma função na Vercel (conta só `count`, sem linhas).
 */
export function useVistagemContagens(ativo: boolean, rota: string): ContagensVistagem | null {
  const [contagens, setContagens] = useState<ContagensVistagem | null>(null);
  const carregadoEm = useRef(0);
  const emAndamento = useRef(false);
  const atualizarSeVelho = useRef<(idade: number) => void>(() => {});

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    const buscar = async () => {
      if (emAndamento.current) return;
      emAndamento.current = true;
      carregadoEm.current = Date.now();
      try {
        const resposta = await fetch("/api/operacoes-legais/vistagem/contagens", { cache: "no-store", credentials: "same-origin" });
        if (!resposta.ok) return;
        const corpo: unknown = await resposta.json();
        if (!cancelado) setContagens(lerContagens(corpo));
      } catch {
        // Os números são auxiliares: falha de rede não pode atrapalhar a navegação.
      } finally {
        emAndamento.current = false;
      }
    };
    const seVelho = (idade: number) => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - carregadoEm.current >= idade) void buscar();
    };
    const conferir = () => seVelho(INTERVALO_MS);
    const naHora = () => void buscar();

    atualizarSeVelho.current = seVelho;
    const timer = window.setInterval(conferir, CONFERIR_MS);
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener(EVENTO_CONTAGENS_VISTAGEM, naHora);
    return () => {
      cancelado = true;
      // A resposta em andamento é descartada: a próxima montagem tem que buscar de novo, sem esperar o intervalo
      // mínimo (senão os números só aparecem 2 minutos depois, ex.: quando o React monta o efeito duas vezes).
      carregadoEm.current = 0;
      emAndamento.current = false;
      atualizarSeVelho.current = () => {};
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener(EVENTO_CONTAGENS_VISTAGEM, naHora);
    };
  }, [ativo]);

  // Ao abrir outra aba da Vistagem (ou voltar para ela), números novos.
  useEffect(() => {
    if (ativo) atualizarSeVelho.current(MINIMO_MS);
  }, [ativo, rota]);

  return ativo ? contagens : null;
}
