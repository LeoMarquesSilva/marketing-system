"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, CheckCircle2, History, Loader2, MessageSquare, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PHASE_LABELS,
  STAGE_LABELS,
  itemStatus,
  type ChecklistPhase,
  type DocBoard,
  type DocComment,
  type DocSection,
  type DocSectionVersion,
  type QuestionAudience,
} from "@/lib/documentario/types";
import { DecisionBadge, Face, Markdown, SensitiveBadge, docRequest, formatDateTimeShort } from "./shared";

type Tab = "texto" | "historico" | "comentarios";

/** Itens que vivem em tabelas próprias e aparecem dentro da seção do documento. */
function LiveContent({ section, board }: { section: DocSection; board: DocBoard }) {
  if (section.slug === "entrevistas") {
    const groups: QuestionAudience[] = ["ricardo", "gustavo", "comum", "aprofundamento"];
    const titles: Record<QuestionAudience, string> = {
      ricardo: "9.1 Perguntas para Ricardo",
      gustavo: "9.2 Perguntas para Gustavo",
      comum: "9.3 Perguntas comuns (selecionar conforme entrevista)",
      aprofundamento: "9.4 Perguntas de aprofundamento para o entrevistador",
    };
    return (
      <div className="space-y-4">
        <LiveHeader text="As perguntas ficam no roteiro do dia da gravação: lá se escolhem as prioritárias e se marca o que foi feito." href="/documentario/dia" link="Abrir o dia da gravação" />
        {groups.map((audience) => {
          const list = board.questions.filter((question) => question.audience === audience);
          return (
            <div key={audience}>
              <h3 className="text-[15px] font-semibold text-foreground">{titles[audience]}</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-foreground/85 marker:text-[#3e84a8]">
                {list.map((question) => (
                  <li key={question.id}>
                    {question.text}
                    {question.sensitive && <SensitiveBadge className="ml-2 align-middle" />}
                    {question.note && <span className="block text-xs text-muted-foreground">{question.note}</span>}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    );
  }
  if (section.slug === "validar" || section.slug === "criterios") {
    const stages = section.slug === "validar" ? (["validacao"] as const) : (["editorial", "producao"] as const);
    return (
      <div className="space-y-4">
        <LiveHeader text="Cada ponto vira um item que Ricardo e Gustavo aprovam, aprovam com ajuste ou recusam." href="/documentario/aprovacao" link="Abrir a aprovação dos sócios" />
        {stages.map((stage) => (
          <div key={stage}>
            <h3 className="text-[15px] font-semibold text-foreground">{STAGE_LABELS[stage].title}</h3>
            <ul className="mt-2 divide-y divide-[#eef3f4] rounded-md border border-[#e6eef0]">
              {board.approvals
                .filter((item) => item.stage === stage)
                .map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">{item.title}</span>
                    {item.sensitive && <SensitiveBadge />}
                    <DecisionBadge status={itemStatus(item)} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (section.slug === "checklist") {
    const phases: ChecklistPhase[] = ["antes", "dia", "montagem", "festa"];
    return (
      <div className="space-y-4">
        <LiveHeader text="O checklist é marcado no sistema: “No dia da captação” vale por gravação, no roteiro do dia." href="/documentario/dia" link="Abrir o dia da gravação" />
        {phases.map((phase) => (
          <div key={phase}>
            <h3 className="text-[15px] font-semibold text-foreground">{PHASE_LABELS[phase]}</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-foreground/85">
              {board.checklist
                .filter((item) => item.phase === phase)
                .map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <CheckCircle2 className={cn("mt-1 size-4 shrink-0", item.done_at ? "text-emerald-600" : "text-[#cfdde1]")} aria-hidden />
                    <span>{item.text}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function LiveHeader({ text, href, link }: { text: string; href: string; link: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f3f8fa] px-3 py-2.5 text-sm text-foreground/80">
      <span className="min-w-0 flex-1">{text}</span>
      <Link href={href} className="inline-flex items-center gap-1 font-medium text-[#285f7a] hover:underline">
        {link}
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export function SectionDialog({
  section,
  board,
  onClose,
  onSections,
  onComments,
}: {
  section: DocSection;
  board: DocBoard;
  onClose: () => void;
  onSections: (sections: DocSection[]) => void;
  onComments: (comments: DocComment[]) => void;
}) {
  const canEdit = board.viewer.can_edit;
  const [tab, setTab] = useState<Tab>("texto");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DocSectionVersion[] | null>(null);
  const [viewing, setViewing] = useState<DocSectionVersion | null>(null);
  const [comment, setComment] = useState("");
  const comments = board.comments.filter((item) => item.section_id === section.id);
  const openComments = comments.filter((item) => !item.resolved_at).length;
  const dirty = title !== section.title || body !== section.body;

  useEffect(() => {
    if (tab !== "historico" || history) return;
    let cancelled = false;
    docRequest<{ history: DocSectionVersion[] }>({ action: "section.history", sectionId: section.id })
      .then((result) => !cancelled && setHistory(result.history))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tab, history, section.id]);

  const authorOf = useMemo(() => new Map(board.team.map((member) => [member.user_id, member])), [board.team]);

  async function run<T>(payload: Record<string, unknown>, then: (result: T) => void) {
    setBusy(true);
    setError(null);
    try {
      then(await docRequest<T>(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run<{ sections: DocSection[] }>({ action: "section.save", sectionId: section.id, title: title.trim(), body, note: note.trim() || null }, (result) => {
      onSections(result.sections);
      setEditing(false);
      setNote("");
      setHistory(null);
    });

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] min-h-[min(560px,90dvh)] flex-col gap-0 p-0 sm:max-w-3xl">
        <div className="border-b border-[#e6eef0] px-5 pb-0 pt-4 pr-12">
          <DialogTitle className="flex items-baseline gap-2 text-base">
            {section.number && <span className="text-sm font-semibold tabular-nums text-[#8a6528]">{section.number === "A" ? "Anexo A" : `${section.number}.`}</span>}
            {editing ? "Editar seção" : section.title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            Versão {section.version}
            {section.version > 1 && section.updated_by_name ? ` · editada por ${section.updated_by_name} em ${formatDateTimeShort(section.updated_at)}` : " · texto do documento original"}
          </DialogDescription>
          {!editing && (
            <div role="tablist" aria-label="Seção" className="-mb-px mt-3 flex gap-1">
              {(
                [
                  ["texto", "Texto", null],
                  ["historico", "Versões", section.version],
                  ["comentarios", "Comentários", openComments || null],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => {
                    setTab(id);
                    setViewing(null);
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium",
                    tab === id ? "border-[#347796] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  {count ? <span className="rounded-full bg-[#eaf2f5] px-1.5 text-xs tabular-nums text-[#285f7a]">{count}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="secao-titulo">Título</Label>
                <Input id="secao-titulo" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secao-texto">Texto</Label>
                <Textarea id="secao-texto" value={body} onChange={(event) => setBody(event.target.value)} rows={18} className="min-h-[320px] font-mono text-[13px] leading-6" />
                <p className="text-xs text-muted-foreground">**negrito**, *itálico*, “- ” para lista, “### ” para subtítulo e “| a | b |” para tabela.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secao-nota">O que mudou (fica no histórico)</Label>
                <Input id="secao-nota" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: ajuste pedido pelo Gustavo na reunião de 20/11" />
              </div>
            </div>
          ) : tab === "texto" ? (
            <div className="space-y-5">
              {section.body.trim() ? <Markdown source={section.body} /> : null}
              <LiveContent section={section} board={board} />
            </div>
          ) : tab === "historico" ? (
            viewing ? (
              <div className="space-y-3">
                <button type="button" onClick={() => setViewing(null)} className="text-sm font-medium text-[#285f7a] hover:underline">
                  ← Todas as versões
                </button>
                <p className="text-sm font-semibold">
                  Versão {viewing.version} · {viewing.title}
                </p>
                <Markdown source={viewing.body || "_(sem texto)_"} />
              </div>
            ) : !history ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando versões…
              </p>
            ) : (
              <ol className="space-y-2">
                {history.map((version) => (
                  <li key={version.id} className="flex flex-wrap items-start gap-3 rounded-md border border-[#e6eef0] px-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#eaf2f5] text-xs font-semibold tabular-nums text-[#285f7a]">v{version.version}</span>
                    <div className="min-w-48 flex-1">
                      <p className="text-sm font-medium text-foreground">{version.note || "Sem anotação"}</p>
                      <p className="text-xs text-muted-foreground">
                        {version.created_by_name ? `${version.created_by_name} · ` : ""}
                        {formatDateTimeShort(version.created_at)}
                        {version.project_version ? ` · projeto ${version.project_version}` : ""}
                        {version.version === section.version ? " · atual" : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setViewing(version)}>
                      Ver texto
                    </Button>
                    {canEdit && version.version !== section.version && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run<{ sections: DocSection[] }>({ action: "section.restore", sectionId: section.id, version: version.version }, (result) => {
                            onSections(result.sections);
                            setHistory(null);
                          })
                        }
                      >
                        <RotateCcw className="size-3.5" />
                        Voltar a esta
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            )
          ) : (
            <div className="space-y-4">
              {comments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário nesta seção. Escreva sugestões e dúvidas para a próxima versão.</p>}
              <ul className="space-y-3">
                {comments.map((item) => {
                  const mine = item.author_user_id === board.viewer.user_id;
                  return (
                    <li key={item.id} className={cn("flex gap-3", item.resolved_at && "opacity-60")}>
                      <Face name={item.author_name ?? "?"} avatarUrl={item.author_avatar ?? (item.author_user_id ? authorOf.get(item.author_user_id)?.avatar_url ?? null : null)} />
                      <div className="min-w-0 flex-1 rounded-md bg-[#f6fafb] px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{item.author_name ?? "Alguém"}</span> · {formatDateTimeShort(item.created_at)}
                          {item.resolved_at ? " · resolvido" : ""}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                        {(mine || canEdit) && (
                          <div className="mt-1 flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              disabled={busy}
                              onClick={() => run<{ comments: DocComment[] }>({ action: "comment.resolve", id: item.id, resolved: !item.resolved_at }, (result) => onComments(result.comments))}
                            >
                              <Check className="size-3.5" />
                              {item.resolved_at ? "Reabrir" : "Resolver"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-rose-700"
                              disabled={busy}
                              onClick={() => run<{ comments: DocComment[] }>({ action: "comment.delete", id: item.id }, (result) => onComments(result.comments))}
                            >
                              <Trash2 className="size-3.5" />
                              Apagar
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-2">
                <Label htmlFor="secao-comentario">Novo comentário</Label>
                <Textarea id="secao-comentario" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Sugestão, dúvida ou ajuste para esta parte" />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={busy || !comment.trim()}
                    onClick={() =>
                      run<{ comments: DocComment[] }>({ action: "comment.add", sectionId: section.id, body: comment.trim() }, (result) => {
                        onComments(result.comments);
                        setComment("");
                      })
                    }
                  >
                    <MessageSquare className="size-4" />
                    Comentar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setTitle(section.title);
                  setBody(section.body);
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={busy || !dirty || title.trim().length < 2} onClick={() => void save()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
                Salvar versão {section.version + 1}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
              {canEdit && tab === "texto" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setTitle(section.title);
                    setBody(section.body);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

