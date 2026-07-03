"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EMAIL_TEMPLATES, wrapEmailPreviewHtml, type EmailTemplate } from "@/lib/email-marketing-templates";
import { DEFAULT_NEWSLETTER_TRABALHISTA, renderNewsletterTrabalhistaHtml } from "@/lib/newsletter-trabalhista-template";

interface TemplateGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: EmailTemplate) => void;
}

export function TemplateGalleryDialog({ open, onOpenChange, onSelect }: TemplateGalleryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolha um modelo</DialogTitle>
          <DialogDescription>
            Selecione um ponto de partida — o conteúdo fica totalmente editável depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EMAIL_TEMPLATES.map((template) => {
            const previewSrc =
              template.editor === "newsletter-trabalhista"
                ? renderNewsletterTrabalhistaHtml(DEFAULT_NEWSLETTER_TRABALHISTA)
                : wrapEmailPreviewHtml(template.html);

            return (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelect(template);
                onOpenChange(false);
              }}
              className="group text-left rounded-lg border overflow-hidden hover:border-primary hover:shadow-md transition-all"
            >
              <div className="relative h-28 overflow-hidden bg-muted">
                <div
                  className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ width: 600, height: 500, transform: "translate(-50%, -50%) scale(0.24)" }}
                >
                  <iframe
                    title={template.name}
                    srcDoc={previewSrc}
                    tabIndex={-1}
                    className="h-[500px] w-[600px] border-0 bg-white"
                  />
                </div>
                <div className="absolute inset-0 bg-transparent group-hover:bg-primary/5 transition-colors" />
              </div>
              <div className="p-2.5">
                <p className="text-sm font-medium leading-tight">{template.name}</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">{template.description}</p>
              </div>
            </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
