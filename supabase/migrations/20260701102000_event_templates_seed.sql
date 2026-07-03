-- Seed de templates de eventos

INSERT INTO event_templates (slug, name, description)
VALUES
  ('evento_interno_simples', 'Evento interno simples', 'Template para encontros internos de baixa complexidade'),
  ('evento_comemorativo', 'Evento comemorativo', 'Template para datas comemorativas e ações de engajamento'),
  ('evento_grande', 'Evento grande', 'Template para eventos com maior porte e múltiplos fornecedores'),
  ('evento_externo', 'Evento externo', 'Template para eventos externos ao escritório'),
  ('treinamento', 'Treinamento', 'Template para treinamentos internos e externos')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();

WITH tpl AS (
  SELECT id, slug
  FROM event_templates
  WHERE slug IN (
    'evento_interno_simples',
    'evento_comemorativo',
    'evento_grande',
    'evento_externo',
    'treinamento'
  )
)
INSERT INTO event_template_tasks (template_id, title, description, offset_days, phase, sort_order)
SELECT t.id, x.title, x.description, x.offset_days, x.phase, x.sort_order
FROM tpl t
JOIN (
  VALUES
    -- interno simples
    ('evento_interno_simples', 'Definir objetivo e escopo', 'Alinhar objetivo do evento com liderança', 60, 'pre_evento', 10),
    ('evento_interno_simples', 'Reservar local e data', 'Confirmar local e capacidade', 30, 'pre_evento', 20),
    ('evento_interno_simples', 'Enviar comunicação interna', 'Publicar aviso nos canais internos', 7, 'pre_evento', 30),
    ('evento_interno_simples', 'Executar evento', 'Condução da agenda e check-in', 0, 'dia_evento', 40),

    -- comemorativo
    ('evento_comemorativo', 'Definir conceito da campanha', 'Tema, objetivo e mensagem', 60, 'pre_evento', 10),
    ('evento_comemorativo', 'Solicitar brindes e materiais', 'Cotação e aprovação inicial', 30, 'pre_evento', 20),
    ('evento_comemorativo', 'Divulgar nas redes internas', 'Planejamento de comunicação', 7, 'pre_evento', 30),
    ('evento_comemorativo', 'Realizar ação comemorativa', 'Execução no dia do evento', 0, 'dia_evento', 40),

    -- evento grande
    ('evento_grande', 'Kickoff com stakeholders', 'Definir escopo, budget e governança', 60, 'pre_evento', 10),
    ('evento_grande', 'Fechar fornecedores críticos', 'Local, buffet, audiovisual', 45, 'pre_evento', 20),
    ('evento_grande', 'Plano de comunicação completo', 'Interno, externo e convites', 30, 'pre_evento', 30),
    ('evento_grande', 'Checklist final de execução', 'Validação operacional final', 7, 'pre_evento', 40),
    ('evento_grande', 'Operação do evento', 'Execução e contingência', 0, 'dia_evento', 50),
    ('evento_grande', 'Coletar feedback e fechamento', 'Pós-evento e lições aprendidas', -2, 'pos_evento', 60),

    -- externo
    ('evento_externo', 'Definir objetivo comercial', 'Público e meta de relacionamento', 60, 'pre_evento', 10),
    ('evento_externo', 'Formalizar fornecedores e logística', 'Espaço, deslocamento e materiais', 30, 'pre_evento', 20),
    ('evento_externo', 'Comunicar convidados externos', 'Confirmação e lembretes', 7, 'pre_evento', 30),
    ('evento_externo', 'Realizar evento externo', 'Cobertura e operação local', 0, 'dia_evento', 40),

    -- treinamento
    ('treinamento', 'Definir trilha e instrutor', 'Conteúdo, carga horária e formato', 60, 'pre_evento', 10),
    ('treinamento', 'Configurar materiais e sala', 'Apostilas, recursos e lista de presença', 30, 'pre_evento', 20),
    ('treinamento', 'Confirmar participantes', 'Convites e lembretes', 7, 'pre_evento', 30),
    ('treinamento', 'Realizar treinamento', 'Execução e coleta de feedback', 0, 'dia_evento', 40)
) AS x(slug, title, description, offset_days, phase, sort_order)
  ON x.slug = t.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM event_template_tasks ett
  WHERE ett.template_id = t.id
    AND ett.title = x.title
);
