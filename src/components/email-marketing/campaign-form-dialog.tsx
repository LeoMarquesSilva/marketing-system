"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Code2,
  LayoutTemplate,
  Monitor,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmailCampaign,
  updateEmailCampaign,
  fetchEmailSenderConfig,
  fetchListContactIds,
  type EmailCampaign,
  type EmailContact,
  type EmailList,
  type EmailSenderConfig,
} from "@/lib/email-marketing";
import { wrapEmailPreviewHtml, type EmailTemplate } from "@/lib/email-marketing-templates";
import {
  applyMergeTags,
  SAMPLE_MERGE_CONTEXT,
} from "@/lib/email-marketing-merge-tags";
import {
  DEFAULT_NEWSLETTER_TRABALHISTA,
  packNewsletterCampaignHtml,
  renderNewsletterTrabalhistaHtml,
  unpackNewsletterCampaignHtml,
  type NewsletterTrabalhistaData,
} from "@/lib/newsletter-trabalhista-template";
import { TemplateGalleryDialog } from "./template-gallery-dialog";
import { NewsletterBuilder } from "./newsletter-builder";
import { MergeTagPicker, SubjectWithMergeTags } from "./merge-tag-picker";
import { cn } from "@/lib/utils";

export type CampaignFormStep = "setup" | "editor";

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: EmailCampaign | null;
  lists: EmailList[];
  contacts: EmailContact[];
  onSaved: (id: string) => void;
  initialStep?: CampaignFormStep;
}

type WizardStep = CampaignFormStep;

const SENDER_FALLBACK = {
  fromName: "Bismarchi Pires",
  fromEmail: "",
};

function resolveSenderFields(config: EmailSenderConfig | null) {
  return {
    fromName: config?.fromName?.trim() || SENDER_FALLBACK.fromName,
    fromEmail: config?.fromEmail?.trim() || SENDER_FALLBACK.fromEmail,
    replyTo: config?.replyTo?.trim() || null,
  };
}

const DEFAULT_HTML = `<h2 style="margin:0 0 12px;color:#04202f;">Título do e-mail</h2>
<p style="margin:0 0 16px;color:#374151;">Olá {{primeiro_nome}}, escreva aqui o conteúdo do seu e-mail.</p>`;

