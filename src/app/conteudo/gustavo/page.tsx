import { redirect } from "next/navigation";

/** O módulo abre direto no Radar; a visão geral fica em /visao-geral. */
export default function GustavoContentPage() {
  redirect("/conteudo/gustavo/radar");
}
