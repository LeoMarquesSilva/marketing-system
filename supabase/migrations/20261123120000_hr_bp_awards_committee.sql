-- BP Awards: quem é o comitê.
--
-- Até aqui, qualquer pessoa com acesso ao RH (ou admin) abria /rh/bp-awards e
-- via apuração, finalistas e vencedores, inclusive indicados. Agora, se a lista
-- estiver preenchida, só os usuários dela abrem o comitê, o telão e as rotas
-- de apuração, configuração e finalistas. Vazia = regra antiga (quem tem RH).

alter table public.hr_award_editions
  add column if not exists committee_user_ids uuid[] not null default '{}';

comment on column public.hr_award_editions.committee_user_ids is
  'Usuários (users.id) do comitê do BP Awards. Preenchida: só eles abrem /rh/bp-awards, a revelação e as rotas do comitê.';
