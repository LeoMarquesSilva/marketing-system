"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCheck, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileUp, Handshake, History, LoaderCircle, Mail, MailCheck, MailSearch, PencilLine, RefreshCw, Scale, Send, Settings2, Sparkles, TriangleAlert, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_NEGOCIACAO,
  agruparPorAdvogado,
  gerarEml,
  montarEmailDeAcordo,
  rotuloDoStatus,
  saudacaoPelaHora,
  type EventoNegociacao,
  type GrupoDeAdvogado,
  type LinhaNegociacao,
  type Negociacao,
  type StatusNegociacao,
} from "@/lib/processos/negociacao";
import type { ConfiguracaoDosAcordos, PainelDeNegociacao, ResultadoImportacao } from "@/lib/processos/negociacao-server";
import type { ResultadoDaConferencia } from "@/lib/processos/negociacao-conversa-server";
import { formatarReais } from "@/lib/processos/trabalhista";
import { cn } from "@/lib/utils";
import { CampoData } from "../vistagem/campo-data";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor, type OpcaoSeletor } from "../vistagem/seletor";
import { Aviso, Busca, Campo, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { CompositorDeEmail, ConversaDoAcordo, DialogoConfiguracaoDoEnvio, ResumoDoEnvio, listaDeEmails } from "./acordos-conversa";
import { formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";

const BASE = "/acordos-trabalhistas";

const TOM_STATUS: Record<StatusNegociacao, TomSelo> = {
  a_enviar: "neutro",
  enviado: "marca",
  respondido: "ia",
  proposta_recebida: "alerta",
  contraproposta: "alerta",
  acordo_fechado: "sucesso",
  sem_interesse: "perigo",
};

const real = (valor: number | null) => (valor === null ? "—" : formatarReais(valor));
const dia = (iso: string | null) => (iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "");

type Dialogo = { tipo: "email"; grupo: GrupoDeAdvogado } | { tipo: "negociacao"; linha: LinhaNegociacao } | { tipo: "configuracao" } | null;

/**
 * Aba Acordos da Carteira Trabalhista: a tentativa de acordo de cada processo, agrupada pelo advogado do reclamante.
 * `atualizacao` muda quando a carteira recarrega (o painel acompanha).
 */
export function PainelDeAcordos({ atualizacao = 0 }: { atualizacao?: number }) {
  const [dados, setDados] = useState<PainelDeNegociacao | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [grupoCliente, setGrupoCliente] = useState("");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [baixando, setBaixando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [avisoConversa, setAvisoConversa] = useState("");
  const [confirmando, setConfirmando] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const conferiuAoAbrir = useRef(false);

  useEffect(() => {
    let ativo = true;
    processosApi.get<PainelDeNegociacao>(BASE).then(
      (resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setErro("");
      },
      (falha: unknown) => {
        if (ativo) setErro(mensagemDeErro(falha));
      }
    );
    return () => {
      ativo = false;
    };
  }, [tentativa, atualizacao]);

  // Ao abrir, uma conferência das respostas na caixa (sem travar a tela); a pessoa confere de novo pelo botão.
  useEffect(() => {
    if (!dados || conferiuAoAbrir.current) return;
    conferiuAoAbrir.current = true;
    void conferirRespostas(true);
  }, [dados]);

  const todas = useMemo(() => dados?.linhas ?? [], [dados]);
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = busca.replace(/\D/g, "");
    return todas.filter((linha) => {
      if (status && linha.negociacao.status !== status) return false;
      if (grupoCliente && linha.grupoCliente !== grupoCliente) return false;
      if (!termo) return true;
      if (digitos.length >= 4 && ((linha.cnj ?? "").replace(/\D/g, "").includes(digitos) || (linha.ci ?? "").includes(digitos))) return true;
      return [linha.reclamante, linha.cliente, ...linha.advogados.map((item) => item.nome), ...linha.advogados.flatMap((item) => item.emails)].some((campo) => campo?.toLowerCase().includes(termo));
    });
  }, [todas, busca, status, grupoCliente]);
  const grupos = useMemo(() => agruparPorAdvogado(filtradas), [filtradas]);

  if (!dados && !erro) return <Carregando rotulo="Carregando os acordos trabalhistas" />;

  const contar = (valor: StatusNegociacao) => todas.filter((linha) => linha.negociacao.status === valor).length;
  const somaRisco = filtradas.reduce((total, linha) => total + (linha.riscoTotal ?? 0), 0);
  const somaMaximo = filtradas.reduce((total, linha) => total + (linha.negociacao.valorMaximoCliente ?? 0), 0);
  const semEmail = filtradas.filter((linha) => !linha.advogados.some((item) => item.emails.length)).length;
  const sugeridos = new Set(filtradas.flatMap((linha) => linha.advogados.flatMap((item) => item.sugestaoIds ?? []))).size;
  const opcoesStatus: OpcaoSeletor[] = STATUS_NEGOCIACAO.map((item) => ({ valor: item.valor, rotulo: item.rotulo, contagem: contar(item.valor) }));
  const opcoesGrupo: OpcaoSeletor[] = [...new Set(todas.map((linha) => linha.grupoCliente).filter((valor): valor is string => Boolean(valor)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((valor) => ({ valor, rotulo: valor, contagem: todas.filter((linha) => linha.grupoCliente === valor).length }));

  async function conferirRespostas(silencioso = false) {
    setConferindo(true);
    if (!silencioso) setAvisoConversa("");
    try {
      const resultado = await processosApi.post<ResultadoDaConferencia>(`${BASE}/respostas`, {});
      if (resultado.novas) setTentativa((atual) => atual + 1);
      const resumo = resultado.novas
        ? `${resultado.novas} e-mail${resultado.novas === 1 ? "" : "s"} novo${resultado.novas === 1 ? "" : "s"} nas conversas${resultado.respondidos ? `; ${resultado.respondidos} processo${resultado.respondidos === 1 ? "" : "s"} passou${resultado.respondidos === 1 ? "" : "aram"} a respondido` : ""}.`
        : silencioso
          ? ""
          : resultado.conversas
            ? `Nada novo nas ${resultado.conversas} conversa${resultado.conversas === 1 ? "" : "s"} acompanhada${resultado.conversas === 1 ? "" : "s"}.`
            : "Nenhuma conversa acompanhada ainda: os e-mails enviados pelo Outlook entram aqui.";
      setAvisoConversa([resultado.aviso, resumo].filter(Boolean).join(" "));
    } catch (falha) {
      if (!silencioso) setAvisoConversa(mensagemDeErro(falha));
    } finally {
      setConferindo(false);
    }
  }

  /** Aprova as sugestões da leitura que trazem os advogados do grupo: eles entram nas partes de cada processo. */
  async function confirmarAdvogados(grupo: GrupoDeAdvogado) {
    const ids = [...new Set(grupo.advogados.flatMap((item) => item.sugestaoIds ?? []))];
    if (!ids.length) return;
    setConfirmando(grupo.chave);
    setErro("");
    setFeito("");
    let aprovados = 0;
    try {
      for (const id of ids) {
        await processosApi.post(`/autos/sugestoes/${id}`, { acao: "aprovar" });
        aprovados += 1;
      }
      setFeito(`${aprovados} advogado${aprovados === 1 ? "" : "s"} confirmado${aprovados === 1 ? "" : "s"} nas partes dos processos.`);
    } catch (falha) {
      setErro(`${aprovados ? `${aprovados} confirmado${aprovados === 1 ? "" : "s"}; ` : ""}${mensagemDeErro(falha)}`);
    } finally {
      setConfirmando("");
      setTentativa((atual) => atual + 1);
    }
  }

  function atualizarConfiguracao(configuracao: ConfiguracaoDosAcordos) {
    setDados((atual) => (atual ? { ...atual, configuracao, remetente: configuracao.remetente ?? atual.remetente } : atual));
  }

  function atualizarLinha(processoId: string, negociacao: Negociacao) {
    setDados((atual) => (atual ? { ...atual, linhas: atual.linhas.map((linha) => (linha.processoId === processoId ? { ...linha, negociacao } : linha)) } : atual));
  }

  async function baixar() {
    setBaixando(true);
    setErro("");
    try {
      const filtrado = Boolean(busca || status || grupoCliente);
      await processosApi.baixarAcordosTrabalhistas(filtrado ? filtradas.map((linha) => linha.processoId) : null);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setBaixando(false);
    }
  }

  async function importar(escolhido: File | undefined) {
    if (!escolhido) return;
    setImportando(true);
    setErro("");
    setFeito("");
    try {
      const resultado = await processosApi.importarAcordosTrabalhistas<ResultadoImportacao>(escolhido);
      setFeito(
        [
          `Planilha lida: ${resultado.lidos} linha${resultado.lidos === 1 ? "" : "s"} com valor, ${resultado.atualizados} processo${resultado.atualizados === 1 ? "" : "s"} atualizado${resultado.atualizados === 1 ? "" : "s"}.`,
          resultado.semProcesso.length ? `${resultado.semProcesso.length} número${resultado.semProcesso.length === 1 ? "" : "s"} não ${resultado.semProcesso.length === 1 ? "está" : "estão"} entre os processos trabalhistas.` : "",
          resultado.avisos.slice(0, 5).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
      );
      setTentativa((atual) => atual + 1);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setImportando(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Indicadores>
        <Indicador icone={Mail} rotulo="A enviar" valor={contar("a_enviar")} ativo={status === "a_enviar"} onClick={() => setStatus((atual) => (atual === "a_enviar" ? "" : "a_enviar"))}>
          de {todas.length} processo{todas.length === 1 ? "" : "s"} trabalhista{todas.length === 1 ? "" : "s"}
        </Indicador>
        <Indicador icone={MailCheck} rotulo="Enviados, sem resposta" valor={contar("enviado")} ativo={status === "enviado"} onClick={() => setStatus((atual) => (atual === "enviado" ? "" : "enviado"))}>
          {contar("respondido") + contar("proposta_recebida") + contar("contraproposta")} em conversa
        </Indicador>
        <Indicador icone={Handshake} rotulo="Acordos fechados" valor={contar("acordo_fechado")} tom={contar("acordo_fechado") ? "sucesso" : "neutro"} ativo={status === "acordo_fechado"} onClick={() => setStatus((atual) => (atual === "acordo_fechado" ? "" : "acordo_fechado"))}>
          {contar("sem_interesse")} sem interesse
        </Indicador>
        <Indicador icone={Scale} rotulo="Risco total (filtro)" valor={formatarReais(somaRisco)}>
          valor máximo do cliente: {formatarReais(somaMaximo)}
        </Indicador>
      </Indicadores>

      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setTentativa((atual) => atual + 1)}>
              <RefreshCw /> Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}
      {dados && !dados.envioPeloOutlook ? (
        <Aviso tom="alerta" titulo="Envio pelo Outlook indisponível">
          {dados.remetente ? "O envio pelo Microsoft 365 não está configurado neste ambiente." : "Sem caixa para enviar: configure a caixa que envia em Envio."} Baixe o rascunho (.eml), envie pelo seu Outlook e marque como enviado.
        </Aviso>
      ) : null}
      {avisoConversa ? <Aviso tom={/permiss|migration|não está configurado|não foi encontrada/i.test(avisoConversa) ? "alerta" : "sucesso"}>{avisoConversa}</Aviso> : null}

      <Painel>
        <PainelTopo
          titulo="Acordos trabalhistas"
          descricao={
            dados?.remetente
              ? `Um e-mail por advogado do reclamante, com todos os processos dele. Sai da caixa ${dados.remetente}${dados.configuracao.cc.length ? `, com cópia para ${dados.configuracao.cc.join(", ")}` : ""}. Nada sai sem a sua confirmação.`
              : "Um e-mail por advogado do reclamante, com todos os processos dele. Nada sai sem a sua confirmação."
          }
        >
          <Button size="sm" variant="outline" onClick={() => void conferirRespostas()} disabled={conferindo} title="Busca na caixa do Outlook as respostas dos e-mails enviados">
            {conferindo ? <LoaderCircle className="animate-spin" /> : <MailSearch />} Conferir respostas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "configuracao" })} title="A caixa que envia e a cópia padrão">
            <Settings2 /> Envio
          </Button>
          <Button size="sm" variant="outline" onClick={() => void baixar()} disabled={baixando || !filtradas.length} title="Planilha dos processos filtrados; o cliente preenche o valor máximo para acordo e devolve">
            {baixando ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />} Exportar planilha
          </Button>
          <Button size="sm" variant="outline" onClick={() => arquivo.current?.click()} disabled={importando} title="A planilha devolvida pelo cliente: grava o valor máximo de cada processo pelo número">
            {importando ? <LoaderCircle className="animate-spin" /> : <FileUp />} Importar planilha
          </Button>
          <input ref={arquivo} type="file" accept=".xlsx,.xls" className="hidden" onChange={(evento) => void importar(evento.target.files?.[0])} />
        </PainelTopo>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e6eef0] px-4 py-3">
          <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Processo, reclamante, advogado, e-mail" aria-label="Buscar" className="sm:w-80" />
          <Seletor valor={status} onChange={setStatus} opcoes={opcoesStatus} todos={{ rotulo: "Todos os status" }} rotulo="Status" className="sm:w-52" />
          {opcoesGrupo.length > 1 ? <Seletor valor={grupoCliente} onChange={setGrupoCliente} opcoes={opcoesGrupo} todos={{ rotulo: "Todos os clientes" }} rotulo="Grupo do cliente" className="sm:w-56" /> : null}
          {semEmail ? (
            <span className="flex items-center gap-1 text-xs text-amber-800">
              <TriangleAlert className="size-3.5" aria-hidden /> {semEmail} processo{semEmail === 1 ? "" : "s"} sem e-mail do advogado: complete nas partes da ficha ou digite no e-mail.
            </span>
          ) : null}
          {sugeridos ? (
            <span className="flex items-center gap-1 text-xs text-violet-800">
              <Sparkles className="size-3.5" aria-hidden /> {sugeridos} advogado{sugeridos === 1 ? "" : "s"} sugerido{sugeridos === 1 ? "" : "s"} pela leitura dos autos, a confirmar.
            </span>
          ) : null}
        </div>
        {grupos.length ? (
          <ul className="space-y-4 bg-[#f3f7f8] p-4">
            {grupos.map((grupo) => (
              <GrupoNaLista
                key={`${grupo.empresa}|${grupo.chave}`}
                grupo={grupo}
                confirmando={confirmando === grupo.chave}
                onConfirmar={() => void confirmarAdvogados(grupo)}
                onEmail={() => setDialogo({ tipo: "email", grupo })}
                onAbrir={(linha) => setDialogo({ tipo: "negociacao", linha })}
              />
            ))}
          </ul>
        ) : (
          <Vazio icone={Users} titulo={todas.length ? "Nenhum processo com esses filtros" : "Nenhum processo da área Trabalhista no cadastro"} />
        )}
      </Painel>

      {dialogo?.tipo === "email" && dados ? (
        <DialogoEmail
          grupo={dialogo.grupo}
          painel={dados}
          onFechar={() => setDialogo(null)}
          onFeito={(mensagem) => {
            setDialogo(null);
            setFeito(mensagem);
            setTentativa((atual) => atual + 1);
          }}
        />
      ) : null}
      {dialogo?.tipo === "configuracao" && dados ? (
        <DialogoConfiguracaoDoEnvio
          configuracao={dados.configuracao}
          onFechar={() => setDialogo(null)}
          onSalvo={(configuracao) => {
            atualizarConfiguracao(configuracao);
            setDialogo(null);
            setFeito("Envio dos e-mails de acordo salvo.");
            setTentativa((atual) => atual + 1);
          }}
        />
      ) : null}
      {dialogo?.tipo === "negociacao" && dados ? (
        <DialogoNegociacao
          linha={dialogo.linha}
          painel={dados}
          onFechar={() => setDialogo(null)}
          onSalvo={(negociacao) => {
            atualizarLinha(dialogo.linha.processoId, negociacao);
            setDialogo(null);
            setFeito("Negociação salva.");
          }}
        />
      ) : null}
    </div>
  );
}

/** Quantos advogados aparecem no grupo antes de "ver os outros". */
const ADVOGADOS_VISIVEIS = 6;

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Nome em caixa alta (como vem da peça) fica em caixa de título; o resto fica como está. */
function nomeLegivel(nome: string): string {
  if (nome !== nome.toLocaleUpperCase("pt-BR")) return nome;
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((parte, indice) => (indice && MINUSCULAS.has(parte) ? parte : parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1)))
    .join(" ");
}