function DeviceToggle({
  device,
  onChange,
}: {
  device: "desktop" | "mobile";
  onChange: (device: "desktop" | "mobile") => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant={device === "desktop" ? "secondary" : "ghost"}
        size="icon-xs"
        onClick={() => onChange("desktop")}
        title="Visualizar como desktop"
      >
        <Monitor className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant={device === "mobile" ? "secondary" : "ghost"}
        size="icon-xs"
        onClick={() => onChange("mobile")}
        title="Visualizar como celular"
      >
        <Smartphone className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 font-medium",
          step === "setup" ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        1. Configuração
      </span>
      <ArrowRight className="h-3 w-3 opacity-50" />
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 font-medium",
          step === "editor" ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        2. Editor
      </span>
    </div>
  );
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  campaign,
  lists,
  contacts,
  onSaved,
  initialStep = "setup",
}: CampaignFormDialogProps) {
  const [step, setStep] = useState<WizardStep>("setup");
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);
  const [senderConfig, setSenderConfig] = useState<EmailSenderConfig | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [listId, setListId] = useState("__all__");
  const [listContactIds, setListContactIds] = useState<Set<string> | null>(null);
  const [listCountLoading, setListCountLoading] = useState(false);
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML);
  const [editorMode, setEditorMode] = useState<"html" | "newsletter-trabalhista">("html");
  const [newsletterData, setNewsletterData] = useState<NewsletterTrabalhistaData>(
    DEFAULT_NEWSLETTER_TRABALHISTA
  );
  const [previewHtml, setPreviewHtml] = useState(htmlBody);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [htmlPanelOpen, setHtmlPanelOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campaignId = campaign?.id ?? savedCampaignId;
  const isNewsletter = editorMode === "newsletter-trabalhista";

  useEffect(() => {
    if (!open) return;
    setStep(initialStep === "editor" && campaign ? "editor" : "setup");
    setSavedCampaignId(campaign?.id ?? null);
    setName(campaign?.name ?? "");
    setSubject(campaign?.subject ?? "");
    setPreviewText(campaign?.previewText ?? "");
    setListId(campaign?.listId ?? "__all__");
    const body = campaign?.htmlBody ?? DEFAULT_HTML;
    const unpacked = unpackNewsletterCampaignHtml(body);
    if (unpacked.data) {
      setEditorMode("newsletter-trabalhista");
      setNewsletterData(unpacked.data);
      setHtmlBody(packNewsletterCampaignHtml(unpacked.data));
      if (!campaign?.subject && unpacked.data.editionLabel) {
        setSubject(unpacked.data.editionLabel);
      }
    } else {
      setEditorMode("html");
      setHtmlBody(body);
      setNewsletterData(DEFAULT_NEWSLETTER_TRABALHISTA);
    }
    setDevice("desktop");
    setHtmlPanelOpen(false);
    setError(null);
  }, [open, campaign, initialStep]);

  useEffect(() => {
    if (!open || listId === "__all__") {
      setListContactIds(null);
      return;
    }
    let cancelled = false;
    setListCountLoading(true);
    fetchListContactIds(listId)
      .then((ids) => {
        if (!cancelled) setListContactIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setListContactIds(null);
      })
      .finally(() => {
        if (!cancelled) setListCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, listId]);

  const audienceCount = useMemo(() => {
    const subscribed = contacts.filter((c) => c.status === "subscribed");
    if (listId === "__all__") return subscribed.length;
    if (!listContactIds) return null;
    return subscribed.filter((c) => listContactIds.has(c.id)).length;
  }, [contacts, listId, listContactIds]);

  useEffect(() => {
    if (!open) return;
    fetchEmailSenderConfig()
      .then(setSenderConfig)
      .catch(() =>
        setSenderConfig({ fromName: "Bismarchi Pires", fromEmail: "", replyTo: null })
      );
  }, [open]);

  useEffect(() => {
    if (isNewsletter) return;
    const source = htmlBody.replace(/^<!-- newsletter-bp:[A-Za-z0-9+/=]+ -->\n?/, "");
    const timeout = setTimeout(() => setPreviewHtml(source), 300);
    return () => clearTimeout(timeout);
  }, [htmlBody, isNewsletter]);

  const previewSubject = useMemo(
    () => applyMergeTags(subject, SAMPLE_MERGE_CONTEXT),
    [subject]
  );

  const previewPreviewText = useMemo(
    () => applyMergeTags(previewText, SAMPLE_MERGE_CONTEXT),
    [previewText]
  );

  const previewDoc = useMemo(() => {
    const merged = applyMergeTags(previewHtml, SAMPLE_MERGE_CONTEXT);
    return wrapEmailPreviewHtml(merged, previewPreviewText);
  }, [previewHtml, previewPreviewText]);

  const templateThumbnailSrc = useMemo(() => {
    if (isNewsletter) return renderNewsletterTrabalhistaHtml(newsletterData);
    return previewDoc;
  }, [isNewsletter, newsletterData, previewDoc]);

  const buildPayload = () => {
    const sender = resolveSenderFields(senderConfig);
    return {
      name: name.trim(),
      subject: subject.trim(),
      previewText: previewText.trim() || null,
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
      replyTo: sender.replyTo,
      htmlBody: isNewsletter ? packNewsletterCampaignHtml(newsletterData) : htmlBody,
      listId: listId === "__all__" ? null : listId,
    };
  };

  const validateSetup = (): string | null => {
    if (!name.trim()) return "Informe o nome interno da campanha.";
    if (!subject.trim()) return "Informe o assunto do e-mail.";
    if (!resolveSenderFields(senderConfig).fromEmail.trim()) {
      return "Configure o e-mail remetente padrão na aba Configurações antes de salvar.";
    }
    return null;
  };

  const persistDraft = async (): Promise<string> => {
    const payload = buildPayload();
    if (campaignId) {
      await updateEmailCampaign(campaignId, payload);
      return campaignId;
    }
    const created = await createEmailCampaign(payload);
    setSavedCampaignId(created.id);
    onSaved(created.id);
    return created.id;
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    if (template.editor === "newsletter-trabalhista") {
      if (
        isNewsletter ||
        (htmlBody.trim() && htmlBody.trim() !== DEFAULT_HTML.trim())
      ) {
        if (!confirm("Isso vai substituir o conteúdo atual pelo modelo Newsletter Trabalhista BP. Continuar?")) {
          return;
        }
      }
      setEditorMode("newsletter-trabalhista");
      setNewsletterData(structuredClone(DEFAULT_NEWSLETTER_TRABALHISTA));
      if (!subject.trim()) setSubject(DEFAULT_NEWSLETTER_TRABALHISTA.editionLabel);
      return;
    }

    if (htmlBody.trim() && htmlBody.trim() !== DEFAULT_HTML.trim()) {
      if (!confirm("Isso vai substituir o conteúdo atual pelo modelo escolhido. Continuar?")) return;
    }
    setEditorMode("html");
    setHtmlBody(template.html);
  };

  const handleContinueToEditor = () => {
    setError(null);
    setStep("editor");
  };

  const handleSubmit = async () => {
    const validationError = validateSetup();
    if (validationError) {
      setError(validationError);
      setStep("setup");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await persistDraft();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar campanha.");
    } finally {
      setSaving(false);
    }
  };

  const editorMaxWidth = device === "desktop" ? 600 : 375;

  if (open && step === "editor") {
    return (
      <>
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-2.5 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setStep("setup")}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground truncate">{previewSubject || subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StepIndicator step={step} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setGalleryOpen(true)}
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Trocar modelo
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={saving} size="sm">
                {saving ? "Salvando..." : "Salvar rascunho"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-2 border-b shrink-0 bg-muted/30 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                {isNewsletter ? "Editor visual" : "Conteúdo do e-mail"}
              </p>
              {!isNewsletter && (
                <Button
                  type="button"
                  variant={htmlPanelOpen ? "secondary" : "ghost"}
                  size="xs"
                  className="gap-1.5"
                  onClick={() => setHtmlPanelOpen((v) => !v)}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  HTML
                  {htmlPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              )}
              {isNewsletter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    if (!confirm("Trocar para editor HTML avançado? Você perde a edição visual estruturada.")) return;
                    setEditorMode("html");
                    setHtmlBody(renderNewsletterTrabalhistaHtml(newsletterData));
                  }}
                >
                  Modo HTML
                </Button>
              )}
            </div>
            <DeviceToggle device={device} onChange={setDevice} />
          </div>

          {!isNewsletter && htmlPanelOpen && (
            <div className="shrink-0 border-b bg-background px-5 py-3 space-y-2 max-h-[38vh] overflow-y-auto">
              <Textarea
                id="campaign-html"
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                className="min-h-40 font-mono text-xs"
              />
              <MergeTagPicker targetId="campaign-html" value={htmlBody} onInsert={setHtmlBody} compact />
            </div>
          )}

          <div className="flex-1 min-h-0">
            {isNewsletter ? (
              <NewsletterBuilder
                data={newsletterData}
                onChange={setNewsletterData}
                onEditionChange={setSubject}
                storageScopeId={campaignId ?? "draft"}
                maxWidth={editorMaxWidth}
              />
            ) : (
              <div className="h-full overflow-y-auto overscroll-y-contain bg-muted/40 p-6">
                <div
                  className="mx-auto rounded-lg border bg-white shadow-sm overflow-hidden"
                  style={{ maxWidth: editorMaxWidth }}
                >
                  <iframe
                    title="Pré-visualização do e-mail"
                    srcDoc={previewDoc}
                    className="w-full border-0"
                    style={{ minHeight: device === "desktop" ? 640 : 720 }}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="shrink-0 px-5 py-2 text-sm text-destructive border-t bg-background">{error}</p>
          )}
        </div>

        <TemplateGalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen} onSelect={handleSelectTemplate} />
      </>
    );
  }

  const sender = resolveSenderFields(senderConfig);
  const senderInitial = (sender.fromName || "?").trim().charAt(0).toUpperCase();

  return (
    <Dialog open={open && step === "setup"} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="!flex flex-col gap-0 p-0 overflow-hidden sm:max-w-4xl w-[95vw] max-h-[90vh]"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle>{campaign ? "Editar campanha" : "Nova campanha"}</DialogTitle>
            <StepIndicator step={step} />
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <div className="grid md:grid-cols-[1fr_280px]">
            <div className="px-6 py-5 space-y-6 md:border-r">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Organização interna
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-name">Nome da campanha *</Label>
                  <Input
                    id="campaign-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Newsletter — Julho/2026"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Só para organização interna — o destinatário não vê este nome.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mensagem
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="campaign-subject">Assunto do e-mail *</Label>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        subject.length > 60 ? "text-amber-600" : "text-muted-foreground"
                      )}
                    >
                      {subject.length}/60
                    </span>
                  </div>
                  <SubjectWithMergeTags
                    id="campaign-subject"
                    value={subject}
                    onChange={setSubject}
                    placeholder="Ex.: Olá {{primeiro_nome}}, confira as novidades trabalhistas"
                  />
                  {subject.includes("{{") && (
                    <p className="text-[11px] text-muted-foreground">
                      Prévia: <span className="font-medium text-foreground">{previewSubject}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="campaign-preview-text">Texto de pré-visualização</Label>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        previewText.length > 110 ? "text-amber-600" : "text-muted-foreground"
                      )}
                    >
                      {previewText.length}/110
                    </span>
                  </div>
                  <Input
                    id="campaign-preview-text"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    placeholder="Complementa o assunto na caixa de entrada — não aparece no corpo do e-mail"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Aparece ao lado do assunto no Gmail/Outlook. Deixe em branco para usar o início do e-mail.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Destinatários
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-list">Lista de destino</Label>
                  <Select value={listId} onValueChange={setListId}>
                    <SelectTrigger id="campaign-list" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os contatos inscritos</SelectItem>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {listCountLoading ? (
                      "Calculando destinatários..."
                    ) : audienceCount !== null ? (
                      <>
                        <span className="font-medium text-foreground">
                          {audienceCount.toLocaleString("pt-BR")}
                        </span>{" "}
                        {audienceCount === 1 ? "contato inscrito vai receber" : "contatos inscritos vão receber"} este
                        e-mail.
                      </>
                    ) : (
                      "Não foi possível calcular os destinatários desta lista."
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Modelo do e-mail
                </p>
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-white">
                    <div
                      className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ width: 600, height: 500, transform: "translate(-50%, -50%) scale(0.11)" }}
                    >
                      <iframe
                        title="Modelo selecionado"
                        srcDoc={templateThumbnailSrc}
                        tabIndex={-1}
                        className="h-[500px] w-[600px] border-0 bg-white"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {isNewsletter ? "Newsletter Trabalhista BP" : "HTML livre"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isNewsletter ? "Editor visual na próxima etapa." : "Edite o conteúdo na próxima etapa."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => setGalleryOpen(true)}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Trocar
                  </Button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="px-5 py-5 bg-muted/20 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Como aparece na caixa de entrada
              </p>
              <div className="rounded-lg border bg-background p-3 space-y-2 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {senderInitial}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs font-medium truncate">{sender.fromName}</p>
                    <p className="text-xs font-semibold truncate">
                      {previewSubject || <span className="italic text-muted-foreground">Sem assunto</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {previewPreviewText || (
                        <span className="italic">Sem texto de pré-visualização</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {!sender.fromEmail && (
                <p className="text-[11px] text-amber-600">
                  Configure o e-mail remetente na aba Configurações para poder salvar a campanha.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleContinueToEditor} className="gap-1.5">
            Continuar para o editor
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>

      <TemplateGalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen} onSelect={handleSelectTemplate} />
    </Dialog>
  );
}
