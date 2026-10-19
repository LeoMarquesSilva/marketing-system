-- Campanhas do planner cujas peças vão para perfis de terceiros (ex.: "[OAB]",
-- posts do Congresso da OAB Campinas). Ao concluir um post/reel com uma dessas
-- tags no título, a conclusão vira "Postagem em outro canal": a peça não entra no
-- Banco de conteúdo nem nas Postagens da equipe, que são do Instagram do escritório.

create table if not exists public.planner_external_tags (
  tag text primary key check (tag = upper(tag)),
  note text,
  created_at timestamptz not null default now()
);

alter table public.planner_external_tags enable row level security;

drop policy if exists "Authenticated users read planner external tags" on public.planner_external_tags;
create policy "Authenticated users read planner external tags"
  on public.planner_external_tags for select to authenticated
  using (true);

insert into public.planner_external_tags (tag, note)
values ('OAB', '3º Congresso de Direito Recuperacional, Falimentar e Empresarial da OAB Campinas (28/10/2026): peças publicadas pelos perfis da OAB e das comissões.')
on conflict (tag) do nothing;

create or replace function public.planner_external_tag_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_stage = 'concluido'
     and new.request_type in ('Post Redes Sociais', 'Reel Redes Sociais')
     and coalesce(new.completion_type, 'design_concluido') not in ('postagem_externa', 'conteudo_entregue')
     and exists (
       select 1
         from public.planner_external_tags t
        where t.tag = upper(substring(new.title from '^\s*\[([^\]]+)\]'))
     ) then
    new.completion_type := 'postagem_externa';
  end if;
  return new;
end;
$$;

revoke execute on function public.planner_external_tag_completion() from public, anon, authenticated;

drop trigger if exists trg_planner_external_tag_completion on public.marketing_requests;
create trigger trg_planner_external_tag_completion
  before insert or update of workflow_stage, completion_type, title, request_type
  on public.marketing_requests
  for each row execute function public.planner_external_tag_completion();

-- Peças [OAB] já concluídas como "Design concluído" saem do Banco de conteúdo.
update public.marketing_requests
   set completion_type = 'postagem_externa'
 where workflow_stage = 'concluido'
   and request_type in ('Post Redes Sociais', 'Reel Redes Sociais')
   and coalesce(completion_type, 'design_concluido') not in ('postagem_externa', 'conteudo_entregue')
   and upper(substring(title from '^\s*\[([^\]]+)\]')) in (select tag from public.planner_external_tags);