function GrupoNaLista({
  grupo,
  confirmando,
  onConfirmar,
  onEmail,
  onAbrir,
}: {
  grupo: GrupoDeAdvogado;
  confirmando: boolean;
  onConfirmar: () => void;
  onEmail: () => void;
  onAbrir: (linha: LinhaNegociacao) => void;
}) {
  const aEnviar = grupo.linhas.filter((linha) => linha.negociacao.status === "a_enviar").length;
  const aConfirmar = grupo.advogados.filter((item) => item.sugestaoIds?.length).length;
  const todosAConfirmar = aConfirmar > 0 && aConfirmar === grupo.advogados.length;
  // Primeiro quem tem e-mail (é para quem o e-mail vai); os demais ficam atrás de "ver todos".
  const advogados = [...grupo.advogados].sort((a, b) => Number(b.emails.length > 0) - Number(a.emails.length > 0));
  const [aberto, setAberto] = useState(false);
  const visiveis = aberto ? advogados : advogados.slice(0, ADVOGADOS_VISIVEIS);
  const escondidos = advogados.length - visiveis.length;
  const comEmail = grupo.advogados.filter((item) => item.emails.length).length;
  return (
    <li className="overflow-hidden rounded-xl border border-[#cfe0e4] bg-white shadow-sm">
      <header className="space-y-2.5 border-b border-[#dce9eb] bg-[#f7fbfc] px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#10293a]">
              <Scale className="size-4 shrink-0 text-[#285f7a]" aria-hidden />
              {advogados.length
                ? `${nomeLegivel(advogados[0].nome)}${advogados.length > 1 ? ` e mais ${advogados.length - 1}` : ""}`
                : "Sem advogado do reclamante"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cliente: {grupo.empresa || "sem cliente no cadastro"} · {grupo.linhas.length} processo{grupo.linhas.length === 1 ? "" : "s"}
              {grupo.advogados.length
                ? ` · ${comEmail ? `${grupo.emails.length} e-mail${grupo.emails.length === 1 ? "" : "s"} para envio` : "nenhum advogado com e-mail"}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {aConfirmar ? (
              <Button size="sm" variant="outline" onClick={onConfirmar} disabled={confirmando} title="Aprova as sugestões da leitura: os advogados entram nas partes de cada processo do grupo">
                {confirmando ? <LoaderCircle className="animate-spin" /> : <UserCheck />} Confirmar no cadastro
              </Button>
            ) : null}
            <Button size="sm" variant={aEnviar ? "default" : "outline"} onClick={onEmail}>
              <Send /> {aEnviar ? `Escrever e-mail (${aEnviar} a enviar)` : "Escrever e-mail"}
            </Button>
          </div>
        </div>

        {grupo.advogados.length ? (
          <div className="rounded-lg border border-[#dce9eb] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef3f5] px-3 py-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#10293a]">
                <Users className="size-3.5 text-muted-foreground" aria-hidden /> Advogados do reclamante
              </p>
              {aConfirmar ? (
                <Selo tom="ia" icone={Sparkles} titulo="Achados pela leitura dos autos; ainda não estão nas partes do processo. Confira e use Confirmar no cadastro.">
                  {todosAConfirmar ? "Achados pela leitura · a confirmar" : `${aConfirmar} achado${aConfirmar === 1 ? "" : "s"} pela leitura · a confirmar`}
                </Selo>
              ) : null}
            </div>
            <ul className="grid gap-x-4 gap-y-1.5 px-3 py-2 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((item) => (
                <li key={`${item.nome}|${item.oab ?? ""}`} className="min-w-0 text-sm">
                  <p className="flex items-center gap-1 truncate font-medium text-[#10293a]" title={item.nome}>
                    <span className="truncate">{nomeLegivel(item.nome)}</span>
                    {item.sugestaoIds?.length && !todosAConfirmar ? (
                      <Sparkles className="size-3 shrink-0 text-[#48466e]" aria-label="a confirmar" />
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={item.emails.join(", ") || undefined}>
                    {item.oab ? `OAB ${item.oab}` : "OAB não informada"}
                    {item.emails.length ? (
                      <>
                        {" · "}
                        <span className="text-[#285f7a]">{item.emails.join(", ")}</span>
                      </>
                    ) : (
                      " · sem e-mail"
                    )}
                  </p>
                </li>
              ))}
            </ul>
            {advogados.length > ADVOGADOS_VISIVEIS ? (
              <button
                type="button"
                onClick={() => setAberto((valor) => !valor)}
                className="flex w-full items-center justify-center gap-1 border-t border-[#eef3f5] py-1 text-xs font-medium text-[#285f7a] hover:bg-[#f7fbfc]"
              >
                {aberto ? (
                  <>
                    <ChevronUp className="size-3.5" /> Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" /> Ver os outros {escondidos} advogado{escondidos === 1 ? "" : "s"}
                  </>
                )}
              </button>
            ) : null}
          </div>
        ) : (
          <Aviso tom="alerta">Nenhum advogado do reclamante no cadastro nem na leitura dos autos. Dá para escrever o e-mail e digitar o destinatário.</Aviso>
        )}
        {grupo.advogados.length && !comEmail ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-800">
            <TriangleAlert className="size-3.5" aria-hidden /> Nenhum advogado com e-mail: digite o destinatário ao escrever o e-mail.
          </p>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-[#eef3f5]">
              <th className="px-4 py-2 font-medium">Processo</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Risco (valor + reflexos)</th>
              <th className="px-3 py-2 text-right font-medium">Proposta</th>
              <th className="px-3 py-2 text-right font-medium">Máximo do cliente</th>
              <th className="px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f5]">
            {grupo.linhas.map((linha) => {
              const n = linha.negociacao;
              const acima = n.propostaValor !== null && n.valorMaximoCliente !== null && n.propostaValor > n.valorMaximoCliente;
              return (
                <tr key={linha.processoId} className="align-top">
                  <td className="px-4 py-2">
                    <Link href={`/operacoes-legais/processos/${linha.processoId}?de=trabalhista`} className="font-medium tabular-nums text-[#285f7a] underline-offset-4 hover:underline">
                      {linha.cnj ?? linha.ci ?? "sem número"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{linha.reclamante ?? "Reclamante não cadastrado"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Selo tom={TOM_STATUS[n.status]}>{rotuloDoStatus(n.status)}</Selo>
                    {n.enviadoEm ? <p className="mt-0.5 text-[11px] text-muted-foreground">enviado {dia(n.enviadoEm)}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <p className="font-medium">{real(linha.riscoTotal)}</p>
                    {linha.riscoValor !== null ? (
                      <p className="text-[11px] text-muted-foreground">
                        {real(linha.riscoValor)} + {real(linha.riscoReflexos)}
                      </p>
                    ) : null}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", acima && "text-red-700")}>
                    {real(n.propostaValor)}
                    {n.contrapropostaValor !== null ? <p className="text-[11px] text-muted-foreground">contraproposta {real(n.contrapropostaValor)}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{real(n.valorMaximoCliente)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="xs" variant="outline" onClick={() => onAbrir(linha)}>
                      <PencilLine /> Negociação
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------ e-mail */

function baixarArquivo(conteudo: string, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * O e-mail de um advogado: escolher os processos, conferir destinatários, título e texto (editáveis) e enviar
 * pelo Outlook de quem está logado, com uma segunda tela de confirmação; ou baixar o rascunho (.eml) e marcar como
 * enviado.
 */
function DialogoEmail({ grupo, painel, onFechar, onFeito }: { grupo: GrupoDeAdvogado; painel: PainelDeNegociacao; onFechar: () => void; onFeito: (mensagem: string) => void }) {
  const inicial = grupo.linhas.filter((linha) => linha.negociacao.status === "a_enviar").map((linha) => linha.processoId);
  const [escolhidos, setEscolhidos] = useState<string[]>(inicial.length ? inicial : grupo.linhas.map((linha) => linha.processoId));
  const [para, setPara] = useState(grupo.emails.join("; "));
  const [cc, setCc] = useState(painel.configuracao.cc.filter((item) => !grupo.emails.includes(item)).join("; "));
  const [verProcessos, setVerProcessos] = useState(grupo.linhas.length <= 6);
  const [editado, setEditado] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [rascunhoBaixado, setRascunhoBaixado] = useState(false);

  // A assinatura configurada em Envio (a do Outlook não vem pelo Graph); sem ela, o nome de quem está logado.
  const assinatura = painel.configuracao.assinatura || painel.remetenteNome;
  const linhasEscolhidas = grupo.linhas.filter((linha) => escolhidos.includes(linha.processoId));
  const numeros = linhasEscolhidas.map((linha) => linha.cnj ?? linha.ci ?? "").filter(Boolean);
  const chaveDosNumeros = numeros.join("|");

  // O texto acompanha os processos escolhidos até a pessoa editar.
  useEffect(() => {
    if (editado) return;
    try {
      const email = montarEmailDeAcordo({ empresa: grupo.empresa, processos: chaveDosNumeros ? chaveDosNumeros.split("|") : [], saudacao: saudacaoPelaHora(), assinatura });
      setAssunto(email.assunto);
      setTexto(email.texto);
      setErro("");
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }, [chaveDosNumeros, editado, grupo.empresa, assinatura]);

  const destinatarios = listaDeEmails(para);
  const copias = listaDeEmails(cc).filter((item) => !destinatarios.includes(item));
  const pronto = escolhidos.length > 0 && destinatarios.length > 0 && assunto.trim() && texto.trim();
  const corpo = { processoIds: escolhidos, para: destinatarios, cc: copias, assunto, texto };

  async function enviar() {
    setOcupado("enviar");
    setErro("");
    try {
      const resultado = await processosApi.post<{ enviados: number; remetente: string }>(`${BASE}/email`, { acao: "enviar", confirmado: true, ...corpo });
      onFeito(`E-mail enviado pela caixa ${resultado.remetente} (${resultado.enviados} processo${resultado.enviados === 1 ? "" : "s"} marcado${resultado.enviados === 1 ? "" : "s"} como enviado${resultado.enviados === 1 ? "" : "s"}).`);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setConfirmando(false);
    } finally {
      setOcupado("");
    }
  }

  async function marcarEnviado() {
    setOcupado("marcar");
    setErro("");
    try {
      const resultado = await processosApi.post<{ marcados: number }>(`${BASE}/email`, { acao: "marcar_enviado", ...corpo });
      onFeito(`${resultado.marcados} processo${resultado.marcados === 1 ? "" : "s"} marcado${resultado.marcados === 1 ? "" : "s"} como enviado${resultado.marcados === 1 ? "" : "s"}.`);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  function baixarRascunho() {
    baixarArquivo(gerarEml({ para: destinatarios, cc: copias, assunto, texto, de: painel.remetente }), `pretensao-acordo-${(numeros[0] ?? "processo").replace(/\D/g, "")}.eml`, "message/rfc822");
    setRascunhoBaixado(true);
  }

  if (confirmando) {
    return (
      <DialogoAcao
        aberto
        onFechar={() => setConfirmando(false)}
        ocupado={ocupado === "enviar"}
        icone={Send}
        titulo="Confirmar o envio"
        descricao={`O e-mail sai agora da caixa ${painel.remetente ?? ""} do Outlook, com cópia nos Itens Enviados dela. As respostas são acompanhadas aqui.`}
        rodape={
          <>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={ocupado === "enviar"}>
              Voltar
            </Button>
            <Button onClick={() => void enviar()} disabled={ocupado === "enviar"}>
              {ocupado === "enviar" ? <LoaderCircle className="animate-spin" /> : <Send />} Confirmar e enviar
            </Button>
          </>
        }
      >
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        <ResumoDoEnvio
          de={painel.remetente}
          para={destinatarios}
          cc={copias}
          assunto={assunto}
          texto={texto}
          extra={
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-xs text-muted-foreground">Processos</dt>
              <dd className="min-w-0 flex-1 tabular-nums">{numeros.join(", ")}</dd>
            </div>
          }
        />
      </DialogoAcao>
    );
  }

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={Boolean(ocupado)}
      icone={Mail}
      titulo="Pretensão para acordo"
      descricao={
        grupo.advogados.length
          ? `${nomeLegivel(grupo.advogados[0].nome)}${grupo.advogados.length > 1 ? ` e mais ${grupo.advogados.length - 1}` : ""} · ${grupo.empresa || "sem cliente no cadastro"}`
          : grupo.empresa || undefined
      }
      className="sm:max-w-3xl"
      aviso={!destinatarios.length ? "Sem destinatário: digite o e-mail do advogado em Para (ou complete nas partes da ficha)." : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={baixarRascunho} disabled={!pronto || Boolean(ocupado)} title="Abre no Outlook como rascunho, para enviar da sua caixa">
            <Download /> Baixar rascunho (.eml)
          </Button>
          {rascunhoBaixado ? (
            <Button variant="outline" onClick={() => void marcarEnviado()} disabled={!pronto || Boolean(ocupado)}>
              {ocupado === "marcar" ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Marcar como enviado
            </Button>
          ) : null}
          <Button
            onClick={() => setConfirmando(true)}
            disabled={!pronto || Boolean(ocupado) || !painel.envioPeloOutlook}
            title={painel.envioPeloOutlook ? `Sai da caixa ${painel.remetente ?? ""}` : "O envio pelo Microsoft 365 não está ligado neste ambiente: baixe o rascunho"}
          >
            <Send /> Enviar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <CompositorDeEmail
        de={painel.remetente}
        para={para}
        onPara={setPara}
        cc={cc}
        onCc={setCc}
        assunto={assunto}
        onAssunto={(valor) => {
          setEditado(true);
          setAssunto(valor);
        }}
        texto={texto}
        onTexto={(valor) => {
          setEditado(true);
          setTexto(valor);
        }}
        dicaDoTexto={editado ? "Editado à mão: trocar os processos não refaz o texto." : painel.configuracao.assinatura ? "O nome da empresa vem do cliente do processo; a assinatura, de Envio." : "O nome da empresa vem do cliente do processo. A assinatura é o seu nome: cadastre a assinatura completa em Envio."}
        antesDoTexto={
          <fieldset className="rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-2">
            <legend className="sr-only">Processos no e-mail</legend>
            <button type="button" className="flex w-full items-center gap-2 text-left text-xs font-medium text-[#285f7a]" onClick={() => setVerProcessos((atual) => !atual)}>
              {verProcessos ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
              {escolhidos.length} de {grupo.linhas.length} processo{grupo.linhas.length === 1 ? "" : "s"} no e-mail
            </button>
            {verProcessos ? (
              <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                {grupo.linhas.map((linha) => (
                  <li key={linha.processoId}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#285f7a]"
                        checked={escolhidos.includes(linha.processoId)}
                        onChange={(evento) => setEscolhidos((atual) => (evento.target.checked ? [...atual, linha.processoId] : atual.filter((id) => id !== linha.processoId)))}
                      />
                      <span className="tabular-nums">{linha.cnj ?? linha.ci}</span>
                      <span className="truncate text-xs text-muted-foreground">{linha.reclamante}</span>
                      <Selo tom={TOM_STATUS[linha.negociacao.status]} className="ml-auto shrink-0">
                        {rotuloDoStatus(linha.negociacao.status)}
                      </Selo>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>
        }
      />
    </DialogoAcao>
  );
}

/* ------------------------------------------------------- negociação */

function DialogoNegociacao({ linha, painel, onFechar, onSalvo }: { linha: LinhaNegociacao; painel: PainelDeNegociacao; onFechar: () => void; onSalvo: (negociacao: Negociacao) => void }) {
  const n = linha.negociacao;
  const valor = (numero: number | null) => (numero === null ? "" : numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const [f, setF] = useState<Record<string, string>>({
    status: n.status,
    enviado_em: n.enviadoEm?.slice(0, 10) ?? "",
    respondido_em: n.respondidoEm?.slice(0, 10) ?? "",
    proposta_valor: valor(n.propostaValor),
    proposta_condicoes: n.propostaCondicoes ?? "",
    contraproposta_valor: valor(n.contrapropostaValor),
    contraproposta_condicoes: n.contrapropostaCondicoes ?? "",
    acordo_valor: valor(n.acordoValor),
    acordo_condicoes: n.acordoCondicoes ?? "",
    valor_maximo_cliente: valor(n.valorMaximoCliente),
    observacoes: n.observacoes ?? "",
  });
  const [eventos, setEventos] = useState<EventoNegociacao[] | null>(null);
  const [versaoEventos, setVersaoEventos] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudar = (chave: string) => (novo: string) => setF((atual) => ({ ...atual, [chave]: novo }));

  useEffect(() => {
    processosApi.get<{ eventos: EventoNegociacao[] }>(`${BASE}/${linha.processoId}`).then(
      (resposta) => setEventos(resposta.eventos),
      () => setEventos([])
    );
  }, [linha.processoId, versaoEventos]);

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const corpo = Object.fromEntries(Object.entries(f).map(([chave, texto]) => [chave, texto.trim() || null]));
      const resposta = await processosApi.put<{ negociacao: Negociacao }>(`${BASE}/${linha.processoId}`, corpo);
      onSalvo(resposta.negociacao);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  const dinheiro = (chave: string, titulo: string) => (
    <Campo rotulo={titulo}>
      <Input value={f[chave]} onChange={(evento) => mudar(chave)(evento.target.value)} inputMode="decimal" placeholder="0,00" />
    </Campo>
  );

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={Handshake}
      titulo={`Negociação — ${linha.cnj ?? linha.ci ?? ""}`}
      descricao={`${linha.reclamante ?? "Reclamante"} · risco ${real(linha.riscoTotal)}`}
      className="sm:max-w-3xl"
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Status">
          <Seletor valor={f.status} onChange={mudar("status")} opcoes={STATUS_NEGOCIACAO} rotulo="Status da negociação" />
        </Campo>
        <Campo rotulo="Enviado em">
          <CampoData valor={f.enviado_em} onChange={mudar("enviado_em")} rotulo="Data do envio" permitirVazio />
        </Campo>
        <Campo rotulo="Respondido em">
          <CampoData valor={f.respondido_em} onChange={mudar("respondido_em")} rotulo="Data da resposta" permitirVazio />
        </Campo>
        {dinheiro("proposta_valor", "Proposta recebida (R$)")}
        <Campo rotulo="Condições da proposta" className="sm:col-span-2">
          <Input value={f.proposta_condicoes} onChange={(evento) => mudar("proposta_condicoes")(evento.target.value)} placeholder="Ex.: 3 parcelas mensais" />
        </Campo>
        {dinheiro("contraproposta_valor", "Contraproposta (R$)")}
        <Campo rotulo="Condições da contraproposta" className="sm:col-span-2">
          <Input value={f.contraproposta_condicoes} onChange={(evento) => mudar("contraproposta_condicoes")(evento.target.value)} />
        </Campo>
        {dinheiro("acordo_valor", "Acordo fechado (R$)")}
        <Campo rotulo="Condições do acordo" className="sm:col-span-2" dica="Lance as parcelas em Acordos, na ficha do processo.">
          <Input value={f.acordo_condicoes} onChange={(evento) => mudar("acordo_condicoes")(evento.target.value)} />
        </Campo>
        {dinheiro("valor_maximo_cliente", "Valor máximo do cliente (R$)")}
        <Campo rotulo="Observações" className="sm:col-span-2">
          <Textarea value={f.observacoes} onChange={(evento) => mudar("observacoes")(evento.target.value)} rows={2} />
        </Campo>
      </div>
      <ConversaDoAcordo
        processoId={linha.processoId}
        eventos={eventos}
        ccPadrao={painel.configuracao.cc}
        assinatura={painel.configuracao.assinatura || painel.remetenteNome}
        envioPeloOutlook={painel.envioPeloOutlook}
        onAtualizar={() => setVersaoEventos((atual) => atual + 1)}
      />
      <section aria-label="Histórico" className="space-y-1.5">
        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase text-[#285f7a]">
          <History className="size-3.5" aria-hidden /> Histórico
        </h3>
        {eventos === null ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : eventos.some((evento) => evento.tipo !== "email_recebido") ? (
          <ul className="max-h-48 divide-y divide-[#eef3f5] overflow-y-auto rounded-md border border-[#e6eef0]">
            {eventos.filter((evento) => evento.tipo !== "email_recebido").map((evento) => (
              <li key={evento.id} className="px-3 py-1.5">
                <p className="text-sm">{evento.descricao}</p>
                {evento.assunto ? <p className="text-xs text-muted-foreground">{evento.assunto}</p> : null}
                <p className="text-[11px] text-muted-foreground">
                  {formatarDataHora(evento.quando)}
                  {evento.autor ? ` · ${evento.autor}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nada registrado ainda.</p>
        )}
      </section>
    </DialogoAcao>
  );
}
