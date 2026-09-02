import { requireAuthenticatedUser, requireCafeCulturaAccess } from "@/lib/api-auth";
import { buildCafeAttendanceCsv } from "@/lib/cafe-cultura/csv";
import { getCafeAdminData } from "@/lib/cafe-cultura/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    await requireCafeCulturaAccess(authUser.id);
    const { id } = await params;
    const data = await getCafeAdminData(id);
    const filename = `cafe-com-cultura-${data.event.eventDate}.csv`;
    return new Response(buildCafeAttendanceCsv(data.participants), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado/i.test(message) ? 401 : /administrador|café com cultura/i.test(message) ? 403 : 500;
    return Response.json({ error: status === 500 ? "Não foi possível exportar a lista." : message }, { status });
  }
}
