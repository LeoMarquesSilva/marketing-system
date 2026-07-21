/**
 * Modelo editável "Newsletter Trabalhista BP" — baseado na #41 migrada do RD Station.
 * Gera HTML completo (documento) no mesmo layout visual.
 *
 * Conteúdo textual é sempre texto puro (editado via builder, sem HTML solto) —
 * a formatação (negrito, cor, alinhamento, tamanho) fica em campos de estilo
 * explícitos, aplicados como CSS inline na hora de renderizar.
 */

import { buildEmailButtonHtml } from "@/lib/email-rich-html";

export type TextAlign = "left" | "center" | "right";
export type FontSizePreset = "sm" | "md" | "lg" | "xl";
export type CtaStyle = "link" | "button";

export interface TextBlockStyle {
  bold: boolean;
  color: string;
  align: TextAlign;
  fontSize: FontSizePreset;
}

export const FONT_SIZE_PX: Record<FontSizePreset, number> = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 23,
};

export const FONT_SIZE_LABEL: Record<FontSizePreset, string> = {
  sm: "Pequeno",
  md: "Normal",
  lg: "Grande",
  xl: "Título",
};

function defaultStyle(overrides: Partial<TextBlockStyle> = {}): TextBlockStyle {
  return { bold: false, color: "#000000", align: "left", fontSize: "md", ...overrides };
}

export interface NewsletterArticle {
  imageUrl: string;
  imageAlt: string;
  title: string;
  titleStyle: TextBlockStyle;
  summary: string;
  summaryStyle: TextBlockStyle;
  linkUrl: string;
  linkLabel: string;
  ctaStyle: CtaStyle;
  ctaColor: string;
  /** Imagem à esquerda (true) ou direita (false) */
  imageLeft: boolean;
}

export interface NewsletterTrabalhistaData {
  editionLabel: string;
  editionLabelStyle: TextBlockStyle;
  intro: string;
  introStyle: TextBlockStyle;
  coverImageUrl: string;
  coverLinkUrl: string;
  articles: NewsletterArticle[];
  closingText: string;
  closingTextStyle: TextBlockStyle;
  contactButtonLabel: string;
  contactButtonColor: string;
  whatsappUrl: string;
}

function buildDefaultArticle(input: {
  imageUrl: string;
  imageAlt: string;
  title: string;
  summary: string;
  linkUrl: string;
  imageLeft: boolean;
}): NewsletterArticle {
  return {
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    title: input.title,
    titleStyle: defaultStyle({ bold: true, fontSize: "lg" }),
    summary: input.summary,
    summaryStyle: defaultStyle({ fontSize: "md" }),
    linkUrl: input.linkUrl,
    linkLabel: "Ler notícia completa",
    ctaStyle: "link",
    ctaColor: "#663ae0",
    imageLeft: input.imageLeft,
  };
}

