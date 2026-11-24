"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleHelp, CircleX, Clock, ExternalLink, ListFilter, LoaderCircle, MapPin, MessageCircle, Mail, Video, X } from "lucide-react";
import { Avatar as AvatarUi, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { hasPautaAccess } from "@/lib/access-control";
import { authFetch } from "@/lib/auth-fetch";
import { cidadeDoOrgao, local, opcoesDeTroca, type Contexto } from "@/lib/audiencias/agenda";
import { ROTULO_MODALIDADE, ROTULO_TIPO, type Audiencia, type Papel, type PessoaPauta, type RespostaConvite } from "@/lib/audiencias/tipos";
import type { DadosDaPauta } from "@/lib/audiencias/pauta-server";
import { cn } from "@/lib/utils";
import { linkPastaVios, linkTarefaVios } from "@/lib/vistagem/vios-links";
import { Aviso, Selo, campoClasse } from "../vistagem/ui";

/* ------------------------------------------------------------------ API */

const BASE = "/api/operacoes-legais/pauta";

async function ler<T>(resposta: Response): Promise<T> {
  const corpo = (await resposta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível concluir a operação.");
  return corpo as T;
}

function comCorpo(metodo: string, corpo?: unknown): RequestInit {
  return { method: metodo, headers: corpo === undefined ? undefined : { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) };
}

export const pautaApi = {
  get: async <T,>(caminho = "") => ler<T>(await authFetch(`${BASE}${caminho}`)),
  post: async <T,>(caminho: string, corpo?: unknown) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("POST", corpo))),
  patch: async <T,>(caminho: string, corpo: unknown) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("PATCH", corpo))),
  put: async <T,>(caminho: string, corpo: unknown) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("PUT", corpo))),
  enviarArquivo: async <T,>(arquivo: File) => {
    const formulario = new FormData();
    formulario.append("arquivo", arquivo);
    return ler<T>(await authFetch(`${BASE}/importacao`, { method: "POST", body: formulario }));
  },
};

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}

export type { DadosDaPauta };

/* ------------------------------------------------------------------ acesso */

