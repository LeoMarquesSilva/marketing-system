import { redirect } from "next/navigation";

/** Compatibilidade: deep links antigos de /ferias/[id]. */
export default function FeriasLegacyColaboradorRedirectPage() {
  redirect("/rh/ferias");
}
