CREATE TABLE IF NOT EXISTS public.reel_studio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_month date NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 240),
  area text,
  original_script text NOT NULL CHECK (char_length(original_script) >= 80),
  refined_script text,
  caption text,
  cover_prompt text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'teleprompter_ready')),
  created_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reel_studio_assignees (
  reel_id uuid NOT NULL REFERENCES public.reel_studio_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  user_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_studio_items_month
  ON public.reel_studio_items (production_month, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reel_studio_assignees_user
  ON public.reel_studio_assignees (user_id);

ALTER TABLE public.reel_studio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_studio_assignees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_reel_studio_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reel_studio_items_updated_at ON public.reel_studio_items;
CREATE TRIGGER reel_studio_items_updated_at
  BEFORE UPDATE ON public.reel_studio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reel_studio_updated_at();