export function AcessoPauta({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const permitido = Boolean(user) && hasPautaAccess(profile);
  useEffect(() => {
    if (!loading && !permitido) router.replace("/");
  }, [loading, permitido, router]);
  if (loading || !permitido) {
    return (
      <div className="flex min-h-[48vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ datas */

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function diaPorExtenso(diaIso: string): string {
  const d = new Date(`${diaIso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function diaCurto(diaIso: string): string {
  const d = new Date(`${diaIso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]!.slice(0, 3).toLowerCase()} ${diaIso.slice(8, 10)}/${diaIso.slice(5, 7)}`;
}

export function hora(iso: string): string {
  return local(iso).hora;
}

export function quando(iso: string | null): string {
  if (!iso) return "—";
  const { dia, hora: h } = local(iso);
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${h}`;
}

/* ------------------------------------------------------------------ pessoas */

const CORES = ["bg-[#347796]", "bg-[#48466e]", "bg-[#2f8f92]", "bg-[#5b6b7a]", "bg-[#7a5c3e]", "bg-[#3e84a8]", "bg-[#6b5b95]", "bg-[#2d6a4f]"];

export function iniciaisDe(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Miniatura da pessoa: a foto (RH, organograma ou cadastro de usuários) ou, sem foto ou se ela não carregar, as iniciais. */
export function Avatar({ pessoa, className }: { pessoa: PessoaPauta | null | undefined; className?: string }) {
  if (!pessoa) return <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-red-400 text-[10px] font-semibold text-red-600", className)}>?</span>;
  let h = 0;
  for (const c of pessoa.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <AvatarUi className={cn("size-6 shrink-0 ring-1 ring-black/5", className)} aria-hidden title={pessoa.nomeCurto}>
      {pessoa.foto ? <AvatarImage src={pessoa.foto} alt="" className="object-cover" /> : null}
      <AvatarFallback className={cn("text-[10px] font-semibold text-white", CORES[h % CORES.length])}>{iniciaisDe(pessoa.nomeCurto)}</AvatarFallback>
    </AvatarUi>
  );
}

const RESPOSTA: Record<RespostaConvite, { icone: typeof CircleCheck; classe: string; texto: string }> = {
  aceito: { icone: CircleCheck, classe: "text-emerald-600", texto: "Aceitou o convite do Outlook" },
  recusado: { icone: CircleX, classe: "text-red-600", texto: "Recusou o convite do Outlook" },
  provisorio: { icone: CircleHelp, classe: "text-amber-600", texto: "Aceitou como provisório no Outlook" },
  sem_resposta: { icone: Clock, classe: "text-slate-400", texto: "Ainda não respondeu ao convite do Outlook" },
};

/** Ícone da resposta ao convite do Outlook, ao lado do nome (só quando o convite saiu de verdade). */
export function IconeResposta({ resposta }: { resposta: RespostaConvite | undefined }) {
  if (!resposta) return null;
  const { icone: Icone, classe, texto } = RESPOSTA[resposta];
  return (
    <span className="inline-flex shrink-0" title={texto}>
      <Icone className={cn("size-3.5", classe)} aria-hidden />
      <span className="sr-only">{texto}</span>
    </span>
  );
}

export function Dupla({
  aud,
  pessoas,
  compacto = false,
  respostas,
}: {
  aud: Audiencia;
  pessoas: Map<string, PessoaPauta>;
  compacto?: boolean;
  /** Resposta de cada papel ao convite do Outlook (contexto.respostas da audiência). */
  respostas?: Partial<Record<Papel, RespostaConvite>>;
}) {
  const titular = aud.titularId ? pessoas.get(aud.titularId) : null;
  const backup = aud.backupId ? pessoas.get(aud.backupId) : null;
  const nome = (p: PessoaPauta) => (compacto ? p.nomeCurto.split(" ")[0] : p.nomeCurto);
  return (
    <div className={cn("flex min-w-0 gap-x-4 gap-y-1", compacto ? "flex-row flex-wrap" : "flex-col")}>
      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="w-3 text-[10px] font-semibold text-muted-foreground">T</span>
        <Avatar pessoa={titular} />
        {titular ? <span className="truncate">{nome(titular)}</span> : <span className="font-semibold text-red-700">Sem titular</span>}
        {titular ? <IconeResposta resposta={respostas?.titular} /> : null}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <span className="w-3 text-[10px] font-semibold">B</span>
        <Avatar pessoa={backup} className={backup ? undefined : "border-slate-300 text-slate-400"} />
        <span className="truncate">{backup ? nome(backup) : "—"}</span>
        {backup ? <IconeResposta resposta={respostas?.backup} /> : null}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ selos */

export function cliente(aud: Audiencia): string {
  return aud.grupoCliente?.replace(/^grupo\s+/i, "") || aud.cliente || "Cliente não identificado";
}

export function SeloTipo({ aud }: { aud: Audiencia }) {
  return (
    <Selo tom={aud.situacao === "cancelada" ? "neutro" : "ia"} titulo={aud.tipoDescricao ?? undefined}>
      {ROTULO_TIPO[aud.tipo]}
    </Selo>
  );
}

/** Audiência que não veio da Minha Pauta do PJe: o processo não está na pauta do certificado e foi lido no Jus.br. */
export function SeloOrigem({ aud }: { aud: Audiencia }) {
  if (aud.origem !== "jusbr") return null;
  return (
    <Selo tom="etiqueta" titulo="O processo não está na Minha Pauta do PJe do certificado: a audiência foi lida no Jus.br (Portal de Serviços do CNJ).">
      Do Jus.br
    </Selo>
  );
}

export function Modalidade({ aud }: { aud: Audiencia }) {
  const m = aud.modalidadeTribunal;
  if (!m) return <span className="text-xs font-semibold text-amber-800">A completar</span>;
  const Icone = m === "presencial" ? MapPin : Video;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icone className="size-3.5 text-[#3e84a8]" aria-hidden />
      {ROTULO_MODALIDADE[m]}
      {m === "hibrida" ? <span className="text-xs text-muted-foreground">{aud.modalidadeEquipe ? `· vamos ${aud.modalidadeEquipe === "video" ? "online" : "presencial"}` : "· escolher"}</span> : null}
    </span>
  );
}

export function Local({ aud }: { aud: Audiencia }) {
  const cidade = cidadeDoOrgao(aud.orgao);
  return (
    <div className="min-w-0">
      <p className="truncate text-sm">{aud.orgao ?? "—"}</p>
      <p className="truncate text-xs text-muted-foreground">{[aud.ritoSumarissimo ? "Rito sumaríssimo" : null, aud.juizoDigital ? "Juízo 100% Digital" : null].filter(Boolean).join(" · ") || (cidade ? `Fórum de ${cidade}` : "")}</p>
    </div>
  );
}

export function LinkDaSala({ aud }: { aud: Audiencia }) {
  if (aud.modalidadeTribunal === "presencial") return <span className="text-xs text-muted-foreground">Presencial, sem link</span>;
  if (!aud.linkSala) return <span className="text-xs font-medium text-amber-800">Sem link ainda</span>;
  let curto = aud.linkSala;
  try {
    const u = new URL(aud.linkSala);
    curto = `${u.hostname.replace(/^www\./, "")}${u.pathname}`;
  } catch {
    // mostra como veio
  }
  const fonte = aud.linkFonte === "pje" ? "No PJe" : aud.linkFonte === "djen" ? `Da intimação${aud.linkFonteData ? ` de ${aud.linkFonteData.slice(8, 10)}/${aud.linkFonteData.slice(5, 7)}` : ""}` : "Colocado à mão";
  return (
    <div className="min-w-0">
      <a href={aud.linkSala} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs text-[#0f5f9e] hover:underline">
        {curto}
      </a>
      <p className="text-xs text-muted-foreground">{fonte}</p>
    </div>
  );
}

const pararClique = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Toda CI da pauta é link para o VIOS, como na vistagem: CI de tarefa abre a tarefa, CI de processo abre a pasta. O
 * clique no link não abre o detalhe da linha onde ele está.
 */
export function CiDoVios({ ci, tipo = "tarefa", className }: { ci: string; tipo?: "tarefa" | "processo"; className?: string }) {
  return (
    <a
      href={tipo === "tarefa" ? linkTarefaVios(ci) : linkPastaVios(ci)}
      target="_blank"
      rel="noreferrer"
      onClick={pararClique}
      onKeyDown={pararClique}
      title={tipo === "tarefa" ? `Abrir a tarefa ${ci} no VIOS` : `Abrir o processo ${ci} no VIOS`}
      className={cn("font-mono tabular-nums text-[#0f5f9e] underline underline-offset-2 hover:text-[#0b4677]", className)}
    >
      {ci}
    </a>
  );
}

/** Texto com CIs de tarefa ("CI 882502", "Tarefa 882502"): cada número vira link para a tarefa no VIOS. */
export function TextoComCi({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(/(CI|Tarefa) (\d{4,})/g)) {
    const inicio = m.index ?? 0;
    partes.push(texto.slice(ultimo, inicio), `${m[1]} `, <CiDoVios key={inicio} ci={m[2]!} />);
    ultimo = inicio + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

/**
 * Link para o VIOS, como na vistagem: a tarefa da audiência (CI casado na conferência) ou, sem tarefa, o processo.
 * Fica dentro de linhas clicáveis: o clique no link não abre o detalhe.
 */
export function LinkDoVios({ aud, className }: { aud: Audiencia; className?: string }) {
  const parar = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const classe = cn("inline-flex items-center gap-1 text-xs font-medium text-[#0f5f9e] underline-offset-2 hover:underline", className);
  if (aud.viosTarefaCi)
    return (
      <a href={linkTarefaVios(aud.viosTarefaCi)} target="_blank" rel="noreferrer" onClick={parar} onKeyDown={parar} className={classe} title="Abrir a tarefa da audiência no VIOS">
        Tarefa <span className="font-mono tabular-nums">{aud.viosTarefaCi}</span> no VIOS
        <ExternalLink className="size-3" aria-hidden />
      </a>
    );
  if (aud.ciProcesso)
    return (
      <a href={linkPastaVios(aud.ciProcesso)} target="_blank" rel="noreferrer" onClick={parar} onKeyDown={parar} className={classe} title="Sem tarefa de audiência casada: abre o processo no VIOS">
        Processo <span className="font-mono tabular-nums">{aud.ciProcesso}</span> no VIOS
        <ExternalLink className="size-3" aria-hidden />
      </a>
    );
  return null;
}

/* ------------------------------------------------------------------ troca */

const MOTIVOS = ["Conflito de horário", "Deslocamento", "Ausência ou compromisso pessoal", "Equilibrar a carga do dia", "Pasta sem responsável", "Outro"];

export function TrocaDialog({
  aud,
  papel,
  dados,
  aberto,
  aoFechar,
  aoTrocar,
}: {
  aud: Audiencia | null;
  papel: Papel;
  dados: DadosDaPauta;
  aberto: boolean;
  aoFechar: () => void;
  aoTrocar: (atualizada: Audiencia) => void;
}) {
  const pessoas = useMemo(() => new Map(dados.pessoas.map((p) => [p.id, p])), [dados.pessoas]);
  const contexto: Contexto = useMemo(() => ({ pessoas, todas: dados.audiencias, duracoes: dados.duracoes }), [pessoas, dados.audiencias, dados.duracoes]);
  const opcoes = useMemo(() => (aud ? opcoesDeTroca(aud, papel, contexto) : []), [aud, papel, contexto]);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [motivo, setMotivo] = useState(MOTIVOS[0]!);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setEscolhida(null);
      setErro(null);
      setMotivo(aud && !(papel === "titular" ? aud.titularId : aud.backupId) ? "Pasta sem responsável" : MOTIVOS[0]!);
    }
  }, [aberto, aud, papel]);

  if (!aud) return null;
  const atual = papel === "titular" ? aud.titularId : aud.backupId;
  const opcao = opcoes.find((o) => o.pessoa.id === escolhida) ?? null;
  const outro = papel === "titular" ? aud.backupId : aud.titularId;

  async function confirmar() {
    if (!escolhida || !aud) return;
    setSalvando(true);
    setErro(null);
    try {
      const { audiencia } = await pautaApi.post<{ audiencia: Audiencia }>(`/${aud.id}/troca`, { papel, pessoaId: escolhida, motivo });
      aoTrocar(audiencia);
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (!v ? aoFechar() : null)}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[#e6eef0] px-5 py-4 text-left">
          <DialogTitle>{atual ? (papel === "titular" ? "Trocar titular" : "Trocar backup") : papel === "titular" ? "Definir titular" : "Definir backup"}</DialogTitle>
          <DialogDescription>
            {ROTULO_TIPO[aud.tipo]} · {cliente(aud)} · {diaCurto(local(aud.inicio).dia)}, {hora(aud.inicio)} · {aud.orgao ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-xs font-semibold">Quem vai fazer a audiência</legend>
            {opcoes.map((o) => (
              <label
                key={o.pessoa.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border border-[#dce9eb] bg-white px-3 py-2 hover:border-[#3e84a8]/40",
                  escolhida === o.pessoa.id && "border-[#347796] bg-[#f7fcfd] ring-[3px] ring-[#47cdd0]/20",
                  o.estado === "atual" && "cursor-default opacity-60"
                )}
              >
                <input type="radio" name="pessoa" className="size-4 accent-[#347796]" disabled={o.estado === "atual"} checked={escolhida === o.pessoa.id} onChange={() => setEscolhida(o.pessoa.id)} />
                <Avatar pessoa={o.pessoa} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{o.pessoa.nomeCurto}</span>
                  <span className={cn("block text-xs", o.estado === "choque" ? "font-medium text-red-700" : o.estado === "atencao" ? "font-medium text-amber-800" : o.estado === "livre" ? "text-emerald-700" : "text-muted-foreground")}>{o.texto}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {opcao?.estado === "choque" ? <Aviso tom="erro">{opcao.pessoa.nomeCurto} tem outra audiência nesse horário. Escolha outra pessoa.</Aviso> : null}
          {opcao?.estado === "atencao" ? <Aviso tom="alerta">{opcao.texto}. Dá para confirmar, mas vale olhar antes.</Aviso> : null}
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">Motivo</span>
            <select className={cn(campoClasse, "h-9 w-full")} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {opcao && opcao.estado !== "choque" ? (
            <div className="space-y-1.5 rounded-md border border-[#47cdd0]/30 bg-[#f2fbfb] px-3 py-2.5 text-xs text-[#285f7a]">
              <p className="font-semibold text-[#10293a]">Quem será avisado</p>
              {atual ? (
                <p className="flex gap-2">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    <b>{pessoas.get(atual)?.nomeCurto}</b> recebe o cancelamento do convite no Outlook.
                  </span>
                </p>
              ) : null}
              <p className="flex gap-2">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                <span>
                  <b>{opcao.pessoa.nomeCurto}</b> recebe o convite como {papel} ({papel === "titular" ? "ocupado" : "livre"}).
                </span>
              </p>
              {outro && outro !== opcao.pessoa.id ? (
                <p className="flex gap-2">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    <b>{pessoas.get(outro)?.nomeCurto}</b> recebe a atualização do convite.
                  </span>
                </p>
              ) : null}
              <p className="flex gap-2">
                <MessageCircle className="size-3.5 shrink-0" aria-hidden />
                <span>Aviso no grupo da área marcando quem entra.</span>
              </p>
              {dados.modos.outlook !== "real" || dados.modos.whatsapp !== "real" ? <p className="text-muted-foreground">Modo teste: os avisos ficam registrados, sem envio.</p> : null}
            </div>
          ) : null}
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        </div>
        <DialogFooter className="border-t border-[#e6eef0] bg-[#f7fbfc] px-5 py-3">
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!opcao || opcao.estado === "choque" || salvando}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null}
            {atual ? "Confirmar troca" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ filtros */

/**
 * Faixa acima da lista quando há filtro (cartão, pessoa, tribunal, tipo ou busca): quantas aparecem, de quantas, quais
 * filtros e o botão de limpar. Sem filtro, não mostra nada.
 */
export function ResumoDoFiltro({ mostrando, de, unidade, filtros, aoLimpar }: { mostrando: number; de: number; unidade: string; filtros: string[]; aoLimpar: () => void }) {
  if (!filtros.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-[#47cdd0]/30 bg-[#f2fbfb] px-3 py-2 text-sm text-[#285f7a]" role="status">
      <ListFilter className="size-4 shrink-0" aria-hidden />
      <span>
        Mostrando <b className="tabular-nums text-[#10293a]">{mostrando}</b> de <span className="tabular-nums">{de}</span> {unidade}
      </span>
      {filtros.map((filtro) => (
        <Selo key={filtro} tom="marca">
          {filtro}
        </Selo>
      ))}
      <Button variant="ghost" size="xs" className="ml-auto" onClick={aoLimpar}>
        <X />
        Limpar filtros
      </Button>
    </div>
  );
}
