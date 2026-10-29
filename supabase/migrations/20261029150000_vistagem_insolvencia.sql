-- Vistagem: a Reestruturação passa a ser as duas áreas do VIOS, Insolvência e Cível | Insolvência.
-- Publicações já triadas vão para a área de insolvência da pasta (fora delas, Cível | Insolvência).
update public.vistagem_publicacoes
set escritorio_responsavel = case when area_processo = 'Insolvência' then 'Insolvência' else 'Cível | Insolvência' end
where escritorio_responsavel = 'Reestruturação';

-- Quem vistava a Reestruturação passa a vistar as duas áreas.
update public.users
set vistagem_areas = array(
  select distinct area
  from unnest(array_remove(vistagem_areas, 'Reestruturação') || array['Insolvência', 'Cível | Insolvência']) as area
)
where 'Reestruturação' = any (vistagem_areas);

-- Sugestões de triagem com Reestruturação são refeitas na próxima triagem.
update public.vistagem_publicacoes
set sugestao_triagem = null
where status = 'triagem_pendente'
  and sugestao_triagem ->> 'escritorio' = 'Reestruturação';
