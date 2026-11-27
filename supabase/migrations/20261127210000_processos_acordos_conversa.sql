-- Acordos trabalhistas: cópia (Cc) nos e-mails, a caixa que envia e a conversa do Outlook no histórico.
-- Só acrescenta: nada que já está gravado muda.

-- Configurações do módulo de Processos (chave → valor). 1º uso: "acordos_trabalhistas", com a caixa que envia os
-- e-mails de acordo e a cópia padrão. Preenchidas pela tela, não pelo código.
create table if not exists public.proc_configuracoes (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  atualizado_por_nome text,
  updated_at timestamptz not null default now()
);
comment on table public.proc_configuracoes is
  'Configurações do módulo de Processos, por chave (ex.: acordos_trabalhistas: caixa que envia e cópia padrão).';
alter table public.proc_configuracoes enable row level security;

-- O histórico da negociação passa a guardar a conversa: os e-mails que chegam (email_recebido) e, de cada e-mail,
-- a cópia, o envio a que pertence, a caixa, a conversa e a mensagem no Microsoft 365.
alter table public.proc_negociacao_eventos drop constraint if exists proc_negociacao_eventos_tipo_check;
alter table public.proc_negociacao_eventos add constraint proc_negociacao_eventos_tipo_check check (
  tipo in ('email_enviado', 'email_recebido', 'email_rascunho', 'status', 'proposta', 'contraproposta', 'acordo', 'valor_maximo', 'observacao', 'importacao')
);

alter table public.proc_negociacao_eventos
  add column if not exists cc text[],
  -- O mesmo e-mail vai para vários processos (um por advogado): o envio junta as linhas dele.
  add column if not exists envio_id uuid,
  add column if not exists caixa text,
  add column if not exists conversa_id text,
  add column if not exists mensagem_id text,
  add column if not exists mensagem_em timestamptz;

-- Cada mensagem da conversa entra uma vez em cada processo do e-mail.
create unique index if not exists proc_negociacao_eventos_mensagem_idx
  on public.proc_negociacao_eventos (processo_id, mensagem_id) where mensagem_id is not null;
create index if not exists proc_negociacao_eventos_envio_idx
  on public.proc_negociacao_eventos (envio_id) where envio_id is not null;
create index if not exists proc_negociacao_eventos_conversa_idx
  on public.proc_negociacao_eventos (conversa_id) where conversa_id is not null;
