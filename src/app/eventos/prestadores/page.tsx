import { PrestadoresClient } from "@/components/eventos/prestadores-client";
import { fetchPrestadoresPageData } from "@/lib/eventos-server";

export const dynamic = "force-dynamic";

export default async function PrestadoresPage() {
  const { suppliers } = await fetchPrestadoresPageData();

  return <PrestadoresClient initialSuppliers={suppliers} />;
}
