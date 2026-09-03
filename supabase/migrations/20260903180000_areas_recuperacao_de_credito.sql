-- Recuperação de Crédito passou a ser área autônoma (não subárea de Cível).
INSERT INTO public.areas (name)
SELECT 'Recuperação de Crédito'
WHERE NOT EXISTS (
  SELECT 1 FROM public.areas WHERE name = 'Recuperação de Crédito'
);
