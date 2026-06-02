-- Corrige tema GPA erroneamente vinculado a Operações Legais
UPDATE content_topics
SET legal_area = 'Reestruturação', name = 'GPA / Reestruturação'
WHERE name = 'Reestruturação' AND rss_query = 'gpa' AND legal_area = 'Operações Legais';

-- Tema RSS dedicado a Legal Operations (gestão/tecnologia do jurídico)
INSERT INTO content_topics (name, rss_query, legal_area, is_active, months_back, item_limit)
SELECT
  'Legal Ops / Legal Tech',
  '"legal operations" OR "legal ops" OR legaltech OR "automação de contratos" OR "software jurídico" OR "legal design" OR CLOC',
  'Operações Legais',
  true,
  4,
  15
WHERE NOT EXISTS (
  SELECT 1 FROM content_topics WHERE legal_area = 'Operações Legais' AND name ILIKE '%legal%'
);

-- Remove posts classificados erroneamente como Legal Ops
DELETE FROM content_roteiros
WHERE area = 'Operações Legais (Legal Ops)'
  AND (
    title ILIKE '%polícia%' OR title ILIKE '%policia%'
    OR title ILIKE '%lavagem de dinheiro%'
    OR title ILIKE '%TCE-%' OR title ILIKE '%tribunal de contas%'
    OR title ILIKE '%palestra%'
    OR title ILIKE '%contas de cláudio%' OR title ILIKE '%contas de claudio%'
    OR title ILIKE '%contas do governo%'
  );
