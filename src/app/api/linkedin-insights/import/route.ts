import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { parseLinkedinWorkbook } from "@/lib/linkedin-import";
import { persistLinkedinImport } from "@/lib/linkedin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione um relatório do LinkedIn." }, { status: 400 });
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ error: "Envie um arquivo .xls ou .xlsx." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "O arquivo deve ter no máximo 10 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const workbook = parseLinkedinWorkbook(buffer);
    const result = await persistLinkedinImport({
      workbook,
      filename: file.name,
      fileHash,
      fileSize: file.size,
      importedBy: user.id,
    });

    revalidatePath("/linkedin-insights");
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao importar relatório.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
