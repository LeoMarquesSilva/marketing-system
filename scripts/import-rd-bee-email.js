/**
 * Importa conteúdo de e-mail a partir de JSON exportado do editor Bee (RD Station).
 *
 * Uso:
 *   node scripts/import-rd-bee-email.js "C:/Users/.../Duplicado de.json" 22287824
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Converter inline (sem path alias @/)
function styleToCss(style) {
  if (!style) return "";
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeRdPlaceholders(html) {
  return html
    .replace(/\*\|\|WEB_PREVIEW_LINK\|\|\*/g, "#")
    .replace(/\*\|\|UNSUBSCRIBE_LINK\|\|\*/g, "{{unsubscribe_url}}");
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderModule(mod) {
  const d = mod.descriptor ?? {};
  switch (mod.type) {
    case "mailup-bee-newsletter-modules-image": {
      const image = d.image ?? {};
      if (!image.src) return "";
      const img = `<img src="${image.src}" alt="${escapeAttr(image.alt ?? "")}" style="display:block;width:100%;max-width:600px;height:auto;border:0;${styleToCss(d.style)}" />`;
      return image.href
        ? `<a href="${escapeAttr(image.href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${img}</a>`
        : img;
    }
    case "mailup-bee-newsletter-modules-heading": {
      const heading = d.heading ?? {};
      if (!heading.text) return "";
      const tag = heading.title === "h1" ? "h1" : heading.title === "h2" ? "h2" : "h3";
      return `<${tag} style="margin:0;${styleToCss(heading.style)};${styleToCss(d.style)}">${sanitizeRdPlaceholders(heading.text)}</${tag}>`;
    }
    case "mailup-bee-newsletter-modules-paragraph": {
      const paragraph = d.paragraph ?? {};
      if (!paragraph.html) return "";
      return `<div style="${styleToCss(paragraph.style)};${styleToCss(d.style)}">${sanitizeRdPlaceholders(paragraph.html)}</div>`;
    }
    case "mailup-bee-newsletter-modules-text": {
      const text = d.text ?? {};
      if (!text.html) return "";
      return `<div style="${styleToCss(text.style)};${styleToCss(d.style)}">${sanitizeRdPlaceholders(text.html)}</div>`;
    }
    case "mailup-bee-newsletter-modules-button": {
      const button = d.button ?? {};
      if (!button.href) return "";
      const label = stripHtml(button.label ?? "Clique aqui");
      const align = (d.style ?? {})["text-align"] ?? "center";
      return `<div style="text-align:${align};${styleToCss(d.style)}"><a href="${escapeAttr(button.href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;${styleToCss(button.style)}">${escapeHtml(label)}</a></div>`;
    }
    case "mailup-bee-newsletter-modules-divider": {
      const border = (d.divider?.style ?? {})["border-top"] ?? "1px solid #E2E2E2";
      return `<div style="${styleToCss(d.style)}"><hr style="border:none;border-top:${border};margin:0;" /></div>`;
    }
    case "mailup-bee-newsletter-modules-social": {
      const icons = d.iconsList?.icons ?? [];
      const items = icons
        .map((icon) => {
          const img = icon.image;
          if (!img?.src) return "";
          return `<a href="${escapeAttr(img.href ?? "#")}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;text-decoration:none;"><img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt ?? "")}" width="32" height="32" style="display:block;border:0;" /></a>`;
        })
        .join("");
      return items ? `<div style="text-align:center;${styleToCss(d.style)}">${items}</div>` : "";
    }
    default:
      return "";
  }
}

function renderColumnModules(column) {
  return (column.modules ?? []).map(renderModule).filter(Boolean).join("\n");
}

