-- NFC Hub: políticas explícitas para tabelas server-only e índices de FKs.

create policy "nfc service role manages scans"
on public.nfc_tag_scans
for all
to service_role
using (true)
with check (true);

create policy "nfc service role manages executions"
on public.nfc_action_executions
for all
to service_role
using (true)
with check (true);

create policy "nfc service role manages form submissions"
on public.nfc_form_submissions
for all
to service_role
using (true)
with check (true);

create policy "nfc service role manages audit logs"
on public.nfc_tag_audit_logs
for all
to service_role
using (true)
with check (true);

create index if not exists nfc_form_submissions_scan_id_idx
on public.nfc_form_submissions(scan_id);

create index if not exists nfc_form_submissions_submitted_by_idx
on public.nfc_form_submissions(submitted_by);

create index if not exists nfc_tag_allowed_users_user_id_idx
on public.nfc_tag_allowed_users(user_id);

create index if not exists nfc_tag_audit_logs_actor_user_id_idx
on public.nfc_tag_audit_logs(actor_user_id);

create index if not exists nfc_tag_scans_authenticated_user_id_idx
on public.nfc_tag_scans(authenticated_user_id);

create index if not exists nfc_tags_created_by_idx
on public.nfc_tags(created_by);

create index if not exists nfc_tags_responsible_user_id_idx
on public.nfc_tags(responsible_user_id);

create index if not exists nfc_templates_created_by_idx
on public.nfc_templates(created_by);
