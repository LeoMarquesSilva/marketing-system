-- Normaliza áreas jurídicas e remove gestores duplicados de subáreas.

DELETE FROM email_area_managers
WHERE area IN ('Recuperação de Crédito', 'Cível | Insolvência');

UPDATE email_group_responsibles
SET area = 'Insolvência'
WHERE area = 'Cível | Insolvência';

UPDATE email_client_groups
SET legal_areas = (
  SELECT COALESCE(array_agg(DISTINCT normalized ORDER BY normalized), '{}')
  FROM (
    SELECT CASE
      WHEN elem = 'Cível | Insolvência' THEN 'Insolvência'
      ELSE elem
    END AS normalized
    FROM unnest(legal_areas) AS elem
  ) s
)
WHERE legal_areas IS NOT NULL AND legal_areas <> '{}';

UPDATE email_companies
SET legal_areas = (
  SELECT COALESCE(array_agg(DISTINCT normalized ORDER BY normalized), '{}')
  FROM (
    SELECT CASE
      WHEN elem = 'Cível | Insolvência' THEN 'Insolvência'
      ELSE elem
    END AS normalized
    FROM unnest(legal_areas) AS elem
  ) s
)
WHERE legal_areas IS NOT NULL AND legal_areas <> '{}';
