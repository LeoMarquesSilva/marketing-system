import { redirect } from "next/navigation";
import { feriasListQueryToSearch, parseFeriasListQuery } from "@/lib/ferias/filters";

/** Compatibilidade: /ferias migrou para /rh/ferias. */
export default async function FeriasLegacyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  redirect(`/rh/ferias${feriasListQueryToSearch(parseFeriasListQuery(query))}`);
}
