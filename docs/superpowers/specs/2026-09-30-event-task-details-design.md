# Tarefas de eventos com detalhes

Design aprovado pelo usuário: lista com detalhes expansíveis, busca e filtros, progresso e edição de título, descrição, responsável, prazo e etapa. A degustação apresenta horário, local, participantes e cardápio nos detalhes.

Manter os componentes, cores e tipografia do sistema. Agrupar as tarefas nas etapas pré-evento, dia do evento, pós-evento e sem etapa. Mostrar resumo de andamento e filtros por status, atraso, responsável e texto. A criação rápida continua disponível; um formulário permite criar ou editar os campos existentes. Confirmar a exclusão e manter a integração com o Planner.

Reutilizar event_tasks e sua descrição em texto simples. Sem migração de banco, sem interpretar a descrição como HTML, sem criar convites ou mensagens para participantes. Horário, local e participantes da degustação serão registrados na descrição; o prazo é a data. Não inventar próximas datas, duração, endereço ou responsável.

Dados da degustação e participantes ficam diretamente no evento, sem versionar dados pessoais nem anexos originais. Separar degustação, avaliação, aprovação final do buffet e escolha dos drinks. Preservar responsáveis, prazos e status das demais tarefas.

Persistência: aguardar confirmação do banco antes de fechar o formulário; apresentar falhas e preservar a edição para nova tentativa. Desabilitar ações durante gravação. Testar busca, filtros, agrupamento e envio dos campos editados; conferir compilação e layout responsivo.
