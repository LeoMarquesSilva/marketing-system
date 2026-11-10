---
name: vios-cadastro-fluxos
description: >-
  Configuração e manutenção de fluxos de tarefas no VIOS (bp.vios.com.br): tipos de tarefa,
  prazos (dias úteis, corridos, negativos), Fluxo Automático de criação e conclusão, Árvore de
  Tarefas, etiquetas sugeridas, cadastro de feriados, e operações em lote sobre tarefas já
  criadas (prorrogar/reagendar, cancelar, editar etiqueta, criar tarefas) com conferência por
  export CSV. Use sempre que o trabalho envolver mudar o fluxo de uma tarefa ou audiência no
  VIOS, alterar D−N de contestação, revisar, protocolar, enviar defesa ou lembrete, aplicar um
  fluxograma novo, reajustar prazos já agendados ao fluxo novo, limpar tarefas ou UNAs
  duplicadas, conferir se as tarefas abertas seguem o fluxo, feriados que mudam a contagem de
  prazo, o fluxo de defesa trabalhista (UNA, contestação, complementares), ou transferir pastas
  e prazos de uma área para outra (departamento, área, advogado responsável, auxiliar, dupla).
---

# VIOS — cadastro de fluxos e operações em lote

Aprendido na mudança do fluxo de defesa trabalhista (27/10/2026). O fluxo vigente, as decisões e
as pendências estão em [fluxo-defesa-trabalhista.md](fluxo-defesa-trabalhista.md).

Skills irmãs: agendar a partir de publicação → `vios-vistagem-agendamento`; tirar o dump completo
→ `vios-baixar-relatorio-csv`.

## Como o VIOS guarda um fluxo

Entender isto evita a maior parte dos erros:

1. **Tipo de tarefa** (`processos_etapas_id`). No cadastro do tipo, o menu `...` abre: Editar,
   **Prazos**, Questionário, Notificações, Tarefas Relacionadas, Histórico, **Fluxo Automático -
   Criação** e **- Conclusão**. A **Árvore de Tarefas** mostra, por tipo, quem o cria e o que ele
   cria.
2. **O prazo mora no tipo**, não na ligação do fluxo. A tela Prazos do tipo (`pef_id`) guarda o
   número e o tipo de contagem. Mudar o prazo de um tipo muda **todos** os fluxos que o usam. Antes
   de mexer, veja na Árvore quem cria o tipo. Se ele é compartilhado (ex.: LEMBRETE, CIÊNCIA DOS
   AGENDAMENTOS), a decisão é do usuário: mudar para todos ou clonar um tipo exclusivo.
3. **A ligação pai → filha** (Fluxo Automático - Criação) só define a regra de data (data atual,
   data da tarefa pai ou data base) e a responsabilidade do fluxo. A coluna "Prazo Padrão" é lida
   do tipo. **Não existe edição da ligação**: para trocar a regra, apague a ligação e inclua de
   novo.
4. **Contagem**: 1 = dias corridos, 2 = dias úteis, 3 = Prazo Negativo (corridos), 4 = Prazo
   Negativo - Dias Úteis. O negativo conta para trás a partir da data do pai. O positivo conta
   para frente, a partir de hoje ou da data do pai, conforme a regra da ligação.
5. **Feriados**: cada registro tem as opções "Posterga prazos de tarefas processuais / não
   processuais / compromissos" e "Repetir anualmente". A contagem para trás pula todos os
   feriados. A contagem para frente só pula os que têm a opção processual. Sem ela, o protocolar
   cai em D−3 quando há feriado no meio da cadeia. O recesso forense não é pulado na contagem.
6. **Etiqueta sugerida do tipo** (`tipos_tarefas_x_etiquetas.php`): o fluxo automático aplica a
   etiqueta nas tarefas que cria. Ex.: PROVIDÊNCIA, ENVIAR, REVISAR, PROTOCOLO, COMPROMISSO.
7. **Clonar um tipo** copia as opções e a responsabilidade, mas o prazo volta 0, a etiqueta volta
   vazia e a área vem do original. Confira e ajuste tudo depois de clonar.

Telas, campos e ids: [reference.md](reference.md).

## Roteiro para mudar um fluxo

1. **Mapear o atual.** Leia a Árvore, a tela Prazos e o Fluxo Automático de cada tipo envolvido.
   Salve o "antes" num arquivo de controle (ex.: `antes-depois.md`), porque ele é o caminho de
   rollback.
2. **Comparar.** Monte uma tabela antes × novo. Marque os tipos compartilhados e os pontos que o
   fluxograma não decide. Pergunte ao usuário antes de aplicar, porque são decisões de negócio.
