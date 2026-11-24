# Proposta: Reuniões 1:1 no ORQESTRAI

Status: **proposta para aprovação** (19/11/2026). Nada foi criado no banco nem no código.

## Decidido em 19/11/2026

1. **Entre quem**: só líder e liderado (gestor direto ou quem lidera a área).
2. **Agenda: marcar direto pelo ORQESTRAI, no modelo do SAMA-ECOA.** O SAMA faz assim (código em `C:\bkp\doc\SAMA`: `src/lib/graph.ts`, `src/lib/reunioes/outlook-write.ts`, `src/lib/salas.ts`):
   - O ORQESTRAI consulta o **livre/ocupado** do líder, do liderado e da sala pelo Microsoft Graph (`getSchedule`, intervalos de 15 ou 30 minutos) e mostra os horários livres.
   - **Salas**: Sala 1, Sala 2, Biblioteca, Outback ou "Somente online". Cada sala é uma caixa de usuário (`SALA01@`, `SALA02@`, `BIBLIOTECA@`, `OUTBACK@`), convidada como participante. É assim que a sala fica reservada.
   - O evento é **criado no Outlook do líder**, com convite ao liderado e à sala, **link do Teams** (também nas presenciais) e a pauta no corpo do convite.
   - Remarcar atualiza o evento; cancelar cancela o convite no Outlook.
   - **Permissão**: o aplicativo do Microsoft 365 do ORQESTRAI **já tem** `Calendars.ReadWrite` e `User.Read.All` (conferido em 19/11/2026). Não precisa liberar nada no Azure.
3. **Anotações privadas: igual ao Feedz, com configuração.**
   - Conferido na conta da empresa em 19/11/2026: no Feedz, um participante não vê a anotação do outro, mas **quem é admin vê as anotações dos dois** pelo Histórico de 1:1.
   - No ORQESTRAI fica igual: o líder não vê a do liderado e vice-versa; quem tem a permissão vê as dos dois.
   - Em **Configurações da 1:1**: ligar ou desligar "RH vê as anotações privadas" e escolher quem (admin, RH completo).
   - Recomendo um aviso discreto para os participantes ("Pessoas e Cultura pode ler estas anotações") enquanto a chave estiver ligada. Decisão sua.
4. **Avisos**: por enquanto só no sistema (tela inicial e tela de 1:1). O **e-mail** (pauta antes da reunião e lembrete de 30 dias) fica pronto, mas **desligado**, com uma chave em Configurações da 1:1.

5. **Histórico do Feedz**: trazer **tudo**: as 131 reuniões, com pauta, ações e anotações privadas, seguindo a mesma regra de quem vê.
6. **Liderado** pode **marcar**, **remarcar** e **avaliar** a 1:1.
   - A avaliação é uma nota de 1 a 5 com comentário opcional.
   - Proposta: o líder e o RH veem; a Gestão mostra a média por gestor.
7. **Resumo por IA**: depois, não entra na primeira versão.
8. **Aviso de que o RH pode ler as anotações**: **não mostrar**, igual ao Feedz.

Fontes: o uso real no Feedz (`telas-logado.md`, `oportunidades.md`), a especificação da central de ajuda (`pdi-e-1-1.md`, parte B) e o benchmark (Fellow, Lattice e Qulture.Rocks, no fim).

## O que é

A conversa periódica entre o líder e cada liderado, com:
- pauta que os dois montam antes;
- ações combinadas, com responsável e prazo;
- anotações que só quem escreve vê.

Hoje a empresa faz no Feedz cerca de uma 1:1 por mês com cada liderado (131 no histórico), quase sempre para acompanhar o PDI. Por isso a 1:1 nasce ligada ao PDI que já está no ORQESTRAI.

## Como funciona

1. **Marcar**: o gestor (ou o liderado) cria a reunião com data, horário, categoria e, se quiser, recorrência (mensal, quinzenal ou semanal, até uma data).
2. **Antes da reunião**: os dois incluem tópicos na pauta compartilhada. O sistema já sugere:
   - as **ações do PDI vencidas ou paradas** há mais de 30 dias;
   - as **ações combinadas da 1:1 anterior que não foram concluídas** (passam sozinhas para a próxima, como no Fellow e no Lattice);
   - os tópicos padrão da categoria escolhida.
3. **Na reunião**: cada tópico é marcado como conversado. As ações combinadas são registradas com responsável e prazo. Cada um escreve as suas anotações privadas.
4. **Fechar**: o líder clica em "Finalizar". A reunião vai para o histórico e as ações abertas seguem visíveis para os dois.
5. **Lembrete**: passados 30 dias sem 1:1, o par aparece como "atrasado" para o gestor e para o RH. O Feedz usa os mesmos 30 dias.

## Telas (no mesmo visual aprovado no PDI)

### Minhas 1:1 (`/1-1`)
- Topo com os números de quem lidera:
  - liderados;
  - com 1:1 nos últimos 30 dias;
  - atrasados;
  - ações combinadas em aberto.
- Cartões por pessoa:
  - foto, cargo e área;
  - última e próxima reunião;
  - semáforo da frequência ("em dia" ou "há 45 dias sem 1:1");
  - PDI da pessoa em %.
