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

## Modo audiências (Pauta de Audiências do ORQESTRAI)

```bash
node index.js --audiencias
```

Exporta o relatório de tarefas de 3 dias atrás até 1 ano à frente, sem abrir janela, em `Bases Atualizacoes/Audiencias.csv` (e cópia em `Historico/`). O ORQESTRAI usa esse arquivo para conferir a data e a situação de cada audiência no VIOS. Agende no Agendador de Tarefas do Windows às 6h30, 11h30 e 16h30. `VIOS_PASTA_BASES` troca a pasta de saída.
