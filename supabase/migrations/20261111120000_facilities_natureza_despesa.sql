-- Natureza da despesa (lista do gestor de Facilities) em coluna própria.
--
-- Até aqui a natureza morava em event_suppliers.category, que o módulo de
-- eventos também usa como tipo de fornecedor de evento (buffet, decoração...).
-- Os dois conceitos se misturavam: "Buffet" aparecia como natureza da despesa.
-- Agora:
--   expense_nature  = uma das 11 naturezas do gestor (ou vazia = "Não informada")
--   category        = continua sendo o tipo usado pelo módulo de eventos
-- Fornecedor de evento sem natureza fica "Não informada" até alguém escolher.

alter table public.event_suppliers add column if not exists expense_nature text;

update public.event_suppliers
set expense_nature = category
where expense_nature is null
  and category in (
    'servicos_profissionais', 'tecnologia', 'imovel', 'consumo', 'beneficios', 'informatica',
    'transporte', 'copa', 'limpeza', 'manutencao', 'outros'
  );

alter table public.event_suppliers drop constraint if exists event_suppliers_expense_nature_check;
alter table public.event_suppliers add constraint event_suppliers_expense_nature_check check (
  expense_nature is null or expense_nature in (
    'servicos_profissionais', 'tecnologia', 'imovel', 'consumo', 'beneficios', 'informatica',
    'transporte', 'copa', 'limpeza', 'manutencao', 'outros'
  )
);

-- Tipo de evento (buffet, decoração...) passa a ser lido como categoria do terceiro "Eventos".
update public.event_suppliers
set third_party_category = 'eventos'
where third_party_category is null
  and category in ('brindes', 'catering', 'buffet', 'decoracao', 'fotografia', 'som_iluminacao', 'seguranca', 'locacao');

-- Categoria do plano de manutenção (campo do gestor): vem do equipamento, mas
-- fica gravada no plano para serviço geral sem equipamento.
alter table public.maintenance_plans add column if not exists category text;
alter table public.maintenance_plans drop constraint if exists maintenance_plans_category_check;
alter table public.maintenance_plans add constraint maintenance_plans_category_check check (
  category is null or category in (
    'ar_condicionado', 'eletrica', 'hidraulica', 'elevador', 'gerador', 'ti_rede',
    'seguranca_incendio', 'alarme_cftv', 'mobiliario', 'predial', 'outros'
  )
);
update public.maintenance_plans p
set category = a.category
from public.facility_assets a
where p.asset_id = a.id and p.category is null;
