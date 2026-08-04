-- Boletim (newsletter) por área jurídica: edições curadas manualmente a partir
-- das notícias já coletadas em content_roteiros, com textos redigidos por IA em
-- tom institucional, editáveis e assinadas pelo sócio responsável.

CREATE TABLE IF NOT EXISTS public.content_newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 240),
  edition_label text,
  area text NOT NULL DEFAULT 'Reestruturação (Insolvência)',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'em_revisao', 'assinado')),
  intro_title text,
  intro_body text,
  signature_names text,
  collaborator_names text,
  signed_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  signed_by_name text,
  signed_at timestamptz,
  created_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_newsletter_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL
    REFERENCES public.content_newsletters(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  roteiro_id uuid REFERENCES public.content_roteiros(id) ON DELETE SET NULL,
  source_link text,
  source_title text,
  headline text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  original_body text,
  edited_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  edited_by_name text,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_newsletters_area
  ON public.content_newsletters (area, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_newsletter_items_newsletter
  ON public.content_newsletter_items (newsletter_id, position);

-- Uma mesma notícia não entra duas vezes na mesma edição.
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_newsletter_items_roteiro
  ON public.content_newsletter_items (newsletter_id, roteiro_id)
  WHERE roteiro_id IS NOT NULL;

ALTER TABLE public.content_newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_newsletter_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_content_newsletters_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_newsletters_updated_at ON public.content_newsletters;
CREATE TRIGGER content_newsletters_updated_at
  BEFORE UPDATE ON public.content_newsletters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_content_newsletters_updated_at();