export const DEFAULT_NEWSLETTER_TRABALHISTA: NewsletterTrabalhistaData = {
  editionLabel: "Newsletter Trabalhista | Edição #41",
  editionLabelStyle: defaultStyle({ bold: true, align: "center", fontSize: "xl" }),
  intro:
    "Acompanhe as principais novidades e atualizações da área trabalhista. Nossa newsletter semanal traz, toda segunda-feira, notícias relevantes para manter você informado e preparado para as mudanças no cenário jurídico.",
  introStyle: defaultStyle({ fontSize: "md" }),
  coverImageUrl:
    "https://email-editor-production.s3.amazonaws.com/images/905685/Newsletter%20Trabalhista/MODELONEWSLETTERCAPA-10.png",
  coverLinkUrl:
    "https://www.bismarchipires.com.br/blog/2026/03/30/decisoes-justica-trabalho-marco-2026-edicao-40/",
  articles: [
    buildDefaultArticle({
      imageUrl:
        "https://email-editor-production.s3.amazonaws.com/images/905685/abstract-blur-supermarket-department-store.jpg",
      imageAlt: "Promotora de vendas",
      title:
        "Justiça reconhece horas extras e supressão de intervalos em jornada de promotora de vendas na Páscoa",
      summary:
        "Sentença proferida na 4ª Vara do Trabalho de Diadema-SP condenou multinacional ao pagamento de horas extras e reflexos, além de indenização por supressão de intervalos intrajornada e interjornada, a uma promotora de vendas.",
      linkUrl:
        "https://www.bismarchipires.com.br/blog/2026/04/07/decisoes-justica-trabalho-marco-2026-edicao-41/",
      imageLeft: true,
    }),
    buildDefaultArticle({
      imageUrl:
        "https://email-editor-production.s3.amazonaws.com/images/905685/yellow-articulated-city-bus-downtown-public-transport.jpg",
      imageAlt: "Acidente de trajeto",
      title:
        "Empresa condenada por acidente de trajeto: empregada sofre fratura na coluna após ônibus passar em alta velocidade sobre quebra-molas",
      summary:
        "A juíza Daniela Torres da Conceição, titular da 6ª Vara do Trabalho de Contagem, reconheceu a responsabilidade objetiva de uma empresa por acidente de trajeto ocorrido com uma empregada quando era transportada em veículo fornecido pela própria empregadora.",
      linkUrl:
        "https://www.bismarchipires.com.br/blog/2026/04/07/decisoes-justica-trabalho-marco-2026-edicao-41/",
      imageLeft: false,
    }),
    buildDefaultArticle({
      imageUrl:
        "https://email-editor-production.s3.amazonaws.com/images/905685/site-engineer-construction-site.jpg",
      imageAlt: "Laudos técnicos",
      title: "Empresa é condenada por usar nome de engenheira em laudos técnicos sem autorização",
      summary:
        "Por unanimidade, a Terceira Turma do Tribunal Superior do Trabalho manteve a condenação da Maxipas Saúde Ocupacional Ltda., de Curitiba (PR), ao pagamento de R$ 17 mil de indenização a uma engenheira de segurança do trabalho.",
      linkUrl:
        "https://www.bismarchipires.com.br/blog/2026/04/07/decisoes-justica-trabalho-marco-2026-edicao-41/",
      imageLeft: true,
    }),
    buildDefaultArticle({
      imageUrl:
        "https://email-editor-production.s3.amazonaws.com/images/905685/close-up-young-pregnant-woman-cooking.jpg",
      imageAlt: "Empregada doméstica gestante",
      title:
        "Pedido de demissão de empregada doméstica gestante é anulado por falta de assistência sindical",
      summary:
        "A Quinta Turma do Tribunal Superior do Trabalho reconheceu, por unanimidade, a nulidade do pedido de demissão apresentado por uma empregada doméstica gestante sem a assistência do sindicato da categoria.",
      linkUrl:
        "https://www.bismarchipires.com.br/blog/2026/04/07/decisoes-justica-trabalho-marco-2026-edicao-41/",
      imageLeft: false,
    }),
  ],
  closingText:
    "Caso tenha dúvidas ou queira conversar sobre algum dos temas abordados, entre em contato conosco. Acompanhe nossas próximas edições e mantenha-se sempre atualizado sobre as novidades da área trabalhista.",
  closingTextStyle: defaultStyle({ color: "#555555", fontSize: "md" }),
  contactButtonLabel: "Entrar em contato",
  contactButtonColor: "#04202f",
  whatsappUrl:
    "https://api.whatsapp.com/send/?phone=5519993596791&text&type=phone_number&app_absent=0",
};

const EDITOR_MARKER = "<!-- newsletter-bp:";

function escapeHtml(value: string): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtmlLines(value: string): string {
  return escapeHtml(value).split(/\n/).join("<br/>");
}

function textStyleToCss(style: TextBlockStyle): string {
  return [
    `color:${style.color}`,
    `font-size:${FONT_SIZE_PX[style.fontSize]}px`,
    `font-weight:${style.bold ? 700 : 400}`,
    `text-align:${style.align}`,
    "line-height:150%",
  ].join(";");
}

