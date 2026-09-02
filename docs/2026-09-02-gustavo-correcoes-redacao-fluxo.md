# Módulo Gustavo — correções de redação e fluxo editorial

Data: 02/09/2026  
Status: diagnóstico e backlog de correções; implementação pendente.

## 1. Objetivo

Fazer o módulo transformar uma notícia e uma leitura editorial escolhida em conteúdo claro, com gancho, coerência e fidelidade ao posicionamento do Gustavo Bismarchi. A interface precisa deixar evidente como avançar da escolha editorial até a geração, revisão e aprovação.

Este documento consolida a análise do código e a consulta somente em leitura dos dados do módulo. Não significa que as correções foram implementadas, que o modelo foi alterado ou que houve publicação em produção.

## 2. Resumo do diagnóstico

O problema não é apenas o modelo GPT. Existem falhas na estrutura solicitada à IA, na seleção da ideia principal, no uso da voz do Gustavo e nas condições que mostram as ações da interface.

Evidências da análise:

- O modelo padrão no código é `gpt-4.1-mini`. Não havia substituição na configuração local consultada. A configuração efetiva de produção não foi confirmada.
- O mesmo modelo é utilizado para avaliação de pauta, ângulos, redação e compliance.
- O LinkedIn é solicitado como uma string livre; o Reel tem um campo explícito de gancho.
- O único post com texto encontrado na consulta tinha 1.487 caracteres, nenhuma quebra de linha e abertura de notícia.
- A consulta encontrou zero amostras de voz e zero teses cadastradas. Há respostas fornecidas no item analisado; portanto, não é correto dizer que não existe nenhuma opinião disponível.
- Selecionar uma leitura editorial só salva o ângulo. Não libera, por si só, uma ação de geração.
- A aplicação de um gancho alternativo pode remover todo o desenvolvimento quando o post possui um único parágrafo. A expressão usada no editor foi reproduzida isoladamente e confirmou esse comportamento.

Limites da análise:

- Um único texto salvo não é uma avaliação estatística da qualidade do modelo.
- Não foi realizada comparação entre modelos com os mesmos exemplos.
- Os fatos e números da notícia de exemplo não foram checados externamente; a análise foi de redação e funcionamento do produto.
- O risco de autorreferência no histórico foi identificado no código, mas não foi comprovado como causa do texto salvo.

## 3. Prioridades

| Prioridade | Correção | Resultado esperado |
| --- | --- | --- |
| P0 | Impedir perda de texto ao aplicar gancho | Trocar a abertura sem apagar o desenvolvimento |
| P0 | Mostrar uma ação clara depois da escolha editorial | Nenhuma pauta editável fica sem um próximo passo |
| P1 | Exigir gancho e estrutura no LinkedIn | Texto pronto para leitura, sem bloco único |
| P1 | Definir uma tese central antes da redação | Um argumento principal conduz o post |
| P1 | Acrescentar revisão editorial | Detectar texto confuso, genérico ou sem gancho |
| P1 | Corrigir uso do histórico | Não comparar a pauta consigo mesma nem trocar seu ângulo silenciosamente |
| P1 | Separar configuração dos modelos e avaliar alternativas | Melhorar a redação com custo e qualidade medidos |
| P2 | Alimentar voz e teses reais | Aproximar os textos da linguagem e das opiniões aprovadas do Gustavo |
| P2 | Melhorar rastreabilidade das gerações e das fontes | Saber com qual contexto, modelo e versão de prompt cada texto foi produzido |

P0: bloqueio de fluxo ou risco de perda de conteúdo. P1: qualidade e confiabilidade da geração. P2: personalização e sustentação da qualidade.

## 4. Correções necessárias

### 4.1. Botão de geração após a escolha editorial — P0

**Problema confirmado**

Clicar em uma das três leituras executa apenas `select_angle`. O botão de gerar aparece quando `opinion_status` é `validated` e ainda não existe post. Já o bloco para responder ou seguir sem visão depende de a pauta estar em `aguardando_opiniao` e de haver perguntas geradas.

