# VIOS App

Baixa o relatório de tarefas do VIOS e sincroniza com o Supabase (apenas **MATERIAL MARKETING - REELS/POST/ARTIGO**).

## Arquivos necessários (mesma pasta)

- `index.js` ou `Tarefas.js` (script principal)
- `sync-to-supabase.js` (sync para Supabase)
- `.env` (credenciais)

## Configuração

Copie `.env.example` para `.env` e preencha VIOS_USER, VIOS_PASS, NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.

## Uso

```bash
npm install
npx playwright install chromium
node index.js
# ou: node Tarefas.js
```
