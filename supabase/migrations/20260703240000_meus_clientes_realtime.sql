-- Realtime para Meus Clientes (gestores editando em paralelo)

ALTER TABLE email_contacts REPLICA IDENTITY FULL;
ALTER TABLE email_people REPLICA IDENTITY FULL;
ALTER TABLE email_companies REPLICA IDENTITY FULL;
ALTER TABLE email_group_responsibles REPLICA IDENTITY FULL;
ALTER TABLE email_client_groups REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_contacts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_people'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_people;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_companies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_companies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_group_responsibles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_group_responsibles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_client_groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_client_groups;
  END IF;
END $$;
