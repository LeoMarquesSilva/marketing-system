-- Configurações da Vistagem que o admin altera na tela (Vistagem › Configurações): uma linha por regra.
-- Sem linha, vale o padrão do código. Só o servidor (service role) lê e grava: RLS ligado e sem política.
create table if not exists public.vistagem_configuracoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now()
);

alter table public.vistagem_configuracoes enable row level security;

-- Histórico: quem mudou, quando, de quê para quê (a tela mostra as últimas alterações de cada regra).
create table if not exists public.vistagem_configuracoes_historico (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  valor_anterior jsonb,
  valor_novo jsonb not null,
  alterado_por uuid,
  alterado_em timestamptz not null default now()
);

create index if not exists vistagem_configuracoes_historico_chave_idx
  on public.vistagem_configuracoes_historico (chave, alterado_em desc);

alter table public.vistagem_configuracoes_historico enable row level security;
