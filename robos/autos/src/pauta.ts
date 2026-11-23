import type { Page } from "playwright";
import { lerConfig, type Config } from "./config.ts";
import { abrirNavegador, guardarDiagnostico, type Navegador } from "./navegador.ts";

/**
 * Robô da Pauta de Audiências: lê a "Minha Pauta" do PJe da Justiça do Trabalho com a sessão do advogado e manda
 * o que leu ao ORQESTRAI (POST /api/robos/pauta). Só leitura: não abre processo, não baixa documento, não peticiona.
 *
 *   npm run pauta                 uma rodada nos tribunais de PAUTA_TRIBUNAIS (padrão TRT15) e encerra
 *   npm run pauta -- --so-ler     teste de acesso: entra, lê e mostra os números, sem mandar nada ao ORQESTRAI
 *   npm run pauta -- --ciclo      fica rodando e lê nos horários de PAUTA_HORARIOS (padrão 06:45,11:45,16:45)
 *   npm run pauta -- --fechar     fecha o navegador no fim (perde a sessão do tribunal)
 *
 * Login: SSO nacional da PDPJ ("Entrar com PDPJ") e código de 2 fatores.
 * - PDPJ_LOGIN=manual (padrão): a pessoa entra na janela do robô (no servidor, pela tela remota). No Mac dá para usar
 *   o certificado com o PJe Office; no servidor não há PJe Office, então é CPF e senha.
 * - PDPJ_LOGIN=senha: o robô preenche PDPJ_USUARIO (CPF) e PDPJ_SENHA, que ficam só no ambiente desta máquina.
 * O código de 2 fatores vem de ROBO_2FA_WEBHOOK_URL com ?sistema=pdpj, se houver; senão, a pessoa digita.
 * A sessão fica no perfil do robô e serve às rodadas seguintes.
 *
 * O que se sabe da tela (teste de 18/11/2026, TRT-15): /pjekz/pauta-usuarios-externos chama
 * GET /pje-comum-api/api/pauta-usuarios-externos?dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD&codigoSituacao=M|C
 * &numeroPagina=1&tamanhoPagina=50&ordenacao=asc e devolve { pagina, qtdPaginas, totalRegistros, resultado }.
 */

const CODIGO = "#otp, input[name=otp], input[name=totp], input[autocomplete='one-time-code'], input[id*='codigo' i][maxlength='6']";
const USUARIO = "#username, input[name=username]";
const SENHA = "#password, input[name=password]";
const ENTRAR = "#kc-login, button[type=submit], input[type=submit]";
const DIAS_A_FRENTE = Number(process.env.PAUTA_DIAS?.trim() || 60);
const SITUACOES = ["M", "C"] as const; // designadas e canceladas (cancelamento e redesignação)

const argumentos = new Set(process.argv.slice(2));
const SO_LER = argumentos.has("--so-ler");
const CICLO = argumentos.has("--ciclo");
const FECHAR = argumentos.has("--fechar");

function log(mensagem: string): void {
  console.log(`[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ${mensagem}`);
}

function tribunais(): string[] {
  const lista = (process.env.PAUTA_TRIBUNAIS?.trim() || "TRT15")
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^TRT\d{1,2}$/.test(t));
  return lista.length ? lista : ["TRT15"];
}

interface LoginPdpj {
  modo: "manual" | "senha";
  usuario: string;
  senha: string;
}

function loginPdpj(): LoginPdpj {
  const modo = (process.env.PDPJ_LOGIN?.trim() || "manual").toLowerCase();
  if (modo !== "manual" && modo !== "senha") throw new Error('PDPJ_LOGIN deve ser "manual" ou "senha".');
  const usuario = (process.env.PDPJ_USUARIO ?? "").replace(/\D/g, "");
  const senha = process.env.PDPJ_SENHA ?? "";
  if (modo === "senha" && (usuario.length !== 11 || !senha)) throw new Error("No modo senha, defina PDPJ_USUARIO (CPF, 11 dígitos) e PDPJ_SENHA no ambiente desta máquina.");
  return { modo, usuario, senha };
}

const base = (trt: string) => `https://pje.${trt.toLowerCase()}.jus.br`;

function dataIso(deslocamentoDias: number): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000 + deslocamentoDias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Logado = a sessão do navegador consegue falar com a API do PJe deste tribunal. */
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

function dicaDaTela(config: Config): string {
  return config.telaRemotaUrl ? ` Tela do robô: ${config.telaRemotaUrl}` : "";
}

/**
 * Abre o login do PJe e clica em "Entrar com PDPJ". No modo senha, preenche CPF e senha uma vez; o código de
 * 2 fatores vem do webhook (até 3 tentativas). O que o robô não resolve fica para a pessoa, até ESPERA_PESSOA_MINUTOS.
 */
