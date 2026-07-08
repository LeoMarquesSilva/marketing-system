-- Dois tipos de encerramento distintos quando inativo

ALTER TABLE email_client_groups
  ADD COLUMN IF NOT EXISTS inativo_encerramento_tipo text
    CHECK (
      inativo_encerramento_tipo IS NULL
      OR inativo_encerramento_tipo IN ('termino_vigencia', 'rescisao_contratual')
    ),
  ADD COLUMN IF NOT EXISTS rescisao_contratual_data date;

COMMENT ON COLUMN email_client_groups.inativo_encerramento_tipo IS
  'Motivo do inativo: término da vigência ou rescisão contratual (opções distintas).';
COMMENT ON COLUMN email_client_groups.rescisao_contratual_data IS
  'Data da rescisão contratual, quando inativo_encerramento_tipo = rescisao_contratual.';

UPDATE email_client_groups
SET inativo_encerramento_tipo = 'termino_vigencia'
WHERE gestor_atividade = 'inativo'
  AND contrato_vigencia_termino IS NOT NULL
  AND inativo_encerramento_tipo IS NULL;

UPDATE email_client_groups
SET inativo_encerramento_tipo = 'rescisao_contratual'
WHERE gestor_atividade = 'inativo'
  AND rescisao_contratual = true
  AND inativo_encerramento_tipo IS NULL;
