-- Um nome, um cadastro em event_suppliers (fornecedores e prestadores de
-- eventos e de Facilities).
--
-- Em 27/10/2026, 13 envios do "Novo prestador" viraram 13 cadastros iguais.
-- Os duplicados foram juntados em 10/11/2026 (131 → 114) e o sistema passou a
-- procurar o nome antes de criar (src/lib/suppliers/unique-name.ts). Este
-- índice é a trava final: dois cadastros com o mesmo nome, sem diferenciar
-- maiúscula, acento e espaços, não entram nem com envios simultâneos.
--
-- Vale com ou sem CNPJ: filial entra com um nome que diferencia a unidade
-- (ex.: "Pão de Açúcar Cambuí"), porque os eventos escolhem o prestador pelo nome.

-- Mesma conta de normalizeSupplierName(), sem a extensão unaccent (que não é
-- imutável e não está instalada): tira os acentos do português, passa para
-- minúscula e junta os espaços. Tudo o que ela iguala o código também iguala.
create or replace function public.supplier_name_key(name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(
        pg_catalog.translate(
          name,
          'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
          'aaaaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuuccnnyyy'
        )
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

comment on function public.supplier_name_key(text) is
  'Nome do fornecedor sem maiúscula, acento e espaços repetidos (índice event_suppliers_name_unique).';

create unique index if not exists event_suppliers_name_unique
  on public.event_suppliers (public.supplier_name_key(name));
