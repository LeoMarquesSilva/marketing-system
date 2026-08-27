-- Pessoa da área responsável por contatar o grupo (definida pelo gestor oficial da área).

ALTER TABLE public.email_client_groups
  ADD COLUMN IF NOT EXISTS area_contact_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_client_groups_area_contact_user_id
  ON public.email_client_groups (area_contact_user_id)
  WHERE area_contact_user_id IS NOT NULL;

COMMENT ON COLUMN public.email_client_groups.area_contact_user_id IS
  'Usuário da área responsável designado pelo gestor oficial para contatar/cadastrar este grupo em Meus Clientes.';
