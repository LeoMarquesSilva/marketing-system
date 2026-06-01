-- Allow Onboarding as a valid request_type (check constraint + lookup table)

ALTER TABLE marketing_requests DROP CONSTRAINT IF EXISTS marketing_requests_request_type_check;

ALTER TABLE marketing_requests
  ADD CONSTRAINT marketing_requests_request_type_check
  CHECK (
    request_type = ANY (
      ARRAY[
        'Comunicado',
        'PPT',
        'Post Redes Sociais',
        'Aplicação de Identidade',
        'Certificados',
        'E-book',
        'Identidade Visual',
        'Newsletter',
        'Material Impresso',
        'Relatório',
        'Apresentação',
        'Onboarding'
      ]::text[]
    )
  );

INSERT INTO request_types (name, "order")
SELECT 'Onboarding', 12
WHERE NOT EXISTS (SELECT 1 FROM request_types WHERE name = 'Onboarding');
