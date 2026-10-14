-- Vistagem: triagem automática das publicações captadas da Kurier.
-- Cada publicação é cruzada com a base de processos do SIOE (processos_completo)
-- pelo CNJ. Com uma pasta só, herda CI, cliente, grupo, advogado e o escritório
-- (área do advogado responsável) e vai para "juridico_vistar". Ex-cliente vai
-- para Operações Legais. Sem pasta ou com mais de uma pasta fica em
-- "triagem_pendente" até a controladoria resolver.

alter table public.vistagem_publicacoes
  add column if not exists pasta_ci text,
  add column if not exists pasta_vinculo text,
  add column if not exists cliente text,
  add column if not exists grupo_cliente text,
  add column if not exists area_processo text,
  add column if not exists advogado_responsavel text,
  add column if not exists situacao_processo text,
  add column if not exists etiquetas text,
  add column if not exists escritorio_responsavel text,
  add column if not exists demanda_risco boolean,
  add column if not exists pendencia text,
  add column if not exists pastas_candidatas jsonb not null default '[]'::jsonb,
  add column if not exists triada_em timestamptz,
  add column if not exists triagem_resolvida_por uuid references auth.users(id) on delete set null,
  add column if not exists triagem_resolvida_em timestamptz;

alter table public.vistagem_publicacoes
  drop constraint if exists vistagem_publicacoes_pendencia_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_pendencia_check
  check (pendencia in ('sem_pasta', 'varias_pastas', 'ex_cliente', 'sem_area', 'sem_grupo'));

alter table public.vistagem_publicacoes
  drop constraint if exists vistagem_publicacoes_status_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_status_check check (status in (
    'captada', 'duplicidade', 'descartada', 'triagem_pendente', 'juridico_vistar',
    'controladoria_vistar', 'pronto_para_agendar', 'agendado', 'checado', 'revisar'
  ));

create index if not exists vistagem_publicacoes_escritorio_idx
  on public.vistagem_publicacoes (status, escritorio_responsavel);
create index if not exists vistagem_publicacoes_pasta_idx
  on public.vistagem_publicacoes (pasta_ci);

comment on column public.vistagem_publicacoes.escritorio_responsavel is
  'Área que vista a publicação: área do advogado responsável no SIOE (fallback: área do processo). Ex-cliente = Operações Legais.';
comment on column public.vistagem_publicacoes.pendencia is
  'Motivo de a publicação passar pela controladoria: sem_pasta, varias_pastas, sem_area, sem_grupo (triagem_pendente) ou ex_cliente (vistada por Operações Legais).';
comment on column public.vistagem_publicacoes.pastas_candidatas is
  'Pastas do SIOE encontradas para o CNJ quando há mais de uma, para a controladoria escolher.';
