-- Confirmação de presença dos colaboradores (1º uso: festa de 10 anos, /festa-10-anos).
-- A resposta grava direto no convite do evento: confirmação + uso do micro-ônibus.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rsvp_closes_at timestamptz;

COMMENT ON COLUMN events.rsvp_closes_at IS
  'Prazo da confirmação de presença dos colaboradores (página com login). Nulo = sem confirmação pelo sistema.';

ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS hr_employee_id uuid REFERENCES hr_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transport text
    CHECK (transport IS NULL OR transport IN ('ida_volta', 'so_ida', 'so_volta', 'nao')),
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

COMMENT ON COLUMN event_invites.hr_employee_id IS
  'Colaborador do cadastro do RH (o e-mail do convite pode ser @bpplaw e o do login @bismarchipires).';
COMMENT ON COLUMN event_invites.transport IS
  'Uso do transporte do escritório: ida_volta, so_ida, so_volta ou nao (vai por conta própria).';
COMMENT ON COLUMN event_invites.responded_at IS
  'Quando o próprio colaborador respondeu pela página de confirmação.';

CREATE INDEX IF NOT EXISTS event_invites_hr_employee_idx
  ON event_invites (event_id, hr_employee_id)
  WHERE hr_employee_id IS NOT NULL;

-- Liga os convites de colaborador já existentes ao cadastro do RH pelo nome completo
-- (só quando o nome casa com uma única pessoa).
UPDATE event_invites i
SET hr_employee_id = e.id
FROM hr_employees e
WHERE i.hr_employee_id IS NULL
  AND i.guest_type = 'colaborador'
  AND lower(trim(e.full_name)) = lower(trim(i.name))
  AND (
    SELECT count(*) FROM hr_employees e2 WHERE lower(trim(e2.full_name)) = lower(trim(i.name))
  ) = 1;

-- Festa de 10 anos: responder até 13/11/2026, 23h59 (Brasília).
UPDATE events
SET rsvp_closes_at = '2026-11-13 23:59:59-03'
WHERE year = 2026
  AND name = 'Aniversário Escritório 10 anos'
  AND rsvp_closes_at IS NULL;
