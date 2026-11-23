"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { faseDaRotina, leituraAtrasada, type SituacaoDoFluxoVios } from "@/lib/vistagem/rotina-vios";
import { CartaoEditavel } from "./configuracoes-ui";
import { formatarDataHora } from "./publicacao-ui";
import { Aviso } from "./ui";

const ROTA = "/api/operacoes-legais/vistagem/configuracoes/fluxo-vios";
/** Enquanto o robô roda (ou até a leitura nova chegar), a tela pergunta de novo a cada 15 s, por no máximo 30 min. */
const INTERVALO_MS = 15_000;
const ESPERA_MAXIMA_MS = 30 * 60 * 1000;

const numero = (valor: number) => valor.toLocaleString("pt-BR");

/**
 * Cartão "Fluxo de tarefas do VIOS": quando o robô leu o fluxo pela última vez e o botão que roda agora a rotina
 * de domingo (útil depois de mudar um tipo de tarefa ou o fluxo automático no VIOS).
 */
export function FluxoDoViosCartao() {
  const [situacao, setSituacao] = useState<SituacaoDoFluxoVios | null>(null);
  const [erro, setErro] = useState("");
  const [pedindo, setPedindo] = useState(false);
  /** Pedido feito nesta tela: a leitura de antes, para saber quando a nova chega. */
  const [pedido, setPedido] = useState<{ lidoAntes: string | null; jaRodando: boolean } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await authFetch(ROTA);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível consultar o fluxo do VIOS.");
      setSituacao(corpo as SituacaoDoFluxoVios);
      setErro("");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível consultar o fluxo do VIOS.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const rodando = situacao?.robo?.rodando === true;
  const relido = pedido !== null && situacao !== null && situacao.lidoEm !== null && situacao.lidoEm !== pedido.lidoAntes;
  const aguardando = rodando || (pedido !== null && !relido);

  useEffect(() => {
    if (!aguardando) return;
    const comeco = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - comeco > ESPERA_MAXIMA_MS) {
        window.clearInterval(timer);
        return;
      }
      void carregar();
    }, INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [aguardando, carregar]);

  async function atualizar() {
    setPedindo(true);
    setErro("");
    const lidoAntes = situacao?.lidoEm ?? null;
    try {
      const resposta = await authFetch(ROTA, { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível pedir a atualização.");
      const { jaRodando, ...nova } = corpo as SituacaoDoFluxoVios & { jaRodando: boolean };
      setSituacao(nova);
      setPedido({ lidoAntes, jaRodando });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível pedir a atualização.");
    } finally {
      setPedindo(false);
    }
  }

  const fase = situacao ? faseDaRotina(situacao) : null;
  const ocupado = pedindo || rodando;

  return (
    <CartaoEditavel
      icone={Workflow}
      titulo="Fluxo de tarefas do VIOS"
      descricao="O robô relê no VIOS os tipos de tarefa, o fluxo automático (o que cada tarefa cria e com que prazo), as etiquetas e os responsáveis. É dessa leitura que saem as tarefas e as datas previstas na Vistagem."
      acao={
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => void atualizar()} disabled={ocupado || !situacao} title="Roda agora a rotina de domingo do robô">
          {ocupado ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          Atualizar agora
        </Button>
      }
      rodape={
        <p className="text-xs text-muted-foreground">
          Roda sozinho todo domingo às 22h. Depois de mudar um tipo de tarefa ou o fluxo automático no VIOS, use Atualizar agora: leva poucos minutos, e
          as telas passam a usar a leitura nova em até 10 minutos.
        </p>
      }
    >
      {!situacao ? (
        erro ? (
          <Aviso tom="erro">{erro}</Aviso>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Consultando o robô…
          </p>
        )
      ) : (
        <div className="space-y-2.5">
          <p className="text-sm text-foreground">
            Última leitura: <span className="font-semibold tabular-nums">{formatarDataHora(situacao.lidoEm)}</span>
            <span className="text-muted-foreground"> · {numero(situacao.tipos)} tipos de tarefa</span>
          </p>

          {relido ? (
            <Aviso
              tom="sucesso"
              acao={
                <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setPedido(null)}>
                  <X />
                </Button>
              }
            >
              Fluxo relido do VIOS às {formatarDataHora(situacao.lidoEm)}: {numero(situacao.tipos)} tipos de tarefa.
            </Aviso>
          ) : fase?.fase === "lendo_fluxo" ? (
            <Aviso tom="info">
              {pedido?.jaRodando ? "A rotina já estava rodando; " : ""}
              Lendo o fluxo no VIOS desde {formatarDataHora(fase.desde)}. Costuma levar poucos minutos; esta tela se atualiza sozinha.
            </Aviso>
          ) : null}

          {fase?.fase === "lendo_catalogo" ? (
            <p className="text-xs text-muted-foreground">O fluxo já foi gravado; o robô segue relendo as matérias e o catálogo das pastas. Não precisa esperar.</p>
          ) : null}
          {fase?.fase === "falhou" && !relido ? (
            <Aviso tom="alerta" titulo={`A última rodada (${formatarDataHora(fase.em)}) não leu o ${fase.parte}`}>
              {fase.erro}
            </Aviso>
          ) : null}
          {fase?.fase === "parado" && fase.terminouEm && !relido ? (
            <p className="text-xs text-muted-foreground">Última rodada do robô terminou em {formatarDataHora(fase.terminouEm)}.</p>
          ) : null}
          {fase?.fase === "sem_robo" ? <p className="text-xs text-muted-foreground">Não deu para consultar o robô agora: {fase.motivo}</p> : null}
          {leituraAtrasada(situacao.lidoEm) && !aguardando ? (
            <Aviso tom="alerta">A leitura tem mais de uma semana: a rotina de domingo pode ter falhado. Use Atualizar agora.</Aviso>
          ) : null}
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        </div>
      )}
    </CartaoEditavel>
  );
}
