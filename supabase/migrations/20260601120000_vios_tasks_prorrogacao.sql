ALTER TABLE vios_tasks
  ADD COLUMN IF NOT EXISTS prorrogada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_limite_anterior date;

COMMENT ON COLUMN vios_tasks.prorrogada IS 'Tarefa teve prazo prorrogado no VIOS (histórico ou mudança de data_limite no sync)';
COMMENT ON COLUMN vios_tasks.data_limite_anterior IS 'Prazo anterior à prorrogação, quando conhecido';

UPDATE vios_tasks
SET prorrogada = true
WHERE historico ILIKE '%PRORROG%'
  AND prorrogada = false;

-- Prazo anterior a partir do histórico (quando disponível)
UPDATE vios_tasks
SET data_limite_anterior = to_date(
  regexp_replace(historico, '.*alterada de (\d{1,2}/\d{1,2}).*', '\1') || '/' || extract(year FROM data_limite)::text,
  'DD/MM/YYYY'
)
WHERE prorrogada = true
  AND data_limite_anterior IS NULL
  AND historico ~* 'alterada de \d{1,2}/\d{1,2}'
  AND data_limite IS NOT NULL;