Isso deixa combinações de estado sem uma ação para continuar, por exemplo: uma pauta sem opinião validada e sem perguntas. O próprio fluxo de análise pode manter uma pauta no status `radar`, que não mostra o bloco de perguntas.

**Correção proposta**

- Exibir uma ação principal junto das três leituras: **Gerar conteúdo com esta leitura**.
- Exigir uma seleção clara antes de habilitar a ação. Distinguir a primeira sugestão pré-selecionada automaticamente de uma escolha confirmada pelo usuário.
- Com base editorial suficiente, gerar o conteúdo com o ângulo escolhido.
- Sem opinião, oferecer caminhos explícitos: **Adicionar minha visão e gerar** ou **Gerar análise factual**.
- O caminho factual não pode inventar experiências, opiniões pessoais ou aprovação do Gustavo.
- Não marcar uma opinião como validada apenas porque o usuário pulou as perguntas. Hoje `saveItemAnswers` faz isso também no caminho de pular a visão; a regra precisa separar disponibilidade para gerar de validação de opinião.
- Separar **Salvar respostas** de **Gerar conteúdo**, ou usar um rótulo combinado inequívoco. Hoje **Usar minhas respostas** salva e gera automaticamente.
- Informar carregamento, sucesso, falha e nova tentativa sem exigir que o usuário redigite respostas já salvas.
- Manter as restrições de permissão e de estados aprovados/publicados. Não liberar geração indiscriminadamente em todas as etapas.

**Critérios de aceite**

- [ ] Uma pauta editável com leituras disponíveis sempre apresenta o próximo passo, inclusive sem perguntas geradas.
- [ ] O ângulo exibido como escolhido é o enviado para a geração.
- [ ] Sem visão validada, a interface explica a diferença entre adicionar opinião e gerar análise factual.
- [ ] Uma falha de geração preserva respostas e escolha editorial.
- [ ] Cliques repetidos não disparam gerações concorrentes.
- [ ] Trocar a leitura ou regenerar não descarta edições locais silenciosamente.
- [ ] Ações de aprovação, publicação e permissões continuam respeitadas.

### 4.2. Aplicação de gancho sem apagar o texto — P0

**Problema confirmado**

O botão de gancho remove o texto desde o início até a primeira linha em branco. Se não houver linha em branco, remove o post inteiro antes de inserir o novo gancho.

**Correção proposta**

- Tratar gancho e desenvolvimento como partes identificáveis.
- Substituir somente a abertura identificada, preservando o corpo.
- Para textos antigos de um único parágrafo, não presumir que todo o conteúdo é o gancho. Oferecer uma prévia ou inserir a nova abertura sem remoção destrutiva quando não for possível separar com segurança.
- Permitir desfazer a troca e manter a versão original da IA.

**Critérios de aceite**

- [ ] Post vazio, post de um parágrafo e post de vários parágrafos têm comportamentos cobertos por testes.
- [ ] Quebras de linha de Windows e de outros ambientes são tratadas.
- [ ] Aplicar outro gancho preserva desenvolvimento e fechamento.
- [ ] Trocas sucessivas não acumulam aberturas indevidamente.
- [ ] Edições manuais e versão original não são perdidas.

### 4.3. Gancho obrigatório e estrutura de LinkedIn — P1

**Problema confirmado**

O contrato atual pede `linkedinPost` como texto livre. `alternativeHooks` aceita até três opções, inclusive nenhuma, e não obriga que alguma seja utilizada no post. O prompt proíbe algumas aberturas genéricas, mas não define uma abertura positiva e concreta.

**Correção proposta**

- Solicitar gancho, desenvolvimento em parágrafos e fechamento de forma estruturada.
- Montar o post final de maneira determinística, garantindo que o gancho seja sua primeira parte.
- Pedir três alternativas distintas, alinhadas à mesma tese, e identificar qual foi aplicada.
- Orientar a abertura a apresentar tensão, consequência ou contraste relevante para o ICP, sem sensacionalismo ou promessa indevida.
- Usar parágrafos curtos, uma ideia por parágrafo e contexto factual enxuto.
- Definir limites editoriais de extensão e validar a composição final, preservando compatibilidade com textos já existentes.
- Separar as instruções do LinkedIn das instruções do Reel, mesmo que a primeira implementação ainda use uma única chamada.