- Quem é liderado vê o cartão do seu gestor.
- Faixa "Próximas reuniões" com data, hora e categoria.
- Botão "Nova 1:1".

### Página do par (`/1-1/[pessoa]`)
- **Topo escuro**: as duas fotos (líder e liderado), a frequência e a próxima reunião em destaque.
- **Resumo do liderado**:
  - PDI (% e ações vencidas);
  - dias desde a última 1:1;
  - quando o feedback existir no ORQESTRAI, dias desde o último feedback.
- **Linha do tempo das reuniões**, com a próxima aberta. Cada reunião tem:
  - pauta compartilhada (tópicos com a foto de quem incluiu, marcar como conversado);
  - ações da reunião;
  - **anotações privadas**;
  - "Finalizar".
- **Coluna lateral**:
  - ações combinadas (em andamento e concluídas, com responsável e prazo);
  - recorrência configurada.

### Nova reunião (modal no meio da tela, no modelo do SAMA)
1. **Liderado e categoria.**
2. **Quando e onde**:
   - escolher a sala (Sala 1, Sala 2, Biblioteca, Outback) ou "Somente online";
   - o modal mostra uma grade do dia com os horários livres dos dois e da sala, puxados do Outlook;
   - clicar num horário livre preenche início e fim.
3. **Pauta**: tópicos sugeridos, "trazer do PDI" e tópicos livres.
4. **Recorrência** (mensal, quinzenal, semanal, até uma data).
5. **Confirmar**: o evento é criado no Outlook do líder com o liderado, a sala e o Teams. Remarcar ou cancelar depois atualiza o Outlook.

### Gestão do RH (`/rh/1-1`)
- **Números**:
  - reuniões no mês;
  - % de liderados com 1:1 nos últimos 30 dias;
  - gestores com pares atrasados.
- **Lista por gestor**: cobertura, último registro e atrasados.
- **Histórico** filtrável por área, categoria, período e status, com exportação.
- **Anotações privadas**: o RH vê as dos dois participantes enquanto a chave estiver ligada.
- **Configurações da 1:1**:
  - categorias e tópicos sugeridos de cada categoria;
  - "RH vê as anotações privadas" (e quem);
  - e-mail de pauta e de lembrete (desligado);
  - dias para considerar atrasada (30);
  - salas disponíveis.

## Categorias (vindas do Feedz)

- Acompanhamento do PDI
- Devolutiva da Avaliação de Competências
- Alinhamento de prioridades e entregas
- Acompanhamento das metas individuais e coletivas
- Desenvolvimento contínuo e alinhamento de expectativas
- Discussão de desempenho e evolução de competências
- Reforço de cultura, valores e boas práticas do escritório

## Quem vê o quê

| | Líder | Liderado | RH | Outros |
|---|---|---|---|---|
| Reunião, pauta, ações | vê e edita | vê e edita | vê | não |
| Anotações privadas | só as próprias | só as próprias | dos dois, se a chave estiver ligada (como no Feedz) | não |
| Marcar e remarcar | sim | sim | não | não |
| Avaliar a 1:1 (nota de 1 a 5) | vê a nota | dá a nota | vê | não |
| Finalizar | sim | não | não | não |
| Lista de cobertura | do seu time | — | todos | não |

O líder é o gestor direto do cadastro ou quem lidera a área, a mesma regra de "Minha equipe" do PDI.

## O que muda no sistema (depois da aprovação)

- **Tabelas novas**:
  - `hr_one_on_one_meetings` (reunião);
  - `hr_one_on_one_topics` (pauta);
  - `hr_one_on_one_actions` (ações combinadas);
  - `hr_one_on_one_notes` (anotações privadas);
  - `hr_one_on_one_series` (recorrência);
  - `hr_one_on_one_categories` (categorias e tópicos sugeridos).
- **Menu**: Pessoas e Cultura › 1:1, com "Minhas 1:1" e "Gestão" (RH).
- **Tela inicial**: pendência "1:1 com Fulano atrasada" para o gestor.
- **Teste**: só admin, como no PDI, até você liberar.

## Benchmark (o que entra de cada um)

| Sistema | O que vale trazer |
|---|---|
| Feedz (uso atual) | Pauta compartilhada, ações, anotações privadas, categorias, recorrência, lembrete de 30 dias e "Resumo do liderado" |
| [Fellow](https://fellow.app/use-cases/one-on-one-meetings) | Ação não concluída passa sozinha para a próxima reunião; anotação privada para preparar a conversa |
| [Lattice](https://help.lattice.com/hc/en-us/articles/360059920054) | Pauta puxa as metas e áreas de desenvolvimento (aqui: o PDI); histórico em linha do tempo; e-mail com a pauta antes da reunião |
| [Qulture.Rocks](https://www.capterra.com/p/192315/Qulture-Rocks/reviews/?page=6) (avaliações de usuários) | Lembrete por e-mail quando o gestor esquece de marcar |

## Decisões

Todas tomadas em 19/11/2026 (ver o topo). Falta só o OK para começar a construir.
