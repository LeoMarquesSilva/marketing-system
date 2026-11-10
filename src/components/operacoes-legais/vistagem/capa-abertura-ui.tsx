"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  montarCapa,
  ROTULO_DA_FONTE,
  type CapaDoDataJud,
  type CapaParaAbertura,
  type FonteDaCapa,
  type StatusDaFonte,
} from "@/lib/vistagem/capa-abertura";
import { Aviso, Secao, Selo, type TomSelo } from "./ui";

const TOM_DA_FONTE: Record<FonteDaCapa, TomSelo> = {
  cnj: "neutro",
  djen: "marca",
  esaj: "marca",
  datajud: "marca",
  triagem: "ia",
  pastas: "ia",
  regra: "neutro",
  falta: "perigo",
};

export type EstadoDataJud = { carregando: true } | { carregando: false; resultado: (CapaDoDataJud & { ms: number }) | null; erro: string | null };

const segundos = (ms: number) => `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;

function LinhaFonte({ nome, status, detalhe }: { nome: string; status: StatusDaFonte | null; detalhe?: string }) {
  if (!status) return null;
  const Icone = status.ok ? CircleCheck : CircleAlert;
  return (
    <li className="flex items-start gap-1.5">
      <Icone className={cn("mt-0.5 size-3.5 shrink-0", status.ok ? "text-emerald-600" : "text-amber-600")} aria-hidden />
      <span>
        <span className="font-medium text-foreground">{nome}</span> · {status.ok ? detalhe ?? "ok" : status.erro} · {segundos(status.ms)}
      </span>
    </li>
  );
}

/**
 * Sem pasta (possível abertura): a capa que o Orquestra montaria para abrir a pasta no VIOS, com a fonte de cada campo.
 * Fase 1 da abertura automática: só mostra, não grava nada no VIOS. O DataJud vem depois, quando responder.
 */
export function CapaParaAberturaDePasta({ publicacaoId }: { publicacaoId: string }) {
  const [capa, setCapa] = useState<CapaParaAbertura | null>(null);
  const [erro, setErro] = useState("");
  const [datajud, setDatajud] = useState<EstadoDataJud>({ carregando: true });
  const [recarga, setRecarga] = useState(0);

  // A tela monta um destes por publicação (key): o estado começa vazio; "Buscar de novo" zera antes de recarregar.
  function buscarDeNovo() {
    setCapa(null);
    setErro("");
    setDatajud({ carregando: true });
    setRecarga((valor) => valor + 1);
  }

  useEffect(() => {
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacaoId}/capa`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao montar a capa.");
        if (!cancelado) setCapa(corpo as CapaParaAbertura);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Falha ao montar a capa.");
      });
    authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacaoId}/capa/datajud`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao consultar o DataJud.");
        if (!cancelado) setDatajud({ carregando: false, resultado: corpo.datajud, erro: null });
      })
      .catch((e: unknown) => {
        if (!cancelado) setDatajud({ carregando: false, resultado: null, erro: e instanceof Error ? e.message : "Falha ao consultar o DataJud." });
      });
    return () => {
      cancelado = true;
    };
  }, [publicacaoId, recarga]);

  return <CapaDaAberturaView id={`capa-abertura-${publicacaoId}`} capa={capa} erro={erro} datajud={datajud} onBuscarDeNovo={buscarDeNovo} />;
}

/** O desenho da capa (separado da busca, para o teste). */
export function CapaDaAberturaView({
  id,
  capa,
  erro,
  datajud,
  onBuscarDeNovo,
}: {
  id: string;
  capa: CapaParaAbertura | null;
  erro: string;
  datajud: EstadoDataJud;
  onBuscarDeNovo: () => void;
}) {
  const campos = useMemo(() => {
    if (!capa) return [];
    const doDataJud = !datajud.carregando && datajud.resultado?.achou ? datajud.resultado : null;
    return montarCapa({ ...capa.dados, datajud: doDataJud });
  }, [capa, datajud]);
  const aConferir = campos.filter((campo) => campo.conferir).length;

  return (
    <Secao
      titulo="Capa para a abertura (prévia)"
      id={id}
      acao={
        <Button type="button" size="xs" variant="ghost" onClick={onBuscarDeNovo} disabled={!capa && !erro}>
          <RefreshCw />
          Buscar de novo
        </Button>
      }
    >
      <p className="text-xs text-muted-foreground">
        O que o Orquestra preencheria no cadastro do processo no VIOS. Só leitura: nada é gravado ainda.
      </p>
      {erro ? (
        <Aviso tom="erro">{erro}</Aviso>
      ) : !capa ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Buscando no DJEN e no e-SAJ…
        </p>
      ) : (
        <>
          {aConferir ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <TriangleAlert className="size-3.5" aria-hidden />
              {aConferir} campo(s) para conferir antes de abrir
            </p>
          ) : null}
          <dl className="divide-y divide-[#e6eef0] overflow-hidden rounded-md border border-[#dce9eb] bg-white text-sm">
            {campos.map((campo) => (
              <div key={campo.campo} className={cn("grid gap-0.5 px-3 py-2", campo.conferir && "bg-amber-50/40")}>
                <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{campo.campo}</span>
                  <Selo tom={TOM_DA_FONTE[campo.fonte]}>{ROTULO_DA_FONTE[campo.fonte]}</Selo>
                </dt>
                <dd className={cn("break-words font-medium text-foreground", !campo.valor && "font-normal italic text-muted-foreground")}>
                  {campo.valor ?? "não encontrado"}
                </dd>
                {campo.nota ? <dd className="text-xs text-muted-foreground">{campo.nota}</dd> : null}
              </div>
            ))}
          </dl>
          <ul className="space-y-1 text-xs text-muted-foreground" aria-label="Fontes consultadas">
            <LinhaFonte nome="DJEN" status={capa.fontes.djen} detalhe={capa.dados.djen ? `${capa.dados.djen.comunicacoes} comunicação(ões)` : undefined} />
            <LinhaFonte nome="e-SAJ" status={capa.fontes.esaj} detalhe={capa.dados.esaj?.valor != null ? "com o valor da ação" : "sem o valor da ação"} />
            {datajud.carregando ? (
              <li className="flex items-center gap-1.5">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">DataJud</span> · consultando (leva até 1 min)…
                </span>
              </li>
            ) : (
              <LinhaFonte
                nome="DataJud"
                status={
                  datajud.resultado
                    ? { ok: datajud.resultado.achou, ms: datajud.resultado.ms, erro: datajud.resultado.erro }
                    : { ok: false, ms: 0, erro: datajud.erro }
                }
              />
            )}
          </ul>
        </>
      )}
    </Secao>
  );
}
