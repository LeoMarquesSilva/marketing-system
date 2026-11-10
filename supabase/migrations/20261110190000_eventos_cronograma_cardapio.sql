-- Eventos: cronograma do dia (com versões), cardápio de comidas e bebidas e degustações.

-- Versões do cronograma. Só uma por evento é a oficial ("a que vamos usar").
CREATE TABLE IF NOT EXISTS event_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  summary text,
  is_official boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_schedules_event_idx ON event_schedules (event_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS event_schedules_official_idx ON event_schedules (event_id) WHERE is_official;

-- Blocos do cronograma. Horário em texto "HH:MM" porque a festa atravessa a meia-noite.
CREATE TABLE IF NOT EXISTS event_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES event_schedules(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_time text NOT NULL CHECK (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text NOT NULL CHECK (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'outro'
    CHECK (kind IN ('dj', 'fala', 'premiacao', 'show', 'outro')),
  note text,
  removed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_schedule_items_schedule_idx ON event_schedule_items (schedule_id, sort_order);

COMMENT ON COLUMN event_schedule_items.removed IS
  'Bloco retirado do roteiro: continua na lista, riscado, para ficar registrado o que saiu.';

-- Cardápio: comidas e bebidas, por seção (estação gourmet, jantar, drinks…).
CREATE TABLE IF NOT EXISTS event_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_type text NOT NULL CHECK (menu_type IN ('comida', 'bebida')),
  section text NOT NULL,
  name text NOT NULL,
  note text,
  highlight boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'aprovado' CHECK (status IN ('aprovado', 'em_analise')),
  vendor_name text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_menu_items_event_idx ON event_menu_items (event_id, menu_type, sort_order);

-- Degustações: quando, onde e quem vai (ou foi).
CREATE TABLE IF NOT EXISTS event_tastings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_type text NOT NULL CHECK (menu_type IN ('comida', 'bebida')),
  vendor_name text NOT NULL,
  tasting_date date,
  tasting_time text CHECK (tasting_time IS NULL OR tasting_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  location text,
  link_url text,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada')),
  result_note text,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_tastings_event_idx ON event_tastings (event_id, tasting_date);

COMMENT ON COLUMN event_tastings.participants IS
  'Lista de {name, userId, status: confirmado|a_confirmar, note}. userId liga à foto da pessoa.';

-- Mesmo acesso das outras tabelas do módulo de eventos.
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['event_schedules', 'event_schedule_items', 'event_menu_items', 'event_tastings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem ler %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem inserir %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem atualizar %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem deletar %1$s" ON %1$I', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem ler %1$s" ON %1$I FOR SELECT TO authenticated USING (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem inserir %1$s" ON %1$I FOR INSERT TO authenticated WITH CHECK (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem atualizar %1$s" ON %1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem deletar %1$s" ON %1$I FOR DELETE TO authenticated USING (true)', tabela);
  END LOOP;
END $$;
