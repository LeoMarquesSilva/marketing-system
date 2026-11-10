# Fluxo de defesa trabalhista no VIOS (vigente desde 27/10/2026)

Fonte: `01. FLUXOGRAMA DEFESAS.pdf`. O registro completo, com o estado anterior para rollback,
está em `ORQESTRAI/vios-trabalhista-defesa/antes-depois.md`. O relatório para o Jurídico está no
Claude Docs: (link com o Samuel)

## O que a AUDIÊNCIA UNA/INICIAL (202) cria

D = data da audiência. Os prazos são em dias úteis e pulam fim de semana e feriado processual.

| Tarefa | Quando | Regra no VIOS | Responsável | Etiqueta |
|---|---|---|---|---|
| 1. CIÊNCIA DOS AGENDAMENTOS (321) | D+0 do agendamento | data atual | Responsável do atendimento | |
| SOLICITAR DOCUMENTOS (256) | D+1 útil do agendamento | data atual | Responsável do atendimento | PROVIDÊNCIA |
| HABILITAÇÃO PROCESSUAL (417), INFORMAR CLIENTE, INSERIR PAUTA (416) | D+1 útil do agendamento | data atual | Estagiário / atendimento | |
| CONTESTAÇÃO (418) | D−15 | negativo, dias úteis | Advogado do processo | |
| SOLICITAR DOCUMENTOS/ESCLARECIMENTOS COMPLEMENTARES (793) | D−15 | negativo, dias úteis | Advogado do processo | PROVIDÊNCIA |
| 2. REVISAR (419), filha da contestação | contestação + 6 úteis = D−9 | data da pai | Auxiliares | |
| 3. PROTOCOLAR (420), filha da contestação | contestação + 13 úteis = D−2 | data da pai | Samuel + advogado | |
| ENVIAR DEFESA PARA VALIDAÇÃO DO CLIENTE (772), filha **só** do PROTOCOLAR | protocolar − 3 úteis = D−5 | negativo, dias úteis | Advogado do processo | |
| LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO (458) | D−4 | negativo, dias úteis; vale para **todas** as audiências | Advogado do processo | |
| VERIFICAR ATA (460) e CIÊNCIA ATA + ENVIAR RELATÓRIO (260) | D+1 útil | data da pai | Larissa / advogado | |

Teste de referência: audiência em 15/12/2026 gera Ciência 27/10 · Solicitar docs, Habilitação,
Informar e Pauta 28/10 · Contestação e Complementares 24/11 · Revisar 02/12 · Enviar defesa 08/12 ·
Lembrete 09/12 · Protocolar 11/12 · Atas 16/12.

Outras audiências: AUD. CONCILIAÇÃO (454) e AUD. INSTRUÇÃO (457) não criam contestação, só o
lembrete. AUDIÊNCIA DE JULGAMENTO (39) cria Informar cliente e Inserir pauta.

## Decisões do Samuel (27/10/2026)

- O lembrete D−4 úteis vale para todas as audiências.
- A complementar é sempre automática na UNA, com o advogado do processo como responsável e a
  etiqueta PROVIDÊNCIA.
- A Ciência dos agendamentos fica em D+0, porque o tipo 321 é compartilhado.
- As SOLICITAR DOCUMENTOS que já estavam abertas mantiveram a data. Antes, ela era D−46 corridos.
- No reajuste, a data nova que caía no passado foi para o próximo dia útil a partir de hoje.
- Cuidado redobrado com duplicidade. Já havia UNAs e cadeias duplicadas antes do ajuste.
- Sobras sem UNA e cadeias velhas não se cancelam sem o Jurídico.

## Pontos de atenção

- Toda CONTESTAÇÃO (418) lançada à mão cria REVISAR em +6 úteis e PROTOCOLAR em +13 úteis a partir
  da data dela. Num prazo de defesa sem audiência, o protocolar pode cair depois do fatal. A regra
  para esses casos está pendente com o Jurídico (pasta 59413).
- A Árvore de Tarefas mostra quem cria cada tipo. Antes de mudar o prazo de um tipo, confira se
  ele é compartilhado.
- Cadeias antigas (UNA cancelada ou concluída) podem continuar abertas ao lado da cadeia nova.
  Elas aparecem na conferência como tarefas "sem audiência aberta".

## Pendências (28/10/2026)

Com o Jurídico (relatório, itens 1 a 5):

1. Sobras sem UNA: 59048, 59543, 60177, 60189.
2. Regra para contestação sem audiência (59413 e futuras).
3. Complementares das pastas 59848 e 60376, que têm duas UNAs em datas diferentes.
4. 14 SOLICITAR DOCUMENTOS vencidas sem os 10 úteis para o cliente (de duas responsáveis).
5. 18 tarefas de cadeias velhas a cancelar (59929, 61093, 60077, 59341 e 58697).

Com Operações Legais:

- Recessos 395 e 396 com a data de fim antes da de início.
- Descobrir onde o VIOS guarda o motivo da prorrogação (não sai no CSV).
