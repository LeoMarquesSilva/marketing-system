/**
 * Helpers de HTML para botões/links usados no template de e-mail.
 */

function escapeHtml(value: string): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildEmailButtonHtml(label: string, url: string, color = "#101f2e"): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = (url ?? "").replace(/"/g, "&quot;");
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 24px;border-radius:20px;margin:8px 4px 8px 0;">${safeLabel}</a>`;
}
