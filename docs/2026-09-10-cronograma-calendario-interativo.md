# Cronograma — calendário interativo e atualização de áreas

## Objetivo

Atualizar os dados do Cronograma de Conteúdo e tornar o calendário a visão principal de trabalho dos gestores, com leitura limpa, acesso aos detalhes de cada entrega e consulta do vínculo com Conteúdo/VIOS/publicação.

## Atualização dos dados

- Remover todas as 33 tarefas da área `Special Situations`.
- A remoção é segura no estado atual: nenhuma dessas tarefas possui vínculo com Conteúdo para Post, Reel Studio ou publicação do Instagram.
- Criar 9 tarefas para `Recuperação de Crédito`, sem responsável inicial e seguindo o calendário regular das demais áreas:

| Data | Formato |
| --- | --- |
| 09/10/2026 | Post |
| 14/10/2026 | Reel |
| 21/10/2026 | Post |
| 11/11/2026 | Post |
| 11/11/2026 | Reel |
| 19/11/2026 | Post |
| 10/12/2026 | Post |
| 16/12/2026 | Post |
| 16/12/2026 | Reel |

- A alteração será idempotente: uma nova execução não poderá duplicar as datas de Recuperação de Crédito.

## Calendário

- Continua sendo a visão padrão ao entrar no módulo.
- Mantém a grade mensal no desktop e a agenda por dia no celular.
- Usa divisórias neutras e discretas somente para estruturar a grade.
- Os cards não usam bordas coloridas, faixas laterais coloridas nem cor como contorno.
- Área, formato e situação são distinguidos por ícone, texto, avatar e pequenos indicadores internos.
- Cada card é um botão acessível por teclado, com estado de foco visível.
- O calendário mostra até três cards por célula. Quando houver mais, exibe um botão `+ N neste dia`.

## Lista completa do dia

- No desktop, `+ N neste dia` abre um popover ancorado na célula.
- No celular, abre um painel adequado à largura da tela.
- A lista mostra todas as entregas daquele dia, sem alterar a altura da grade mensal.
- Cada item da lista também abre os detalhes da tarefa.

## Detalhes da tarefa

O clique em qualquer card abre um painel lateral no desktop e um painel de tela adequada no celular. O painel apresenta:

- data, área, formato e situação;
- responsável atual, com avatar;
- nome original importado da planilha, quando existir;
- conteúdo vinculado e acesso ao módulo correspondente;
- tarefa do VIOS vinculada ao Conteúdo para Post, incluindo CI e status, quando existir;
- indicação explícita quando ainda não há conteúdo ou tarefa VIOS;
- publicação vinculada, data, link e métricas disponíveis;
- ação para trocar o responsável quando o usuário tiver permissão.

## Troca de responsável e permissões

- Marketing e administradores podem editar qualquer tarefa.
- Gestores podem trocar o responsável apenas nas áreas que gerenciam, reutilizando a mesma identificação de liderança do módulo de Férias.
- As opções exibem somente colaboradores ativos e compatíveis com a área, com avatar e nome.
- Uma tarefa sem conteúdo vinculado pode trocar de responsável normalmente.
- Se já houver conteúdo vinculado, a troca permanece bloqueada para evitar divergência entre autor, conteúdo e cronograma. O painel explica o motivo em vez de apenas desabilitar silenciosamente.
- Usuários sem permissão podem consultar os detalhes permitidos, mas não veem ação editável.

## VIOS

- O cronograma não cria nem altera tarefas no VIOS.
- Para Posts, o painel consulta o `vios_task_id` do conteúdo vinculado e exibe a tarefa correspondente.
- Sem conteúdo vinculado: `Tema ainda não escolhido`.
- Com conteúdo, mas sem tarefa VIOS: `Não vinculado ao VIOS`.
- Com tarefa VIOS: exibe CI e situação real disponível no espelho do VIOS.
- Para Reels sem vínculo equivalente, o painel informa que não há tarefa VIOS associada, sem inventar estado.

## Critérios de aceite

1. Não existe tarefa de `Special Situations` no cronograma após a migração.
2. Existem exatamente as 9 novas tarefas de `Recuperação de Crédito` descritas neste documento.
3. Nenhum card do calendário usa borda ou faixa colorida.
4. Todo card é clicável e abre seus detalhes.
5. `+ N neste dia` é clicável e permite acessar todos os itens ocultos.
6. O painel mostra conteúdo, VIOS e publicação com estados vazios claros.
7. Gestores autorizados conseguem trocar o responsável de tarefas ainda não vinculadas.
8. Tarefas vinculadas explicam por que a troca de responsável está bloqueada.
9. As visões Lista e Responsáveis continuam funcionando.
10. Testes automatizados, TypeScript, lint e verificação visual do fluxo principal passam antes da entrega.
