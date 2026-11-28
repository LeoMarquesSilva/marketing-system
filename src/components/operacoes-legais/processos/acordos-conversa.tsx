"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, LoaderCircle, Mail, RefreshCw, Reply, Send, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { assuntoDeResposta, conversaDosEventos, destinatariosDaResposta, separarEmails, type EventoNegociacao } from "@/lib/processos/negociacao";
import type { ConfiguracaoDosAcordos } from "@/lib/processos/negociacao-server";
import type { ResultadoDaConferencia } from "@/lib/processos/negociacao-conversa-server";
import { cn } from "@/lib/utils";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Aviso, Campo } from "../vistagem/ui";
import { formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";

const BASE = "/acordos-trabalhistas";

export const listaDeEmails = (texto: string) => separarEmails(texto);
const juntar = (lista: string[]) => lista.join("; ");

/** Uma linha do cabeçalho do e-mail, como no Outlook: rótulo à esquerda, campo à direita. */
function LinhaDoCabecalho({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 border-b border-[#e6eef0] px-3 py-1.5 last:border-b-0">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{rotulo}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

const campoSemBorda = "h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";

/**
 * O e-mail como no Outlook: De (a caixa que envia), Para, Cc, Assunto e o texto. `antesDoTexto` entra entre o
 * cabeçalho e o corpo (ex.: os processos do e-mail).
 */
export function CompositorDeEmail({
  de,
  para,
  onPara,
  cc,
  onCc,
  assunto,
  onAssunto,
  texto,
  onTexto,
  dicaDoTexto,
  antesDoTexto,
}: {
  de: string | null;
  para: string;
  onPara: (valor: string) => void;
  cc: string;
  onCc: (valor: string) => void;
  assunto: string;
  onAssunto?: (valor: string) => void;
  texto: string;
  onTexto: (valor: string) => void;
  dicaDoTexto?: ReactNode;
  antesDoTexto?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[#dce9eb] bg-white">
        <LinhaDoCabecalho rotulo="De">
          <p className={cn("truncate text-sm", de ? "text-[#10293a]" : "text-amber-800")}>{de ?? "Sem caixa para enviar: configure em Envio."}</p>
        </LinhaDoCabecalho>
        <LinhaDoCabecalho rotulo="Para">
          <Input value={para} onChange={(evento) => onPara(evento.target.value)} placeholder="advogado@exemplo.adv.br; outro@exemplo.adv.br" className={campoSemBorda} aria-label="Para" />
        </LinhaDoCabecalho>
        <LinhaDoCabecalho rotulo="Cc">
          <Input value={cc} onChange={(evento) => onCc(evento.target.value)} placeholder="Em cópia (ex.: a caixa da equipe)" className={campoSemBorda} aria-label="Cc" />
        </LinhaDoCabecalho>
        <LinhaDoCabecalho rotulo="Assunto">
          {onAssunto ? (
            <Input value={assunto} onChange={(evento) => onAssunto(evento.target.value)} className={cn(campoSemBorda, "font-medium")} aria-label="Assunto" />
          ) : (
            <p className="truncate text-sm font-medium">{assunto}</p>
          )}
        </LinhaDoCabecalho>
      </div>
      {antesDoTexto}
      <div className="space-y-1">
        <Textarea value={texto} rows={14} onChange={(evento) => onTexto(evento.target.value)} className="min-h-64 bg-white font-sans text-sm leading-relaxed" aria-label="Texto do e-mail" />
        {dicaDoTexto ? <p className="text-xs text-muted-foreground">{dicaDoTexto}</p> : null}
      </div>
    </div>
  );
}

/** O resumo da confirmação (antes de qualquer e-mail sair). */
export function ResumoDoEnvio({ de, para, cc, assunto, texto, extra }: { de: string | null; para: string[]; cc: string[]; assunto: string; texto: string; extra?: ReactNode }) {
  const linha = (rotulo: string, valor: ReactNode) => (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium">{valor}</dd>
    </div>
  );
  return (
    <>
      <dl className="space-y-1.5 text-sm">
        {linha("De", de)}
        {linha("Para", para.join(", "))}
        {cc.length ? linha("Cc", cc.join(", ")) : null}
        {linha("Assunto", assunto)}
        {extra}
      </dl>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-[#dce9eb] bg-[#f7fbfc] p-3 font-sans text-sm">{texto}</pre>
    </>
  );
}

/* ------------------------------------------------------------ configuração */

/** A caixa que envia os e-mails de acordo e a cópia padrão (ex.: a caixa da equipe trabalhista). */
export function DialogoConfiguracaoDoEnvio({ configuracao, onFechar, onSalvo }: { configuracao: ConfiguracaoDosAcordos; onFechar: () => void; onSalvo: (configuracao: ConfiguracaoDosAcordos) => void }) {
  const [remetente, setRemetente] = useState(configuracao.remetente ?? "");
  const [cc, setCc] = useState(juntar(configuracao.cc));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const resposta = await processosApi.put<{ configuracao: ConfiguracaoDosAcordos }>(`${BASE}/configuracao`, { remetente: remetente.trim(), cc: listaDeEmails(cc) });
      onSalvo(resposta.configuracao);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={Settings2}
      titulo="Envio dos e-mails de acordo"
      descricao="Vale para todos os e-mails de acordo trabalhista, de quem estiver logado."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !configuracao.disponivel}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!configuracao.disponivel ? <Aviso tom="alerta">Falta aplicar a migration das conversas dos acordos (20261127210000) para guardar a configuração.</Aviso> : null}
      <Campo rotulo="Caixa que envia" dica="A caixa do Microsoft 365 de onde os e-mails saem e onde as respostas chegam. Vazia: sai da caixa de quem está logado.">
        <Input value={remetente} onChange={(evento) => setRemetente(evento.target.value)} placeholder="nome@escritorio.com.br" inputMode="email" />
      </Campo>
      <Campo rotulo="Cópia (Cc) padrão" dica="Entra em cópia em todo e-mail de acordo; dá para tirar no e-mail. Separe com ponto e vírgula.">
        <Input value={cc} onChange={(evento) => setCc(evento.target.value)} placeholder="equipe@escritorio.com.br" inputMode="email" />
      </Campo>
      {configuracao.atualizadoPorNome ? (
        <p className="text-xs text-muted-foreground">
          Alterado por {configuracao.atualizadoPorNome}
          {configuracao.atualizadoEm ? ` em ${formatarDataHora(configuracao.atualizadoEm)}` : ""}.
        </p>
      ) : null}
    </DialogoAcao>
  );
}

/* ------------------------------------------------------------ conversa */

function MensagemDaConversa({ evento, onResponder }: { evento: EventoNegociacao; onResponder?: () => void }) {
  const [aberta, setAberta] = useState(false);
  const recebida = evento.tipo === "email_recebido";
  const corpo = (evento.corpo ?? "").trim();
  const longo = corpo.split("\n").length > 8 || corpo.length > 700;
  return (
    <li className={cn("rounded-md border px-3 py-2", recebida ? "border-[#c9e7d8] bg-[#f3fbf7]" : "border-[#dce9eb] bg-white")}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
        {recebida ? <ArrowDownLeft className="mt-0.5 size-3.5 shrink-0 text-emerald-700" aria-label="Recebido" /> : <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[#285f7a]" aria-label="Enviado" />}
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{evento.remetente ?? (evento.tipo === "email_rascunho" ? "Rascunho (.eml)" : "—")}</span>
          <span className="text-muted-foreground"> → {evento.para.join(", ") || "—"}</span>
          {evento.cc.length ? <span className="block text-xs text-muted-foreground">Cc: {evento.cc.join(", ")}</span> : null}
        </p>
        <span className="text-[11px] text-muted-foreground">{formatarDataHora(evento.mensagemEm ?? evento.quando)}</span>
      </div>
      {evento.assunto ? <p className="mt-1 text-xs font-medium text-[#10293a]">{evento.assunto}</p> : null}
      {corpo ? <p className={cn("mt-1 whitespace-pre-wrap text-sm text-[#24323d]", !aberta && longo && "line-clamp-6")}>{corpo}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {longo ? (
          <Button size="xs" variant="ghost" onClick={() => setAberta((atual) => !atual)}>
            {aberta ? <ChevronUp /> : <ChevronDown />} {aberta ? "Mostrar menos" : "Mostrar tudo"}
          </Button>
        ) : null}
        {onResponder ? (
          <Button size="xs" variant="outline" onClick={onResponder} className="ml-auto">
            <Reply /> Responder
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A conversa por e-mail da negociação (como no Outlook, do mais antigo ao mais novo), com a conferência das
 * respostas e a resposta pela própria tela (confirmada antes de sair).
 */
export function ConversaDoAcordo({
  processoId,
  eventos,
  ccPadrao,
  envioPeloOutlook,
  onAtualizar,
}: {
  processoId: string;
  eventos: EventoNegociacao[] | null;
  ccPadrao: string[];
  envioPeloOutlook: boolean;
  onAtualizar: () => void;
}) {
  const [conferindo, setConferindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [resposta, setResposta] = useState<{ evento: EventoNegociacao; para: string; cc: string; texto: string; confirmando: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const conversa = eventos ? conversaDosEventos(eventos) : [];

  async function conferir() {
    setConferindo(true);
    setAviso("");
    try {
      const resultado = await processosApi.post<ResultadoDaConferencia>(`${BASE}/respostas`, { processoIds: [processoId] });
      setAviso(resultado.aviso ?? (resultado.novas ? `${resultado.novas} e-mail${resultado.novas === 1 ? "" : "s"} novo${resultado.novas === 1 ? "" : "s"} na conversa.` : "Nada novo na conversa."));
      if (resultado.novas) onAtualizar();
    } catch (falha) {
      setAviso(mensagemDeErro(falha));
    } finally {
      setConferindo(false);
    }
  }

  function responder(evento: EventoNegociacao) {
    const destino = destinatariosDaResposta(evento, evento.caixa, ccPadrao);
    setErro("");
    setResposta({ evento, para: juntar(destino.para), cc: juntar(destino.cc), texto: "", confirmando: false });
  }

  async function enviarResposta() {
    if (!resposta) return;
    setEnviando(true);
    setErro("");
    try {
      await processosApi.post(`${BASE}/email`, {
        acao: "responder",
        confirmado: true,
        processoId,
        mensagemId: resposta.evento.mensagemId,
        para: listaDeEmails(resposta.para),
        cc: listaDeEmails(resposta.cc),
        texto: resposta.texto,
      });
      setResposta(null);
      setAviso("Resposta enviada. Ela aparece na conversa na próxima conferência.");
      onAtualizar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setResposta((atual) => (atual ? { ...atual, confirmando: false } : atual));
    } finally {
      setEnviando(false);
    }
  }

  const ultimaAcompanhada = [...conversa].reverse().find((evento) => evento.mensagemId && evento.caixa);

  return (
    <section aria-label="Conversa por e-mail" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase text-[#285f7a]">
          <Mail className="size-3.5" aria-hidden /> Conversa por e-mail
        </h3>
        <Button size="xs" variant="outline" onClick={() => void conferir()} disabled={conferindo} className="ml-auto" title="Busca na caixa do Outlook as respostas e o que a equipe mandou nesta conversa">
          {conferindo ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Conferir respostas
        </Button>
        {ultimaAcompanhada && envioPeloOutlook ? (
          <Button size="xs" onClick={() => responder(ultimaAcompanhada)}>
            <Reply /> Responder
          </Button>
        ) : null}
      </div>
      {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
      {eventos === null ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : conversa.length ? (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {conversa.map((evento) => (
            <MensagemDaConversa key={evento.id} evento={evento} onResponder={evento.mensagemId && evento.caixa && envioPeloOutlook ? () => responder(evento) : undefined} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum e-mail ainda.</p>
      )}

      {resposta ? (
        <DialogoAcao
          aberto
          onFechar={() => (resposta.confirmando ? setResposta({ ...resposta, confirmando: false }) : setResposta(null))}
          ocupado={enviando}
          icone={resposta.confirmando ? Send : Reply}
          titulo={resposta.confirmando ? "Confirmar a resposta" : "Responder"}
          descricao={resposta.confirmando ? "A resposta sai agora, na mesma conversa do Outlook, com o histórico citado abaixo." : "Fica na mesma conversa do Outlook; o histórico vai citado abaixo do seu texto."}
          className="sm:max-w-3xl"
          rodape={
            resposta.confirmando ? (
              <>
                <Button variant="outline" onClick={() => setResposta({ ...resposta, confirmando: false })} disabled={enviando}>
                  Voltar
                </Button>
                <Button onClick={() => void enviarResposta()} disabled={enviando}>
                  {enviando ? <LoaderCircle className="animate-spin" /> : <Send />} Confirmar e enviar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResposta(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => setResposta({ ...resposta, confirmando: true })} disabled={!listaDeEmails(resposta.para).length || !resposta.texto.trim()}>
                  <Send /> Enviar…
                </Button>
              </>
            )
          }
        >
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
          {resposta.confirmando ? (
            <ResumoDoEnvio de={resposta.evento.caixa} para={listaDeEmails(resposta.para)} cc={listaDeEmails(resposta.cc)} assunto={assuntoDeResposta(resposta.evento.assunto)} texto={resposta.texto} />
          ) : (
            <CompositorDeEmail
              de={resposta.evento.caixa}
              para={resposta.para}
              onPara={(valor) => setResposta({ ...resposta, para: valor })}
              cc={resposta.cc}
              onCc={(valor) => setResposta({ ...resposta, cc: valor })}
              assunto={assuntoDeResposta(resposta.evento.assunto)}
              texto={resposta.texto}
              onTexto={(valor) => setResposta({ ...resposta, texto: valor })}
              dicaDoTexto="O e-mail respondido vai citado abaixo do seu texto, como no Outlook."
            />
          )}
        </DialogoAcao>
      ) : null}
    </section>
  );
}
