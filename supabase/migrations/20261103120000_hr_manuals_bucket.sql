-- Manuais do RH (PDF) para consulta e download dentro do sistema.
--
-- Bucket PRIVADO: o servidor confere o acesso ao RH e abre o arquivo por link
-- assinado de 1 hora. Primeiro arquivo: o Manual de Boas Práticas 2025, em
-- boas-praticas/manual-de-boas-praticas-2025.pdf (RH > Boas práticas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'RH-MANUAIS',
  'RH-MANUAIS',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
