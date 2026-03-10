import { AdminPageGate } from "./admin-page-gate";

export const dynamic = "force-dynamic";

/**
 * Página de admin: proteção e dados só no cliente (AdminPageGate) para evitar
 * redirect no servidor que causava loop admin → login → dashboard.
 */
export default function AdminPage() {
  return <AdminPageGate />;
}