async function entrar(config: Config, pagina: Page, trt: string, credenciais: LoginPdpj): Promise<void> {
  await pagina.goto(`${base(trt)}/primeirograu/login.seam`, { waitUntil: "domcontentloaded" });
  await pagina.waitForTimeout(2_000);
  const pdpj = pagina.locator("#btnSsoPdpj").first();
  if (await pdpj.isVisible().catch(() => false)) await pdpj.click().catch(() => undefined);
  await pagina.waitForTimeout(3_000);
  if (credenciais.modo === "manual") log(`${trt}: login pelo SSO da PDPJ. Entre na janela do robô (CPF e senha, ou certificado no Mac); o robô não digita senha.${dicaDaTela(config)}`);
  const limite = Date.now() + config.esperaPessoaMs;
  let senhaEnviada = false;
  let tentativasCodigo = 0;
  let avisouPessoa = false;
  while (Date.now() < limite) {
    const abas = pagina.context().pages().filter((a) => !a.isClosed());
    const atual = abas[abas.length - 1] ?? pagina;
    if (atual.url().startsWith(base(trt)) && !/login|acesso-negado/.test(atual.url())) {
      if (atual !== pagina) await pagina.goto(atual.url()).catch(() => undefined);
      return;
    }
    const campoCodigo = atual.locator(CODIGO).first();
    if (await campoCodigo.isVisible().catch(() => false)) {
      if (tentativasCodigo < 3) {
        const codigo = await codigoDoWebhook(config);
        if (codigo) {
          tentativasCodigo += 1;
          await campoCodigo.fill(codigo).catch(() => undefined);
          const botao = atual.locator(ENTRAR).first();
          if (await botao.isVisible().catch(() => false)) await botao.click().catch(() => undefined);
          else await campoCodigo.press("Enter").catch(() => undefined);
          log(`${trt}: código de 2 fatores obtido da fonte configurada e digitado (tentativa ${tentativasCodigo}).`);
          await atual.waitForTimeout(5_000);
          continue;
        }
        tentativasCodigo = 3;
      }
      if (!avisouPessoa) log(`${trt}: o SSO pediu o código de 2 fatores e a fonte automática não resolveu. Digite na janela do robô.${dicaDaTela(config)}`);
      avisouPessoa = true;
    } else if (credenciais.modo === "senha" && !senhaEnviada) {
      const campoUsuario = atual.locator(USUARIO).first();
      const campoSenha = atual.locator(SENHA).first();
      if ((await campoUsuario.isVisible().catch(() => false)) && (await campoSenha.isVisible().catch(() => false))) {
        await campoUsuario.fill(credenciais.usuario).catch(() => undefined);
        await campoSenha.fill(credenciais.senha).catch(() => undefined);
        const botao = atual.locator(ENTRAR).first();
        if (await botao.isVisible().catch(() => false)) await botao.click().catch(() => undefined);
        else await campoSenha.press("Enter").catch(() => undefined);
        senhaEnviada = true;
        log(`${trt}: CPF e senha preenchidos no SSO da PDPJ.`);
        await atual.waitForTimeout(5_000);
        continue;
      }
    } else if (credenciais.modo === "senha" && senhaEnviada && !avisouPessoa && /sso\.cloud\.pje\.jus\.br/.test(atual.url()) && (await atual.locator(SENHA).first().isVisible().catch(() => false))) {
      log(`${trt}: o SSO voltou para a tela de senha (senha recusada, CAPTCHA ou aviso). Confira na janela do robô.${dicaDaTela(config)}`);
      avisouPessoa = true;
    }
    await atual.waitForTimeout(3_000);
  }
  throw new Error(`ninguém concluiu o login em ${Math.round(config.esperaPessoaMs / 60000)} minutos.`);
}

interface PaginaDaPauta {
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
    const corpo = resposta.corpo as PaginaDaPauta;
    registros.push(...(corpo.resultado ?? []));
    if (numero >= (corpo.qtdPaginas ?? 1)) break;
    await pagina.waitForTimeout(800);
  }
  return registros;
}

