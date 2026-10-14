-- Vistagem: Id de documento do PJe ("Id. 1c116a7") como segundo critério de
-- duplicidade e apoio à conferência; registra como a duplicidade foi reconhecida.

alter table public.vistagem_publicacoes
  add column if not exists documento_ids text[] not null default '{}',
  add column if not exists duplicidade_criterio text;

alter table public.vistagem_publicacoes
  drop constraint if exists vistagem_publicacoes_duplicidade_criterio_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_duplicidade_criterio_check
  check (duplicidade_criterio in ('texto', 'id_documento'));

-- Publicações já capturadas: extrai os Ids do teor (7 hexadecimais com pelo menos um dígito).
update public.vistagem_publicacoes p
set documento_ids = coalesce((
  select array_agg(distinct lower(m[1]) order by lower(m[1]))
  from regexp_matches(p.teor, '\mId\.?\s*:?\s*([0-9a-fA-F]{7})\M', 'gi') as m
  where m[1] ~ '[0-9]'
), '{}')
where p.documento_ids = '{}';

update public.vistagem_publicacoes
set duplicidade_criterio = 'texto'
where duplicidade_de is not null and duplicidade_criterio is null;

comment on column public.vistagem_publicacoes.documento_ids is
  'Ids de documento do PJe citados no texto (ex.: Id. 1c116a7). Mesmo processo + data + Ids = mesma publicação.';
comment on column public.vistagem_publicacoes.duplicidade_criterio is
  'Como a duplicidade foi reconhecida: texto (mesmo despacho sem nomes das partes) ou id_documento.';