/** Normaliza dados vindos de versões antigas (sem campos de estilo) preenchendo defaults. */
export function withNewsletterDefaults(
  data: Partial<NewsletterTrabalhistaData>
): NewsletterTrabalhistaData {
  const base = DEFAULT_NEWSLETTER_TRABALHISTA;
  const articles = Array.isArray(data.articles) ? data.articles : base.articles;
  return {
    editionLabel: data.editionLabel ?? base.editionLabel,
    editionLabelStyle: { ...base.editionLabelStyle, ...(data.editionLabelStyle as Partial<TextBlockStyle>) },
    intro: data.intro ?? base.intro,
    introStyle: { ...base.introStyle, ...(data.introStyle as Partial<TextBlockStyle>) },
    coverImageUrl: data.coverImageUrl ?? base.coverImageUrl,
    coverLinkUrl: data.coverLinkUrl ?? base.coverLinkUrl,
    articles: articles.map((article, i: number) => {
      const defaults = base.articles[i % base.articles.length];
      const a = article as Partial<NewsletterArticle> & Record<string, unknown>;
      return {
        imageUrl: a.imageUrl ?? defaults.imageUrl,
        imageAlt: a.imageAlt ?? defaults.imageAlt,
        title: a.title ?? defaults.title,
        titleStyle: { ...defaults.titleStyle, ...(a.titleStyle as Partial<TextBlockStyle>) },
        summary: a.summary ?? defaults.summary,
        summaryStyle: { ...defaults.summaryStyle, ...(a.summaryStyle as Partial<TextBlockStyle>) },
        linkUrl: a.linkUrl ?? defaults.linkUrl,
        linkLabel: a.linkLabel ?? defaults.linkLabel,
        ctaStyle: (a.ctaStyle as CtaStyle) ?? "link",
        ctaColor: a.ctaColor ?? "#663ae0",
        imageLeft: a.imageLeft ?? defaults.imageLeft,
      };
    }),
    closingText: data.closingText ?? base.closingText,
    closingTextStyle: { ...base.closingTextStyle, ...(data.closingTextStyle as Partial<TextBlockStyle>) },
    contactButtonLabel: data.contactButtonLabel ?? base.contactButtonLabel,
    contactButtonColor: data.contactButtonColor ?? base.contactButtonColor,
    whatsappUrl: data.whatsappUrl ?? base.whatsappUrl,
  };
}

function renderDivider(): string {
  return `<tr><td style="background-color:#fcf9f5;padding:16px 60px 24px;"><hr style="border:none;border-top:1px solid #E2E2E2;margin:0;" /></td></tr>`;
}

