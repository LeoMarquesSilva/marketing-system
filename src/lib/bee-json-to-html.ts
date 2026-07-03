/**
 * Converte JSON do editor Bee (exportado do RD Station) para HTML de e-mail.
 */

type StyleRecord = Record<string, string | undefined>;

interface BeePage {
  page?: {
    body?: {
      container?: { style?: StyleRecord };
      content?: {
        computedStyle?: { messageBackgroundColor?: string; messageWidth?: string; linkColor?: string };
        style?: StyleRecord;
        webFonts?: { url?: string }[];
      };
    };
    rows?: BeeRow[];
  };
}

interface BeeRow {
  columns?: BeeColumn[];
  content?: { style?: StyleRecord };
  container?: { style?: StyleRecord };
}

interface BeeColumn {
  modules?: BeeModule[];
  style?: StyleRecord;
  mobileStyle?: StyleRecord;
  ["grid-columns"]?: number;
}

interface BeeModule {
  type?: string;
  descriptor?: Record<string, unknown>;
  locked?: boolean;
}

function styleToCss(style?: StyleRecord): string {
  if (!style) return "";
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeRdPlaceholders(html: string): string {
  return html
    .replace(/\*\|\|WEB_PREVIEW_LINK\|\|\*/g, "#")
    .replace(/\*\|\|UNSUBSCRIBE_LINK\|\|\*/g, "{{unsubscribe_url}}");
}

function renderImage(descriptor: Record<string, unknown>): string {
  const image = descriptor.image as { src?: string; alt?: string; href?: string } | undefined;
  if (!image?.src) return "";
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  const alt = image.alt ?? "";
  const img = `<img src="${image.src}" alt="${escapeAttr(alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;${moduleStyle}" />`;
  if (image.href) {
    return `<a href="${escapeAttr(image.href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${img}</a>`;
  }
  return img;
}

function renderHeading(descriptor: Record<string, unknown>): string {
  const heading = descriptor.heading as { text?: string; style?: StyleRecord; title?: string } | undefined;
  if (!heading?.text) return "";
  const tag = heading.title === "h1" ? "h1" : heading.title === "h2" ? "h2" : "h3";
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  const textStyle = styleToCss(heading.style);
  return `<${tag} style="margin:0;${textStyle};${moduleStyle}">${sanitizeRdPlaceholders(heading.text)}</${tag}>`;
}

function renderParagraph(descriptor: Record<string, unknown>): string {
  const paragraph = descriptor.paragraph as { html?: string; style?: StyleRecord } | undefined;
  if (!paragraph?.html) return "";
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  const textStyle = styleToCss(paragraph.style);
  return `<div style="${textStyle};${moduleStyle}">${sanitizeRdPlaceholders(paragraph.html)}</div>`;
}

function renderText(descriptor: Record<string, unknown>): string {
  const text = descriptor.text as { html?: string; style?: StyleRecord } | undefined;
  if (!text?.html) return "";
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  const textStyle = styleToCss(text.style);
  return `<div style="${textStyle};${moduleStyle}">${sanitizeRdPlaceholders(text.html)}</div>`;
}

function renderButton(descriptor: Record<string, unknown>): string {
  const button = descriptor.button as { href?: string; label?: string; style?: StyleRecord; target?: string } | undefined;
  if (!button?.href) return "";
  const label = stripHtml(button.label ?? "Clique aqui");
  const btnStyle = styleToCss(button.style);
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  const align = (descriptor.style as StyleRecord)?.["text-align"] ?? "center";
  return `<div style="text-align:${align};${moduleStyle}"><a href="${escapeAttr(button.href)}" target="${button.target ?? "_blank"}" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;${btnStyle}">${escapeHtml(label)}</a></div>`;
}

function renderDivider(descriptor: Record<string, unknown>): string {
  const divider = descriptor.divider as { style?: StyleRecord } | undefined;
  const border = divider?.style?.["border-top"] ?? "1px solid #E2E2E2";
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  return `<div style="${moduleStyle}"><hr style="border:none;border-top:${border};margin:0;" /></div>`;
}

function renderSocial(descriptor: Record<string, unknown>): string {
  const iconsList = descriptor.iconsList as { icons?: { image?: { href?: string; src?: string; alt?: string } }[] } | undefined;
  const icons = iconsList?.icons ?? [];
  if (!icons.length) return "";
  const moduleStyle = styleToCss(descriptor.style as StyleRecord);
  const items = icons
    .map((icon) => {
      const img = icon.image;
      if (!img?.src) return "";
      const href = img.href ?? "#";
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;text-decoration:none;"><img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt ?? "")}" width="32" height="32" style="display:block;border:0;" /></a>`;
    })
    .join("");
  return `<div style="text-align:center;${moduleStyle}">${items}</div>`;
}

function renderModule(mod: BeeModule): string {
  const descriptor = mod.descriptor ?? {};
  switch (mod.type) {
    case "mailup-bee-newsletter-modules-image":
      return renderImage(descriptor);
    case "mailup-bee-newsletter-modules-heading":
      return renderHeading(descriptor);
    case "mailup-bee-newsletter-modules-paragraph":
      return renderParagraph(descriptor);
    case "mailup-bee-newsletter-modules-text":
      return renderText(descriptor);
    case "mailup-bee-newsletter-modules-button":
      return renderButton(descriptor);
    case "mailup-bee-newsletter-modules-divider":
      return renderDivider(descriptor);
    case "mailup-bee-newsletter-modules-social":
      return renderSocial(descriptor);
    default:
      return "";
  }
}

function renderColumnModules(column: BeeColumn): string {
  return (column.modules ?? []).map(renderModule).filter(Boolean).join("\n");
}

function renderColumn(column: BeeColumn): string {
  const colStyle = styleToCss(column.style);
  const modules = renderColumnModules(column);
  if (!modules) return "";
  return `<td valign="top" style="vertical-align:top;${colStyle}">${modules}</td>`;
}

function renderRow(row: BeeRow): string {
  const columns = row.columns ?? [];
  if (!columns.length) return "";

  const rowStyle = styleToCss(row.content?.style);
  const isMultiCol = columns.length > 1;

  if (isMultiCol) {
    const totalCols = columns.reduce((sum, c) => sum + (c["grid-columns"] ?? 12), 0);
    const innerCells = columns
      .map((col) => {
        const modules = renderColumnModules(col);
        if (!modules.trim()) return "";
        const grid = col["grid-columns"] ?? 12;
        const width = `${Math.round((grid / totalCols) * 100)}%`;
        const colStyle = styleToCss(col.style);
        return `<td width="${width}" valign="top" style="vertical-align:top;width:${width};${colStyle}">${modules}</td>`;
      })
      .filter(Boolean)
      .join("");
    if (!innerCells) return "";
    return `<tr><td style="${rowStyle}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${innerCells}</tr></table></td></tr>`;
  }

  const cell = renderColumn(columns[0]);
  if (!cell) return "";
  return `<tr>${cell.replace("<td ", `<td style="${rowStyle};`)}</tr>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Extrai assunto sugerido a partir do primeiro título h1. */
export function extractBeeSubject(json: BeePage): string | null {
  for (const row of json.page?.rows ?? []) {
    for (const col of row.columns ?? []) {
      for (const mod of col.modules ?? []) {
        if (mod.type !== "mailup-bee-newsletter-modules-heading") continue;
        const heading = mod.descriptor?.heading as { title?: string; text?: string } | undefined;
        if (heading?.title === "h1" && heading.text) {
          return stripHtml(heading.text);
        }
      }
    }
  }
  return null;
}

/** Converte JSON Bee em documento HTML completo pronto para envio/arquivo. */
export function beeJsonToHtml(json: BeePage): string {
  const body = json.page?.body;
  const containerStyle = styleToCss(body?.container?.style);
  const content = body?.content;
  const messageBg = content?.computedStyle?.messageBackgroundColor ?? "#ffffff";
  const messageWidth = content?.computedStyle?.messageWidth ?? "600px";
  const fontFamily = content?.style?.["font-family"] ?? "Arial, Helvetica, sans-serif";
  const webFonts = (content?.webFonts ?? [])
    .map((f) => f.url)
    .filter(Boolean)
    .map((url) => `<link href="${escapeAttr(url!)}" rel="stylesheet" type="text/css" />`)
    .join("\n");

  const rows = (json.page?.rows ?? []).map(renderRow).filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${webFonts}
</head>
<body style="margin:0;padding:0;background-color:${body?.container?.style?.["background-color"] ?? "#f4f5f7"};${containerStyle};font-family:${fontFamily};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${body?.container?.style?.["background-color"] ?? "#f4f5f7"};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="${messageWidth.replace("px", "")}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${messageWidth};background-color:${messageBg};">
          ${rows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Corpo interno (sem wrapper externo) — útil para pré-visualização em iframe estreito. */
export function beeJsonToBodyHtml(json: BeePage): string {
  const full = beeJsonToHtml(json);
  const match = full.match(/<table role="presentation" width="\d+"[^>]*style="[^"]*max-width:[^"]*"[^>]*>([\s\S]*)<\/table>\s*<\/td>/);
  return match?.[1]?.trim() ?? full;
}
