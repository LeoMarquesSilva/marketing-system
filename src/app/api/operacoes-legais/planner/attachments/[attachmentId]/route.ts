import { NextResponse } from "next/server";
import { withOpsActor } from "@/lib/ops-planner/http";
import { requireOpsActor, toOpsApiError } from "@/lib/ops-planner/server";
import { deleteAttachment, getAttachmentUrl } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ attachmentId: string }> };

/** Abre o anexo: redireciona para o link ou para a URL assinada do arquivo. */
export async function GET(_request: Request, { params }: Params) {
  const { attachmentId } = await params;
  try {
    const actor = await requireOpsActor();
    return NextResponse.redirect(await getAttachmentUrl(actor, attachmentId));
  } catch (error) {
    const apiError = toOpsApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { attachmentId } = await params;
  return withOpsActor(async (actor) => {
    await deleteAttachment(actor, attachmentId);
    return { ok: true };
  });
}