/** Resumo do teste de acesso, sem nomes: quantas designadas, canceladas, por vídeo e com link. */
function resumoDoTeste(registros: Record<string, unknown>[]): string {
  const designadas = registros.filter((r) => String(r.statusDescricao ?? "").toLowerCase().startsWith("design"));
  const video = designadas.filter((r) => /videoconfer/i.test(String((r.tipo as { descricao?: string } | undefined)?.descricao ?? "")));
  const comLink = video.filter((r) => Boolean(r.urlAudienciaVirtual));
  const proxima = designadas.map((r) => String(r.dataInicio ?? "")).filter(Boolean).sort()[0];
  return `${designadas.length} designada(s), ${registros.length - designadas.length} cancelada(s); ${video.length} por vídeo, ${comLink.length} com link no PJe; próxima: ${proxima ? proxima.slice(0, 16).replace("T", " ") : "—"}`;
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

/** Uma rodada em todos os tribunais. Devolve quantos falharam. */
async function rodada(config: Config, navegador: Navegador, credenciais: LoginPdpj): Promise<number> {
  let falhas = 0;
  for (const trt of tribunais()) {
    try {
      const pagina = navegador.pagina;
      await pagina.goto(`${base(trt)}/pjekz/pauta-usuarios-externos`, { waitUntil: "domcontentloaded" });
      await pagina.waitForTimeout(3_000);
      if (!(await logado(pagina, trt))) {
        await entrar(config, pagina, trt, credenciais);
        await pagina.goto(`${base(trt)}/pjekz/pauta-usuarios-externos`, { waitUntil: "domcontentloaded" });
        await pagina.waitForTimeout(3_000);
        if (!(await logado(pagina, trt))) throw new Error("depois do login, a pauta ainda pede autenticação");
      } else log(`${trt}: sessão do PJe já aberta no perfil do robô.`);
      const de = dataIso(-1);
      const ate = dataIso(DIAS_A_FRENTE);
      const registros: Record<string, unknown>[] = [];
      for (const situacao of SITUACOES) registros.push(...(await lerPauta(pagina, situacao, de, ate)));
      log(`${trt}: ${registros.length} registro(s) lido(s) de ${de} a ${ate} · ${resumoDoTeste(registros)}.`);
      if (SO_LER) {
        log(`${trt}: teste de acesso OK. Nada foi mandado ao ORQESTRAI (--so-ler).`);
        continue;
      }
      const resumo = await enviar(config, trt, registros);
      log(`${trt}: gravado no ORQESTRAI · ${JSON.stringify(resumo)}`);
    } catch (erro) {
      falhas += 1;
      log(`${trt}: não deu certo · ${erro instanceof Error ? erro.message : String(erro)}`);
      const arquivo = await guardarDiagnostico(config, navegador.pagina, `pauta-${trt}`).catch(() => null);
      if (arquivo) log(`${trt}: tela guardada em ${arquivo} para conferir.`);
    }
  }
  return falhas;
}

/** Horários de PAUTA_HORARIOS ("06:45,11:45,16:45") no fuso de Brasília; devolve quantos ms faltam para o próximo. */
function msAteProximoHorario(agora = Date.now()): number {
  const horarios = (process.env.PAUTA_HORARIOS?.trim() || "06:45,11:45,16:45")
    .split(/[,\s]+/)
    .map((h) => h.match(/^(\d{1,2}):(\d{2})$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => Number(m[1]) * 60 + Number(m[2]))
    .sort((a, b) => a - b);
  const local = new Date(agora - 3 * 60 * 60 * 1000);
  const minutosAgora = local.getUTCHours() * 60 + local.getUTCMinutes();
  const proximo = horarios.find((h) => h > minutosAgora) ?? (horarios[0] ?? 405) + 24 * 60;
  return (proximo - minutosAgora) * 60_000 - local.getUTCSeconds() * 1000;
}

async function principal(): Promise<void> {
  // O teste de acesso não fala com o ORQESTRAI: não precisa do endereço nem do token dele.
  if (SO_LER) {
    process.env.ORQESTRAI_URL ||= "http://localhost";
    process.env.ROBO_AUTOS_TOKEN ||= "somente-leitura-sem-envio-ao-orqestrai";
  }
  const config = lerConfig();
  const credenciais = loginPdpj();
  log(`Robô da pauta · tribunais ${tribunais().join(", ")} · login ${credenciais.modo}${SO_LER ? " · teste (só lê)" : ""}${CICLO ? " · ciclo" : ""}.`);
  const navegador = await abrirNavegador(config);
  let falhas = 0;
  try {
    if (!CICLO) falhas = await rodada(config, navegador, credenciais);
    else {
      for (;;) {
        await rodada(config, navegador, credenciais);
        const espera = msAteProximoHorario();
        log(`Próxima leitura em ${Math.round(espera / 60000)} minuto(s).`);
        await new Promise((resolver) => setTimeout(resolver, espera));
      }
    }
  } finally {
    // Por padrão o navegador fica aberto: a próxima rodada se conecta a ele e aproveita a sessão do tribunal.
    if (FECHAR) await navegador.fechar();
  }
  process.exit(falhas ? 1 : 0);
}

principal().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
