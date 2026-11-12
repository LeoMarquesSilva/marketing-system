-- Confirmação da equipe: quem pode levar 1 acompanhante (1º uso: sócios de área na festa de 10 anos).
-- O acompanhante usa os mesmos campos do convite dos clientes: plus_one, plus_one_name e dietary_info.plusOne.
ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS plus_one_allowed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN event_invites.plus_one_allowed IS
  'Pessoa da equipe que pode levar 1 acompanhante na confirmação de presença (definido pela organização). O convite pessoal dos clientes não depende deste campo.';
