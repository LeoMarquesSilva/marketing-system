/**
 * Encaminhar lead para a equipe: telefone, liderança e texto da mensagem.
 * Sem dependências de servidor (usado no modal e na rota).
 */

/** Pessoa da equipe que pode receber o lead pelo WhatsApp. */
export interface LeadForwardRecipient {
  userId: string;
  name: string;
  avatarUrl: string | null;
  position: string | null;
  area: string | null;
  /** Telefone no formato 55DDNNNNNNNNN. */
  phone: string;
  isLeader: boolean;
}

/** Encaminhamento já feito desta conversa. */
export interface LeadForwardRecord {
  id: string;
  recipientName: string | null;
  recipientPhone: string;
  sentByName: string | null;
  createdAt: string;
}

/** Telefone do Brasil com DDI, só dígitos; `null` se não parecer telefone. */
export function normalizeBrazilPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/**
 * Formas que o mesmo celular pode ter no WhatsApp: com e sem 55 e com e sem o
 * nono dígito (contas antigas ficam com 8 dígitos no JID).
 */
export function brazilPhoneVariants(phone: string): string[] {
  const full = normalizeBrazilPhone(phone);
  if (!full) return [];
  const ddd = full.slice(2, 4);
  const local = full.slice(4);
  const locals = new Set([local]);
  if (local.length === 9 && local.startsWith("9")) locals.add(local.slice(1));
  if (local.length === 8 && /^[6-9]/.test(local)) locals.add(`9${local}`);
  const variants = new Set<string>();
  for (const l of locals) {
    variants.add(`55${ddd}${l}`);
    variants.add(`${ddd}${l}`);
  }
  return [...variants];
}

/** (DD) NNNNN-NNNN, para mostrar na tela e na mensagem. */
export function formatBrazilPhone(phone: string | null | undefined): string {
  const full = normalizeBrazilPhone(phone);
  if (!full) return phone?.trim() || "";
  const ddd = full.slice(2, 4);
  const local = full.slice(4);
  const split = local.length - 4;
  return `(${ddd}) ${local.slice(0, split)}-${local.slice(split)}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const LEADER_POSITION = /^(socio|coordenador|gerente|supervisor|diretor|gestor|head)\b/;

/** Sócios, gerentes, coordenadores e supervisores aparecem primeiro na lista. */
export function isLeaderPosition(position: string | null | undefined): boolean {
  return LEADER_POSITION.test(normalizeText(position));
}

/** Liderança primeiro, depois o resto da equipe, em ordem alfabética. */
export function sortForwardRecipients(recipients: LeadForwardRecipient[]): LeadForwardRecipient[] {
  return [...recipients].sort(
    (a, b) => Number(b.isLeader) - Number(a.isLeader) || a.name.localeCompare(b.name, "pt-BR")
  );
}

/** Busca por nome, cargo ou área, sem diferenciar acento. */
export function matchesRecipientSearch(recipient: LeadForwardRecipient, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return normalizeText([recipient.name, recipient.position, recipient.area].join(" ")).includes(q);
}

/** Texto enviado ao gestor: dados do lead em cima e o resumo da conversa embaixo. */
export function buildLeadForwardMessage(input: {
  leadName: string;
  leadPhone: string | null;
  origin: string | null;
  campaign: string | null;
  summary: string;
  senderName: string | null;
}): string {
  const phone = formatLeadPhone(input.leadPhone);
  const origin = [input.origin, input.campaign].filter((v) => v?.trim()).join(" · ");
  const lines = [
    "*Lead do WhatsApp*",
    `Nome: ${input.leadName}`,
    phone ? `WhatsApp: ${phone}` : null,
    origin ? `Origem: ${origin}` : null,
    "",
    "*Resumo da conversa*",
    input.summary.trim() || "-",
  ];
  const sender = input.senderName?.trim().split(/\s+/)[0];
  if (sender) lines.push("", `Encaminhado por ${sender} pelo ORQESTRAI`);
  return lines.filter((line) => line !== null).join("\n");
}

/**
 * Telefone do lead como veio do WhatsApp (sempre com DDI). Brasileiro sai como
 * (DD) NNNNN-NNNN; estrangeiro, com o + na frente.
 */
export function formatLeadPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return formatBrazilPhone(digits);
  }
  return `+${digits}`;
}

/** Cartão de contato (vCard) do lead para a Evolution API. */
export function leadContactCard(name: string, phone: string | null): {
  fullName: string;
  wuid: string;
  phoneNumber: string;
} | null {
  const display = formatLeadPhone(phone);
  if (!display) return null;
  const digits = (phone ?? "").replace(/\D/g, "");
  return { fullName: name.trim() || display, wuid: digits, phoneNumber: `+${digits}` };
}