**Critérios de aceite**

- [ ] Todo novo post começa com o gancho escolhido.
- [ ] O post não é entregue como um bloco único de texto.
- [ ] Gancho, corpo e fechamento desenvolvem a mesma tese.
- [ ] As alternativas não são apenas pequenas reformulações do título da notícia.
- [ ] Não há CTA comercial, dados inventados ou opinião pessoal sem base autorizada.

### 4.4. Uma tese central antes de escrever — P1

**Problema observado**

O texto analisado combina muitos argumentos e dá mais destaque à notícia do que à ideia principal das respostas fornecidas.

**Correção proposta**

Preparar um resumo editorial enxuto antes da redação contendo:

1. Leitura escolhida pelo usuário.
2. Tese central sustentada por respostas ou teses aprovadas; na ausência delas, conclusão factual sem atribuição pessoal.
3. ICP e decisão empresarial para a qual o conteúdo deve ser útil.
4. Dois ou três fatos de apoio, distinguindo fonte, interpretação e opinião.
5. Consequência prática que o leitor deve compreender.
6. Limites: afirmações que não podem ser feitas com os dados disponíveis.

Se o ângulo escolhido e a opinião fornecida forem incompatíveis, sinalizar a divergência. Não substituir a escolha editorial silenciosamente.

**Exemplo editorial baseado nas respostas disponíveis**

A resposta fornecida contém a ideia: “Reestruturar dívida não é o mesmo que reestruturar o negócio.” Uma abertura possível seria:

> Renegociar a dívida não resolve um negócio que continua sem gerar caixa.
>
> Essa é a diferença entre reestruturar o passivo e reestruturar a empresa.

O exemplo ilustra hierarquia da mensagem, não valida os fatos da notícia nem representa aprovação do Gustavo.

**Critérios de aceite**

- [ ] É possível resumir o argumento principal de cada post em uma frase.
- [ ] Cada parágrafo contribui para esse argumento.
- [ ] Posicionamento e ICP orientam o texto, sem aparecer como jargão interno.
- [ ] Nenhuma opinião nova é atribuída ao Gustavo para preencher lacunas.

### 4.5. Revisão editorial além do compliance — P1

**Problema confirmado**

A revisão existente avalia compliance. Não há uma etapa específica que rejeite um texto por falta de gancho, excesso de assuntos, linguagem genérica ou leitura ruim.

**Correção proposta**

- Avaliar abertura, clareza, coerência, especificidade, legibilidade e aderência à visão fornecida.
- Manter compliance como verificação independente; boa redação não substitui conformidade.
- Permitir uma rodada limitada de revisão automática, preservando a tese e os fatos.
- Se ainda houver falhas, mostrar os motivos e permitir edição, sem loops de geração ou consumo sem limite.

**Critérios de aceite**

- [ ] Um texto sem gancho ou sem parágrafos é sinalizado.
- [ ] A revisão não introduz fatos ou opiniões que não estavam na base.
- [ ] O usuário consegue distinguir problemas editoriais de alertas de compliance.
- [ ] Falhas de revisão não descartam o rascunho já produzido.

### 4.6. Histórico sem autorreferência — P1

**Problema identificado no código**

O histórico inclui rascunhos e não exclui explicitamente a pauta atual. A regeneração pode comparar o item consigo mesmo e solicitar variação de ângulo. Além disso, o resumo do histórico usa o primeiro gancho alternativo como se fosse a abertura utilizada.

**Correção proposta**

- Selecionar o identificador dos itens históricos e excluir a pauta em geração.
- Usar a abertura efetivamente salva/publicada, não uma alternativa não aplicada.
- Separar repetição de assunto, de tese e de gancho.
- Tratar variação como orientação subordinada à leitura escolhida; uma mudança de tese exige uma decisão explícita.

**Critérios de aceite**

