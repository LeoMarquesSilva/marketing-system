import type { Page } from "playwright";
import { FalhaDoCertificado, diasParaVencer, lerCertificado, type CertificadoCliente } from "./certificado.ts";
import { lerConfig, type Config } from "./config.ts";
import { abrirNavegador, guardarDiagnostico, type Navegador } from "./navegador.ts";
import { entrarComCodigoDoPainel } from "./segundo-fator.ts";

/**
 * Robô da Pauta de Audiências: lê a "Minha Pauta" do PJe da Justiça do Trabalho com a sessão do advogado e manda
 * o que leu ao ORQESTRAI (POST /api/robos/pauta). Só leitura: não abre processo, não baixa documento, não peticiona.
 *
 *   npm run pauta                 uma rodada nos tribunais de PAUTA_TRIBUNAIS (padrão TRT15) e encerra
 *   npm run pauta -- --so-ler     teste de acesso: entra, lê e mostra os números, sem mandar nada ao ORQESTRAI
 *   npm run pauta -- --ciclo      fica rodando e lê nos horários de PAUTA_HORARIOS (padrão 06:45,11:45,16:45)
 *   npm run pauta -- --fechar     fecha o navegador no fim (perde a sessão do tribunal)
 *
 * Login (SSO nacional da PDPJ, "Entrar com PDPJ"), na ordem:
 * 1. Certificado: no servidor, com o A1 enviado pelo painel de robôs, o robô clica em "CERTIFICADO DIGITAL" e o PJe
 *    Office imitado (src/pje-office.ts) assina o desafio. No Mac, a pessoa escolhe o certificado no PJe Office.
 * 2. Código de 2 fatores: gerado pelo segredo "pdpj" do painel (src/segundo-fator.ts); sem ele, o webhook
 *    ROBO_2FA_WEBHOOK_URL com ?sistema=pdpj; sem os dois, a pessoa digita.
 * 3. O que o robô não resolver fica para a pessoa, pela janela do robô (no servidor, a tela remota), até
 *    ESPERA_PESSOA_MINUTOS. O robô não digita senha.
 * A sessão fica no perfil do robô e serve às rodadas seguintes.
 *
 * O que se sabe da tela (teste de 18/11/2026, TRT-15): /pjekz/pauta-usuarios-externos chama
 * GET /pje-comum-api/api/pauta-usuarios-externos?dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD&codigoSituacao=M|C
 * &numeroPagina=1&tamanhoPagina=50&ordenacao=asc e devolve { pagina, qtdPaginas, totalRegistros, resultado }.
 */

const CODIGO = "#otp, input[name=otp], input[name=totp], input[autocomplete='one-time-code'], input[id*='codigo' i][maxlength='6']";
/**
 * Login por certificado no SSO da PDPJ (chama o PJe Office). Até 2026 era o botão "CERTIFICADO DIGITAL"
 * (#kc-pje-office); em 23/11/2026 a tela trazia o link "Seu certificado digital" (<a onclick="autenticar(...)">).
 * O <a> tem altura zero (o ícone e o texto dentro dele é que aparecem), e o Playwright o trata como invisível: o
 * robô procura e clica no que está dentro do link, e o clique sobe até o onclick.
 */
const CERTIFICADO_PDPJ = "#kc-pje-office, a[onclick^='autenticar('] > *";
const CONFIRMAR = "#kc-login, button[type=submit], input[type=submit]";
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

const base = (trt: string) => `https://pje.${trt.toLowerCase()}.jus.br`;

/**
 * O login terminou quando a aba volta ao PJe do tribunal e já passou do retorno do SSO. O authenticateSSO.seam é a
 * página que recebe o código da PDPJ e abre a sessão: sair dela antes de ela terminar deixa o PJe sem sessão.
 */
export function loginTerminou(url: string, trt: string): boolean {
  if (!url.startsWith(base(trt))) return false;
  return !/login|acesso-negado|authenticatesso|authorization|openid-connect|\/auth\/realms\//i.test(url);
}

