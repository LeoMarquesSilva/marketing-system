-- "Operações Legais (Legal Ops)" passa a ser só "Operações Legais" (pedido do usuário em 10/11/2026:
-- nunca "Legal Ops" em texto para pessoas).
--
-- Única coluna com o nome antigo em 10/11/2026: content_roteiros.area (96 roteiros).
-- Aplicar junto com o deploy do código que usa o nome novo (src/lib/content-areas.ts):
-- o código antigo não reconhece "Operações Legais" como área de conteúdo, e o novo
-- não pinta nem filtra o nome antigo. O código novo ainda aceita o nome antigo vindo
-- da IA ou de fontes externas (aliases em content-classification.ts e vistagem).

update public.content_roteiros
   set area = 'Operações Legais'
 where area = 'Operações Legais (Legal Ops)';
