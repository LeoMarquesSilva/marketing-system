-- Atualização da ficha cadastral pelo próprio colaborador (com login).
--
-- Quem já está no escritório entra em /minha-ficha, vê a ficha do seu vínculo
-- pré-preenchida com o que o RH já tem e completa o que falta. O envio vira
-- uma ficha "recebida" já vinculada ao colaborador e a RH revisa como as de
-- admissão. Sem link público: token e prazo ficam nulos (a sessão é a
-- credencial), e a ficha nunca abre pelo /ficha-cadastral/<token>.

alter table public.hr_registration_forms
  add column if not exists origin text not null default 'admissao';

alter table public.hr_registration_forms
  drop constraint if exists hr_registration_forms_origin_check;
alter table public.hr_registration_forms
  add constraint hr_registration_forms_origin_check
  check (origin in ('admissao', 'atualizacao'));

-- Prestador de serviço e "sem vínculo definido" (colaborador sem tipo no VIOS).
alter table public.hr_registration_forms
  drop constraint if exists hr_registration_forms_employment_kind_check;
alter table public.hr_registration_forms
  add constraint hr_registration_forms_employment_kind_check
  check (employment_kind in ('clt', 'estagio', 'socio_servico', 'prestador', 'geral'));

alter table public.hr_registration_forms alter column token drop not null;
alter table public.hr_registration_forms alter column expires_at drop not null;

-- Link público sempre tem prazo; ficha sem link precisa estar vinculada a alguém.
alter table public.hr_registration_forms
  drop constraint if exists hr_registration_forms_access_check;
alter table public.hr_registration_forms
  add constraint hr_registration_forms_access_check
  check (
    (token is null) = (expires_at is null)
    and (token is not null or employee_id is not null)
  );

comment on column public.hr_registration_forms.origin is
  'admissao = link público da RH; atualizacao = enviada pelo colaborador logado em /minha-ficha.';
comment on table public.hr_registration_forms is
  'Ficha cadastral (admissão por link público ou atualização com login); leitura só RH.';
