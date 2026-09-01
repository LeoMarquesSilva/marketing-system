-- Documento vivo que explica o posicionamento pessoal de Gustavo Bismarchi.
-- Uma única linha concentra a estratégia apresentada e utilizada pelo motor editorial.

create table if not exists public.gustavo_content_strategy (
  id text primary key default 'main' check (id = 'main'),
  positioning text not null,
  editorial_promise text not null,
  strategic_rationale text not null,
  icp text[] not null default '{}',
  icp_context text not null default '',
  content_pillars jsonb not null default '[]'::jsonb,
  channel_roles jsonb not null default '[]'::jsonb,
  editorial_principles text[] not null default '{}',
  avoidances text[] not null default '{}',
  success_signals text[] not null default '{}',
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists gustavo_content_strategy_set_updated_at
  on public.gustavo_content_strategy;
create trigger gustavo_content_strategy_set_updated_at
before update on public.gustavo_content_strategy
for each row execute function public.set_gustavo_content_updated_at();

insert into public.gustavo_content_strategy (
  id,
  positioning,
  editorial_promise,
  strategic_rationale,
  icp,
  icp_context,
  content_pillars,
  channel_roles,
  editorial_principles,
  avoidances,
  success_signals
)
values (
  'main',
  'Ser reconhecido como uma fonte confiável de interpretação sobre empresas em crise, reestruturação, dívida e preservação de valor.',
  'Gustavo não explica simplesmente recuperação judicial. Ele explica o que crises e reestruturações revelam sobre empresas.',
  'O mercado já recebe notícias e explicações jurídicas. O espaço de autoridade está em conectar fatos a decisões, sinais, riscos e consequências que importam para quem administra capital e empresas.',
  array['Empresários', 'Sócios e fundadores', 'CEOs', 'CFOs', 'Conselheiros', 'Executivos', 'Investidores'],
  'Decisores de empresas relevantes, prioritariamente com faturamento a partir de aproximadamente R$ 5 milhões, que enfrentam ou querem antecipar tensões de liquidez, dívida, governança e continuidade.',
  '[
    {"title":"Crise antes do processo","description":"Ler os sinais empresariais que aparecem antes da medida jurídica.","reason":"Autoridade nasce ao ajudar o decisor a reconhecer o problema cedo, quando ainda existem mais opções."},
    {"title":"Decisões sob pressão","description":"Explicar trade-offs de caixa, dívida, credores, ativos e governança.","reason":"O ICP se identifica com escolhas reais, não com aulas abstratas sobre procedimentos."},
    {"title":"Preservação de valor","description":"Mostrar quando tempo, negociação e instrumentos protegem ou destroem valor.","reason":"Conecta a especialidade jurídica ao resultado empresarial sem fazer promessa comercial."},
    {"title":"Teses e contrapontos","description":"Oferecer leituras menos óbvias sobre casos conhecidos.","reason":"Diferencia Gustavo de perfis que apenas resumem a notícia ou repetem consenso."}
  ]'::jsonb,
  '[
    {"channel":"LinkedIn","role":"Construir autoridade por meio de análises completas, teses e contexto executivo.","reason":"É o ambiente principal para alcançar decisores e sustentar raciocínios com maior profundidade."},
    {"channel":"Instagram Reel","role":"Traduzir uma ideia central em explicação direta, humana e memorável.","reason":"Amplia familiaridade e alcance sem transformar Gustavo em um influenciador jurídico genérico."}
  ]'::jsonb,
  array[
    'A notícia é matéria-prima, não o conteúdo final',
    'O jurídico sustenta a análise, mas não precisa ser sempre o centro',
    'Opinião só entra quando estiver registrada ou validada pelo Gustavo',
    'Todo conteúdo deve entregar uma implicação para quem decide',
    'Sobriedade e clareza valem mais do que volume e viralização'
  ],
  array[
    'Resumo de notícia',
    'Juridiquês sem consequência empresarial',
    'CTA comercial ou promessa de resultado',
    'Tom professoral, sensacionalista ou de copywriter',
    'Opinião inventada pela IA'
  ],
  array[
    'Reconhecimento espontâneo do Gustavo como referência no tema',
    'Conversas estratégicas qualificadas com decisores',
    'Consistência de teses ao longo do tempo',
    'Conteúdos lembrados pela interpretação, não apenas pela notícia',
    'Aumento da participação direta do Gustavo na construção das opiniões'
  ]
)
on conflict (id) do nothing;

alter table public.gustavo_content_strategy enable row level security;

revoke all on public.gustavo_content_strategy from anon, public;
grant select on public.gustavo_content_strategy to authenticated, service_role;
grant insert, update, delete on public.gustavo_content_strategy to service_role;

create policy "gustavo_content_strategy_select"
on public.gustavo_content_strategy for select to authenticated
using ((select public.has_gustavo_content_access()));

comment on table public.gustavo_content_strategy is
  'Documento vivo de posicionamento, ICP e racional editorial do módulo Gustavo.';
