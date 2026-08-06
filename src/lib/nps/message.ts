/** Mensagem pronta para o gestor colar no WhatsApp. */

export function buildNpsWhatsAppMessage(options: {
  groupName: string;
  surveyUrl: string;
  campaignName?: string | null;
}): string {
  const group = options.groupName.trim() || "cliente";
  const campaignLine = options.campaignName?.trim()
    ? ` (${options.campaignName.trim()})`
    : "";

  return [
    `Olá! Tudo bem?`,
    ``,
    `Gostaríamos de ouvir a opinião de vocês sobre o atendimento do Bismarchi | Pires${campaignLine}.`,
    ``,
    `É uma pesquisa rápida (menos de 2 minutos). Ao abrir o link, selecione o seu nome e responda as perguntas:`,
    options.surveyUrl,
    ``,
    `Agradecemos desde já a colaboração da equipe ${group}!`,
  ].join("\n");
}
