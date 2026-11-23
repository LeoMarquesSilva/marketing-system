-- Pauta de Audiências: conferência automática com o VIOS pela cópia das tarefas no SAMA (vios_tarefas).
-- vios_conferido_em = quando o SAMA copiou o VIOS usado na última conferência desta audiência. Separa "não há
-- tarefa de audiência no VIOS" (conferida, sem vios_tarefa_ci) de "ainda não conferida", e deixa o "Conferido no
-- VIOS" feito depois da cópia valer até chegar uma cópia mais nova. vios_tarefa_ci já existe (20261118190000).
alter table public.aud_audiencias add column if not exists vios_conferido_em timestamptz;
