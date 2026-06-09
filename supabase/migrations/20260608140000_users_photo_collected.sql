ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS photo_collected boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_collected_at timestamptz;

COMMENT ON COLUMN public.users.photo_collected IS 'Designer marcou que já obteve/atualizou a foto do colaborador (ex.: figurinha Copa).';
COMMENT ON COLUMN public.users.photo_collected_at IS 'Quando a foto foi marcada como obtida.';
