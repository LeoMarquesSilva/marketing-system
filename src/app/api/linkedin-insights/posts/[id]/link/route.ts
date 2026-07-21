import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateLinkedinInstagramLink } from "@/lib/linkedin-server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  instagramPostId: z.string().uuid().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const parsed = linkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Vínculo inválido." }, { status: 400 });
    }

    await updateLinkedinInstagramLink(id, parsed.data.instagramPostId);
    revalidatePath("/linkedin-insights");
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar vínculo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