/** Painel do advogado no PJe (pjekz): onde o navegador chega depois do login, com o token já no perfil de Advogado. */
const PAINEL = "/pjekz/painel/usuario-externo";

function dataIso(deslocamentoDias: number): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000 + deslocamentoDias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function dicaDaTela(config: Config): string {
  return config.telaRemotaUrl ? ` Tela do robô: ${config.telaRemotaUrl}` : "";
}

interface EstadoDaSessao {
  /** Status HTTP de /token/perfis (200 = sessão válida). */
  perfis: number;
  /** Status HTTP de /token/permissoes/recursos. */
  recursos: number;
  /** O perfil da sessão libera a tela "Minha Pauta" (page:pauta-usuarios-externos). */
  pauta: boolean;
  /** O token (cookie access_token) já traz o perfil escolhido. */
  tokenComPerfil: boolean;
}

/**
 * Como o próprio PJe (pjekz) decide o acesso: o token fica no cookie access_token, as chamadas levam o X-XSRF-TOKEN,
 * e a tela só abre se /token/permissoes/recursos trouxer page:pauta-usuarios-externos. Sem nomes nem dados pessoais.
 */
async function estadoDaSessao(pagina: Page, trt: string): Promise<EstadoDaSessao | null> {
  if (!pagina.url().startsWith(base(trt))) return null;
  // Atenção: nada de função com nome dentro do evaluate. O tsx (esbuild, keepNames) embrulha a função em __name(),
  // que não existe no navegador, e o evaluate falha calado (23/11/2026).
  return pagina
    .evaluate(async () => {
      const cookies = document.cookie;
      const xsrf = decodeURIComponent((cookies.match(/(?:^|; )Xsrf-Token=([^;]*)/) || [])[1] || "");
      const token = decodeURIComponent((cookies.match(/(?:^|; )access_token=([^;]*)/) || [])[1] || "");
      const headers: Record<string, string> = { Accept: "application/json", ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}) };
      const perfis = await fetch("/pje-seguranca/api/token/perfis", { credentials: "include", headers }).then((r) => r.status, () => 0);
      const recursos = await fetch("/pje-seguranca/api/token/permissoes/recursos", { credentials: "include", headers }).then(
        async (r) => ({ status: r.status, nomes: r.ok ? ((await r.json()) as { nome?: string }[]).map((x) => x.nome) : [] }),
        () => ({ status: 0, nomes: [] as (string | undefined)[] }),
      );
      let tokenComPerfil = false;
      try {
        if (token) tokenComPerfil = Boolean(JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))).perfil);
      } catch {
        tokenComPerfil = false;
      }
      return { perfis, recursos: recursos.status, pauta: recursos.nomes.includes("page:pauta-usuarios-externos"), tokenComPerfil };
    })
    .catch(() => null);
}

/** Logado = a sessão fala com a API do PJe deste tribunal e o perfil libera a Minha Pauta. */
async function logado(pagina: Page, trt: string): Promise<boolean> {
  const estado = await estadoDaSessao(pagina, trt);
  return Boolean(estado && estado.perfis === 200 && estado.pauta);
}

function descreverSessao(estado: EstadoDaSessao | null): string {
  if (!estado) return "fora do PJe do tribunal";
  return `perfis ${estado.perfis} · permissões ${estado.recursos} · Minha Pauta liberada: ${estado.pauta ? "sim" : "não"} · token com perfil: ${estado.tokenComPerfil ? "sim" : "não"}`;
}

/**
 * Depois do login, segue o caminho do navegador: espera o PJe chegar sozinho ao painel do advogado (ou abre o painel)
 * e deixa a tela carregar. Ir direto para a pauta logo depois do login dava "Acesso Negado" (23/11/2026).
 */
