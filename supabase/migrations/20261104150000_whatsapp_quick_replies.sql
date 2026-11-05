-- Respostas prontas do atendimento do WhatsApp ("/" no campo de mensagem).
-- O texto inicial vem do Manual de atendimento (04/11/2026). A equipe edita
-- pela tela; a IA do "Sugerir resposta" lê as mesmas respostas.
create table if not exists public.whatsapp_quick_replies (
  id uuid primary key default gen_random_uuid(),
  shortcut text not null,
  title text not null,
  category text not null default 'outros',
  body text not null,
  sort_order integer not null default 0,
  use_count integer not null default 0,
  last_used_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_quick_replies_shortcut_format check (shortcut ~ '^[a-z0-9_-]{1,30}$')
);

create unique index if not exists whatsapp_quick_replies_shortcut_key
  on public.whatsapp_quick_replies (shortcut) where active;

-- Sem policies: só as rotas do servidor (service role) leem e gravam.
alter table public.whatsapp_quick_replies enable row level security;

comment on table public.whatsapp_quick_replies is
  'Respostas prontas do atendimento do WhatsApp. {saudacao}, {nome} e {atendente} são preenchidos na hora; [colchetes] o atendente completa.';

create or replace function public.whatsapp_quick_reply_used(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.whatsapp_quick_replies
     set use_count = use_count + 1, last_used_at = now()
   where id = p_id;
$$;

revoke all on function public.whatsapp_quick_reply_used(uuid) from public, anon, authenticated;

insert into public.whatsapp_quick_replies (shortcut, title, category, sort_order, body)
select v.shortcut, v.title, v.category, v.sort_order, v.body
from (values
  ('ola', 'Primeira resposta', 'primeiro_contato', 10,
   E'{saudacao}, {nome}! Meu nome é {atendente}, do Bismarchi | Pires. Em que posso ajudar?'),
  ('triagem', 'Lead do anúncio (triagem)', 'primeiro_contato', 20,
   E'{saudacao}, {nome}! Obrigado pelo contato. Meu nome é {atendente}, do Bismarchi | Pires.\n\nPara eu direcionar melhor, pode me contar:\n1. Qual é o nome da empresa?\n2. Quantos colaboradores ela tem, aproximadamente?\n3. Qual assunto você quer tratar?'),
  ('site', 'Veio pelo site', 'primeiro_contato', 30,
   E'{saudacao}, {nome}! Sou {atendente}, do Bismarchi | Pires. Me conta em poucas linhas o que está acontecendo e se é para você ou para uma empresa, que eu já te direciono ao especialista.'),
  ('demora', 'Desculpas pela demora', 'primeiro_contato', 40,
   E'{saudacao}, {nome}! Desculpe a demora no retorno.'),
  ('fora', 'Fora do horário', 'primeiro_contato', 50,
   E'Olá, {nome}! Recebemos sua mensagem e respondemos a partir das [horário].'),
  ('pf', 'Atende pessoa física?', 'duvidas', 10,
   E'Atendemos, sim, dependendo do assunto. Pode me contar do que se trata? Assim vejo qual área do escritório cuida disso.'),
  ('local', 'Onde fica o escritório', 'duvidas', 20,
   E'Somos de Campinas, mas atendemos no Brasil todo.'),
  ('valor', 'Quanto custa', 'duvidas', 30,
   E'O valor depende do caso, e quem passa a proposta é o advogado da área depois de entender a situação. Vou encaminhar seu contato para ele te chamar.'),
  ('empresa', 'Empresa ou pessoa física', 'qualificacao', 10,
   E'Para eu direcionar melhor: o atendimento é para você ou para uma empresa? Se for empresa, qual é o nome e quantos colaboradores ela tem, aproximadamente?'),
  ('resumo', 'Pedir um resumo do caso', 'qualificacao', 20,
   E'Pode me contar em poucas linhas o que está acontecendo? Assim já te direciono ao advogado certo.'),
  ('cobranca', 'Cobrar ou ser cobrado', 'qualificacao', 30,
   E'Para eu entender melhor: você pretende cobrar uma dívida ou está sendo cobrado?'),
  ('urgencia', 'Tem prazo correndo?', 'qualificacao', 40,
   E'Tem algum prazo correndo, citação recebida, bloqueio de conta ou audiência marcada?'),
  ('encaminhar', 'Encaminhado ao advogado', 'encaminhamento', 10,
   E'Obrigado, {nome}! Estou enviando seu contato para [advogado], da área [área], que vai te chamar por aqui para entender o caso e marcar uma conversa.'),
  ('urgente', 'Caso urgente', 'encaminhamento', 20,
   E'Entendi a urgência, {nome}. Já estou passando seu caso agora para [advogado], da área [área], que vai te chamar ainda hoje.'),
  ('advogado', 'Quer falar com um advogado', 'encaminhamento', 30,
   E'Vou avisar [advogado] agora. Para ele te retornar, pode me dizer seu nome e o assunto?'),
  ('processo', 'Outro escritório ou banco', 'terceiros', 10,
   E'Obrigado pelo contato. Para tratar desse processo, por favor fale com o advogado responsável pelo contato abaixo 👇'),
  ('recuperacao', 'Credor em recuperação', 'terceiros', 20,
   E'Para assuntos da recuperação de [empresa], por favor fale com a equipe de Reestruturação pelo contato abaixo 👇'),
  ('curriculo', 'Currículo ou estágio', 'outros', 10,
   E'Obrigado pelo interesse em fazer parte da equipe! Vou encaminhar seu currículo para o nosso RH.'),
  ('fornecedor', 'Fornecedor ou proposta', 'outros', 20,
   E'Obrigado pelo contato. Vamos analisar internamente e, se houver interesse, retornamos por aqui.')
) as v(shortcut, title, category, sort_order, body)
where not exists (
  select 1 from public.whatsapp_quick_replies q where q.shortcut = v.shortcut and q.active
);
