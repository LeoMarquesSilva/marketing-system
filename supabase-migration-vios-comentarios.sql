-- Adiciona coluna comentarios na tabela vios_tasks (relatório VIOS - coluna "Comentários")
ALTER TABLE vios_tasks ADD COLUMN IF NOT EXISTS comentarios TEXT;
