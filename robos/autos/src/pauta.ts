import type { Page } from "playwright";
import { lerConfig, type Config } from "./config.ts";
import { abrirNavegador, guardarDiagnostico } from "./navegador.ts";

/**
 * Robô da Pauta de Audiências: lê a "Minha Pauta" do PJe da Justiça do Trabalho com a sessão do advogado e manda
 * o que leu ao ORQESTRAI (POST /api/robos/pauta). Só leitura: não abre processo, não baixa documento, não peticiona.
 *
 *   npm run pauta              lê os tribunais de PAUTA_TRIBUNAIS (padrão TRT15) e encerra
 *   npm run pauta -- --fechar  fecha o navegador no fim (perde a sessão do tribunal)
 *
 * Login: SSO nacional da PDPJ ("Entrar com PDPJ"), com certificado digital (PJe Office) ou CPF e senha, e o código
 * de 2 fatores. O robô não digita senha. Com ROBO_2FA_WEBHOOK_URL no .env, busca o código em ?sistema=pdpj e
 * digita sozinho; sem ela, espera a pessoa. A sessão fica no perfil do robô e serve às rodadas seguintes.
 *
 * O que se sabe da tela (teste de 18/11/2026, TRT-15): /pjekz/pauta-usuarios-externos chama
 * GET /pje-comum-api/api/pauta-usuarios-externos?dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD&codigoSituacao=M|C
 * &numeroPagina=1&tamanhoPagina=50&ordenacao=asc e devolve { pagina, qtdPaginas, totalRegistros, resultado }.
 */

const CODIGO = "#otp, input[name=otp], input[name=totp], input[autocomplete='one-time-code'], input[id*='codigo' i][maxlength='6']";
const DIAS_A_FRENTE = Number(process.env.PAUTA_DIAS?.trim() || 60);
const SITUACOES = ["M", "C"] as const; // designadas e canceladas (cancelamento e redesignação)

