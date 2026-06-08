ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS photo_onedrive_url text;

COMMENT ON COLUMN public.users.photo_onedrive_url IS 'Link OneDrive da foto preferida do colaborador (origem/arquivo).';
COMMENT ON COLUMN public.users.avatar_url IS 'URL direta da foto para preview e uso em materiais.';
