-- Conferência DJEN × Kurier (pedido de 11/11/2026): estudo para ver se a API pública do DJEN traz tudo o que a Kurier
-- traz, antes de pensar em tirar a Kurier. Não muda nada no fluxo das publicações.
--
-- vistagem_djen_comunicacoes: cada comunicação do DJEN (comunicaapi.pje.jus.br) que cita o Gustavo Bismarchi Motta
-- (OAB 275477/SP) ou o Ricardo Viscardi Pires (OAB 353389/SP), os mesmos nomes que a Kurier localiza. O id é o da
-- comunicação no DJEN, o mesmo que a Kurier traz em vistagem_publicacoes.djen_id_comunicacao.
-- vistagem_djen_buscas: cada busca (cron ou botão), com os dias buscados e o total por advogado.

create table if not exists public.vistagem_djen_comunicacoes (
  id                    bigint primary key,
  data_disponibilizacao date not null,
  numero_processo       text,
  sigla_tribunal        text,
  tipo_comunicacao      text,
  nome_orgao            text,
  nome_classe           text,
  -- Quais dos nossos a comunicação cita ("275477/SP", "353389/SP").
  advogados             text[] not null default '{}',
  ativo                 boolean,
  link                  text,
  primeira_vez          timestamptz not null default now(),
  ultima_vez            timestamptz not null default now()
);

create index if not exists vistagem_djen_comunicacoes_data_idx
  on public.vistagem_djen_comunicacoes (data_disponibilizacao);

create table if not exists public.vistagem_djen_buscas (
  id           uuid primary key default gen_random_uuid(),
  executada_em timestamptz not null default now(),
  origem       text not null default 'cron' check (origem in ('cron', 'manual')),
  dias         date[] not null default '{}',
  -- { "275477/SP": { "2026-11-10": 105, … }, … }
  totais       jsonb not null default '{}'::jsonb,
  erro         text
);

create index if not exists vistagem_djen_buscas_executada_idx
  on public.vistagem_djen_buscas (executada_em desc);

alter table public.vistagem_djen_comunicacoes enable row level security;
alter table public.vistagem_djen_buscas enable row level security;
-- Sem políticas: só o servidor (service_role) lê e grava.

comment on table public.vistagem_djen_comunicacoes is
  'Conferência DJEN × Kurier: comunicações do DJEN que citam o Gustavo (275477/SP) ou o Ricardo (353389/SP). Só estudo.';
comment on table public.vistagem_djen_buscas is
  'Conferência DJEN × Kurier: cada busca no DJEN (cron ou botão), com os dias e o total por advogado.';

notify pgrst, 'reload schema';
