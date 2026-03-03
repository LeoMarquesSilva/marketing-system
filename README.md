# Sistema de Eficiência de Marketing

Sistema para rastrear solicitações da equipe de marketing, monitorar prazos e visualizar eficiência através de métricas. Desenvolvido para escritórios de advocacia.

## Tech Stack

- **Framework:** Next.js 16 (App Router) com TypeScript
- **Estilização:** Tailwind CSS
- **Componentes UI:** shadcn/ui
- **Banco de Dados:** Supabase (PostgreSQL)
- **Gráficos:** Recharts
- **Ícones:** Lucide-React

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env.local
```

3. Preencha `.env.local` com suas credenciais (disponíveis em **Settings > API** do Supabase):

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

4. Migrações e SQL no banco:
   - **Preferência:** usar o MCP Supabase (`user-supabase-marketing-system`) para aplicar migrations (autenticar com `mcp_auth` se necessário). Ver `.cursor/rules/supabase-mcp.mdc`.
   - **Alternativa:** executar no **SQL Editor** do painel Supabase:
     - `supabase-schema.sql` — tabela `marketing_requests`
     - `supabase-users-schema.sql` — tabela `users` (sincronizada com o outro sistema)
     - `supabase-migration-solicitante-id.sql` — vincula solicitante ao usuário (após popular `users`)
     - `supabase-migration-art-link.sql` — coluna `art_link` (link da arte)

### 3. Executar o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Funcionalidades

- **Dashboard:** KPIs (total no mês, tempo médio de atendimento), gráficos por área e status
- **Nova Solicitação:** Formulário para cadastrar demandas
- **Solicitações:** Lista com filtros por status, área e busca por título

## Estrutura

```
src/
├── app/              # Rotas (Dashboard, Nova Solicitação, Lista)
├── components/       # Componentes UI e de layout
├── lib/              # Utilitários e lógica de dados
└── utils/            # Cliente Supabase
```

## Alinhamento com o Excel

O sistema foi ajustado para refletir a planilha "Solicitações Marketing":

| Excel | Sistema |
|-------|---------|
| SOLICITANTE | Solicitante (quem pediu) |
| ÁREA | Área (Cível, Trabalhista, Operações Legais, etc.) |
| SOLICITAÇÃO | Tipo (Comunicado, PPT, Post Redes Socias, etc.) |
| DETALHE SOLICITAÇÃO | Detalhe da solicitação |
| DATA PEDIDO | Data solicitado |
| DATA ENTREGUE | Data entregue |

**Áreas:** Cível, Trabalhista, Operações Legais, Reestruturação, Marketing, Societário e Contratos, Sócio

**Tipos:** Comunicado, PPT, Post Redes Socias, Aplicação identidade, Certificados, EBOOK, Identidade Visual

### Importar dados do Excel

Com o Supabase configurado e a tabela criada:

```bash
npm run import-excel
```

Coloque o arquivo `Solicitações Marketing-CURSOR.xlsx` na raiz do projeto antes de executar.

### Importar usuários (planilha app_c009c0e4f1_users_rows)

Para usar o select de solicitante com avatar e área automática:

```bash
npm run import-users
```

Coloque o arquivo `app_c009c0e4f1_users_rows.csv` na raiz do projeto. O script popula a tabela `users` com nome, email, departamento e avatar_url.

### Migração (tabela já existente)

- `supabase-migration-add-columns.sql` — adiciona `solicitante` e `request_type`
- `supabase-migration-solicitante-id.sql` — adiciona `solicitante_id` (FK para users)

## Deploy na Vercel

1. **Envie o código para o GitHub** (repositório: [LeoMarquesSilva/marketing-system](https://github.com/LeoMarquesSilva/marketing-system)):

   ```bash
   git branch -M main
   git push -u origin main
   ```

2. **Conecte na Vercel:** [vercel.com](https://vercel.com) → **Add New Project** → **Import** o repositório `LeoMarquesSilva/marketing-system`.

3. **Variáveis de ambiente** (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave anon/public

4. **Deploy:** a Vercel detecta Next.js e faz o build automaticamente. Após o deploy, acesse a URL gerada (ex.: `marketing-system-xxx.vercel.app`).

5. **Supabase:** em **Authentication → URL Configuration**, adicione a URL da Vercel em **Redirect URLs** (ex.: `https://seu-app.vercel.app/**`) para o login funcionar.

## Nota

Se o Supabase não estiver configurado ou a tabela não existir, o sistema usa dados mockados para exibir o layout.
