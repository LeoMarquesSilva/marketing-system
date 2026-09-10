# Cronograma de Conteúdo

Implementação autorizada em 09/09/2026 após revisão do plano.

Marketing (incluindo designer)/admin cadastra vagas por área, formato (post ou reel) e data de entrega/gravação. Gestores distribuem colaboradores ativos de suas áreas. Reutilizar identificação de liderança e escopos do Férias, sem converter permissão global de RH em gestão global de conteúdo. Colaboradores consultam sua escala.

O cronograma não solicita tema. A aprovação efetiva em Conteúdo para Post associa automaticamente o conteúdo à vaga compatível do colaborador. Reels experimentais não preenchem vagas; a confirmação de uso persiste o roteiro no estúdio e associa a vaga. A escolha usa colaborador, área normalizada, formato, vaga não cancelada/livre e proximidade de até 14 dias. Empates e ausência de vaga ficam pendentes para Marketing. Repetir a operação não consome outra vaga. A atualização concorrente deve preservar a primeira associação.

Alertas consultivos de repetição aparecem no módulo de seleção: mesma fonte ou assunto semelhante em publicações e conteúdos em produção. Exibir evidências e permitir continuar; similaridade é heurística, não garantia de ausência de repetição.

Vínculos comprovados por identificador ligam conteúdo, Planner e Instagram. Data da tarefa não é data publicada. Publicações podem ter múltiplos participantes. Importação de 2026 preserva planilha, aba/linha, nomes e status originais. Casamentos incertos ficam para conferência. Conclusão no Excel não implica publicação comprovada. Importação repetida não sobrescreve decisões posteriores.

Tela mensal agrupada por área, filtros e contadores de previstas, atribuídas, com conteúdo e publicadas. Marketing corrige pendências e vincula publicações históricas explicitamente. Interface conforme PRODUCT.md e DESIGN.md, com desktop/mobile, carregamento, vazio e erros.

Revisão aprovada: a entrada padrão passa a ser um calendário mensal, com lista como visão secundária e agenda no mobile. Gestores têm uma terceira visão para responsáveis pendentes. Nome abreviado confirmado como identidade pode atualizar todo o histórico importado daquele nome; substituição de inativo, transferido ou “a definir” afeta somente tarefas futuras não canceladas, preservando o histórico original.

Verificação: testes de autorização, idempotência e ambiguidade; similaridade exata/temática; importação com nomes incompletos e cancelamentos; TypeScript, lint e revisão de integração. Validar schema e importação remotos somente com o banco configurado deste projeto. Publicação Git/Vercel não integra esta autorização.
