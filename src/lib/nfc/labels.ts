import type { NfcActionType } from "@/lib/nfc/types";

export const NFC_ACTION_LABELS = {
  url: "Abrir URL",
  custom_page: "Página personalizada",
  form: "Formulário",
  webhook: "Webhook n8n",
  whatsapp: "WhatsApp",
  menu: "Menu de ações",
  sequence: "Sequência",
  asset_loan: "Retirada e devolução",
  professional_profile: "Perfil profissional",
} satisfies Record<NfcActionType, string>;

export function getNfcActionLabel(actionType: string): string {
  return NFC_ACTION_LABELS[actionType as NfcActionType] ?? actionType;
}
