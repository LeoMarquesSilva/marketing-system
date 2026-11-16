-- Registro da IA da vistagem (pedido de 16/11/2026): o que a IA leu, o que ela sugeriu e o que o advogado escolheu.
-- É a base para a IA aprender com as decisões do jurídico e para medir o acerto por área.
--
-- vistagem_ia_instrucoes: as instruções que a IA recebeu (regras da área, lista de tarefas do VIOS e o costume do
--   escritório), guardadas uma vez por versão (hash sha-256 do texto).
-- vistagem_ia_registros: uma linha por sugestão.
--   - entrada: o que a IA leu da publicação (data, tribunal, órgão, tipo, cliente, partes e teor).
--   - sugestao: o que ela sugeriu (tarefas, dias, de quem é o prazo, confiança, resumo, custo).
--   - tarefas_escolhidas: o que o advogado agendou ao vistar.
--   - comparacao: as tarefas sugeridas que ele aceitou, as que rejeitou e as que acrescentou.
--   - resultado: usada, usada_com_alteracao ou nao_usada. Uma nova vistagem (devolução, reabertura) atualiza a linha.
--   - motivo: o porquê do advogado, para quando a tela pedir.

create table if not exists public.vistagem_ia_instrucoes (
  hash      text primary key,
  area      text,
  texto     text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.vistagem_ia_registros (
  id                 uuid primary key default gen_random_uuid(),
  publicacao_id      uuid references public.vistagem_publicacoes(id) on delete set null,
  numero_processo    text,
  -- Área do catálogo do VIOS (lista de tarefas) e escritório da publicação.
  area               text,
  escritorio         text,
  modelo             text,
  instrucoes_hash    text references public.vistagem_ia_instrucoes(hash),
  entrada            jsonb not null,
  sugestao           jsonb not null,
  custo_us           numeric,
  gerada_em          timestamptz not null default now(),
  resultado          text check (resultado in ('usada', 'usada_com_alteracao', 'nao_usada')),
  tarefas_escolhidas jsonb,
  comparacao         jsonb,
  decidido_por       uuid,
  decidido_em        timestamptz,
  motivo             text
);

create unique index if not exists vistagem_ia_registros_publicacao_idx on public.vistagem_ia_registros (publicacao_id);
create index if not exists vistagem_ia_registros_escritorio_idx on public.vistagem_ia_registros (escritorio, gerada_em desc);

alter table public.vistagem_ia_instrucoes enable row level security;
alter table public.vistagem_ia_registros enable row level security;

-- Carga das sugestões que já existem: o que a IA leu, o que sugeriu e, nas já vistadas, o que o advogado agendou e a
-- comparação (a tarefa casa pelo id ou, no tipo recriado no VIOS, pelo nome). As instruções antigas não foram guardadas.
insert into public.vistagem_ia_registros (
  publicacao_id, numero_processo, area, escritorio, modelo, entrada, sugestao, custo_us, gerada_em,
  resultado, tarefas_escolhidas, comparacao, decidido_por, decidido_em
)
select
  p.id,
  p.numero_processo,
  null,
  p.escritorio_responsavel,
  p.sugestao_ia->>'modelo',
  jsonb_build_object(
    'data_publicacao', p.data_publicacao,
    'tribunal', p.tribunal,
    'orgao', p.djen_orgao,
    'tipo_comunicacao', p.djen_tipo_comunicacao,
    'cliente', p.cliente,
    'partes', coalesce(p.djen_partes, '[]'::jsonb),
    'teor', left(p.teor, 20000)
  ),
  p.sugestao_ia,
  (p.sugestao_ia->>'custoUS')::numeric,
  coalesce(p.sugestao_ia_em, (p.sugestao_ia->>'geradaEm')::timestamptz, p.created_at),
  p.sugestao_ia_resultado,
  case when p.sugestao_ia_resultado is not null then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'classe', a.etiqueta, 'tarefaId', a.tarefa_id::text, 'tarefa', a.tarefa, 'dias', a.dias_prazo,
      'contagem', a.contagem_prazo, 'dataFatal', a.data_fatal, 'data', a.data, 'hora', a.hora
    ) order by a.ordem), '[]'::jsonb)
    from public.vistagem_agendamentos a
    where a.publicacao_id = p.id
  ) end,
  case when p.sugestao_ia_resultado is not null then jsonb_build_object(
    'aceitas', (
      select coalesce(jsonb_agg(s->>'tarefa'), '[]'::jsonb)
      from jsonb_array_elements(p.sugestao_ia->'tarefas') s
      where exists (
        select 1 from public.vistagem_agendamentos a
        where a.publicacao_id = p.id and (a.tarefa_id::text = s->>'tarefaId' or upper(a.tarefa) = upper(s->>'tarefa'))
      )
    ),
    'rejeitadas', (
      select coalesce(jsonb_agg(s->>'tarefa'), '[]'::jsonb)
      from jsonb_array_elements(p.sugestao_ia->'tarefas') s
      where not exists (
        select 1 from public.vistagem_agendamentos a
        where a.publicacao_id = p.id and (a.tarefa_id::text = s->>'tarefaId' or upper(a.tarefa) = upper(s->>'tarefa'))
      )
    ),
    'acrescentadas', (
      select coalesce(jsonb_agg(a.tarefa order by a.ordem), '[]'::jsonb)
      from public.vistagem_agendamentos a
      where a.publicacao_id = p.id
        and upper(a.tarefa) not like '1. CI%NCIA DOS AGENDAMENTOS'
        and upper(a.tarefa) not like 'INSERIR E%SOCIAL%'
        and not exists (
          select 1 from jsonb_array_elements(p.sugestao_ia->'tarefas') s
          where a.tarefa_id::text = s->>'tarefaId' or upper(a.tarefa) = upper(s->>'tarefa')
        )
    )
  ) end,
  case when p.sugestao_ia_resultado is not null then coalesce(p.revistado_por, p.vistado_por) end,
  case when p.sugestao_ia_resultado is not null then coalesce(p.revistado_em, p.vistado_em) end
from public.vistagem_publicacoes p
where p.sugestao_ia is not null
on conflict (publicacao_id) do nothing;
