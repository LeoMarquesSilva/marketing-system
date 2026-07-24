-- NFC Hub: corrige modelos com texto corrompido, adiciona formulários
-- do Café com Cultura e controla retirada/devolução de itens compartilhados.

alter table public.nfc_tags
  drop constraint if exists nfc_tags_action_type_check;

alter table public.nfc_tags
  add constraint nfc_tags_action_type_check
  check (
    action_type in (
      'url', 'custom_page', 'form', 'webhook', 'whatsapp',
      'menu', 'sequence', 'asset_loan'
    )
  );

alter table public.nfc_templates
  drop constraint if exists nfc_templates_action_type_check;

alter table public.nfc_templates
  add constraint nfc_templates_action_type_check
  check (
    action_type in (
      'url', 'custom_page', 'form', 'webhook', 'whatsapp',
      'menu', 'sequence', 'asset_loan'
    )
  );

create table if not exists public.nfc_asset_loans (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete restrict,
  asset_number text not null check (char_length(asset_number) between 1 and 80),
  borrower_user_id uuid not null references public.users(id) on delete restrict,
  checked_out_by uuid not null references public.users(id) on delete restrict,
  checked_out_at timestamptz not null default now(),
  checkout_scan_id uuid references public.nfc_tag_scans(id) on delete set null,
  returned_at timestamptz,
  returned_by uuid references public.users(id) on delete set null,
  return_scan_id uuid references public.nfc_tag_scans(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nfc_asset_loans_return_consistency_check
    check (
      (returned_at is null and returned_by is null and return_scan_id is null)
      or returned_at is not null
    )
);

create unique index if not exists nfc_asset_loans_one_open_per_item_idx
on public.nfc_asset_loans(tag_id, lower(asset_number))
where returned_at is null;

create index if not exists nfc_asset_loans_tag_history_idx
on public.nfc_asset_loans(tag_id, checked_out_at desc);

create index if not exists nfc_asset_loans_borrower_idx
on public.nfc_asset_loans(borrower_user_id, returned_at);

create index if not exists nfc_asset_loans_checked_out_by_idx
on public.nfc_asset_loans(checked_out_by);

create index if not exists nfc_asset_loans_returned_by_idx
on public.nfc_asset_loans(returned_by)
where returned_by is not null;

create index if not exists nfc_asset_loans_checkout_scan_idx
on public.nfc_asset_loans(checkout_scan_id)
where checkout_scan_id is not null;

create index if not exists nfc_asset_loans_return_scan_idx
on public.nfc_asset_loans(return_scan_id)
where return_scan_id is not null;

alter table public.nfc_asset_loans enable row level security;

revoke all on public.nfc_asset_loans from public, anon, authenticated;
grant select, insert, update, delete on public.nfc_asset_loans to service_role;

drop policy if exists "nfc service role manages asset loans" on public.nfc_asset_loans;
create policy "nfc service role manages asset loans"
on public.nfc_asset_loans
for all
to service_role
using (true)
with check (true);

-- Os modelos originais foram inseridos por um cliente que corrompeu caracteres
-- UTF-8. Tags já criadas não são afetadas porque recebem uma cópia do modelo.
delete from public.nfc_templates
where is_system = true;

insert into public.nfc_templates
  (name, description, category, action_type, action_config, is_system)
values
  (
    'Abrir ticket de equipamento',
    'Formulário rápido para registrar um problema e acionar o fluxo responsável.',
    'Equipamento',
    'form',
    '{"title":"Abrir ticket","description":"Conte o que aconteceu com o equipamento.","fields":[{"id":"problema","label":"Descreva o problema","type":"long_text","required":true}],"workflowKey":"abrir-ticket-equipamento"}',
    true
  ),
  (
    'Solicitar reposição de estoque',
    'Registra uma solicitação de reposição vinculada ao item físico.',
    'Estoque',
    'form',
    '{"title":"Solicitar reposição","fields":[{"id":"quantidade","label":"Quantidade necessária","type":"number","required":true}],"workflowKey":"reposicao-estoque"}',
    true
  ),
  (
    'Check-in em evento',
    'Confirma presença por meio de uma página simples.',
    'Evento',
    'form',
    '{"title":"Check-in","fields":[{"id":"nome","label":"Seu nome","type":"short_text","required":true}],"workflowKey":"checkin-evento"}',
    true
  ),
  (
    'Registrar presença em treinamento',
    'Registra presença e horário do participante.',
    'Evento',
    'form',
    '{"title":"Registrar presença","fields":[{"id":"nome","label":"Nome","type":"short_text","required":true}],"workflowKey":"presenca-treinamento"}',
    true
  ),
  (
    'Abrir material de reunião',
    'Abre uma URL de pauta, apresentação ou documentos.',
    'Marketing',
    'url',
    '{"destinationUrl":"https://","openImmediately":true}',
    true
  ),
  (
    'Capturar ideia de Marketing',
    'Formulário curto para registrar uma ideia no momento em que surgir.',
    'Marketing',
    'form',
    '{"title":"Nova ideia","fields":[{"id":"ideia","label":"Descreva sua ideia","type":"long_text","required":true}],"workflowKey":"capturar-ideia-marketing"}',
    true
  ),
  (
    'Registrar retirada de equipamento',
    'Solicita identificação e confirmação antes do registro.',
    'Equipamento',
    'form',
    '{"title":"Retirada de equipamento","fields":[{"id":"responsavel","label":"Responsável","type":"short_text","required":true}],"workflowKey":"retirada-equipamento","sensitive":true}',
    true
  ),
  (
    'Abrir lista de compras',
    'Atalho permanente para uma lista compartilhada.',
    'Automação pessoal',
    'url',
    '{"destinationUrl":"https://","openImmediately":true}',
    true
  ),
  (
    'Iniciar rotina pessoal',
    'Aciona um fluxo previamente configurado no n8n.',
    'Automação pessoal',
    'webhook',
    '{"workflowKey":"iniciar-rotina-pessoal","requireConfirmation":true}',
    true
  ),
  (
    'Enviar formulário de feedback',
    'Coleta uma avaliação e comentários opcionais.',
    'Marketing',
    'form',
    '{"title":"Feedback","fields":[{"id":"nota","label":"Nota","type":"number","required":true},{"id":"comentario","label":"Comentário","type":"long_text","required":false}]}',
    true
  ),
  (
    'Abrir URL simples',
    'Redireciona para uma URL HTTPS configurada.',
    'Outro',
    'url',
    '{"destinationUrl":"https://","openImmediately":true}',
    true
  ),
  (
    'Chamar fluxo do n8n',
    'Executa um workflow seguro identificado por chave.',
    'Automação',
    'webhook',
    '{"workflowKey":"meu-fluxo","requireConfirmation":true}',
    true
  ),
  (
    'Café com Cultura — Confirmar presença',
    'Confirma a participação, identifica o colaborador e registra restrições alimentares.',
    'Café com Cultura',
    'form',
    '{"title":"Café com Cultura","description":"Confirme sua participação no próximo encontro.","fields":[{"id":"colaborador","label":"Colaborador","type":"user_select","required":true},{"id":"confirmacao","label":"Você participará?","type":"select","required":true,"options":["Sim, confirmo minha presença","Não poderei participar"]},{"id":"restricoes","label":"Restrição alimentar ou observação","type":"long_text","required":false}],"successMessage":"Sua resposta para o Café com Cultura foi registrada. Obrigado!"}',
    true
  ),
  (
    'Café com Cultura — Check-in',
    'Registra a chegada dos colaboradores ao encontro.',
    'Café com Cultura',
    'form',
    '{"title":"Check-in — Café com Cultura","description":"Que bom ter você por aqui. Selecione seu nome para confirmar a chegada.","fields":[{"id":"colaborador","label":"Colaborador","type":"user_select","required":true}],"successMessage":"Check-in confirmado. Aproveite o Café com Cultura!"}',
    true
  ),
  (
    'Café com Cultura — Feedback',
    'Coleta uma avaliação rápida e sugestões para a próxima edição.',
    'Café com Cultura',
    'form',
    '{"title":"Feedback — Café com Cultura","description":"Sua opinião ajuda a deixar os próximos encontros ainda melhores.","fields":[{"id":"colaborador","label":"Colaborador","type":"user_select","required":true},{"id":"avaliacao","label":"Como foi o encontro?","type":"select","required":true,"options":["Excelente","Muito bom","Bom","Pode melhorar"]},{"id":"proximo_tema","label":"Que tema você gostaria de ver na próxima edição?","type":"long_text","required":false}],"successMessage":"Feedback recebido. Obrigado por construir esse encontro com a gente!"}',
    true
  ),
  (
    'Guarda-chuvas — Retirada e devolução',
    'Controla o empréstimo por número, colaborador e devolução do guarda-chuva.',
    'Equipamento',
    'asset_loan',
    '{"title":"Guarda-chuvas compartilhados","description":"Registre a retirada ou a devolução de um guarda-chuva.","assetLabel":"Guarda-chuva","assetNumberLabel":"Número do guarda-chuva","checkoutMessage":"Retirada registrada. Cuide bem do nosso guarda-chuva!","returnMessage":"Devolução registrada. Obrigado por trazer o guarda-chuva de volta!","requireConfirmation":true,"sensitive":true}',
    true
  );
