# Cronograma de Conteúdo

## Operação

Acesso: **Conteúdo → Cronograma**, em `/conteudo/cronograma`.

- A entrada abre diretamente no **Calendário**. No desktop, ele mostra a grade mensal de segunda a domingo; no celular, vira uma agenda por dia. A visão **Lista** permanece disponível para ajustes pontuais.
- Marketing (incluindo o perfil designer) e administradores cadastram datas, áreas e formatos.
- Gestores distribuem as tarefas entre colaboradores ativos de suas áreas, usando liderança/escopos do Férias. A permissão global de RH não concede gestão global do cronograma.
- Gestores também veem **Responsáveis**, uma conferência dos nomes originais da planilha. Abreviações podem ser associadas à identidade correta em todas as datas; ex-colaboradores, placeholders e pessoas transferidas de área só podem ser substituídos em tarefas futuras. O histórico passado fica preservado.
- As sugestões de associação são consultivas: nenhuma troca é aplicada automaticamente. Antes de confirmar, a tela informa quantas tarefas serão afetadas e restringe as opções a colaboradores ativos da área gerenciada.
- Colaboradores consultam suas próprias tarefas. O cronograma não exige escolher tema antecipadamente.
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

## Segurança e entrega

As tabelas `content_schedule_slots` e `content_schedule_links` usam RLS e não permitem acesso direto por `anon`/`authenticated`. As APIs autenticadas recalculam permissões no servidor.

Migração e importação aplicadas ao banco configurado do projeto. A disponibilização do código no ambiente de produção depende da publicação da aplicação; esta implementação não inclui push/deploy.

## Verificação

- Suíte completa: 999 testes aprovados; um teste de IA ao vivo ignorado pela configuração existente.
- Cobertura específica inclui permissões, datas, calendário responsivo, classificação de nomes abreviados/inativos, associação histórica versus substituição futura, heurística de repetição, retries, concorrência, aprovação de Post e confirmação de Reel.
- TypeScript e lint dos arquivos do módulo conferidos.
- RLS e ausência de privilégios diretos de leitura anônima/escrita autenticada conferidos no banco; importação repetida conferida sem duplicação.
- Calendário e central de responsáveis conferidos visualmente em sessão autenticada, usando os dados importados do ambiente local.