function log(mensagem: string): void {
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${mensagem}`);
}

function tribunais(): string[] {
  const lista = (process.env.PAUTA_TRIBUNAIS?.trim() || "TRT15")
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^TRT\d{1,2}$/.test(t));
  return lista.length ? lista : ["TRT15"];
}

const base = (trt: string) => `https://pje.${trt.toLowerCase()}.jus.br`;

function dataIso(deslocamentoDias: number): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000 + deslocamentoDias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Logado = a consulta da pauta responde 200 com a sessão do navegador. */
async function logado(pagina: Page, trt: string): Promise<boolean> {
  if (!pagina.url().startsWith(base(trt))) return false;
  return pagina
    .evaluate(async () => {
      const r = await fetch("/pje-seguranca/api/token/perfis", { credentials: "include" });
      return r.ok;
    })
    .catch(() => false);
}

async function codigoDoWebhook(config: Config): Promise<string | null> {
  const fonte = config.webhook2fa;
  if (!fonte.url) return null;
  try {
    const url = `${fonte.url}${fonte.url.includes("?") ? "&" : "?"}sistema=pdpj`;
    const resposta = await fetch(url, { headers: fonte.token ? { [fonte.header]: fonte.token } : {}, signal: AbortSignal.timeout(15_000) });
    if (!resposta.ok) return null;
    const dados = (await resposta.json().catch(() => null)) as { codigo?: unknown; code?: unknown; token?: unknown } | null;
    const codigo = String(dados?.codigo ?? dados?.code ?? dados?.token ?? "").replace(/\D/g, "");
    return /^\d{6,8}$/.test(codigo) ? codigo : null;
  } catch {
    return null;
  }
}

/** Abre o login do PJe, clica em "Entrar com PDPJ" e espera a pessoa (certificado ou senha). O código de 2 fatores vem do webhook, se houver. */
async function entrar(config: Config, pagina: Page, trt: string): Promise<void> {
  await pagina.goto(`${base(trt)}/primeirograu/login.seam`, { waitUntil: "domcontentloaded" });
  await pagina.waitForTimeout(2_000);
  const pdpj = pagina.locator("#btnSsoPdpj").first();
  if (await pdpj.isVisible().catch(() => false)) await pdpj.click().catch(() => undefined);
  log(`${trt}: login pelo SSO da PDPJ. Entre com o certificado (ou CPF e senha) na janela do robô; o robô não digita senha.`);
  const limite = Date.now() + config.esperaPessoaMs;
  let tentativasCodigo = 0;
  while (Date.now() < limite) {
    const abas = pagina.context().pages().filter((a) => !a.isClosed());
    const atual = abas[abas.length - 1] ?? pagina;
    if (atual.url().startsWith(base(trt)) && !/login|acesso-negado/.test(atual.url())) {
      if (atual !== pagina) await pagina.goto(atual.url()).catch(() => undefined);
      return;
    }
    const campo = atual.locator(CODIGO).first();
    if (tentativasCodigo < 3 && (await campo.isVisible().catch(() => false))) {
      const codigo = await codigoDoWebhook(config);
      if (codigo) {
        tentativasCodigo += 1;
        await campo.fill(codigo).catch(() => undefined);
        await campo.press("Enter").catch(() => undefined);
        log(`${trt}: código de 2 fatores obtido da fonte configurada e digitado.`);
        await atual.waitForTimeout(5_000);
        continue;
      }
      if (tentativasCodigo === 0) log(`${trt}: o SSO pediu o código de 2 fatores. Digite na janela do robô.`);
      tentativasCodigo = 3;
    }
    await atual.waitForTimeout(3_000);
  }
  throw new Error(`${trt}: ninguém concluiu o login em ${Math.round(config.esperaPessoaMs / 60000)} minutos.`);
}

interface Pagina {
  qtdPaginas?: number;
  totalRegistros?: number;
  resultado?: Record<string, unknown>[];
}

/** Lê a pauta no contexto da página (mesma sessão e mesmos cabeçalhos do navegador). */
async function lerPauta(pagina: Page, situacao: string, de: string, ate: string): Promise<Record<string, unknown>[]> {
  const registros: Record<string, unknown>[] = [];
  for (let numero = 1; numero <= 40; numero += 1) {
    const parametros = new URLSearchParams({ dataInicio: de, dataFim: ate, codigoSituacao: situacao, numeroPagina: String(numero), tamanhoPagina: "50", ordenacao: "asc" });
    const resposta = await pagina.evaluate(async (consulta) => {
      const r = await fetch(`/pje-comum-api/api/pauta-usuarios-externos?${consulta}`, { credentials: "include", headers: { Accept: "application/json" } });
      return { status: r.status, corpo: r.ok ? ((await r.json()) as unknown) : await r.text() };
    }, parametros.toString());
    if (resposta.status !== 200) throw new Error(`a consulta da pauta respondeu ${resposta.status}: ${String(resposta.corpo).slice(0, 160)}`);
    const corpo = resposta.corpo as Pagina;
    registros.push(...(corpo.resultado ?? []));
    if (numero >= (corpo.qtdPaginas ?? 1)) break;
    await pagina.waitForTimeout(800);
  }
  return registros;
}

async function enviar(config: Config, tribunal: string, registros: Record<string, unknown>[]): Promise<Record<string, unknown>> {
  const resposta = await fetch(`${config.orqestraiUrl}/api/robos/pauta`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tribunal, origem: `robô ${config.nome}`, registros }),
    signal: AbortSignal.timeout(280_000),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok) throw new Error(`o ORQESTRAI respondeu ${resposta.status}: ${String(corpo.error ?? "")}`);
  return corpo;
}

async function principal(): Promise<void> {
  const config = lerConfig();
  const fechar = process.argv.includes("--fechar");
  const navegador = await abrirNavegador(config);
  let falhas = 0;
  try {
    for (const trt of tribunais()) {
      try {
        const pagina = navegador.pagina;
        await pagina.goto(`${base(trt)}/pjekz/pauta-usuarios-externos`, { waitUntil: "domcontentloaded" });
        await pagina.waitForTimeout(3_000);
        if (!(await logado(pagina, trt))) {
          await entrar(config, pagina, trt);
          await pagina.goto(`${base(trt)}/pjekz/pauta-usuarios-externos`, { waitUntil: "domcontentloaded" });
          await pagina.waitForTimeout(3_000);
          if (!(await logado(pagina, trt))) throw new Error("depois do login, a pauta ainda pede autenticação");
        }
        const de = dataIso(-1);
        const ate = dataIso(DIAS_A_FRENTE);
        const registros: Record<string, unknown>[] = [];
        for (const situacao of SITUACOES) registros.push(...(await lerPauta(pagina, situacao, de, ate)));
        log(`${trt}: ${registros.length} registro(s) lido(s) de ${de} a ${ate}.`);
        const resumo = await enviar(config, trt, registros);
        log(`${trt}: gravado no ORQESTRAI · ${JSON.stringify(resumo)}`);
      } catch (erro) {
        falhas += 1;
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        log(`${trt}: não deu certo · ${mensagem}`);
        await guardarDiagnostico(config, navegador.pagina, `pauta-${trt}`).catch(() => undefined);
      }
    }
  } finally {
    // Por padrão o navegador fica aberto: a próxima rodada se conecta a ele e aproveita a sessão do tribunal.
    if (fechar) await navegador.fechar();
  }
  process.exit(falhas ? 1 : 0);
}

principal().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
