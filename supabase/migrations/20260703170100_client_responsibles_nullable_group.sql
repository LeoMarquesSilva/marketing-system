-- Nem toda empresa/pessoa do SIOE tem um grupo_cliente preenchido; permite registrar
-- a responsabilidade (área/advogado) mesmo sem grupo associado.
ALTER TABLE email_group_responsibles ALTER COLUMN client_group_id DROP NOT NULL;
