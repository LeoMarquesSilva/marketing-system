"use client";

import { useRef, useState } from "react";
import { Bot, FileText, Hourglass, LoaderCircle, Paperclip, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutosDoProcesso, DocumentoAutos, MotivoEspera, PedidoAutos } from "@/lib/processos/autos-types";
import { ROTULO_SISTEMA, type SistemaTribunal } from "@/lib/processos/tribunais";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Aviso, PainelTopo, Painel, Selo, type TomSelo } from "../vistagem/ui";
import { abrirAutos, anexarAutos, formatarDataHora, formatarTamanho, mensagemDeErro, processosApi } from "./processos-api";

const ESPERA: Record<MotivoEspera, { titulo: string; texto: string }> = {
  login: { titulo: "O robô espera o login", texto: "Alguém precisa concluir o login do tribunal na janela aberta na máquina do robô. Ele segue sozinho depois." },
  segundo_fator: { titulo: "O robô espera o código de verificação", texto: "O tribunal pediu o segundo fator. O advogado informa o código na janela aberta na máquina do robô; o robô não contorna essa etapa." },
  captcha: { titulo: "O robô parou num CAPTCHA", texto: "Uma pessoa precisa resolver o desafio na janela aberta na máquina do robô. Ele não tenta resolver sozinho." },
  segredo_justica: { titulo: "Processo em segredo de justiça", texto: "O tribunal marca este processo como segredo de justiça. O robô só baixa os autos se alguém liberar aqui." },
};

const LEITURA: Record<DocumentoAutos["leitura"], { tom: TomSelo; rotulo: string }> = {
  pendente: { tom: "neutro", rotulo: "A ler" },
  lendo: { tom: "ia", rotulo: "A IA está lendo" },
  lida: { tom: "sucesso", rotulo: "Lido pela IA" },
  sem_texto: { tom: "alerta", rotulo: "Sem texto" },
  erro: { tom: "perigo", rotulo: "Leitura falhou" },
};

/** Leitura "lendo" há mais de 6 min é de uma execução que morreu: o botão de ler volta. */
function lendoAgora(documento: DocumentoAutos, lendo: string): boolean {
  if (documento.id === lendo) return true;
  if (documento.leitura !== "lendo") return false;
  const inicio = documento.leituraIniciadaEm ? new Date(documento.leituraIniciadaEm).getTime() : 0;
  return Date.now() - inicio < 6 * 60_000;
}

