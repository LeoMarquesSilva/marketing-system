import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { IdentityVisualBriefingForm } from "@/components/briefings/identity-visual-briefing-form";
import {
  EMPTY_IDENTITY_VISUAL_BRIEFING,
  identityVisualBriefingSchema,
  type IdentityVisualBriefingAnswers,
} from "@/lib/identity-visual-briefing";
import { loginPathWithReturn } from "@/lib/login-redirect";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

interface BriefingPageProps {
  params: Promise<{ requestId: string }>;
}

interface BriefingRow {
  request_id: string;
  respondent_user_id: string;
  status: "pending" | "submitted";
  answers: unknown;
  submitted_at: string | null;
  marketing_requests: {
    title: string;
    solicitante: string | null;
    requesting_area: string;
  } | null;
}

export default async function IdentityVisualBriefingPage({ params }: BriefingPageProps) {
  const { requestId } = await params;
  const path = `/briefings/identidade-visual/${requestId}`;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect(loginPathWithReturn(path));

  const [{ data: profile }, { data: briefingData }] = await Promise.all([
    supabase.from("users").select("id, name").eq("auth_id", authUser.id).maybeSingle(),
    supabase
      .from("identity_visual_briefings")
      .select("request_id, respondent_user_id, status, answers, submitted_at, marketing_requests(title, solicitante, requesting_area)")
      .eq("request_id", requestId)
      .maybeSingle(),
  ]);

  if (!profile || !briefingData) notFound();

  const briefing = briefingData as unknown as BriefingRow;
  const mergedAnswers = {
    ...EMPTY_IDENTITY_VISUAL_BRIEFING,
    ...(briefing.answers && typeof briefing.answers === "object" ? briefing.answers : {}),
  };
  const parsed = identityVisualBriefingSchema.safeParse(mergedAnswers);
  const initialAnswers: IdentityVisualBriefingAnswers = parsed.success
    ? parsed.data
    : EMPTY_IDENTITY_VISUAL_BRIEFING;
  const canEdit = profile.id === briefing.respondent_user_id;

  return (
    <main className="min-h-screen bg-[#f4f7f7] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 overflow-hidden rounded-lg bg-[#04202f] px-5 py-6 text-white shadow-[0_16px_40px_rgba(3,32,47,0.18)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#47cdd0]">
                Briefing — Identidade Visual
              </p>
              <h1 className="mt-3 font-brand text-3xl font-semibold leading-tight sm:text-4xl">
                Vamos traduzir a essência da sua marca.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/75">
                Conte sobre o negócio, os objetivos, o público e suas referências. Caso tenha dificuldade em alguma resposta, pode deixá-la em branco — quanto mais detalhes você compartilhar, melhor será o direcionamento criativo.
              </p>
            </div>
            <Image
              src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-white.svg"
              alt="ORQESTRAI"
              width={76}
              height={76}
              className="h-16 w-16 shrink-0 object-contain opacity-90"
              priority
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/15 pt-4 text-xs text-white/65">
            <span>Solicitação: {briefing.marketing_requests?.title ?? "Identidade Visual"}</span>
            {briefing.marketing_requests?.solicitante && <span>Solicitante: {briefing.marketing_requests.solicitante}</span>}
            {briefing.marketing_requests?.requesting_area && <span>Área: {briefing.marketing_requests.requesting_area}</span>}
          </div>
        </header>

        <IdentityVisualBriefingForm
          requestId={briefing.request_id}
          initialAnswers={initialAnswers}
          canEdit={canEdit}
          alreadySubmitted={briefing.status === "submitted"}
        />

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
          As informações fornecidas serão utilizadas como base para o desenvolvimento estratégico e criativo da identidade visual.
        </p>
      </div>
    </main>
  );
}
