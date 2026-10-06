-- Radar do Gustavo: 20 notícias por tema esgotava rápido (quase tudo duplicado).
alter table public.gustavo_content_topics alter column item_limit set default 40;
update public.gustavo_content_topics set item_limit = 40 where item_limit < 40;
