-- Allow professional_profile as NFC tag/template action type

alter table public.nfc_tags
  drop constraint if exists nfc_tags_action_type_check;

alter table public.nfc_tags
  add constraint nfc_tags_action_type_check
  check (
    action_type in (
      'url', 'custom_page', 'form', 'webhook', 'whatsapp',
      'menu', 'sequence', 'asset_loan', 'professional_profile'
    )
  );

alter table public.nfc_templates
  drop constraint if exists nfc_templates_action_type_check;

alter table public.nfc_templates
  add constraint nfc_templates_action_type_check
  check (
    action_type in (
      'url', 'custom_page', 'form', 'webhook', 'whatsapp',
      'menu', 'sequence', 'asset_loan', 'professional_profile'
    )
  );
