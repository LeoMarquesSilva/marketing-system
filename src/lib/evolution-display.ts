/** Helpers de exibição — seguros para importar em Client Components. */

export function jidToPhone(remoteJid: string): string | null {
  if (!remoteJid || remoteJid.endsWith("@g.us")) return null;
  if (remoteJid === "status@broadcast") return null;
  const userPart = remoteJid.split("@")[0] ?? "";
  const digits = userPart.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "Contato WhatsApp";
  if (phone.length > 15) return "Contato WhatsApp";
  if (phone.length === 13 && phone.startsWith("55")) {
    const ddd = phone.slice(2, 4);
    const rest = phone.slice(4);
    const mid = rest.length > 5 ? rest.slice(0, rest.length - 4) : rest;
    const end = rest.length > 5 ? rest.slice(-4) : "";
    return `+55 (${ddd}) ${mid}${end ? `-${end}` : ""}`;
  }
  return `+${phone}`;
}

export function formatConversationLabel(conversation: {
  push_name?: string | null;
  phone?: string | null;
}): string {
  if (conversation.push_name?.trim()) return conversation.push_name.trim();
  return formatPhoneDisplay(conversation.phone ?? null);
}
