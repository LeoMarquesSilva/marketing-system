import { redirect } from "next/navigation";

/** Compatibilidade: /ferias migrou para /rh/ferias. */
export default function FeriasLegacyRedirectPage() {
  redirect("/rh/ferias");
}
