-- Eventos: notas das degustações de drinks (cada drink provado, com foto, e a nota de 1 a 5 de cada participante).
-- Liga às degustações de event_tastings; os participantes continuam no jsonb da degustação.

CREATE TABLE IF NOT EXISTS event_tasting_drinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tasting_id uuid NOT NULL REFERENCES event_tastings(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  photo_path text,
  photo_url text,
  note text,
  shortlisted boolean NOT NULL DEFAULT false,
  menu_item_id uuid REFERENCES event_menu_items(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_tasting_drinks_tasting_idx ON event_tasting_drinks (tasting_id, sort_order);
CREATE INDEX IF NOT EXISTS event_tasting_drinks_event_idx ON event_tasting_drinks (event_id);

COMMENT ON COLUMN event_tasting_drinks.photo_path IS 'Caminho no bucket MARKETING-SYSTEM-EVENTOS (eventos/<evento>/degustacoes/<degustação>/...).';
COMMENT ON COLUMN event_tasting_drinks.shortlisted IS 'Pré-selecionado pelo grupo (aparece em negrito na tabela de notas).';
COMMENT ON COLUMN event_tasting_drinks.menu_item_id IS 'Item do cardápio criado a partir deste drink, quando o organizador decidir levá-lo.';

-- Uma nota por participante em cada drink. participant_key = id do usuário ou "convidado:<nome>" para quem não tem login.
CREATE TABLE IF NOT EXISTS event_tasting_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_id uuid NOT NULL REFERENCES event_tasting_drinks(id) ON DELETE CASCADE,
  tasting_id uuid NOT NULL REFERENCES event_tastings(id) ON DELETE CASCADE,
  participant_key text NOT NULL,
  participant_name text NOT NULL,
  user_id uuid,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drink_id, participant_key)
);
CREATE INDEX IF NOT EXISTS event_tasting_votes_tasting_idx ON event_tasting_votes (tasting_id);

COMMENT ON COLUMN event_tasting_votes.recorded_by IS 'Quem lançou a nota (a própria pessoa ou o organizador, por ela).';

-- Mesmo acesso das outras tabelas do módulo de eventos.
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['event_tasting_drinks', 'event_tasting_votes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem ler %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem inserir %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem atualizar %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem deletar %1$s" ON %1$I', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem ler %1$s" ON %1$I FOR SELECT TO authenticated USING (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem inserir %1$s" ON %1$I FOR INSERT TO authenticated WITH CHECK (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem atualizar %1$s" ON %1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem deletar %1$s" ON %1$I FOR DELETE TO authenticated USING (true)', tabela);
    -- Tabela ao vivo no celular de todo mundo.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
    END IF;
  END LOOP;
END $$;