- [ ] Regenerar a única pauta do módulo não gera alerta de repetição contra ela mesma.
- [ ] Outra pauta realmente semelhante continua sendo identificada.
- [ ] O histórico não atribui a um post uma abertura que não foi usada.
- [ ] A geração preserva o ângulo escolhido na ausência de uma alteração explícita.

### 4.7. Modelo adequado por etapa — P1

**Situação atual**

O fallback é `gpt-4.1-mini`, com uma configuração compartilhada entre as etapas. Uma troca global afetaria mais do que a redação. Também falta confirmar qual configuração está efetivamente ativa em produção.

**Recomendação a validar**

- Separar as configurações de triagem, redação e revisão.
- Manter um modelo econômico na triagem, sujeito à qualidade medida.
- Avaliar `gpt-5.6-sol` como candidato para redação e revisão, comparando com `gpt-5.6-terra` e com o modelo atual.
- Confirmar disponibilidade na conta, suporte do SDK e parâmetros aceitos antes da mudança. Não copiar parâmetros entre famílias sem verificar compatibilidade.
- Usar o mesmo prompt revisado e as mesmas entradas na comparação. Separadamente, comparar o prompt antigo com o revisado no mesmo modelo para distinguir os ganhos.
- Registrar qualidade, latência, consumo e custo por conteúdo completo.

**Critérios de aceite**

- [ ] O modelo efetivo de cada etapa é verificável sem expor credenciais.
- [ ] Pelo menos dez pautas representativas são comparadas, incluindo casos com e sem opinião e com pouca base factual.
- [ ] As versões são avaliadas sem identificar o modelo para o avaliador, usando os critérios da seção 4.5.
- [ ] O modelo escolhido apresenta ganho observado, não apenas reputação ou maior preço.
- [ ] Há configuração de retorno ao modelo anterior e tratamento explícito de indisponibilidade.
- [ ] Structured output, timeout e compatibilidade do SDK são validados em ambiente de teste.

Os candidatos acima refletem a documentação oficial consultada em 02/09/2026. Não há evidência, nesta análise, de que um deles já seja superior para a voz do Gustavo.

### 4.8. Voz, teses e qualidade da base — P2

**Problema confirmado**

Não havia amostras de voz nem teses na consulta. Além disso, o contexto de voz usa no máximo seis amostras cortadas em 700 caracteres cada, o que pode perder desenvolvimento e conclusão quando houver material cadastrado.

**Correção proposta**

- Cadastrar de cinco a dez textos autênticos ou explicitamente aprovados pelo Gustavo, como conjunto inicial.
- Registrar teses validadas e limites de posicionamento, sem promover sugestões da IA a opiniões aprovadas.
- Identificar origem e aprovação das amostras; textos gerados e não aprovados não devem alimentar automaticamente a voz.
- Selecionar exemplos relevantes e preservar sua estrutura dentro do orçamento de contexto, sem cortes arbitrários que eliminem o fechamento.
- Mostrar na interface quando a personalização está limitada por ausência de referências.

**Critérios de aceite**

- [ ] Só teses validadas podem justificar atribuição pessoal de opinião.
- [ ] Textos de terceiros não são apresentados como voz autêntica do Gustavo.
- [ ] A ausência de base de voz é visível e não vira promessa de personalização completa.
- [ ] A geração usa as referências pertinentes sem simplesmente copiar frases.

### 4.9. Rastreabilidade e qualidade das fontes — P2

**Lacunas observadas**

Não foi possível associar o texto salvo a um identificador de modelo registrado por geração. No item analisado, o corpo completo da matéria não estava preservado, embora o código atual já contemple esse campo.

**Correção proposta**

- Registrar modelo, versão do prompt, data, modo editorial, ângulo e referências utilizadas por geração.
- Preservar versões anteriores, inclusive após regeneração, com política de retenção e acesso adequada.
- Distinguir corpo integral da matéria, resumo extraído e respostas do usuário.
- Se a fonte estiver incompleta, sinalizar a limitação e evitar apresentar informação não verificada como fato confirmado.
- Caso sejam necessários novos campos ou tabelas, preparar migração compatível com os registros existentes. Nenhuma migração é executada como parte deste documento.

