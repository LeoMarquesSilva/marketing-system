-- Remove "Leonardo Marques Silva" (e variações com espaços extras) da coluna responsaveis em vios_tasks.
-- Executar no SQL Editor do Supabase ou via MCP quando necessário.

UPDATE vios_tasks t
SET responsaveis = NULLIF(TRIM(BOTH ' | ' FROM sub.filtrado), '')
FROM (
  SELECT vt.vios_id,
    (SELECT string_agg(x.trimmed, ' | ' ORDER BY x.ord)
     FROM (
       SELECT u.ord AS ord, TRIM(u.part) AS trimmed
       FROM unnest(string_to_array(TRIM(BOTH ' | ' FROM vt.responsaveis), '|')) WITH ORDINALITY AS u(part, ord)
     ) x
     WHERE LOWER(REGEXP_REPLACE(x.trimmed, '\s+', ' ', 'g')) <> 'leonardo marques silva'
    ) AS filtrado
  FROM vios_tasks vt
  WHERE vt.responsaveis IS NOT NULL
    AND LOWER(REGEXP_REPLACE(vt.responsaveis, '\s+', ' ', 'g')) LIKE '%leonardo marques silva%'
) sub
WHERE t.vios_id = sub.vios_id;
