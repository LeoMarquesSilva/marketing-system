# Cronograma de Conteúdo

## Operação

Acesso: **Conteúdo → Cronograma**, em `/conteudo/cronograma`.

- A entrada abre diretamente no **Calendário**. No desktop, ele mostra a grade mensal de segunda a domingo; no celular, vira uma agenda por dia. A visão **Lista** permanece disponível para ajustes pontuais.
- A grade usa divisórias neutras e cards sem bordas ou faixas coloridas. Área, formato e situação são diferenciados por ícones, texto, avatar e indicadores internos.
- Todos os cards são botões acessíveis por teclado e abrem os detalhes da tarefa. Cada dia mostra até três cards; `+ N neste dia` abre a lista completa em popover no desktop e em painel adequado à largura no celular.
- Marketing (incluindo o perfil designer) e administradores cadastram datas, áreas e formatos.
- Gestores distribuem as tarefas entre colaboradores ativos de suas áreas, usando liderança/escopos do Férias. A permissão global de RH não concede gestão global do cronograma.
- Gestores também veem **Responsáveis**, uma conferência dos nomes originais da planilha. Abreviações podem ser associadas à identidade correta em todas as datas; ex-colaboradores, placeholders e pessoas transferidas de área só podem ser substituídos em tarefas futuras. O histórico passado fica preservado.
- As sugestões de associação são consultivas: nenhuma troca é aplicada automaticamente. Antes de confirmar, a tela informa quantas tarefas serão afetadas e restringe as opções a colaboradores ativos da área gerenciada.
- Colaboradores consultam suas próprias tarefas. O cronograma não exige escolher tema antecipadamente.
- O painel lateral (Sheet) mostra data, área, formato, situação, responsável com avatar, origem importada, Conteúdo, VIOS e publicação/métricas. Estados vazios distinguem `Tema ainda não escolhido`, `Sem tarefa VIOS associada ao Reel` e `Não vinculado ao VIOS` para Posts.
- Marketing, administradores e gestores autorizados podem trocar o responsável enquanto o slot não possui conteúdo vinculado e não está cancelado. As opções ficam restritas a colaboradores ativos e compatíveis com a área; slots vinculados ou cancelados não oferecem a troca.
- A aprovação efetiva em Conteúdo para Post vincula a produção automaticamente. No gerador de Reels, **Usar este roteiro** salva a versão no estúdio e processa o vínculo; gerar testes não ocupa tarefas.
- A associação procura uma tarefa livre, não cancelada, da mesma pessoa, área e formato, até 14 dias antes/depois da escolha. A menor distância precisa ser única. Sem correspondência segura, o Marketing recebe uma pendência para corrigir.
- Alertas de repetição são consultivos: comparam fonte/assunto com conteúdo em produção e publicações. A similaridade é heurística e não bloqueia a escolha.
- Publicação é comprovada pelo vínculo real com Instagram. O Marketing pode associar publicações históricas pelo editor da tarefa. A publicação de um Post não publica automaticamente o Reel derivado.

## Importação inicial — 09/09/2026

Origem: `Cronograma Marketing BP 2026.xlsx`, preservada sem alterações.

| Área | Tarefas |
| --- | ---: |
| Reestruturação | 33 |
| Operações Legais | 20 |
| Special Situations | 33 |
| Cível | 33 |
| Trabalhista | 33 |
| Societário e Contratos | 33 |
| Total | 185 |

Foram identificadas com segurança 45 atribuições. As outras 140 mantêm o nome original para conferência (abreviações, nomes incompletos, pessoas inativas ou área atual diferente). Cinco tarefas preservam cancelamento. Nenhuma publicação foi presumida a partir do status da planilha.

O importador `scripts/import-content-schedule.mjs` usa Python/openpyxl para leitura, via variável `CONTENT_SCHEDULE_PYTHON`. Sem `--apply`, apenas simula. Com `--apply`, insere por chave da aba/linha e ignora registros existentes, preservando ajustes posteriores. A segunda execução foi conferida: continuaram 185 chaves únicas.

## Atualização de áreas — 10/09/2026

A migração `20260910120000_content_schedule_replace_special_situations.sql` substituiu o recorte de `Special Situations` por `Recuperação de Crédito`. Antes da aplicação, o banco tinha 33 slots de `Special Situations`, nenhum deles atribuído ou vinculado a Conteúdo, Reel Studio, publicação do Instagram ou pendência resolvida, e nenhum slot de `Recuperação de Crédito`.

Depois da aplicação, `Special Situations` ficou com 0 slots e `Recuperação de Crédito` com exatamente 9 slots sem responsável: Posts em 09/10, 21/10, 11/11, 19/11, 10/12 e 16/12/2026; Reels em 14/10, 11/11 e 16/12/2026. As nove `source_key` são distintas. Os 152 slots fora dessas duas áreas mantiveram a mesma contagem e o mesmo hash de conteúdo.

`Recuperação de Crédito` também passou a ser uma área canônica do módulo Conteúdo. Ela aparece nos seletores de Posts e Reels, é reconhecida na classificação e no mapeamento do departamento homônimo, e pode ser vinculada automaticamente somente aos slots da mesma área e formato.

## Ajuste de gravação — 11/09/2026

A migração `20260911163029_move_september_reels_to_23.sql` moveu de 16/09 para 23/09/2026 os cinco Reels de setembro: Cível, Operações Legais, Reestruturação, Societário e Contratos e Trabalhista. A alteração preservou os demais dados dos slots.

## Segurança e entrega

As tabelas `content_schedule_slots` e `content_schedule_links` usam RLS e não permitem acesso direto por `anon`/`authenticated`. As APIs autenticadas recalculam permissões no servidor.

Migração e importação aplicadas ao banco configurado do projeto. A disponibilização do código no ambiente de produção depende da publicação da aplicação; esta implementação não inclui push/deploy.

## Verificação

- Suíte focal do calendário interativo: 46 testes aprovados em 5 arquivos, sem falhas.
- Suíte completa: 1.050 testes aprovados; um teste de IA ao vivo ignorado pela configuração existente; nenhuma falha.
- Cobertura específica inclui os nove pares de data/formato de Recuperação de Crédito, permissões, calendário responsivo e clicável, lista diária, Sheet, avatares, estados de Conteúdo/VIOS/publicação, retries, concorrência, aprovação de Post e confirmação de Reel.
- TypeScript (`npx tsc --noEmit`), lint focal dos cinco arquivos do módulo e build de produção com o ambiente principal foram conferidos com exit 0.
- RLS e ausência de privilégios diretos de leitura anônima/escrita autenticada conferidos no banco; importação repetida conferida sem duplicação.
- O banco remoto foi conferido após a migração: 0 slots de `Special Situations`, 9 de `Recuperação de Crédito`, nove pares literais na ordem esperada e nove `source_key` distintas.
- A validação visual autenticada confirmou o calendário de outubro, os cards neutros, o popover `+ N neste dia`, o Sheet e o seletor de responsáveis com avatar ou iniciais.
