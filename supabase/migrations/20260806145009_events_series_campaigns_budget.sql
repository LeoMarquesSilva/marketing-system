-- Eventos: séries recorrentes, campanhas com período e verba aprovada
--
-- Objetivo: permitir comparar o mesmo evento entre anos (base para previsão
-- orçamentária do ano seguinte). Até aqui o único vínculo entre "Dia das Mães
-- 2026" e "Dia das Mães 2027" era o texto do nome, que já divergiu na prática
-- ("Dia do Advogado" → "Dia do Advogado 2026").

-- 1. Séries: a identidade estável do evento através dos anos
CREATE TABLE IF NOT EXISTS event_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_series IS
  'Identidade recorrente de um evento/campanha entre anos. Une as edições anuais para comparação histórica e previsão.';

DROP TRIGGER IF EXISTS trg_event_series_updated_at ON event_series;
CREATE TRIGGER trg_event_series_updated_at
  BEFORE UPDATE ON event_series
  FOR EACH ROW EXECUTE FUNCTION trg_events_updated_at();

-- 2. Novas colunas em events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES event_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'evento'
    CHECK (kind IN ('evento', 'campanha')),
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS budget_approved numeric(12, 2);

COMMENT ON COLUMN events.series_id IS 'Série recorrente à qual esta edição pertence';
COMMENT ON COLUMN events.kind IS 'evento = data pontual; campanha = período (usa event_date..end_date)';
COMMENT ON COLUMN events.end_date IS 'Data final. Só se aplica a campanhas / eventos de vários dias';
COMMENT ON COLUMN events.budget_approved IS 'Teto de verba aprovado para a edição. Comparar com a soma de event_budget_items';

-- Campanha com período precisa terminar depois de começar
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_end_date_after_start;
ALTER TABLE events ADD CONSTRAINT events_end_date_after_start
  CHECK (end_date IS NULL OR event_date IS NULL OR end_date >= event_date);

CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);

-- 3. budget_planned nunca foi gravado pela interface (o formulário enviava NULL
--    fixo) e nenhuma tela o lia. Passa a se chamar budget_approved. A coluna
--    antiga fica para trás por uma versão para não quebrar deploys em voo;
--    remover em migration futura.
UPDATE events SET budget_approved = budget_planned
WHERE budget_planned IS NOT NULL AND budget_approved IS NULL;

COMMENT ON COLUMN events.budget_planned IS
  'DEPRECADO — substituído por budget_approved. Remover após o deploy que para de referenciá-la.';

-- 4. Séries a partir do que já está cadastrado (2025 e 2026)
INSERT INTO event_series (slug, name)
VALUES
  ('aniversario-escritorio',      'Aniversário do Escritório'),
  ('bpm',                         'BPM'),
  ('campanha-mes-empatia',        'Campanha Mês Empatia'),
  ('confraternizacao',            'Confraternização'),
  ('corrida-bp',                  'Corrida BP'),
  ('dia-das-maes',                'Dia das Mães'),
  ('dia-do-advogado',             'Dia do Advogado'),
  ('dia-do-trabalho',             'Dia do Trabalho'),
  ('dia-dos-pais',                'Dia dos Pais'),
  ('dia-internacional-da-mulher', 'Dia Internacional da Mulher'),
  ('festa-junina-bp',             'Festa Junina BP'),
  ('innovation-day',              'Innovation Day'),
  ('novembro-azul',               'Novembro Azul'),
  ('outubro-rosa',                'Outubro Rosa'),
  ('pascoa',                      'Páscoa'),
  ('setembro-amarelo',            'Setembro Amarelo')
ON CONFLICT (slug) DO NOTHING;

-- 5. Vínculo das edições existentes. Mapeamento explícito por nome porque os
--    nomes divergem entre anos (edição no título, contagem de aniversário,
--    erro de digitação propagado nos dois anos).
WITH mapping (event_name, series_slug) AS (
  VALUES
    ('Aniversário Escritório 09 anos', 'aniversario-escritorio'),
    ('Aniversário Escritório 10 anos', 'aniversario-escritorio'),
    ('BPM',                            'bpm'),
    ('Campanha Mês Empatia',           'campanha-mes-empatia'),
    ('Confraternização',               'confraternizacao'),
    ('Corrida BP',                     'corrida-bp'),
    ('Dia das mães',                   'dia-das-maes'),
    ('Dia do Advogado',                'dia-do-advogado'),
    ('Dia do Advogado 2026',           'dia-do-advogado'),
    ('Dia do Trabalho',                'dia-do-trabalho'),
    ('Dia dos pais',                   'dia-dos-pais'),
    ('Dia internacinal  da Mulher',    'dia-internacional-da-mulher'),
    ('Festa Junina BP',                'festa-junina-bp'),
    ('Innovation Day 2° Edição',       'innovation-day'),
    ('Outubro Rosa',                   'outubro-rosa'),
    ('Novembro Azul',                  'novembro-azul'),
    ('Páscoa',                         'pascoa'),
    ('Setembro Amarelo',               'setembro-amarelo')
)
UPDATE events e
SET series_id = s.id
FROM mapping m
JOIN event_series s ON s.slug = m.series_slug
WHERE e.name = m.event_name
  AND e.series_id IS NULL;

-- Classificação como campanha só onde o próprio nome já diz. Os "meses"
-- (Setembro Amarelo, Outubro Rosa, Novembro Azul) ficam como evento — a
-- reclassificação é um clique na interface e não cabe adivinhar aqui.
UPDATE events SET kind = 'campanha' WHERE name = 'Campanha Mês Empatia';

-- 6. RLS
ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler event_series"
  ON event_series FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_series"
  ON event_series FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_series"
  ON event_series FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_series"
  ON event_series FOR DELETE TO authenticated USING (true);
