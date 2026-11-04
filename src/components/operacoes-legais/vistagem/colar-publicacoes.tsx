"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { ClipboardPaste, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { MAX_TEXTO_COLADO, lerPublicacoesColadas, type LeituraColada, type TrechoIgnorado } from "@/lib/vistagem/importacao-texto";
import type { ArquivoKurierResumo, TriagemResumo } from "@/lib/vistagem/types";
import { formatarData } from "./publicacao-ui";
import { Aviso, Selo } from "./ui";

export interface ResultadoColagem {
  arquivo: ArquivoKurierResumo;
  novo: boolean;
  triagem?: TriagemResumo;
  ignorados: TrechoIgnorado[];
}

function plural(total: number, singular: string, varias: string): string {
  return `${total} ${total === 1 ? singular : varias}`;
}

/** O que o sistema entendeu do texto, antes de importar. */
function Previa({ leitura }: { leitura: LeituraColada }) {
  const { publicacoes, ignorados } = leitura;
  return (
    <div className="space-y-3">
      {publicacoes.length ? (
        <section aria-label="Publicações reconhecidas" className="space-y-2">
          <p className="text-sm font-medium text-foreground">{plural(publicacoes.length, "publicação reconhecida", "publicações reconhecidas")}</p>
          <ol className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
            {publicacoes.map((publicacao) => (
              <li key={publicacao.linha.linha} className="space-y-1 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs tabular-nums text-muted-foreground">{publicacao.linha.linha}.</span>
                  <span className="font-semibold tabular-nums text-foreground">{publicacao.processo}</span>
                  {publicacao.tribunal ? <Selo tom="marca">{publicacao.tribunal}</Selo> : <Selo tom="alerta">tribunal não identificado</Selo>}
                  {publicacao.tipoComunicacao ? <span className="text-xs text-muted-foreground">{publicacao.tipoComunicacao}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {publicacao.orgao ?? "Órgão não informado"} · disponibilizada em {formatarData(publicacao.linha.dataDivulgacao)} · publicada em{" "}
                  {formatarData(publicacao.linha.dataPublicacao)}
                  {publicacao.intimados.length ? ` · intimado: ${publicacao.intimados.join(", ")}` : ""}
                </p>
                <p className="line-clamp-2 text-xs text-foreground/80">{publicacao.resumo}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {ignorados.length ? (
        <Aviso tom="alerta" titulo={plural(ignorados.length, "trecho não será importado", "trechos não serão importados")}>
          <ul className="space-y-1">
            {ignorados.map((item, indice) => (
              <li key={indice}>
                <span className="font-medium">{item.motivo}</span>: “{item.trecho}”
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}
    </div>
  );
}

/**
 * Captura › Colar publicações: para as poucas demandas que chegam por e-mail ou Teams. O texto é lido
 * aqui para conferir; o servidor lê de novo, grava e tria como o arquivo da Kurier.
 */
export function ColarPublicacoes({
  aberto,
  onFechar,
  onImportado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onImportado: (resultado: ResultadoColagem) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const idTexto = useId();
  const textoAdiado = useDeferredValue(texto);
  const leitura = useMemo(() => lerPublicacoesColadas(textoAdiado), [textoAdiado]);
  const lendo = textoAdiado !== texto;
  const total = leitura.publicacoes.length;

  async function importar() {
    setEnviando(true);
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/colar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao importar as publicações.");
      setTexto("");
      onImportado(corpo as ResultadoColagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao importar as publicações.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && !enviando && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl" showCloseButton={!enviando}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-4 pr-14 text-left">
          <DialogTitle className="text-lg">Colar publicações</DialogTitle>
          <DialogDescription>
            Para as publicações que chegam por e-mail ou Teams. Cole o texto como veio (Recorte Digital da OAB/SP ou comunicação do
            DJEN): cada publicação segue a mesma esteira do arquivo da Kurier, para Duplicidades, Controladoria ou Jurídico.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <label htmlFor={idTexto} className="text-sm font-medium text-foreground">
              Texto do e-mail ou da mensagem
            </label>
            <Textarea
              id={idTexto}
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value);
                setErro("");
              }}
              maxLength={MAX_TEXTO_COLADO}
              rows={9}
              placeholder={"Data de Disponibilização: 04/11/2026\nData de Publicação: 05/11/2026\n…\nPublicação: Intimação\nPROCESSO: 0000000-00.0000.0.00.0000 …"}
              className="max-h-72 min-h-40 font-mono text-xs"
              disabled={enviando}
            />
            <p className="text-xs text-muted-foreground">Pode colar o e-mail inteiro: a saudação e a assinatura são ignoradas.</p>
          </div>
          {texto.trim() ? lendo ? <p className="text-xs text-muted-foreground">Lendo…</p> : <Previa leitura={leitura} /> : null}
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <Button variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={!total || lendo || enviando}>
            {enviando ? <LoaderCircle className="animate-spin" /> : <ClipboardPaste />}
            {total ? `Importar ${plural(total, "publicação", "publicações")}` : "Importar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
