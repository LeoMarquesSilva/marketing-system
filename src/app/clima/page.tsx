import { ClimaClient } from "@/components/clima/clima-client";
import { INDICADORES, PLANOS_ACAO, INDICADORES_QUANTITATIVOS } from "@/lib/clima-mock-data";
import { fetchClimaTodos } from "@/lib/clima-todos";
import { fetchActiveUsers } from "@/lib/users";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClimaPage() {
  const supabase = await createClient();
  const [todos, users] = await Promise.all([
    fetchClimaTodos(supabase),
    fetchActiveUsers(),
  ]);
  return (
    <ClimaClient
      indicadores={INDICADORES}
      planosAcao={PLANOS_ACAO}
      indicadoresQuantitativos={INDICADORES_QUANTITATIVOS}
      initialTodos={todos}
      users={users}
    />
  );
}