async function chegarAoPainel(pagina: Page, trt: string): Promise<void> {
  log(`${trt}: login terminou em ${pagina.url().split("?")[0]}.`);
  for (const limite = Date.now() + 30_000; Date.now() < limite && !pagina.url().includes("/pjekz/painel"); ) {
    await pagina.waitForTimeout(1_000);
  }
  if (!pagina.url().includes("/pjekz/painel")) {
    await pagina.goto(`${base(trt)}${PAINEL}`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  let titulo = "";
  for (const limite = Date.now() + 45_000; Date.now() < limite; ) {
    titulo = await pagina.title().catch(() => "");
    if (/Meu Painel/i.test(titulo)) break;
    await pagina.waitForTimeout(1_000);
  }
  await pagina.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  log(`${trt}: painel do PJe ${/Meu Painel/i.test(titulo) ? "aberto" : `não abriu (${pagina.url().split("?")[0]} · "${titulo.slice(0, 60)}")`} · ${descreverSessao(await estadoDaSessao(pagina, trt))}.`);
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

/** Digita o código e espera sair da tela dele. Devolve se foi aceito. */
async function digitarCodigo(aba: Page, codigo: string, trt: string): Promise<boolean> {
  const campo = aba.locator(CODIGO).first();
  await campo.fill(codigo).catch(() => undefined);
  const botao = aba.locator(CONFIRMAR).first();
  if (await botao.isVisible().catch(() => false)) await botao.click().catch(() => undefined);
  else await campo.press("Enter").catch(() => undefined);
  for (const limite = Date.now() + 20_000; Date.now() < limite; ) {
    await aba.waitForTimeout(1_000).catch(() => undefined);
    if (aba.isClosed() || aba.url().startsWith(base(trt))) return true;
    if (!(await aba.locator(CODIGO).first().isVisible().catch(() => false))) return true;
  }
  return false;
}

/**
 * Abre o login do PJe, clica em "Entrar com PDPJ" e tenta, na ordem: certificado pelo PJe Office do robô, código do
 * painel, código do webhook. O que sobrar fica com a pessoa, até ESPERA_PESSOA_MINUTOS.
 */
async function entrar(config: Config, pagina: Page, trt: string, comCertificado: boolean): Promise<void> {
  await pagina.goto(`${base(trt)}/primeirograu/login.seam`, { waitUntil: "domcontentloaded" });
  await pagina.waitForTimeout(2_000);
  const pdpj = pagina.locator("#btnSsoPdpj").first();
  if (await pdpj.isVisible().catch(() => false)) await pdpj.click().catch(() => undefined);
  await pagina.waitForTimeout(3_000);
  const limite = Date.now() + config.esperaPessoaMs;
  let tentouCertificado = false;
  let tentouCodigo = false;
  let chamouPessoa = false;
  let avisouTela = false;
  const inicio = Date.now();
  while (Date.now() < limite) {
    const abas = pagina.context().pages().filter((a) => !a.isClosed());
    const atual = abas[abas.length - 1] ?? pagina;
    if (loginTerminou(atual.url(), trt)) {
      // Deixa o PJe terminar de abrir a sessão antes de qualquer outra navegação.
      await atual.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      if (atual !== pagina) await pagina.goto(atual.url()).catch(() => undefined);
      return;
    }
    if (!avisouTela && Date.now() - inicio > 30_000) {
      const temCodigo = await atual.locator(CODIGO).first().isVisible().catch(() => false);
      const temCertificado = await atual.locator(CERTIFICADO_PDPJ).first().isVisible().catch(() => false);
      if (!temCodigo && !temCertificado && !tentouCertificado) {
        avisouTela = true;
        const titulo = (await atual.title().catch(() => "")).slice(0, 80);
        const endereco = atual.url().split("?")[0];
        log(`${trt}: há 30 s o robô não acha o botão do certificado nem o campo do código (${endereco}${titulo ? ` · "${titulo}"` : ""}).${dicaDaTela(config)}`);
      }
    }
    if (await atual.locator(CODIGO).first().isVisible().catch(() => false)) {
      if (!tentouCodigo) {
        tentouCodigo = true;
        const peloPainel = await entrarComCodigoDoPainel({
          config: config.segundoFator,
          sistema: "pdpj",
          digitar: (codigo) => digitarCodigo(atual, codigo, trt),
          registrar: (m) => log(`${trt}: ${m}`),
        });
        if (peloPainel) continue;
        const codigo = await codigoDoWebhook(config);
        if (codigo && (await digitarCodigo(atual, codigo, trt))) {
          log(`${trt}: código de 2 fatores obtido do webhook e aceito.`);
          continue;
        }
      }
      if (!chamouPessoa) log(`${trt}: o SSO pediu o código de 2 fatores e o robô não conseguiu. Digite na janela do robô.${dicaDaTela(config)}`);
      chamouPessoa = true;
    } else if (comCertificado && !tentouCertificado && (await atual.locator(CERTIFICADO_PDPJ).first().isVisible().catch(() => false))) {
      tentouCertificado = true;
      await atual.locator(CERTIFICADO_PDPJ).first().click().catch(() => undefined);
      log(`${trt}: entrando pelo certificado (PJe Office do robô).`);
      await atual.waitForTimeout(5_000);
      continue;
    } else if (!chamouPessoa && (!comCertificado || tentouCertificado)) {
      log(`${trt}: login pelo SSO da PDPJ esperando a pessoa (certificado ou CPF e senha na janela do robô). O robô não digita senha.${dicaDaTela(config)}`);
      chamouPessoa = true;
    }
    await atual.waitForTimeout(3_000);
  }
  throw new Error(`ninguém concluiu o login em ${Math.round(config.esperaPessoaMs / 60000)} minutos.`);
}

interface PaginaDaPauta {
  qtdPaginas?: number;
  resultado?: Record<string, unknown>[];
}

/** Lê a pauta no contexto da página (mesma sessão e mesmos cabeçalhos do navegador). */
async function lerPauta(pagina: Page, situacao: string, de: string, ate: string): Promise<Record<string, unknown>[]> {
  const registros: Record<string, unknown>[] = [];
  for (let numero = 1; numero <= 40; numero += 1) {
    const parametros = new URLSearchParams({ dataInicio: de, dataFim: ate, codigoSituacao: situacao, numeroPagina: String(numero), tamanhoPagina: "50", ordenacao: "asc" });
    const resposta = await pagina.evaluate(async (consulta) => {
      // Mesmos cabeçalhos que o PJe (pjekz) manda: o X-XSRF-TOKEN sai do cookie Xsrf-Token.
      const xsrf = decodeURIComponent((document.cookie.match(/(?:^|; )Xsrf-Token=([^;]*)/) || [])[1] || "");
      const headers: Record<string, string> = { Accept: "application/json", ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}) };
      const r = await fetch(`/pje-comum-api/api/pauta-usuarios-externos?${consulta}`, { credentials: "include", headers });
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

/** Resumo para o log, sem nomes: designadas, canceladas, por vídeo, com link e a próxima. */
function resumo(registros: Record<string, unknown>[]): string {
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
async function rodada(config: Config, navegador: Navegador, comCertificado: boolean): Promise<number> {
  let falhas = 0;
  for (const trt of tribunais()) {
    try {
      const pagina = navegador.pagina;
      // A leitura usa a API da pauta a partir de qualquer tela do PJe do tribunal: o robô fica no painel do advogado,
      // como o navegador depois do login, e não abre a tela da Minha Pauta.
      await pagina.goto(`${base(trt)}${PAINEL}`, { waitUntil: "domcontentloaded" });
      await pagina.waitForTimeout(3_000);
      if (!(await logado(pagina, trt))) {
        await entrar(config, pagina, trt, comCertificado);
        await chegarAoPainel(pagina, trt);
        let ok = await logado(pagina, trt);
        for (const limite = Date.now() + 45_000; !ok && Date.now() < limite; ) {
          await pagina.waitForTimeout(3_000);
          ok = await logado(pagina, trt);
        }
        if (!ok) {
          throw new Error(
            `depois do login, a sessão não libera a Minha Pauta (${pagina.url().split("?")[0]} · ${descreverSessao(await estadoDaSessao(pagina, trt))})`,
          );
        }
        log(`${trt}: login concluído.`);
      } else log(`${trt}: sessão do PJe já aberta no perfil do robô.`);
      const de = dataIso(-1);
      const ate = dataIso(DIAS_A_FRENTE);
      const registros: Record<string, unknown>[] = [];
      for (const situacao of SITUACOES) registros.push(...(await lerPauta(pagina, situacao, de, ate)));
      log(`${trt}: ${registros.length} registro(s) lido(s) de ${de} a ${ate} · ${resumo(registros)}.`);
      if (SO_LER) {
        log(`${trt}: teste de acesso OK. Nada foi mandado ao ORQESTRAI (--so-ler).`);
        continue;
      }
      log(`${trt}: gravado no ORQESTRAI · ${JSON.stringify(await enviar(config, trt, registros))}`);
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
export function msAteProximoHorario(agora = Date.now(), texto = process.env.PAUTA_HORARIOS?.trim() || "06:45,11:45,16:45"): number {
  const horarios = texto
    .split(/[,\s]+/)
    .map((h) => h.match(/^(\d{1,2}):(\d{2})$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => Number(m[1]) * 60 + Number(m[2]))
    .sort((a, b) => a - b);
  const local = new Date(agora - 3 * 60 * 60 * 1000);
  const minutosAgora = local.getUTCHours() * 60 + local.getUTCMinutes();
  const proximo = horarios.find((h) => h > minutosAgora) ?? (horarios[0] ?? 405) + 24 * 60;
  return (proximo - minutosAgora) * 60_000 - local.getUTCSeconds() * 1000 - local.getUTCMilliseconds();
}

async function carregarCertificado(config: Config): Promise<CertificadoCliente | null> {
  try {
    const certificado = await lerCertificado(config.certificado);
    if (!certificado) return null;
    const dias = diasParaVencer(certificado.validoAte);
    log(`Certificado do painel carregado (${certificado.origem}).${dias !== null && dias <= 30 ? ` ATENÇÃO: vence em ${dias} dia(s).` : ""}`);
    return certificado;
  } catch (erro) {
    if (!(erro instanceof FalhaDoCertificado)) throw erro;
    log(`Certificado indisponível: ${erro.message} O login por certificado fica com a pessoa.`);
    return null;
  }
}

async function principal(): Promise<void> {
  // O teste de acesso não fala com o ORQESTRAI: não precisa do endereço nem do token dele.
  if (SO_LER) {
    process.env.ORQESTRAI_URL ||= "http://localhost";
    process.env.ROBO_AUTOS_TOKEN ||= "somente-leitura-sem-envio-ao-orqestrai";
  }
  const config = lerConfig();
  const certificado = await carregarCertificado(config);
  const comCertificado = Boolean(certificado && config.pjeOffice);
  log(`Robô da pauta · ${tribunais().join(", ")} · ${comCertificado ? "login pelo certificado do painel" : "login com a pessoa"}${SO_LER ? " · teste (só lê)" : ""}${CICLO ? " · ciclo" : ""}.`);
  const navegador = await abrirNavegador(config, certificado);
  let falhas = 0;
  try {
    if (!CICLO) falhas = await rodada(config, navegador, comCertificado);
    else {
      for (;;) {
        await rodada(config, navegador, comCertificado);
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

if (process.argv[1]?.endsWith("pauta.ts")) {
  principal().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