function LinhaDoPedido({ pedido, ocupado, onAcao }: { pedido: PedidoAutos; ocupado: boolean; onAcao: (acao: "cancelar" | "liberar_segredo") => void }) {
  if (pedido.status === "erro") {
    return (
      <Aviso tom="erro" titulo="O robô não conseguiu baixar os autos">
        {pedido.erro ?? "Erro não informado."} Você pode pedir de novo ou anexar o PDF.
      </Aviso>
    );
  }
  const cancelar = (
    <Button size="xs" variant="ghost" className="shrink-0" disabled={ocupado} onClick={() => onAcao("cancelar")}>
      <X /> Cancelar
    </Button>
  );
  if (pedido.status === "aguardando_pessoa" && pedido.motivoEspera) {
    const espera = ESPERA[pedido.motivoEspera];
    return (
      <Aviso tom="alerta" titulo={espera.titulo}>
        <p>{espera.texto}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pedido.motivoEspera === "segredo_justica" ? (
            <Button size="xs" variant="outline" disabled={ocupado} onClick={() => onAcao("liberar_segredo")}>
              <ShieldAlert /> Liberar o download
            </Button>
          ) : null}
          {cancelar}
        </div>
      </Aviso>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2">
      {pedido.status === "em_andamento" ? <LoaderCircle className="size-4 shrink-0 animate-spin text-[#3e84a8]" aria-hidden /> : <Hourglass className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{pedido.status === "em_andamento" ? "O robô está baixando os autos" : "Na fila do robô"}</p>
        <p className="text-xs text-muted-foreground">
          Pedido em {formatarDataHora(pedido.criadoEm)}
          {pedido.autor ? ` por ${pedido.autor}` : ""}
        </p>
      </div>
      {cancelar}
    </div>
  );
}

/**
 * Painel "Autos" da ficha: pedir o download ao robô, anexar o PDF à mão e ver os documentos, com a
 * situação da leitura pela IA. As sugestões que saem da leitura ficam no painel "Sugestões da IA".
 */
export function PainelAutos({
  processoId,
  autos,
  onAutos,
  onFeito,
  onErro,
}: {
  processoId: string;
  autos: AutosDoProcesso;
  onAutos: (autos: AutosDoProcesso) => void;
  onFeito: (mensagem: string) => void;
  onErro: (mensagem: string) => void;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState("");
  const [lendo, setLendo] = useState("");
  const [liberar, setLiberar] = useState(false);
  const [confirmaSegredo, setConfirmaSegredo] = useState(false);
  const [excluir, setExcluir] = useState<DocumentoAutos | null>(null);

  const { robo, pedidos, documentos } = autos;
  const ultimo = pedidos[0];
  const pedidoVisivel = ultimo && (ultimo.status === "pendente" || ultimo.status === "em_andamento" || ultimo.status === "aguardando_pessoa" || ultimo.status === "erro") ? ultimo : null;
  const pedidoAberto = pedidoVisivel && pedidoVisivel.status !== "erro";
  const pendentesPorDocumento = new Map<string, number>();
  for (const sugestao of autos.sugestoes) {
    if (sugestao.situacao === "pendente" && sugestao.documentoId) pendentesPorDocumento.set(sugestao.documentoId, (pendentesPorDocumento.get(sugestao.documentoId) ?? 0) + 1);
  }

  async function executar(chave: string, acao: () => Promise<void>) {
    setOcupado(chave);
    onErro("");
    try {
      await acao();
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  async function ler(documento: DocumentoAutos) {
    setLendo(documento.id);
    onErro("");
    try {
      const resposta = await processosApi.post<{ leitura: { sugestoes: number; aviso: string | null; situacao: string }; autos: AutosDoProcesso }>(`/autos/documentos/${documento.id}/ler`);
      onAutos(resposta.autos);
      const { sugestoes, aviso, situacao } = resposta.leitura;
      if (situacao === "sem_texto") onErro("O PDF não tem camada de texto (páginas digitalizadas): a IA não consegue ler. Preencha a ficha à mão.");
      else onFeito(`${sugestoes ? `A IA deixou ${sugestoes} sugest${sugestoes === 1 ? "ão" : "ões"} para você conferir.` : "A IA leu os autos e não encontrou nada novo para sugerir."}${aviso ? ` ${aviso}` : ""}`);
    } catch (falha) {
      onErro(mensagemDeErro(falha));
      // A leitura pode ter ficado registrada como erro: recarrega para mostrar.
      void processosApi.get<{ autos: AutosDoProcesso }>(`/${processoId}/autos`).then((resposta) => onAutos(resposta.autos), () => undefined);
    } finally {
      setLendo("");
    }
  }

  async function anexar(arquivo: File) {
    const enviado: { documento: DocumentoAutos | null } = { documento: null };
    await executar("anexar", async () => {
      const resposta = await anexarAutos(processoId, arquivo);
      onAutos(resposta.autos);
      enviado.documento = resposta.documento;
      if (!resposta.autos.iaConfigurada) onFeito("PDF anexado. A leitura pela IA está desligada neste ambiente (falta a chave da OpenAI).");
    });
    // Anexou: a leitura começa em seguida, sem outro clique.
    if (enviado.documento && autos.iaConfigurada) await ler(enviado.documento);
  }

  const pedir = (liberarSegredo: boolean) =>
    executar("pedir", async () => {
      const resposta = await processosApi.post<{ autos: AutosDoProcesso }>(`/${processoId}/autos/pedidos`, { liberarSegredo });
      onAutos(resposta.autos);
      setLiberar(false);
      setConfirmaSegredo(false);
      onFeito("Pedido enviado ao robô. O PDF aparece aqui quando ele terminar.");
    });

  const decidirPedido = (pedido: PedidoAutos, acao: "cancelar" | "liberar_segredo") =>
    executar("pedido", async () => {
      const resposta = await processosApi.post<{ autos: AutosDoProcesso }>(`/autos/pedidos/${pedido.id}`, { acao });
      onAutos(resposta.autos);
      onFeito(acao === "cancelar" ? "Pedido cancelado." : "Download liberado. O pedido voltou para a fila do robô.");
    });

  const sistema = robo.sistema ? ROTULO_SISTEMA[robo.sistema as SistemaTribunal] : null;

  return (
    <Painel>
      <PainelTopo titulo="Autos" descricao="PDF do processo: baixado pelo robô no tribunal ou anexado aqui. A IA lê e sugere o que falta." />
      <div className="space-y-3 border-b border-[#e6eef0] px-4 py-3">
        {pedidoVisivel ? <LinhaDoPedido pedido={pedidoVisivel} ocupado={ocupado === "pedido"} onAcao={(acao) => void decidirPedido(pedidoVisivel, acao)} /> : null}
        <div className="flex flex-wrap gap-2">
          {robo.disponivel && !pedidoAberto ? (
            <Button size="sm" variant="outline" disabled={Boolean(ocupado)} onClick={() => (autos.segredoJustica ? setLiberar(true) : void pedir(false))}>
              {ocupado === "pedir" ? <LoaderCircle className="animate-spin" /> : <Bot />} {pedidoVisivel?.status === "erro" ? "Pedir de novo ao robô" : "Pedir ao robô"}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={Boolean(ocupado) || Boolean(lendo)} onClick={() => arquivoRef.current?.click()}>
            {ocupado === "anexar" ? <LoaderCircle className="animate-spin" /> : <Paperclip />} {ocupado === "anexar" ? "Enviando" : "Anexar PDF"}
          </Button>
          <input
            ref={arquivoRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-label="Anexar o PDF dos autos"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              evento.target.value = "";
              if (arquivo) void anexar(arquivo);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{robo.disponivel ? `Robô disponível: ${sistema} do ${robo.tribunal}.` : robo.motivo}</p>
      </div>

      {documentos.length ? (
        <ul className="divide-y divide-[#e6eef0]">
          {documentos.map((documento) => {
            const estaLendo = lendoAgora(documento, lendo);
            const selo = estaLendo ? LEITURA.lendo : documento.leitura === "lendo" ? LEITURA.erro : LEITURA[documento.leitura];
            const pendentes = pendentesPorDocumento.get(documento.id) ?? 0;
            const detalhes = [
              documento.paginas ? `${documento.paginas} pág.` : null,
              formatarTamanho(documento.tamanhoBytes),
              documento.origem === "robo" ? "baixado pelo robô" : `anexado${documento.autor ? ` por ${documento.autor}` : ""}`,
              formatarDataHora(documento.criadoEm),
            ].filter(Boolean);
            return (
              <li key={documento.id} className="space-y-1.5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="block max-w-full truncate text-left text-sm font-medium text-[#347796] underline decoration-[#347796]/40 underline-offset-4 hover:text-[#285f7a] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
                      title={`Abrir ${documento.nome}`}
                      onClick={() => void abrirAutos(documento.id).catch((falha) => onErro(mensagemDeErro(falha)))}
                    >
                      {documento.nome}
                    </button>
                    <p className="text-xs text-muted-foreground">{detalhes.join(" · ")}</p>
                  </div>
                  <Button size="icon-xs" variant="ghost" aria-label={`Excluir ${documento.nome}`} title="Excluir" disabled={estaLendo || Boolean(ocupado)} onClick={() => setExcluir(documento)}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <Selo tom={selo.tom} icone={estaLendo ? LoaderCircle : undefined} className={estaLendo ? "[&_svg]:animate-spin" : undefined}>
                    {selo.rotulo}
                  </Selo>
                  {pendentes ? <Selo tom="ia">{pendentes} a conferir</Selo> : null}
                  {!estaLendo && autos.iaConfigurada ? (
                    <Button size="xs" variant="ghost" className="text-xs" disabled={Boolean(lendo) || Boolean(ocupado)} onClick={() => void ler(documento)}>
                      <Sparkles /> {documento.leitura === "lida" || documento.leitura === "sem_texto" ? "Ler de novo" : "Ler com a IA"}
                    </Button>
                  ) : null}
                </div>
                {estaLendo ? <p className="pl-6 text-xs text-muted-foreground">Autos grandes levam alguns minutos. Pode continuar na ficha.</p> : null}
                {!estaLendo && documento.leituraErro ? <p className={`pl-6 text-xs ${documento.leitura === "erro" ? "text-red-700" : "text-muted-foreground"}`}>{documento.leituraErro}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum PDF ainda. {robo.disponivel ? "Peça ao robô ou anexe o arquivo." : "Anexe o arquivo dos autos."}</p>
      )}
      {!autos.iaConfigurada ? <p className="border-t border-[#e6eef0] px-4 py-2.5 text-xs text-amber-800">A leitura pela IA está desligada: falta a chave da OpenAI no servidor.</p> : null}

      {liberar ? (
        <DialogoAcao
          aberto
          onFechar={() => setLiberar(false)}
          ocupado={ocupado === "pedir"}
          icone={ShieldAlert}
          tom="alerta"
          titulo="Processo em segredo de justiça"
          descricao="O cadastro marca este processo como segredo de justiça. O robô só baixa os autos com a sua liberação."
          rodape={
            <>
              <Button variant="outline" onClick={() => setLiberar(false)} disabled={ocupado === "pedir"}>
                Cancelar
              </Button>
              <Button onClick={() => void pedir(true)} disabled={!confirmaSegredo || ocupado === "pedir"}>
                {ocupado === "pedir" ? <LoaderCircle className="animate-spin" /> : <Bot />} Liberar e pedir
              </Button>
            </>
          }
        >
          <label className="flex items-start gap-2.5 rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#347796]" checked={confirmaSegredo} onChange={(evento) => setConfirmaSegredo(evento.target.checked)} />
            <span>
              <span className="font-medium text-foreground">Libero o download destes autos</span>
              <span className="block text-xs text-muted-foreground">A liberação fica registrada no histórico com o seu nome. O PDF vai para o armazenamento privado do ORQESTRAI.</span>
            </span>
          </label>
        </DialogoAcao>
      ) : null}

      {excluir ? (
        <DialogoAcao
          aberto
          onFechar={() => setExcluir(null)}
          ocupado={ocupado === "excluir"}
          icone={Trash2}
          tom="perigo"
          titulo="Excluir o PDF?"
          descricao={`${excluir.nome} sai do processo, com as sugestões dele que ainda não foram decididas.`}
          rodape={
            <>
              <Button variant="outline" onClick={() => setExcluir(null)} disabled={ocupado === "excluir"}>
                Manter
              </Button>
              <Button
                variant="destructive"
                disabled={ocupado === "excluir"}
                onClick={() =>
                  void executar("excluir", async () => {
                    const resposta = await processosApi.del<{ autos: AutosDoProcesso }>(`/autos/documentos/${excluir.id}`);
                    onAutos(resposta.autos);
                    setExcluir(null);
                    onFeito("PDF excluído.");
                  })
                }
              >
                {ocupado === "excluir" ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Excluir
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">O que já foi aprovado continua no cadastro e no histórico.</p>
        </DialogoAcao>
      ) : null}
    </Painel>
  );
}
