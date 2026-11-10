// Uso: node <skill>/scripts/cdp.mjs <arquivo.js> [saida.json]
// Roda o JS numa aba própria do VIOS no Chrome local com --remote-debugging-port=9333.
// O id da aba fica em ./.vios-aba.txt (pasta de onde você roda). Feche a aba ao terminar:
// curl -s http://127.0.0.1:9333/json/close/$(cat .vios-aba.txt) && rm .vios-aba.txt
// O código roda dentro de (async()=>{ ... })(): use `return` para devolver o resultado.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const BASE = 'http://127.0.0.1:9333';
const ID_FILE = process.cwd() + '/.vios-aba.txt';
const listar = async () => (await (await fetch(`${BASE}/json/list`)).json()).filter(t => t.type === 'page');
let abas = await listar();
let aba = existsSync(ID_FILE) ? abas.find(t => t.id === readFileSync(ID_FILE, 'utf8').trim()) : null;
if (!aba) {
  aba = await (await fetch(`${BASE}/json/new?${encodeURIComponent('https://bp.vios.com.br/index.php?pag=sys/processos/processos-lista.php')}`, { method: 'PUT' })).json();
  writeFileSync(ID_FILE, aba.id);
  await new Promise(r => setTimeout(r, 4000));
}
if (!new URL(aba.url || 'https://bp.vios.com.br').hostname.endsWith('vios.com.br')) throw new Error('aba fora do VIOS: ' + aba.url);
const vivo = setInterval(() => {}, 1000);
setTimeout(() => { console.error('ERRO tempo esgotado'); process.exit(2); }, 175000);
const ws = new WebSocket(aba.webSocketDebuggerUrl);
ws.onclose = () => { console.error('ERRO conexão fechada'); process.exit(3); };
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let n = 0; const pend = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cmd = (method, params = {}) => new Promise(res => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const codigo = readFileSync(process.argv[2], 'utf8');
const r = await cmd('Runtime.evaluate', { expression: `(async()=>{${codigo}\n})()`, awaitPromise: true, returnByValue: true, timeout: 170000 });
ws.onclose = null; ws.close(); clearInterval(vivo);
if (r.result?.exceptionDetails) { console.error('ERRO', JSON.stringify(r.result.exceptionDetails).slice(0, 800)); process.exit(1); }
const v = r.result?.result?.value;
const txt = typeof v === 'string' ? v : JSON.stringify(v, null, 1);
if (process.argv[3]) { writeFileSync(process.argv[3], txt ?? ''); console.log('salvo', process.argv[3], (txt ?? '').length); } else console.log(txt);
process.exit(0);
