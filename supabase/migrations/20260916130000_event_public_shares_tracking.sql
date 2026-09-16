-- Compartilhamento seletivo de materiais de eventos e rastreamento de links.
-- Nenhum IP é armazenado; os cliques registram somente canal, horário,
-- referenciador e user-agent limitado.

ALTER TABLE public.event_attachments
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_event_attachments_public
  ON public.event_attachments(event_id, created_at DESC)
  WHERE is_public = true;

CREATE TABLE IF NOT EXISTS public.event_public_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[a-z0-9][a-z0-9-]{5,80}$'),
  title text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  campaign_slug text NOT NULL CHECK (campaign_slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  channel text NOT NULL CHECK (channel ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  label text NOT NULL,
  destination_url text NOT NULL CHECK (destination_url ~ '^https://'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_slug, channel)
);

CREATE TABLE IF NOT EXISTS public.event_tracking_clicks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.event_tracking_links(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  referrer text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_event_tracking_links_event
  ON public.event_tracking_links(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tracking_clicks_link_date
  ON public.event_tracking_clicks(link_id, clicked_at DESC);

ALTER TABLE public.event_public_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tracking_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage event public shares" ON public.event_public_shares;
CREATE POLICY "Authenticated users manage event public shares"
  ON public.event_public_shares FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage event tracking links" ON public.event_tracking_links;
CREATE POLICY "Authenticated users manage event tracking links"
  ON public.event_tracking_links FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users read event tracking clicks" ON public.event_tracking_clicks;
CREATE POLICY "Authenticated users read event tracking clicks"
  ON public.event_tracking_clicks FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.get_event_public_share(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'title', s.title,
    'description', s.description,
    'eventName', e.name,
    'expiresAt', s.expires_at,
    'attachments', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'title', a.title,
          'url', a.url,
          'fileType', a.file_type,
          'createdAt', a.created_at
        )
        ORDER BY a.created_at DESC
      )
      FROM public.event_attachments a
      WHERE a.event_id = s.event_id
        AND a.is_public = true
    ), '[]'::jsonb)
  )
  FROM public.event_public_shares s
  JOIN public.events e ON e.id = s.event_id
  WHERE s.token = p_token
    AND s.active = true
    AND (s.expires_at IS NULL OR s.expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.record_event_tracking_click(
  p_campaign_slug text,
  p_channel text,
  p_referrer text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.event_tracking_links%ROWTYPE;
BEGIN
  SELECT *
    INTO v_link
    FROM public.event_tracking_links
   WHERE campaign_slug = p_campaign_slug
     AND channel = p_channel
     AND active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.event_tracking_clicks (link_id, referrer, user_agent)
  VALUES (
    v_link.id,
    NULLIF(left(COALESCE(p_referrer, ''), 500), ''),
    NULLIF(left(COALESCE(p_user_agent, ''), 500), '')
  );

  RETURN v_link.destination_url;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_public_share(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_event_tracking_click(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_public_share(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_event_tracking_click(text, text, text, text) TO anon, authenticated;

COMMENT ON COLUMN public.event_attachments.is_public IS
  'Define se o anexo aparece no link público de materiais do evento.';
COMMENT ON TABLE public.event_public_shares IS
  'Links públicos controlados para entrega seletiva de materiais de eventos.';
COMMENT ON TABLE public.event_tracking_clicks IS
  'Cliques em links de campanhas; não armazena endereço IP.';
