import { redirect } from "next/navigation";

/** Entrada do grupo RH; a home do módulo é Férias. */
export default function RhIndexPage() {
  redirect("/rh/ferias");
}
