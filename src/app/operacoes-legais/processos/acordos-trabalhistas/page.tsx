import { redirect } from "next/navigation";

/** O painel de acordos virou a aba Acordos da Carteira Trabalhista. */
export default function ProcessosAcordosTrabalhistasPage() {
  redirect("/operacoes-legais/processos/trabalhista?aba=acordos");
}
