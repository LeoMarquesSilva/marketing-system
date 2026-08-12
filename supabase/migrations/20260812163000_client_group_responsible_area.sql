-- Área jurídica dona do cliente em Meus Clientes (NPS, cadastro, convites).
-- Quando preenchida, só gestores dessa área enxergam o grupo; as demais áreas do SIOE deixam de ver.

ALTER TABLE public.email_client_groups
  ADD COLUMN IF NOT EXISTS responsible_area text;

CREATE INDEX IF NOT EXISTS idx_email_client_groups_responsible_area
  ON public.email_client_groups (responsible_area)
  WHERE responsible_area IS NOT NULL;

COMMENT ON COLUMN public.email_client_groups.responsible_area IS
  'Área jurídica responsável pelo cliente em Meus Clientes. Quando preenchida, só gestores dessa área veem o grupo.';