function renderRow(row) {
  const columns = row.columns ?? [];
  if (!columns.length) return "";
  const rowStyle = styleToCss(row.content?.style);
  if (columns.length > 1) {
    const totalCols = columns.reduce((sum, c) => sum + (c["grid-columns"] ?? 12), 0);
    const innerCells = columns
      .map((col) => {
        const modules = renderColumnModules(col);
        if (!modules.trim()) return "";
        const width = `${Math.round(((col["grid-columns"] ?? 12) / totalCols) * 100)}%`;
        return `<td width="${width}" valign="top" style="vertical-align:top;width:${width};${styleToCss(col.style)}">${modules}</td>`;
      })
      .filter(Boolean)
      .join("");
    return innerCells ? `<tr><td style="${rowStyle}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${innerCells}</tr></table></td></tr>` : "";
  }
  const modules = renderColumnModules(columns[0]);
  return modules ? `<tr><td style="${rowStyle};${styleToCss(columns[0].style)}">${modules}</td></tr>` : "";
}

function extractSubject(json) {
  for (const row of json.page?.rows ?? []) {
    for (const col of row.columns ?? []) {
      for (const mod of col.modules ?? []) {
        if (mod.type !== "mailup-bee-newsletter-modules-heading") continue;
        const heading = mod.descriptor?.heading;
        if (heading?.title === "h1" && heading.text) return stripHtml(heading.text);
      }
    }
  }
  return null;
}

function beeJsonToHtml(json) {
  const body = json.page?.body;
  const messageBg = body?.content?.computedStyle?.messageBackgroundColor ?? "#ffffff";
  const messageWidth = body?.content?.computedStyle?.messageWidth ?? "600px";
  const fontFamily = body?.content?.style?.["font-family"] ?? "Arial, Helvetica, sans-serif";
  const outerBg = body?.container?.style?.["background-color"] ?? "#f4f5f7";
  const webFonts = (body?.content?.webFonts ?? [])
    .filter((f) => f.url)
    .map((f) => `<link href="${escapeAttr(f.url)}" rel="stylesheet" type="text/css" />`)
    .join("\n");
  const rows = (json.page?.rows ?? []).map(renderRow).filter(Boolean).join("\n");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${webFonts}
</head>
<body style="margin:0;padding:0;background-color:${outerBg};font-family:${fontFamily};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${outerBg};">
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

async function main() {
  const jsonPath = process.argv[2];
  const rdEmailId = Number(process.argv[3] ?? 22287824);
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error("Uso: node scripts/import-rd-bee-email.js <caminho.json> [rd_email_id]");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, supabaseKey);
  const raw = fs.readFileSync(jsonPath, "utf8");
  const editorJson = JSON.parse(raw);
  const htmlBody = beeJsonToHtml(editorJson);
  const subject = extractSubject(editorJson) ?? "Newsletter";

  const { data: existing } = await admin
    .from("email_rd_emails")
    .select("id, name, raw_data, send_at, rd_campaign_id, status, leads_count")
    .eq("rd_email_id", rdEmailId)
    .maybeSingle();

  const payload = {
    rd_email_id: rdEmailId,
    rd_campaign_id: existing?.rd_campaign_id ?? null,
    name: existing?.name ?? `RD Email ${rdEmailId}`,
    status: existing?.status ?? "finished",
    send_at: existing?.send_at ?? null,
    leads_count: existing?.leads_count ?? 0,
    raw_data: {
      ...(existing?.raw_data && typeof existing.raw_data === "object" ? existing.raw_data : {}),
      editor_json: editorJson,
      html_body: htmlBody,
      subject,
      migrated_at: new Date().toISOString(),
      source_file: path.basename(jsonPath),
    },
    synced_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("email_rd_emails")
    .upsert(payload, { onConflict: "rd_email_id" })
    .select("id, rd_email_id, name, raw_data")
    .single();

  if (error) {
    console.error("Erro ao gravar:", error.message);
    process.exit(1);
  }

  console.log("Migrado com sucesso!");
  console.log("  ID:", data.id);
  console.log("  RD email:", data.rd_email_id);
  console.log("  Nome:", data.name);
  console.log("  Assunto:", subject);
  console.log("  HTML:", htmlBody.length, "chars");
  console.log("  Arquivo:", path.basename(jsonPath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
