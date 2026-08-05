import { redirect } from "next/navigation";

/** A ficha do colaborador abre em modal na listagem; deep links voltam para /ferias. */
export default async function FeriasColaboradorPage() {
  redirect("/ferias");
}
