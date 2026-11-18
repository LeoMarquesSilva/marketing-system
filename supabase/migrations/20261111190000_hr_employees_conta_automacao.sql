-- Conta de automação no cadastro do RH (ex.: o robô "Fênix Agendador", usuário do VIOS).
-- Ela continua no cadastro e com login, porque as integrações dependem dela, mas não é
-- uma pessoa da equipe: fica fora da festa, das pesquisas, do BP Awards, do Café com
-- Cultura, das boas-vindas e das demais listas de colaboradores.
ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS is_automation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN hr_employees.is_automation IS
  'Conta de automação (robô), não é uma pessoa: fica fora das listas de colaboradores. A sincronização com o VIOS não mexe neste campo.';

UPDATE hr_employees SET is_automation = true WHERE id = 'bbf67cb5-be21-4856-a189-3cb297272ed1';
