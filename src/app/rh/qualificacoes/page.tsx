import { redirect } from "next/navigation";

/**
 * A tela "Qualificações" saiu do RH em 09/11/2026: repetia o que já está em
 * Fichas cadastrais. A qualificação jurídica continua sendo gravada pela ficha
 * aprovada e pelo próprio advogado em Meu perfil.
 */
export default function QualificacoesPage() {
  redirect("/rh/fichas-cadastrais");
}
