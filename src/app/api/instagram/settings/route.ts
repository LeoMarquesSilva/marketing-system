import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  fetchInstagramMonthlyGoal,
  updateInstagramMonthlyGoal,
} from "@/lib/instagram-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const monthlyGoal = await fetchInstagramMonthlyGoal();
    return NextResponse.json({ monthlyGoal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar configurações.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const goal = Number(body.monthlyGoal);
    if (!Number.isFinite(goal) || goal < 1) {
      return NextResponse.json({ error: "Meta inválida." }, { status: 400 });
    }

    await updateInstagramMonthlyGoal(goal);
    return NextResponse.json({ success: true, monthlyGoal: Math.floor(goal) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar configurações.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
