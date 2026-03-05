import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let syncViosToSupabase = null;
try {
  const syncPath = path.join(__dirname, 'sync-to-supabasemkt.js');
  if (fs.existsSync(syncPath)) {
    const mod = await import(syncPath);
    syncViosToSupabase = mod.syncViosToSupabase;
  }
} catch {
  syncViosToSupabase = null;
}

const config = {
  baseUrl: 'https://bp.vios.com.br',
  usuario: process.env.VIOS_USER || 'vinicius.marques@bismarchipires.com.br',
  senha: process.env.VIOS_PASS || 'Vinicius123!',
  headless: false,

  // 🔧 Informe manualmente o período desejado
  dataInicio: '01/01/2026',
  dataFim: '28/04/2026',

  // Caminho principal
  downloadPath: `C:\\Users\\bp01\\OneDrive - BPPLAW\\Documentos - Equipe Controladoria\\Núcleo de Cadastro\\Bases Atualizacoes\\Tarefas.csv`,

  // Caminho secundário (Histórico)
  backupPath: `C:\\Users\\bp01\\OneDrive - BPPLAW\\Documentos - Equipe Controladoria\\Núcleo de Cadastro\\Bases Atualizacoes\\Historico\\Tarefas.csv`
};

// 📁 Função para copiar arquivo ao histórico
async function copiarParaBackup() {
  try {
    if (fs.existsSync(config.downloadPath)) {
      fs.copyFileSync(config.downloadPath, config.backupPath);
      console.log(`📂 Copiado com sucesso para o caminho secundário:\n   ${config.backupPath}`);
    } else {
      console.warn('⚠️ Arquivo original não encontrado para cópia.');
    }
  } catch (err) {
    console.error('❌ Erro ao copiar arquivo para o caminho secundário:', err);
  }
}

async function main() {
  console.log('1️⃣ Abrindo navegador...');
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  console.log('2️⃣ Indo para página de login...');
  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 0 });

  console.log('3️⃣ Preenchendo usuário e senha...');
  await page.fill('input[name="form[usuario]"]', config.usuario);
  await page.fill('input[name="form[senha]"]', config.senha);

  console.log('4️⃣ Clicando em Entrar...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 0 }).catch(() => {}),
    page.click('input[type="submit"][name="Entrar"], button:has-text("Entrar")')
  ]);
  console.log('✅ Login concluído.');

  console.log('5️⃣ Acessando página de processos...');
  await page.goto(`${config.baseUrl}/?pag=sys/processos/pxe-lista.php&menu_lateral=true`, { waitUntil: 'domcontentloaded', timeout: 0 });

  console.log('6️⃣ Selecionando "Todas" no combo flag_conclusao...');
  await page.click('button[data-id="flag_conclusao"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("Todas")');

  console.log(`7️⃣ Preenchendo datas: ${config.dataInicio} → ${config.dataFim}`);
  // Limpa antes de preencher para evitar erro
  await page.fill('input[name="pesq[idata]"], input[name="pesq[data_de]"], input[name="pesq[data_ini]"]', '');
  await page.fill('input[name="pesq[fdata]"], input[name="pesq[data_ate]"], input[name="pesq[data_fim]"]', '');
  await page.fill('input[name="pesq[idata]"], input[name="pesq[data_de]"], input[name="pesq[data_ini]"]', config.dataInicio);
  await page.fill('input[name="pesq[fdata]"], input[name="pesq[data_ate]"], input[name="pesq[data_fim]"]', config.dataFim);

  console.log('8️⃣ Selecionando CSV e limite...');
  await page.click('button[data-id="pesq[tprel]"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("CSV")');
  await page.click('button[data-id="pesq[limit]"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("99999")');

  console.log('9️⃣ Iniciando pesquisa...');
  await page.click('#Pesq');

  console.log('🔟 Aguardando link de download...');
  const linkHandle = await page.waitForSelector("a[id*='tarefas-lista']", { timeout: 0 });
  const href = await linkHandle.getAttribute('href');
  const finalUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\.\//, '')}`;
  console.log(`🔗 URL final do CSV: ${finalUrl}`);

  console.log('1️⃣1️⃣ Baixando CSV...');
  const writer = fs.createWriteStream(config.downloadPath);
  const response = await axios.get(finalUrl, {
    responseType: 'stream',
    headers: {
      Cookie: (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ')
    },
    maxBodyLength: Infinity
  });

  const totalLength = response.headers['content-length'] ? parseInt(response.headers['content-length']) : null;
  let downloaded = 0;
  const startTime = Date.now();

  response.data.on('data', chunk => {
    downloaded += chunk.length;
    if (totalLength) {
      const percent = ((downloaded / totalLength) * 100).toFixed(2);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = downloaded / 1024 / 1024 / elapsed;
      const remaining = totalLength - downloaded;
      const eta = (remaining / 1024 / 1024 / speed).toFixed(1);
      process.stdout.write(`\r📦 ${percent}% baixado | ${speed.toFixed(2)} MB/s | ETA: ${eta}s`);
    } else {
      process.stdout.write(`\r📦 Baixado: ${(downloaded / 1024 / 1024).toFixed(2)} MB`);
    }
  });

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  console.log(`\n✅ CSV salvo em ${config.downloadPath}`);

  // 🔁 Copia automaticamente para o caminho secundário
  await copiarParaBackup();

  // 📤 Sync para Supabase (apenas tarefas MATERIAL MARKETING - REELS/POST/ARTIGO)
  if (syncViosToSupabase && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('Sincronizando com Supabase...');
    try {
      const result = await syncViosToSupabase(config.downloadPath);
      console.log(`✅ Sync: ${result.inserted} inseridos, ${result.updated} atualizados (${result.total} tarefas MATERIAL MARKETING)`);
    } catch (err) {
      console.error('❌ Erro no sync Supabase:', err.message);
    }
  }

  console.log('1️⃣2️⃣ Realizando logout...');
  await page.goto(`${config.baseUrl}/logout.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('✅ Logout realizado.');

  await browser.close();
  console.log('🎉 Script finalizado.');
}

main();
