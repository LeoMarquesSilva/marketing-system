"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Search } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { camposDaConferencia, combinaCampos } from "@/lib/vistagem/busca";
import type { ConferenciaItem, PublicacaoStatus } from "@/lib/vistagem/types";
import { TabelaTarefas } from "./conferencia-client";
import { IconeArea, LogoGrupo } from "./marcas";
import { formatarData, formatarDataHora } from "./publicacao-ui";
import { Aviso, Carregando, Painel, Selo, Vazio, type TomSelo } from "./ui";

/** Onde a publicação está depois da vistagem do jurídico. */
const SITUACAO: Partial<Record<PublicacaoStatus, { rotulo: string; tom: TomSelo }>> = {
  controladoria_vistar: { rotulo: "Na conferência da controladoria", tom: "alerta" },
  pronto_para_agendar: { rotulo: "Com o robô", tom: "marca" },
  agendado: { rotulo: "Agendada no VIOS", tom: "sucesso" },
  checado: { rotulo: "Checada", tom: "sucesso" },
  revisar: { rotulo: "Em revisão", tom: "perigo" },
};


/** "Hoje", "Ontem" ou a data, pelo dia (no fuso de Brasília) em que a publicação foi vistada. */
function diaDaVistagem(iso: string | null, hoje: string, ontem: string): string {
  if (!iso) return "Sem data";
  const dia = new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return dia === hoje ? "Hoje" : dia === ontem ? "Ontem" : formatarData(dia);
}

/**
 * Visão do jurídico: o que já foi vistado nos últimos dias, das suas áreas, e onde cada tarefa está
 * (conferência, robô, agendada no VIOS, checada ou em revisão).
 */
export function AgendadasJuridico({ escritorio, busca }: { escritorio: string; busca: string }) {
  const [itens, setItens] = useState<ConferenciaItem[] | null>(null);
  const [dias, setDias] = useState(30);
  const [erro, setErro] = useState("");

  // Trocar a área remonta o componente (key), então o estado já começa vazio.
  useEffect(() => {
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/juridico/agendadas${escritorio ? `?escritorio=${encodeURIComponent(escritorio)}` : ""}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o que foi agendado.");
        if (cancelado) return;
        setItens(corpo.itens);
        setDias(corpo.dias);
      })
      .catch((e) => {
        if (cancelado) return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar o que foi agendado.");
        setItens([]);
      });
    return () => {
      cancelado = true;
    };
  }, [escritorio]);

  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(() => new Map((itens ?? []).map((item) => [item.publicacao.id, camposDaConferencia(item)])), [itens]);

  const blocos = useMemo(() => {
    const agora = new Date();
    const hoje = agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const ontem = new Date(agora.getTime() - 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const porDia = new Map<string, ConferenciaItem[]>();
    for (const item of (itens ?? []).filter((item) => combinaCampos(camposDeBusca.get(item.publicacao.id) ?? [], busca))) {
      const dia = diaDaVistagem(item.publicacao.vistadoEm, hoje, ontem);
      porDia.set(dia, [...(porDia.get(dia) ?? []), item]);
    }
    return [...porDia.entries()];
  }, [itens, busca, camposDeBusca]);

  if (itens === null) return <Painel><Carregando rotulo="Carregando o que foi agendado" /></Painel>;
  return (
    <div className="space-y-4">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!itens.length ? (
        <Painel>
          <Vazio icone={CalendarCheck} titulo="Nada vistado nos últimos dias">
            O que for vistado nos últimos {dias} dias aparece aqui, com a situação de cada tarefa no VIOS.
          </Vazio>
        </Painel>
      ) : !blocos.length ? (
        <Painel>
          <Vazio icone={Search} titulo="Nenhuma publicação com essa busca" />
        </Painel>
      ) : (
        blocos.map(([dia, lista]) => (
          <section key={dia} aria-label={`Vistadas ${dia.toLowerCase()}`} className="space-y-2">
            <h3 className="text-xs font-semibold text-[#285f7a]">
              {dia} <span className="font-normal tabular-nums text-muted-foreground">· {lista.length}</span>
            </h3>
            {lista.map((item) => {
              const { publicacao } = item;
              const situacao = SITUACAO[publicacao.status] ?? { rotulo: publicacao.status, tom: "neutro" as const };
              return (
                <Painel key={publicacao.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <LogoGrupo grupo={publicacao.grupoCliente} tamanho="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold tabular-nums text-foreground">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
                        <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
                      </p>
                      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {publicacao.escritorioResponsavel ? <IconeArea area={publicacao.escritorioResponsavel} tamanho="xs" /> : null}
                        <span className="truncate">
                          {[publicacao.grupoCliente ?? publicacao.cliente, publicacao.escritorioResponsavel, `publ. ${formatarData(publicacao.dataPublicacao)}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vistada {item.vistadoPor ? `por ${item.vistadoPor} ` : ""}em {formatarDataHora(publicacao.vistadoEm)}
                      {item.revistadoPor && publicacao.revistadoEm
                        ? ` · devolvida e vistada de novo por ${item.revistadoPor} em ${formatarDataHora(publicacao.revistadoEm)}`
                        : ""}
                    </p>
                  </div>
                  <TabelaTarefas agendamentos={item.agendamentos} comEnvio />
                </Painel>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