**Critérios de aceite**

- [ ] É possível identificar como cada nova versão foi produzida.
- [ ] Ausência de matéria completa aparece como limitação, não é ocultada.
- [ ] Logs não expõem chaves, tokens ou dados pessoais desnecessários.
- [ ] Textos e aprovações existentes continuam acessíveis.

## 5. Mapa dos arquivos envolvidos

Os caminhos abaixo são relativos à raiz do repositório. São referências para a futura implementação, não uma lista de arquivos já alterados.

| Arquivo | Responsabilidade na correção |
| --- | --- |
| `src/components/gustavo-content/item-workspace.tsx` | Escolha editorial, próxima ação, perguntas, geração, aplicação de gancho e estados de interface |
| `src/lib/gustavo-content/items.ts` | Seleção de ângulo, contexto, histórico, persistência de respostas e geração |
| `src/lib/gustavo-content/workflow.ts` | Separar autorização para gerar de validação de opinião; respeitar estados |
| `src/lib/gustavo-content/answers.ts` | Tratar respostas e caminho sem visão sem criar falsa validação |
| `src/lib/gustavo-content/prompts.ts` | Resumo editorial, gancho, estrutura e revisão |
| `src/lib/gustavo-content/schemas.ts` | Contratos estruturados e validação das saídas |
| `src/lib/gustavo-content/ai.ts` | Modelos por etapa, contexto de voz e chamadas de geração/revisão |
| `src/lib/gustavo-content/constants.ts` | Configuração e fallback dos modelos |
| `src/lib/gustavo-content/history.ts` | Comparação sem autorreferência e abertura realmente utilizada |
| `src/lib/gustavo-content/types.ts` | Tipos compatíveis com os contratos e estados resultantes |
| `src/lib/gustavo-content/editorial-context.ts` | Qualidade e disponibilidade do contexto factual |
| `src/app/api/gustavo-content/items/[id]/route.ts` | Ações explícitas e tratamento de erros da geração |

Reaproveitar testes existentes de `workflow`, `answers`, `history`, `editorial-context`, `voice` e `theses`. Acrescentar testes específicos para montagem do LinkedIn, troca de gancho e estados da interface.

## 6. Sequência recomendada e validação

- [ ] Corrigir primeiro o risco de perda de texto e o fluxo sem botão de geração.
- [ ] Ajustar contrato de redação, tese central e composição do LinkedIn.
- [ ] Corrigir histórico e introduzir revisão editorial limitada.
- [ ] Comparar modelos com exemplos representativos e registrar a decisão.
- [ ] Alimentar a base de voz/teses e acrescentar rastreabilidade.
- [ ] Executar `npm test -- src/lib/gustavo-content` e acrescentar os testes de interface conforme a infraestrutura disponível.
- [ ] Executar lint dos arquivos alterados e `npm run build`.
- [ ] Validar manualmente em desktop e mobile: notícia → leitura → visão ou análise factual → geração → edição → revisão → aprovação.
- [ ] Simular ausência de perguntas, ausência de opinião, falha de geração, nova tentativa, troca de ângulo, texto de um parágrafo e edições não salvas.
- [ ] Avaliar os textos com leitura humana: teste técnico passando não comprova boa redação.

Este backlog não autoriza publicação automática, alteração de dados reais, execução de migrações ou push. Preservar alterações não relacionadas quando a implementação for solicitada.

## 7. Referências oficiais para a avaliação dos modelos

- [GPT-4.1 mini — características e capacidades](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
- [Orientação atual da família GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model).
- [Seleção de modelos com avaliação de qualidade, custo e latência](https://developers.openai.com/api/docs/guides/model-selection).

## 8. Definição de conclusão

A correção estará concluída quando a pessoa conseguir escolher a notícia e a leitura, enxergar como gerar, obter um post com gancho e uma tese clara, editar sem perder conteúdo e revisar sem confundir texto factual com opinião validada. A escolha do modelo deve estar apoiada em comparação real, e não ser tratada como substituto das correções do fluxo editorial.