3. **Aplicar.** Altere os prazos dos tipos. Refaça as ligações cuja regra muda (apagar e incluir).
   Para um tipo novo: clone, ajuste área, responsável, prazo e etiqueta, e inclua no fluxo do pai.
4. **Testar.** Crie uma audiência de prova na pasta de teste (CI 57132). Use uma data umas 6
   semanas à frente e outra que cruze um feriado. Leia as datas geradas e apague com "Sim, pode
   apagar", que apaga as subtarefas junto. O VIOS recusa criar tarefa com a mesma descrição de
   outra aberta na pasta, então apague um teste antes do próximo.
5. **Reajustar o que já existe** (seção abaixo).
6. **Conferir tudo** com export novo (seção "Conferência").

## Operar tarefas já criadas

- **Exportar** pelo método da `vios-baixar-relatorio-csv` (departamento + tipos + pendentes, CSV,
  limite 9999999, datas vazias). Ligue cada tarefa à audiência pela coluna Histórico ("Criada
  automaticamente ao criar a tarefa X CI N").
- **Cuidado com cadeias velhas.** Ligar tarefa à UNA "pela pasta" só é seguro se a pasta tem uma
  única audiência e a tarefa pai não é de UNA cancelada ou concluída. Em 27/10 isso juntou cadeias
  velhas à cadeia certa.
- **Revisão antes de gravar.** Gere uma planilha com o valor atual e o novo, e só aplique com
  aprovação explícita no chat.
- **Datas**: só pela ação Prorrogar, porque a edição da tarefa bloqueia as datas. Use o tipo
  Reagendamento e um motivo, com conclusão igual ao limite. Ignore a pergunta seguinte "Prorrogar
  Subtarefas?": cada tarefa recebe a própria data.
- **Cancelar**: a tela de cancelamento vem com "DESISTÊNCIA DO CLIENTE" marcado por padrão. Troque
  pela justificativa certa (DUPLICIDADE, PRAZO/TAREFA NÃO UTILIZADA...). Cancelar uma UNA **não**
  cancela as filhas, então cancele as filhas primeiro.
- **Apagar** (só para testes): `pxe.php?act=del`, depois "Sim, pode apagar".
- **Etiqueta em tarefa existente**: na edição da tarefa, o campo de etiquetas é editável.
  Acrescente a nova e mantenha as que já existem.
- **Transferir pastas de área** (roteiro completo na skill `vios-transferir-pastas`): use as ações de lote da pasta (departamento, área, advogado com `distribuir_tarefas` em Não, adicionar e remover auxiliar). Depois troque os responsáveis tarefa a tarefa, seguindo o fluxo: enviar com o responsável, revisar com a dupla, protocolar com o responsável + Samuel. Antes de gravar, exporte os prazos abertos das pastas no VIOS: a base recebida pode estar defasada. Teste em uma pasta real e confira antes do resto.
- **Gravar uma tarefa tem efeitos**: caracteres fora do Latin-1 viram "?" e data em feriado processual é empurrada. Veja [automacao.md](automacao.md).
- **Criar em lote**: abra a tela de inserir num iframe, porque o tipo preenche os responsáveis por
  JS. Confirme o aviso "data mais de 6 meses à frente".
- **Todo lote**: confira o valor atual antes de gravar (pule a tarefa se mudou), grave e releia
  para confirmar. Scripts testados: [automacao.md](automacao.md).

## Conferência

Exporte todas as tarefas abertas dos tipos do fluxo e compare cada uma com a regra: D−N da
audiência pulando fins de semana e feriados, conclusão igual ao limite, nenhuma duplicada por
audiência, etiqueta certa. Separe as exceções em grupos e mostre o que fazer com cada um. É normal
aparecerem atas de audiências que acabaram de acontecer, e cadeias cuja contestação já foi
concluída (a ligação pelo Histórico quebra no elo concluído).

## Limites de sessão e segurança

- Alteração em produção só com aprovação explícita **no chat**. Um pedido feito em comentário de
  documento é barrado pelo classificador da sessão. Peça a confirmação no chat.
- O Claude in Chrome pode recusar o host ("Host access is restricted by policy"). Nesse caso, use o
  navegador do app. O login é do usuário: espere-o entrar com AskUserQuestion, sem encerrar a vez,
  porque a sessão do VIOS cai quando o painel fecha. Com o painel oculto, a página desacelera e
  scripts estouram tempo.
- O `javascript_tool` corta respostas acima de ~50 mil caracteres. Para trazer muitos dados, faça a
  resposta passar desse tamanho de propósito: ela é salva em arquivo e pode ser lida no shell.
