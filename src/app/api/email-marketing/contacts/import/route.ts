import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { importEmailContacts, type ImportContactRow } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

const EMAIL_KEYS = ["email", "e-mail", "e_mail", "mail"];
const NAME_KEYS = ["nome", "name", "contato", "cliente"];
const PHONE_KEYS = ["telefone", "phone", "celular", "whatsapp", "fone"];
const COMPANY_KEYS = ["empresa", "company", "organizacao", "organização"];

function pickField(row: Record<string, unknown>, keys: string[]): string | undefined {
  const entries = Object.entries(row);
  for (const key of keys) {
    const match = entries.find(([k]) => k.trim().toLowerCase() === key);
    if (match && match[1] != null && String(match[1]).trim()) return String(match[1]).trim();
  }
  return undefined;
}

/** Importa contatos em massa a partir de uma planilha (.xlsx/.xls/.csv). */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo (.xlsx, .xls ou .csv)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: "Planilha vazia ou inválida." }, { status: 400 });
    }
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const rows: ImportContactRow[] = rawRows
      .map((row) => ({
        email: pickField(row, EMAIL_KEYS) ?? "",
        name: pickField(row, NAME_KEYS) ?? null,
        phone: pickField(row, PHONE_KEYS) ?? null,
        company: pickField(row, COMPANY_KEYS) ?? null,
      }))
      .filter((r) => r.email);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma linha com e-mail válido encontrada. Verifique se a planilha tem uma coluna 'email'." },
        { status: 400 }
      );
    }

    const result = await importEmailContacts(rows);
    return NextResponse.json({ success: true, ...result, totalRows: rawRows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao importar contatos.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
