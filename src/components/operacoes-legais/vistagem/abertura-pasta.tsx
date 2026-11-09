"use client";

import { useState } from "react";
import { CircleAlert, ExternalLink, FolderPlus, LoaderCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { ROTULO_ETIQUETA } from "@/lib/vistagem/agendamento";
import { ehAberturaDePasta, linkDoItemNaCentral } from "@/lib/vistagem/central";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import type { ConferenciaItem, PublicacaoResumo } from "@/lib/vistagem/types";
import { IconeTribunal, LogoGrupo, SeloArea } from "./marcas";
import { formatarData, formatarDataHora } from "./publicacao-ui";
import { Painel, PainelTopo, Selo, Vazio } from "./ui";

/** Etiqueta da publicação sem pasta no VIOS, ao lado do selo de risco. Só visual; não aparece nas outras. */
export function SeloAberturaDePasta({ publicacao }: { publicacao: Pick<PublicacaoResumo, "status" | "pastaCi" | "pendencia"> }) {
  if (!ehAberturaDePasta(publicacao)) return null;
  return (
    <Selo tom="alerta" icone={FolderPlus}>
      Abertura de pasta
    </Selo>
  );
}

/** Item da Central do SharePoint (abre em nova aba). */
export function LinkItemCentral({ itemId }: { itemId: string }) {
  return (
    <a
      href={linkDoItemNaCentral(itemId)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir o item na Central do SharePoint (nova aba)"
      aria-label={`Abrir o item ${itemId} na Central do SharePoint (nova aba)`}
      className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-[#347796] hover:text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <span className="tabular-nums">Item {itemId} na Central</span>
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

/** Situação do pedido na Central, em uma frase: o item criado, o erro ou a espera. */
export function SituacaoNaCentral({ publicacao }: { publicacao: Pick<PublicacaoResumo, "centralItemId" | "centralEnviadaEm" | "centralErro"> }) {
  if (publicacao.centralItemId) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <LinkItemCentral itemId={publicacao.centralItemId} />
        {publicacao.centralEnviadaEm ? <span className="text-xs tabular-nums text-muted-foreground">{formatarDataHora(publicacao.centralEnviadaEm)}</span> : null}
      </span>
    );
  }
  return (
    <Selo tom={publicacao.centralErro ? "perigo" : "alerta"} icone={CircleAlert}>
      {publicacao.centralErro ? "Não chegou à Central" : "Enviando à Central"}
    </Selo>
  );
}

function resumoDasTarefas(item: ConferenciaItem): string {
  return item.agendamentos
    .map((tarefa) => `${ROTULO_ETIQUETA[tarefa.etiqueta]}: ${tarefa.tarefa}${tarefa.etiqueta === "PRAZO" && tarefa.dataFatal ? ` (fatal ${formatarData(tarefa.dataFatal).slice(0, 5)})` : ""}`)
    .join(" · ");
}

function LinhaAbertura({ item, onTentar, ocupado }: { item: ConferenciaItem; onTentar: () => void; ocupado: boolean }) {
  const { publicacao } = item;
  const processo = publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
  const grupo = publicacao.grupoCliente ?? publicacao.cliente;
  const naoChegou = !publicacao.centralItemId;
  return (
    <li className="grid gap-x-6 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <LogoGrupo grupo={publicacao.grupoCliente} tamanho="md" className="mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-sm font-semibold tabular-nums text-[#10293a]">{processo}</span>
            {publicacao.tribunal ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground" title={descricaoDoTribunal(publicacao.tribunal) ?? undefined}>
                <IconeTribunal sigla={publicacao.tribunal} />
                {publicacao.tribunal}
              </span>
            ) : null}
            {publicacao.demandaRisco ? (
              <Selo tom="perigo" icone={ShieldAlert}>
                Risco
              </Selo>
            ) : null}
          </p>
          <p className="truncate text-sm font-medium text-foreground" title={grupo ?? undefined}>
            {grupo ?? "Sem grupo"}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {publicacao.escritorioResponsavel ? <SeloArea area={publicacao.escritorioResponsavel} /> : <Selo>Sem área</Selo>}
            <span>
              Vistada{item.vistadoPor ? (
                <>
                  {" "}
                  por <span className="font-medium text-foreground">{item.vistadoPor}</span>
                </>
              ) : null}
              {publicacao.vistadoEm ? <span className="tabular-nums"> em {formatarDataHora(publicacao.vistadoEm)}</span> : null}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{resumoDasTarefas(item)}</p>
          {naoChegou && publicacao.centralErro ? <p className="whitespace-pre-wrap break-words text-xs text-red-700">{publicacao.centralErro}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 lg:justify-end">
        <SituacaoNaCentral publicacao={publicacao} />
        {naoChegou ? (
          <Button type="button" variant="outline" size="sm" onClick={onTentar} disabled={ocupado}>
            {ocupado ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
            Tentar de novo
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Publicações sem pasta no VIOS que o jurídico vistou: não passam pela conferência nem pelo robô, viram pedido de abertura
 * de pasta na Central do SharePoint. Aqui a controladoria vê o que foi e tenta de novo o que não chegou.
 */
export function PainelAberturaDePasta({
  itens,
  onTentado,
  onErro,
}: {
  itens: ConferenciaItem[];
  /** A Central aceitou: recarrega a lista. */
  onTentado: (texto: string) => void;
  onErro: (texto: string) => void;
}) {
  const [ocupada, setOcupada] = useState<string | null>(null);

  async function tentar(id: string) {
    setOcupada(id);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/conferencia/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "central" }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "A Central do SharePoint não aceitou o pedido.");
      onTentado(`Pedido de abertura de pasta criado na Central (item ${corpo.itemId}).`);
    } catch (e) {
      onErro(e instanceof Error ? e.message : "A Central do SharePoint não aceitou o pedido.");
    } finally {
      setOcupada(null);
    }
  }

  if (!itens.length) {
    return (
      <Painel>
        <Vazio icone={FolderPlus} titulo="Nenhum pedido de abertura de pasta.">
          Quando o jurídico vistar uma publicação sem pasta no VIOS, ela vai para a Central do SharePoint e aparece aqui.
        </Vazio>
      </Painel>
    );
  }
  return (
    <Painel>
      <PainelTopo titulo="Enviadas à Central do SharePoint" descricao="Sem pasta no VIOS: a controladoria agenda pela Central depois de abrir a pasta." />
      <ul aria-label="Pedidos de abertura de pasta" className="divide-y divide-[#eef3f5] border-t border-[#e6eef0]">
        {itens.map((item) => (
          <LinhaAbertura key={item.publicacao.id} item={item} ocupado={ocupada === item.publicacao.id} onTentar={() => void tentar(item.publicacao.id)} />
        ))}
      </ul>
    </Painel>
  );
}
