-- Normaliza nomes de contatos e pessoas para Title Case (primeira letra maiúscula).
-- Partículas comuns (de, da, do, dos, das, e) permanecem minúsculas no meio do nome.

CREATE OR REPLACE FUNCTION public.title_case_person_name(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  words text[];
  result text[] := '{}';
  word text;
  parts text[];
  formatted_parts text[] := '{}';
  part text;
  i int;
  j int;
  particles text[] := ARRAY['de', 'da', 'do', 'dos', 'das', 'e'];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN raw;
  END IF;

  words := regexp_split_to_array(btrim(regexp_replace(raw, '\s+', ' ', 'g')), '\s+');

  FOR i IN 1 .. array_length(words, 1) LOOP
    word := words[i];
    parts := regexp_split_to_array(word, '-');

    formatted_parts := '{}';
    FOR j IN 1 .. array_length(parts, 1) LOOP
      part := lower(parts[j]);
      IF i > 1 AND part = ANY (particles) THEN
        formatted_parts := array_append(formatted_parts, part);
      ELSE
        formatted_parts := array_append(
          formatted_parts,
          upper(substr(part, 1, 1)) || substr(part, 2)
        );
      END IF;
    END LOOP;

    result := array_append(result, array_to_string(formatted_parts, '-'));
  END LOOP;

  RETURN array_to_string(result, ' ');
END;
$$;

UPDATE public.email_contacts
SET name = public.title_case_person_name(name)
WHERE name IS NOT NULL AND btrim(name) <> '';

UPDATE public.email_people
SET name = public.title_case_person_name(name)
WHERE name IS NOT NULL AND btrim(name) <> '';
