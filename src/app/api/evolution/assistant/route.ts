import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { after, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { openAIKey } from "@/lib/openai-keys";
import { isOpenAIOutOfCredits, openAIErrorMessage } from "@/lib/openai-errors";
import {
  attendantNameForAuth,
  loadAssistantContext,
  saveAssistantSuggestion,
  type AssistantMode,
} from "@/lib/whatsapp-assistant";
import {
  assistantReplySchema,
  cleanVersions,
  resolveAssistantActions,
  type AssistantAction,
  type AssistantVersion,
} from "@/lib/whatsapp-assistant-output";
import { ATENDIMENTO_MANUAL } from "@/lib/whatsapp-playbook";
import { formatQuickRepliesForPrompt, listQuickReplies } from "@/lib/whatsapp-quick-replies-server";
import type { TeamContact } from "@/lib/whatsapp-team-contacts";
import { fetchTeamDirectory, formatTeamForPrompt } from "@/lib/whatsapp-team-directory";

export const dynamic = "force-dynamic";
// Áudios sem transcrição são transcritos antes de sugerir.
export const maxDuration = 60;

interface AssistantRequestBody {
  conversationId?: unknown;
  draftMessage?: unknown;
  mode?: unknown;
  replyTo?: {
    waMessageId?: unknown;
    body?: unknown;
    fromName?: unknown;
  } | null;
}

/** Melhorar o texto só precisa do tom recente: sem transcrever áudio, contexto curto. */
const IMPROVE_CONTEXT_CHARS = 6000;

function suggestSystemPrompt(quickReplies: string, team: string): string {
  return `Você ajuda a equipe do escritório Bismarchi | Pires Sociedade de Advogados a responder leads e clientes pelo WhatsApp comercial.
Sugira a mensagem que o atendente vai enviar, com base na conversa inteira (os áudios aparecem transcritos) e no manual de atendimento abaixo.

Regras da resposta:
- Português do Brasil, como uma pessoa da equipe escreveria no WhatsApp.
- Escreva só a mensagem a ser enviada, sem títulos, aspas, análise ou markdown.
- Siga o manual: tom, roteiro do primeiro contato, área e responsável certos, e o que não fazer.
- Use o que o cliente já contou e não repita perguntas já respondidas.
- Se faltar informação para encaminhar, faça no máximo duas perguntas objetivas, numeradas.
- Quando o caso for igual a uma resposta pronta, use a redação dela, adaptada à conversa. Nunca deixe [colchetes] ou {variáveis} no texto: complete com os dados da conversa e do manual, ou reescreva a frase sem eles.
- Não invente horários, valores, prazos ou nomes que não estejam na conversa ou no manual.
- Se a conversa for golpe ou spam, responda apenas: "Não responder: parece golpe ou spam."
- Se houver rascunho do atendente, parta dele em vez de começar do zero.

Versões:
- Em "Sugerir", devolva duas versões: "curta" (uma ou duas frases, direto ao ponto) e "completa" (a mensagem inteira, seguindo o roteiro).
- Em "Responder só esta", devolva só a "curta".

Contatos e ações (o atendente decide; nada é enviado sozinho):
- Você conhece a equipe pela lista abaixo. Quando o cliente perguntar como falar com alguém da equipe, pedir um contato, ou quando outro escritório ou banco precisar falar com o responsável, escreva no texto o e-mail profissional da pessoa (está na lista) e sugira "enviar_cartao" para ela.
- Nunca escreva telefone de ninguém no texto. Para passar o WhatsApp, sugira "enviar_cartao" (da "recepcao" ou de quem "tem cartão do WhatsApp") e diga no texto que o contato vai logo abaixo; para quem não tem cartão, o botão manda o e-mail.
- Quando o cliente quiser ligar, falar por telefone ou marcar um horário, sugira "enviar_cartao" da "recepcao".
- Quando o lead precisar ir para o advogado da área, sugira "encaminhar_lead" para o responsável da área (pelo manual) e diga ao cliente quem vai chamá-lo.
- Sugira ação só quando ela combinar com o texto; na dúvida, nenhuma.

${ATENDIMENTO_MANUAL}

## Respostas prontas do escritório
${quickReplies || "Nenhuma cadastrada."}

## Equipe (código, nome, cargo, área, e-mail)
${team || "Lista indisponível agora: não cite e-mail de ninguém."}`;
}

const IMPROVE_SYSTEM_PROMPT = `Você revisa mensagens que a equipe do escritório Bismarchi | Pires Sociedade de Advogados vai mandar pelo WhatsApp.
Reescreva o rascunho do atendente.

Regras:
- Português do Brasil correto, claro, cordial e profissional, no tom de uma conversa de WhatsApp.
- Jeito de escrever do escritório: sem gíria nem abreviação ("vc", "blz"), parágrafos curtos, perguntas numeradas quando forem mais de uma, no máximo um emoji.
- Mantenha o sentido, os fatos, nomes, números, datas e perguntas do rascunho.
- Não acrescente informação, promessa, pergunta ou saudação que não esteja no rascunho.
- Não troque uma frase que dê parecer jurídico ou prometa resultado por outra que faça o mesmo; se houver, deixe neutra ("o advogado da área vai avaliar").
- Tamanho parecido com o do rascunho: se ele for curto, a resposta também.
- Escreva só a mensagem final, sem aspas, título ou comentário.`;

function parseMode(value: unknown): AssistantMode {
  return value === "reply" || value === "improve" ? value : "suggest";
}

function nowInBrasilia(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export async function POST(request: Request) {
  const apiKey = openAIKey("atendimento");
  if (!apiKey) {
    return NextResponse.json(
      { error: "O assistente de IA não está disponível agora." },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AssistantRequestBody;
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    const mode = parseMode(body.mode);
    const draftMessage = typeof body.draftMessage === "string" ? body.draftMessage.trim() : "";
    const replyToBody = typeof body.replyTo?.body === "string" ? body.replyTo.body.trim() : "";
    const replyToName = typeof body.replyTo?.fromName === "string" ? body.replyTo.fromName.trim() : "";
    const replyToWaMessageId =
      typeof body.replyTo?.waMessageId === "string" ? body.replyTo.waMessageId.trim() : "";

    if (mode === "improve" && !draftMessage) {
      return NextResponse.json({ error: "Escreva algo no campo para a IA melhorar." }, { status: 400 });
    }
    if (mode === "reply" && !replyToBody && !replyToWaMessageId) {
      return NextResponse.json({ error: "Escolha a mensagem que quer responder." }, { status: 400 });
    }

    const [context, attendantName, quickReplies, team] = await Promise.all([
      loadAssistantContext(
        conversationId,
        mode === "improve"
          ? { transcribeAudios: false, maxTranscriptChars: IMPROVE_CONTEXT_CHARS }
          : { replyToWaMessageId: replyToWaMessageId || undefined }
      ),
      attendantNameForAuth(user.id).catch(() => null),
      mode === "improve"
        ? Promise.resolve([])
        : listQuickReplies().catch((err) => {
            console.error("[evolution/assistant] respostas prontas:", err);
            return [];
          }),
      mode === "improve"
        ? Promise.resolve([] as TeamContact[])
        : fetchTeamDirectory().catch((err) => {
            console.error("[evolution/assistant] equipe:", err);
            return [] as TeamContact[];
          }),
    ]);
    if (!context) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    // Do banco quando possível: áudio já transcrito e autor certo em grupo.
    const replyToText =
      context.replyToLine ?? (replyToBody ? `${replyToName ? `${replyToName}: ` : ""}${replyToBody}` : "");

    const prompt =
      mode === "improve"
        ? `## Conversa recente (só para o tom e os nomes)
${context.transcript || "Sem mensagens salvas."}

## Rascunho do atendente
${draftMessage}

Reescreva o rascunho.`
        : `## Agora
${nowInBrasilia()} (horário de Brasília)

## Quem está atendendo
${attendantName ?? "Não informado: não se apresente pelo nome."}

## Quem é o contato
${context.leadSummary || "Sem dados do contato."}

## Conversa completa (${context.messageCount} mensagens)
${context.transcript || "Sem mensagens salvas."}

## Mensagem que o atendente quer responder
${replyToText || "Nenhuma específica: responder ao momento atual da conversa."}

## Rascunho do atendente
${draftMessage || "Sem rascunho."}

${
  mode === "reply"
    ? "Responda somente à mensagem que o atendente escolheu, em no máximo duas frases. Não trate de outros assuntos da conversa."
    : "Sugira a próxima mensagem do escritório."
}`;

    const openai = createOpenAI({ apiKey });
    const generation = {
      model: openai(OPENAI_DEFAULT_MODEL),
      prompt,
      // Uma nova tentativa só: quem espera é o atendente com o cliente na linha.
      maxRetries: 1,
      ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "none", temperature: 0.4 }),
    };

    let versions: AssistantVersion[];
    let actions: AssistantAction[] = [];
    if (mode === "improve") {
      const { text } = await generateText({ ...generation, system: IMPROVE_SYSTEM_PROMPT });
      versions = [{ kind: "curta", text: text.trim() }];
    } else {
      const directory = formatTeamForPrompt(team);
      const { object } = await generateObject({
        ...generation,
        system: suggestSystemPrompt(formatQuickRepliesForPrompt(quickReplies), team.length ? directory.text : ""),
        schema: assistantReplySchema,
        schemaName: "resposta_whatsapp",
      });
      versions = cleanVersions(object.versoes, mode === "reply" ? 1 : 2);
      actions = resolveAssistantActions(object.acoes, { idByRef: directory.idByRef, team });
    }
    if (versions.length === 0) throw new Error("A IA não devolveu texto.");
    const suggestion = versions[0].text;
    const savedSuggestion =
      versions.length > 1 ? versions.map((version) => `[${version.kind}]\n${version.text}`).join("\n\n") : suggestion;

    after(async () => {
      try {
        await saveAssistantSuggestion({
          conversationId,
          authId: user.id,
          draft: draftMessage,
          suggestion: savedSuggestion,
          model: OPENAI_DEFAULT_MODEL,
          messagesInContext: context.messageCount,
          mode,
        });
      } catch (err) {
        console.error("[evolution/assistant] guardar sugestão:", err);
      }
    });

    return NextResponse.json({ suggestion, versions, actions, mode, transcribedAudios: context.transcribedNow });
  } catch (error) {
    console.error("[evolution/assistant]", error);
    return NextResponse.json(
      { error: openAIErrorMessage(error, "Não foi possível sugerir uma resposta agora.") },
      { status: isOpenAIOutOfCredits(error) ? 503 : 500 }
    );
  }
}