function renderCta(label: string, url: string, style: CtaStyle, color: string): string {
  if (style === "button") {
    return buildEmailButtonHtml(label || "Saiba mais", url, color);
  }
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:${color};font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function renderArticle(article: NewsletterArticle): string {
  const imageBlock = `<a href="${escapeHtml(article.linkUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
    <img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.imageAlt)}" style="display:block;width:100%;max-width:174px;height:auto;border:0;" />
  </a>`;

  const textBlock = `
    <h2 style="margin:0 0 8px;${textStyleToCss(article.titleStyle)}">${textToHtmlLines(article.title)}</h2>
    <p style="margin:0 0 8px;${textStyleToCss(article.summaryStyle)}">${textToHtmlLines(article.summary)}</p>
    ${renderCta(article.linkLabel, article.linkUrl, article.ctaStyle, article.ctaColor)}`;

  const imageCell = `<td width="42%" valign="top" style="vertical-align:top;padding:8px ${article.imageLeft ? "16px" : "60px"} 8px ${article.imageLeft ? "60px" : "16px"};">${imageBlock}</td>`;
  const textCell = `<td width="58%" valign="top" style="vertical-align:top;padding:8px ${article.imageLeft ? "60px" : "16px"} 8px ${article.imageLeft ? "16px" : "60px"};">${textBlock}</td>`;

  const cells = article.imageLeft ? `${imageCell}${textCell}` : `${textCell}${imageCell}`;

  return `<tr><td style="background-color:#fcf9f5;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>${renderDivider()}`;
}

/** Gera documento HTML completo da newsletter. */
export function renderNewsletterTrabalhistaHtml(rawData: NewsletterTrabalhistaData): string {
  const data = withNewsletterDefaults(rawData);
  const articlesHtml = data.articles.map(renderArticle).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@100;400;700;900&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#04202f;font-family:'Montserrat','Trebuchet MS',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#04202f;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#fcf9f5;">
          <tr>
            <td style="background-color:#fcf9f5;padding:0;">
              <a href="${escapeHtml(data.coverLinkUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <img src="${escapeHtml(data.coverImageUrl)}" alt="Capa da newsletter" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fcf9f5;padding:32px 60px 16px;text-align:center;">
              <h1 style="margin:0;${textStyleToCss(data.editionLabelStyle)}">${textToHtmlLines(data.editionLabel)}</h1>
              <p style="margin:16px 0 0;${textStyleToCss(data.introStyle)}">${textToHtmlLines(data.intro)}</p>
            </td>
          </tr>
          ${renderDivider()}
          ${articlesHtml}
          <tr>
            <td style="background-color:#fcf9f5;padding:24px 60px 8px;">
              <p style="margin:0;${textStyleToCss(data.closingTextStyle)}">${textToHtmlLines(data.closingText)}</p>
            </td>
          </tr>
          ${renderDivider()}
          <tr>
            <td style="background-color:#fcf9f5;padding:10px;text-align:center;">
              ${buildEmailButtonHtml(data.contactButtonLabel, data.whatsappUrl, data.contactButtonColor)}
            </td>
          </tr>
          <tr>
            <td style="background-color:#fcf9f5;padding:10px;text-align:center;">
              <a href="https://www.instagram.com/bismarchipires/" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/instagram@2x.png" alt="Instagram" width="32" height="32" style="border:0;" /></a>
              <a href="https://www.linkedin.com/company/bismarchipires" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/linkedin@2x.png" alt="LinkedIn" width="32" height="32" style="border:0;" /></a>
              <a href="https://www.youtube.com/@bismarchipires" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/youtube@2x.png" alt="YouTube" width="32" height="32" style="border:0;" /></a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fcf9f5;padding:15px;text-align:center;">
              <p style="margin:0;color:#8c8c8c;font-size:12px;line-height:14px;">Enviado por Bismarchi | Pires Sociedade de Advogados<br/>R. Cel. Quirino, 1266 - Cambuí, Campinas - SP, 13025-002<br/>Caso não queira mais receber estes e-mails, <a href="{{unsubscribe_url}}" style="color:#8c8c8c;text-decoration:underline;">cancele sua inscrição</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Serializa campanha: metadados do editor + HTML renderizado. */
export function packNewsletterCampaignHtml(data: NewsletterTrabalhistaData): string {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return `${EDITOR_MARKER}${payload} -->\n${renderNewsletterTrabalhistaHtml(data)}`;
}

/** Recupera dados do editor a partir do html_body salvo. */
export function unpackNewsletterCampaignHtml(htmlBody: string): {
  data: NewsletterTrabalhistaData | null;
  html: string;
} {
  const match = htmlBody.match(/^<!-- newsletter-bp:([A-Za-z0-9+/=]+) -->\n?/);
  if (!match) return { data: null, html: htmlBody };
  try {
    const json = decodeURIComponent(escape(atob(match[1])));
    const parsed = JSON.parse(json) as Partial<NewsletterTrabalhistaData> & Record<string, unknown>;
    return { data: withNewsletterDefaults(parsed), html: htmlBody.slice(match[0].length) };
  } catch {
    return { data: null, html: htmlBody };
  }
}

export function isFullEmailDocument(html: string): boolean {
  return /^\s*<!doctype html/i.test(html) || /<html[\s>]/i.test(html);
}

/** Extrai dados da newsletter #41 migrada (Bee JSON) para servir de ponto de partida. */
export function newsletterDataFromBeeJson(beeJson: { page?: { rows?: unknown[] } }): NewsletterTrabalhistaData | null {
  try {
    const data = structuredClone(DEFAULT_NEWSLETTER_TRABALHISTA);
    const rows = beeJson.page?.rows as {
      columns?: { modules?: { type?: string; descriptor?: Record<string, unknown> }[] }[];
    }[];

    for (const row of rows ?? []) {
      for (const col of row.columns ?? []) {
        for (const mod of col.modules ?? []) {
          if (mod.type === "mailup-bee-newsletter-modules-heading") {
            const heading = mod.descriptor?.heading as { title?: string; text?: string } | undefined;
            if (heading?.title === "h1" && heading.text) {
              data.editionLabel = heading.text.replace(/<[^>]+>/g, "").trim();
            }
          }
          if (mod.type === "mailup-bee-newsletter-modules-paragraph") {
            const html = (mod.descriptor?.paragraph as { html?: string } | undefined)?.html ?? "";
            const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (plain.startsWith("Acompanhe as principais")) data.intro = plain;
          }
          if (mod.type === "mailup-bee-newsletter-modules-image") {
            const image = mod.descriptor?.image as { src?: string; href?: string } | undefined;
            if (image?.src?.includes("MODELONEWSLETTERCAPA")) {
              data.coverImageUrl = image.src;
              if (image.href) data.coverLinkUrl = image.href;
            }
          }
          if (mod.type === "mailup-bee-newsletter-modules-text") {
            const html = (mod.descriptor?.text as { html?: string } | undefined)?.html ?? "";
            const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (plain.startsWith("Caso tenha dúvidas")) data.closingText = plain;
          }
          if (mod.type === "mailup-bee-newsletter-modules-button") {
            const button = mod.descriptor?.button as { href?: string; label?: string } | undefined;
            if (button?.href?.includes("whatsapp")) {
              data.whatsappUrl = button.href;
              data.contactButtonLabel = (button.label ?? "").replace(/<[^>]+>/g, "").trim() || data.contactButtonLabel;
            }
          }
        }
      }
    }

    const articles: NewsletterArticle[] = [];
    for (const row of rows ?? []) {
      const cols = row.columns ?? [];
      if (cols.length < 2) continue;
      let imageMod: { src?: string; href?: string; alt?: string } | null = null;
      let title = "";
      let summary = "";
      let linkUrl = "";
      let linkLabel = "Ler notícia completa";
      let imageLeft = true;

      for (let i = 0; i < cols.length; i++) {
        for (const mod of cols[i].modules ?? []) {
          if (mod.type === "mailup-bee-newsletter-modules-image") {
            const img = mod.descriptor?.image as { src?: string; href?: string; alt?: string } | undefined;
            if (img?.src && !img.src.includes("MODELONEWSLETTERCAPA")) {
              imageMod = img;
              imageLeft = i === 0;
            }
          }
          if (mod.type === "mailup-bee-newsletter-modules-heading") {
            const h = mod.descriptor?.heading as { title?: string; text?: string } | undefined;
            if (h?.title === "h2" && h.text) title = h.text.replace(/<[^>]+>/g, "").trim();
          }
          if (mod.type === "mailup-bee-newsletter-modules-paragraph") {
            const html = (mod.descriptor?.paragraph as { html?: string } | undefined)?.html ?? "";
            const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (plain && !plain.startsWith("Acompanhe")) summary = plain;
          }
          if (mod.type === "mailup-bee-newsletter-modules-button") {
            const btn = mod.descriptor?.button as { href?: string; label?: string } | undefined;
            if (btn?.href && !btn.href.includes("whatsapp")) {
              linkUrl = btn.href;
              linkLabel = (btn.label ?? linkLabel).replace(/<[^>]+>/g, "").trim() || linkLabel;
            }
          }
        }
      }

      if (imageMod && title) {
        articles.push(
          buildDefaultArticle({
            imageUrl: imageMod.src!,
            imageAlt: imageMod.alt ?? title.slice(0, 60),
            title,
            summary,
            linkUrl: linkUrl || imageMod.href || data.coverLinkUrl,
            imageLeft,
          })
        );
        articles[articles.length - 1].linkLabel = linkLabel;
      }
    }

    if (articles.length) data.articles = articles.slice(0, 4);
    return data;
  } catch {
    return null;
  }
}
