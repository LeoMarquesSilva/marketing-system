/**
 * Documento do boletim, compartilhado entre o preview no cliente e o download
 * no servidor.
 *
 * `buildNewsletterHtml` devolve o corpo do documento em HTML puro, sem nenhuma
 * dependência do Word; `buildNewsletterWordHtml` só o embrulha nos namespaces
 * do Office. Um futuro export em PDF consome o primeiro sem alterações.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Newsletter, NewsletterItem } from "./content-newsletter";

const BRAND = "#04202f";

const esc = (s?: string | null) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const inlineHtml = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

/** Quebra o texto em parágrafos, tolerando quebra simples ou dupla. */
export function splitParagraphs(body: string): string[] {
  return (body ?? "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export type NewsletterDocInput = Pick<
  Newsletter,
  | "title"
  | "edition_label"
  | "area"
  | "intro_title"
  | "intro_body"
  | "signature_names"
  | "collaborator_names"
  | "signed_by_name"
  | "signed_at"
>;

export type NewsletterDocItem = Pick<
  NewsletterItem,
  "headline" | "body" | "source_link"
>;

/** Corpo do boletim em HTML puro (capa, abertura, sumário, seções e rodapé). */
export function buildNewsletterHtml(
  newsletter: NewsletterDocInput,
  items: NewsletterDocItem[]
): string {
  const editionLine = [newsletter.area, newsletter.edition_label]
    .filter(Boolean)
    .map((v) => esc(v))
    .join(" &nbsp;|&nbsp; ");

  const intro =
    newsletter.intro_title || newsletter.intro_body
      ? `<div style="border-left:3px solid ${BRAND};padding:2pt 0 2pt 12pt;margin:0 0 22pt;">
          ${
            newsletter.intro_title
              ? `<h2 style="color:${BRAND};font-size:13pt;margin:0 0 6pt;">${inlineHtml(
                  newsletter.intro_title
                )}</h2>`
              : ""
          }
          ${splitParagraphs(newsletter.intro_body ?? "")
            .map(
              (p) =>
                `<p style="margin:0 0 8pt;text-align:justify;">${inlineHtml(p)}</p>`
            )
            .join("")}
        </div>`
      : "";

  const summary =
    items.length > 0
      ? `<h2 style="color:${BRAND};font-size:12pt;text-transform:uppercase;letter-spacing:1px;margin:0 0 8pt;">Sumário</h2>
         <ol style="margin:0 0 24pt;padding-left:18pt;">
           ${items
             .map(
               (item) =>
                 `<li style="margin:0 0 4pt;">${inlineHtml(item.headline)}</li>`
             )
             .join("")}
         </ol>`
      : "";

  const sections = items
    .map((item, index) => {
      const paragraphs = splitParagraphs(item.body)
        .map(
          (p) => `<p style="margin:0 0 9pt;text-align:justify;">${inlineHtml(p)}</p>`
        )
        .join("");
      const source = item.source_link
        ? `<p style="margin:0 0 4pt;font-size:8.5pt;color:#8a8a8a;">Fonte: ${esc(
            item.source_link
          )}</p>`
        : "";
      return `<div style="margin:0 0 26pt;">
          <p style="margin:0 0 4pt;font-size:8.5pt;color:#8a8a8a;letter-spacing:1px;">${String(
            index + 1
          ).padStart(2, "0")}</p>
          <h2 style="color:${BRAND};font-size:12.5pt;margin:0 0 8pt;border-bottom:1px solid #e2e5e8;padding-bottom:5pt;">${inlineHtml(
            item.headline
          )}</h2>
          ${paragraphs}
          ${source}
        </div>`;
    })
    .join("");

  const signature = `<div style="border-top:2px solid ${BRAND};margin-top:26pt;padding-top:12pt;">
      ${
        newsletter.signature_names
          ? `<p style="margin:0 0 8pt;font-size:9pt;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;">Responsáveis pelo conteúdo</p>
             <p style="margin:0 0 12pt;font-weight:bold;">${inlineHtml(
               newsletter.signature_names
             )}</p>`
          : ""
      }
      ${
        newsletter.collaborator_names
          ? `<p style="margin:0 0 4pt;font-size:9pt;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;">Colaborou para esta newsletter</p>
             <p style="margin:0 0 12pt;">${inlineHtml(newsletter.collaborator_names)}</p>`
          : ""
      }
      ${
        newsletter.signed_by_name && newsletter.signed_at
          ? `<p style="margin:0;font-size:8.5pt;color:#8a8a8a;">Assinado por ${esc(
              newsletter.signed_by_name
            )} em ${format(new Date(newsletter.signed_at), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}.</p>`
          : ""
      }
      <p style="margin:12pt 0 0;font-size:8pt;color:#aaa;text-align:justify;">Este material possui caráter meramente informativo e não constitui parecer ou aconselhamento jurídico. As consequências jurídicas dependem das circunstâncias específicas de cada caso, sendo recomendada a obtenção de orientação jurídica individualizada.</p>
    </div>`;

  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#1a1a1a;line-height:1.5;">
      <p style="margin:0;font-size:9pt;color:#8a8a8a;letter-spacing:1px;text-transform:uppercase;">Newsletter</p>
      <h1 style="color:${BRAND};font-size:20pt;margin:6pt 0 4pt;">${esc(newsletter.title)}</h1>
      <p style="margin:0 0 22pt;font-size:9.5pt;color:#6b7280;">${editionLine}</p>
      ${intro}
      ${summary}
      ${sections}
      ${signature}
    </div>`;
}

/** Envelope .doc (Word abre HTML com estes namespaces). */
export function buildNewsletterWordHtml(
  newsletter: NewsletterDocInput,
  items: NewsletterDocItem[]
): string {
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(
    newsletter.title
  )}</title></head><body>${buildNewsletterHtml(newsletter, items)}</body></html>`;
}

/** Sufixo de arquivo a partir do título da edição. */
export function newsletterWordSlug(title: string): string {
  return (
    (title || "newsletter")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .toLowerCase() || "newsletter"
  );
}
