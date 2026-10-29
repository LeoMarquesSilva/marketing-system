"use client";

import { useMemo, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { classeDoProcesso, partesPorPolo, valorDaCausa, type ParteDoPolo } from "@/lib/vistagem/dados-processo";
import { lerPublicacao } from "@/lib/vistagem/leitura";
import { advogadosDoEscritorioCitados } from "@/lib/vistagem/triagem";
import type { PublicacaoResumo } from "@/lib/vistagem/types";
import { Celula } from "./ficha-pasta";
import { Selo } from "./ui";

/** Nomes de cada polo que aparecem antes do "e mais N". */
const VISIVEIS = 2;

function Polo({ rotulo, partes, todas, onVerTodas }: { rotulo: string; partes: ParteDoPolo[]; todas: boolean; onVerTodas: () => void }) {
  const mostradas = todas ? partes : partes.slice(0, VISIVEIS);
  const resto = partes.length - mostradas.length;
  return (
    <Celula rotulo={rotulo}>
      {partes.length ? (
        <ul className="space-y-0.5">
          {mostradas.map((parte) => (
            <li key={parte.nome} className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="truncate" title={parte.nome}>
                {parte.nome}
              </span>
              {parte.cliente ? (
                <Selo tom="escuro" className="shrink-0">
                  cliente
                </Selo>
              ) : null}
            </li>
          ))}
          {resto > 0 ? (
            <li>
              <button type="button" className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline" onClick={onVerTodas}>
                e mais {resto}
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </Celula>
  );
}

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Processo no cabeçalho do jurídico: tipo de ação (da pasta no VIOS, ou a classe do DJEN), fase e valor da ação
 * da pasta no VIOS (o valor cai para o citado na publicação, se houver), as partes do DJEN por polo, com o
 * cliente marcado, e os advogados, com os do escritório na frente. A fase nunca é deduzida.
 */
export function FichaProcesso({ publicacao }: { publicacao: PublicacaoResumo }) {
  const leitura = useMemo(() => lerPublicacao(publicacao.teor), [publicacao.teor]);
  const [todasAsPartes, setTodasAsPartes] = useState(false);
  const classe = classeDoProcesso(leitura.classe);
  const tipo = publicacao.acaoProcesso ?? classe;
  const citado = useMemo(() => valorDaCausa(publicacao.teor), [publicacao.teor]);
  const { ativo, passivo } = partesPorPolo(leitura.partes, publicacao.cliente);
  // Pelo nome ou pela OAB no texto todo: vale também para os diários fora do DJEN, que não listam os advogados.
  const doEscritorio = useMemo(() => advogadosDoEscritorioCitados(publicacao.teor), [publicacao.teor]);
  const outros = leitura.advogados.filter((advogado) => !advogado.doEscritorio);
  const [todosOsAdvogados, setTodosOsAdvogados] = useState(false);

  return (
    <div className="grid gap-x-4 gap-y-3 rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2.5 @md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Celula rotulo="Tipo de ação">
        <p className="truncate text-sm font-semibold text-foreground" title={tipo ?? undefined}>
          {tipo ?? "—"}
        </p>
        {classe && tipo && chaveNome(classe) !== chaveNome(tipo) ? (
          <p className="truncate text-[11px] text-muted-foreground" title={classe}>
            No tribunal: {classe}
          </p>
        ) : null}
      </Celula>
      <Celula rotulo="Fase">
        {publicacao.faseProcessual ? (
          <p className="truncate text-sm font-semibold text-foreground" title="Fase da pasta no VIOS">
            {publicacao.faseProcessual}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground" title="A pasta no VIOS está sem a fase.">
            Não informada
          </p>
        )}
      </Celula>
      <Celula rotulo="Valor da causa">
        {publicacao.valorAcao !== null ? (
          <>
            <p className="truncate text-sm font-semibold tabular-nums text-foreground" title="Valor da ação da pasta no VIOS">
              {reais(publicacao.valorAcao)}
            </p>
            {publicacao.valorAcaoAtualizado !== null && publicacao.valorAcaoAtualizado !== publicacao.valorAcao ? (
              <p className="truncate text-[11px] tabular-nums text-muted-foreground">atualizado {reais(publicacao.valorAcaoAtualizado)}</p>
            ) : null}
          </>
        ) : citado ? (
          <>
            <p className="truncate text-sm font-semibold tabular-nums text-foreground">{citado}</p>
            <p className="truncate text-[11px] text-muted-foreground">citado na publicação</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" title="A pasta no VIOS está sem o valor da ação, e esta publicação não o cita.">
            Não informado
          </p>
        )}
      </Celula>
      {ativo.length || passivo.length ? (
        <div className="grid gap-x-4 gap-y-2 border-t border-[#c9dde6] pt-2.5 @md:col-span-full @md:grid-cols-2">
          <Polo rotulo="Polo ativo" partes={ativo} todas={todasAsPartes} onVerTodas={() => setTodasAsPartes(true)} />
          <Polo rotulo="Polo passivo" partes={passivo} todas={todasAsPartes} onVerTodas={() => setTodasAsPartes(true)} />
        </div>
      ) : null}
      {/* Advogados: o vistador confere logo se a publicação saiu em nome do Gustavo ou do Ricardo. */}
      <div className="grid gap-x-4 gap-y-2 border-t border-[#c9dde6] pt-2.5 @md:col-span-full @md:grid-cols-2">
        <Celula rotulo="Advogados do escritório">
          {doEscritorio.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {doEscritorio.map((advogado) => (
                <li key={advogado.oab}>
                  <Selo tom="escuro" icone={Check}>
                    {advogado.nome} · OAB {advogado.oab}/SP
                  </Selo>
                </li>
              ))}
            </ul>
          ) : (
            <Selo tom="alerta" icone={TriangleAlert}>
              Gustavo e Ricardo não aparecem na publicação
            </Selo>
          )}
        </Celula>
        <Celula rotulo="Outros advogados">
          {outros.length ? (
            <ul className="space-y-0.5">
              {(todosOsAdvogados ? outros : outros.slice(0, VISIVEIS)).map((advogado) => (
                <li key={`${advogado.nome}|${advogado.oab}`} className="flex min-w-0 items-baseline gap-1.5 text-sm text-foreground">
                  <span className="truncate font-medium" title={advogado.nome}>
                    {advogado.nome}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    OAB {advogado.oab}/{advogado.uf}
                  </span>
                </li>
              ))}
              {!todosOsAdvogados && outros.length > VISIVEIS ? (
                <li>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline"
                    onClick={() => setTodosOsAdvogados(true)}
                  >
                    e mais {outros.length - VISIVEIS}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </Celula>
      </div>
    </div>
  );
}
