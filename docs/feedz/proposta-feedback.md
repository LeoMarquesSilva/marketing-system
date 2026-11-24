# Feedback contínuo no ORQESTRAI: proposta

Status em 23/11/2026: **proposta, aguardando aprovação**. Nenhuma tabela ou tela foi criada.

## 1. Como a empresa usa o feedback hoje no Feedz

Dados lidos do Histórico de Feedbacks do Feedz em 23/11/2026, pela API interna `GET /api/gestao/feedbacks/historico`.

| O que | Número |
|---|---|
| Feedbacks desde 04/09/2025 | **496** (118 em 2025 e 378 em 2026) |
| Pessoas que enviaram | 31 |
| Entregas das **Boas práticas** | 181, todas enviadas pela Andressa (Operações Legais) para 15 gestores, sem nota. É o RH avisando o gestor da ocorrência |
| Feedbacks entre pessoas | cerca de 315 |
| Marcados como "foi presencial" | 172. O feedback foi conversado e depois registrado |
| Com nota por valor CIVIL | 193, com nota de 1 a 5 em um ou mais valores |
| Com modelo de texto | 127. O mais usado é o da casa, "Bismarchi Pires", com 81 |
| Com resposta | 148, até 3 mensagens de ida e volta |
| Lidos | 431 (87%) |
| Anônimos | 0. O anônimo está desligado |

**Recursos ligados**:
- pedir feedback;
- anotação interna, que só o autor vê;
- compartilhar no LinkedIn;
- excluir até 24 h depois de enviar (depois disso, só o admin, e o apagado fica guardado);
- limite de 10 por dia para quem não é gestor;
- lembrete ao gestor a cada 30 dias sem enviar feedback;
- radar CIVIL da pessoa comparado com a média da empresa;
- tela de médias por pessoa e por valor para o RH.

**O que dói hoje com as Boas práticas:**
- O RH registra a ocorrência no ORQESTRAI (`/rh/boas-praticas`), manda o aviso ao gestor pelo Feedz e depois importa uma planilha do Feedz para marcar o que foi visualizado.
- Dos 186 registros, só 11 estão ligados a um envio do Feedz.
- O cruzamento por data e gestor falha muito.

## 2. Benchmark

Fontes: centrais de ajuda oficiais, consultadas em 23/11/2026. Os sistemas com feedback contínuo documentado são Lattice, Culture Amp, 15Five, Leapsome, Betterworks, Small Improvements, Officevibe (Workleap) e o próprio Feedz. BambooHR e Viva Glint só têm feedback em ciclo. Qulture.Rocks e Gupy/Pulses não publicam detalhes.

**O que vale trazer:**

| Ideia | Quem faz | Por quê |
|---|---|---|
| **Visibilidade escolhida no envio**: privado, destinatário + gestor, ou público (só para reconhecimento). Não muda depois | Lattice, 15Five, Leapsome ([Lattice](https://help.lattice.com/en-us/articles/15178958-customize-feedback-visibility-options-for-your-organization), [15Five](https://success.15five.com/hc/en-us/articles/50989064497435)) | Responde "quem vê" sem uma regra única para todos: quem escreve decide, dentro do que a empresa liberar |
| **Valores como etiqueta (1 ou 2 por feedback)**, com gráfico de quais valores aparecem mais | Lattice, 15Five, Culture Amp Shoutouts | Nota em estrelas em cada valor só existe no Feedz; nota de colega por valor fica perto de avaliação de desempenho |
| **Botão "Melhorar com IA"** depois de uns 100 caracteres, guiado por SCI (situação–comportamento–impacto) | Culture Amp ("Improve"), Lattice (Writing Assist) ([Lattice](https://lattice.com/blog/writing-assist-leverage-ai-to-deliver-high-quality-feedback-with-ease)) | Feedback mais específico e menos vago |
| **Pedido com perguntas, prazo e lembrete antes do prazo**; o gestor pode pedir feedback sobre um liderado | Small Improvements, Culture Amp, 15Five ([Small Improvements](https://intercomdocs.small-improvements.com/en/articles/9180034-anytime-feedback-giving-and-requesting-feedback)) | Hoje o pedido do Feedz é só um texto solto |
| **Reação e resposta** com a mesma visibilidade do feedback | Lattice, Culture Amp, Officevibe | Mantém a conversa sem expor a mais gente |
| **Painel de cobertura**: quem não deu, não pediu e não recebeu em 30, 60 e 90 dias, por área; gestores parados | Culture Amp ([relatórios](https://support.cultureamp.com/en/articles/11820959-anytime-feedback-admin-reporting)) | Troca o lembrete fixo de 30 dias por aviso só para quem está parado |
| **RH sem ler o conteúdo entre colegas por padrão**; o RH vê números e exclui com registro | Culture Amp, 15Five | Dá segurança para o feedback sincero |

**O que nenhum deles tem e o ORQESTRAI manteria:** a confirmação de leitura ("visualizado"), que é diferencial do Feedz.

**Armadilhas:**
- **Ranking de quem mais recebe** reconhecimento reduz a ajuda entre colegas; ranking de quem mais dá aumenta ([estudo, Gies/Illinois](https://giesbusiness.illinois.edu/news/2026/03/26/peer-to-peer-recognition-leaderboards-givers-vs-receivers)). Meta e limite viram cota.
- **Anonimato** abre espaço para ataque. Melhor manter identificado, como hoje.
- **Mural só de elogios**: o construtivo tem de ser sempre privado. Vale medir a proporção de construtivos e de pedidos respondidos, não só o volume.
- **Opção "só gestor"**, em que o liderado não vê o que disseram dele, vira dossiê oculto. Não incluir.
- **IA de terceiros**: o texto sai para o fornecedor de IA. Usar a chave da OpenAI do escritório e deixar claro na tela.
- **Ocorrência de convivência misturada com feedback**: a louça na pia contando como feedback distorce os números. **Nenhum dos sistemas mistura as duas coisas.**

## 3. Como ficaria no ORQESTRAI

### 3.1 Telas

**Feedback** (`/feedback`, para todos):
- **Topo**:
  - botões **Dar feedback** e **Pedir feedback**;
  - números: recebidos, enviados e pedidos esperando resposta;
  - radar CIVIL da pessoa com os selos do BP Awards, comparado com a média da empresa.
- **Abas**: Recebidos, Enviados, Pedidos.
- **Cartão de cada feedback**:
  - foto de quem enviou;
  - valores CIVIL com selo e estrelas;
  - texto;
  - selos "presencial" e "lido em …";
  - conversa de respostas.
- **Modal centralizado "Dar feedback"**:
  1. pessoa, num seletor com foto e busca;
  2. tipo: **Reconhecimento** ou **Desenvolvimento** (construtivo);
  3. valores CIVIL que se aplicam, em chips com o selo (1 ou 2). As estrelas de 1 a 5 ficam como opção, ver decisão 4;
  4. modelo de texto em chips: Livre, Bismarchi Pires, SCI (Situação–Comportamento–Impacto), Parar/Continuar/Começar e os outros que o RH cadastrar;
  5. texto, com o botão **Melhorar com IA**;
  6. **quem vê**: só a pessoa; a pessoa e o gestor dela; ou todos no mural da tela inicial (só para reconhecimento);
  7. switch "Foi conversado pessoalmente";
  8. anotação só minha.
- **Pedir feedback**: escolher uma ou mais pessoas, sobre o quê (ex.: "a audiência de ontem") e prazo opcional. Quem recebe o pedido responde com um feedback já ligado a ele.

**Minha equipe** (gestor, junto com PDI e 1:1):
- dias desde o último feedback dado a cada liderado;
- alerta passando do prazo (hoje são 30 dias).

**Gestão** (`/rh/feedback`, RH):
- **Histórico** com filtros: área, pessoa, valor, período, presencial, lido.
- **Médias** por pessoa e por valor, no lugar da "Gestão de Feedbacks" do Feedz.
- **Apagados**, para auditoria.
- **Configurações**:
  - modelos de texto;
  - limite por dia;
  - lembrete ao gestor;
  - quem vê o quê;
  - compartilhar no LinkedIn, ligado ou desligado.

### 3.2 Boas práticas saindo daqui

- A ocorrência registrada em `/rh/boas-praticas` ganha o botão **Enviar**. Ele manda um feedback do tipo "Boa prática" com:
  - o tema do manual;
  - a data;
  - as fotos e vídeos;
  - o link para a página do manual.
- Quando a pessoa abre, o "visualizado" do painel das Boas práticas se marca sozinho. Acaba a planilha do Feedz e o cruzamento por data.
- **Decisão sua**: para quem vai, ao gestor (como hoje) ou direto ao colaborador. Hoje a regra é **não enviar nada sem você pedir**.

### 3.3 Avisos (sino para todos)

- Hoje cada módulo tem o próprio sino: RH, cronograma de conteúdo, Minhas entregas.
- A proposta é **um sino geral**, com uma tabela única de avisos, e o feedback como o primeiro a usar.
- **Avisos do feedback**:
  - feedback recebido;
  - pedido recebido;
  - resposta;
  - lembrete do gestor.
- **Canais**:
  - sino no topo, para todos;
  - e-mail pelo Microsoft 365, desligado por padrão e ligável em Configurações (como na 1:1);
  - push no celular, que já existe para os leads.
- Depois, comunicados, 1:1 e PDI usam o mesmo sino.

### 3.4 Regras

| Regra | Proposta | Hoje no Feedz |
|---|---|---|
| Anônimo | Não | Desligado |
| Excluir | Até 24 h; depois só o RH, e o apagado fica guardado | Igual |
| Limite | 10 por dia para quem não é gestor (configurável) | Igual |
| Lembrete ao gestor | A cada 30 dias sem dar feedback a um liderado (configurável) | Igual |
| Quem vê | Quem envia escolhe: só a pessoa, a pessoa e o gestor, ou mural público (só reconhecimento). O RH vê números; ler o conteúdo é **decisão sua** | O admin lê tudo no Histórico; o gestor vê na Jornada do Colaborador |
| Boas práticas | Tipo próprio, fora das contas de feedback e dos valores CIVIL | Saem como feedback comum e entram no volume |

### 3.5 Dados (resumo)

| Tabela | O que guarda |
|---|---|
| `hr_feedbacks` | de, para, tipo (feedback ou boa prática), notas CIVIL, modelo, texto, presencial, enviado em, lido em, apagado em/por, `feedz_id`, ligação com a boa prática e com o pedido |
| `hr_feedback_replies` | conversa de respostas |
| `hr_feedback_requests` | pedidos: de, para, sobre o quê, prazo, status |
| `hr_feedback_notes` | anotação privada de cada autor |
| `hr_feedback_templates` | modelos de texto |
| `hr_feedback_settings` | limites, lembrete, quem vê, LinkedIn |
| `notifications` | sino geral: para quem, tipo, título, link, lido em |

### 3.6 Migração do Feedz

- **Os 496 feedbacks**:
  - pela mesma API do histórico;
  - campos: de, para, texto, notas por valor, modelo, presencial, data, lido em e respostas;
  - pessoas casadas pelo e-mail, como no PDI e na 1:1.
- **As 181 entregas de Boas práticas** entram como tipo "Boa prática" e, quando der, são ligadas ao registro de `/rh/boas-praticas`.
- **Ficam de fora**: a **anotação interna** de cada autor e os **pedidos de feedback**.
  - Os dois só aparecem na página da própria pessoa ("Ver anotações internas", "Solicitações Recebidas/Enviadas").
  - Nem o admin tem uma lista da empresa toda para exportar (conferido em 23/11/2026).
  - Quem quiser guardar uma anotação copia antes de o Feedz sair.

### 3.7 Lançamento

Como na 1:1: primeiro **só RH e admin** (trava no código), para testar com dados reais. Depois libera para todos.

### 3.8 Fases

1. **Feedback**: dar, pedir, responder, ler, Gestão do RH, sino geral e importação do Feedz.
2. **Boas práticas** enviadas daqui e a aba Minha equipe (com PDI e 1:1).
3. **Extras**, se você quiser: IA para ajudar a escrever e compartilhar no LinkedIn.

## 4. Decisões que são suas

1. **Quem vê**:
   - Quem envia escolhe entre só a pessoa, a pessoa e o gestor, ou o mural (recomendado, como Lattice e 15Five)?
   - O RH lê o conteúdo de tudo, como no Feedz hoje, ou só vê os números?
2. **Boas práticas**: passam a sair pelo ORQESTRAI, como tipo próprio e fora das contas? Para o gestor, como hoje, ou direto para o colaborador?
3. **Tipos**: separar **Reconhecimento** (pode ir para o mural) de **Desenvolvimento** (sempre privado), em vez de um tipo só como no Feedz?
4. **Valores CIVIL**: só como etiqueta (recomendado pelo benchmark) ou manter as estrelas de 1 a 5, como hoje?
5. **Limite de 10 por dia** e **lembrete ao gestor a cada 30 dias**: manter, ou trocar o lembrete pelo painel de cobertura (aviso só para quem está parado) e tirar o limite, que vira cota?
6. **Sino geral** para todos agora, servindo depois a comunicados, 1:1 e PDI? E-mail ligado ou desligado no começo?
7. **Importar os 496** do Feedz, incluindo as 181 entregas de Boas práticas?
8. **Lançar primeiro só para RH e admin**, como a 1:1?
9. **Compartilhar no LinkedIn**: manter?
10. **IA para ajudar a escrever** (deixar no formato SCI, ajustar o tom): entra agora ou depois?

## 5. Decidido em 23/11/2026

| # | Decisão |
|---|---|
| 1 | **Quem vê**: quem envia escolhe, na hora do envio, entre só a pessoa, a pessoa e o gestor dela, ou o mural (só reconhecimento). Não muda depois. Não existe a opção "só o gestor". |
| 1b | **O RH lê tudo**, como hoje no Feedz: o texto de todos os feedbacks, além dos números. A tela de envio avisa que o RH tem acesso. |
| 2 | **Boas práticas saem pelo ORQESTRAI para o gestor**, como tipo próprio, fora das contas de feedback e dos valores. O "visualizado" entra sozinho no painel das Boas práticas. |
| 3 | **Dois tipos**: Reconhecimento (pode ir para o mural) e Desenvolvimento (sempre privado). |
| 4 | **Valores CIVIL só como etiqueta** (1 ou 2, com o selo), sem estrelas. As notas do Feedz entram como histórico. |
| 5 | **Sem limite de envio**. Painel de cobertura (30, 60 e 90 dias) e aviso só para o gestor parado, no lugar do lembrete fixo. |
| 6 | **Sino geral para todos**, com push no celular e e-mail desligado (ligável em Configurações). Depois serve a comunicados, 1:1 e PDI. |
| 7 | **Importar os 496** do Feedz. As 181 entregas de Boas práticas entram como tipo próprio e são ligadas aos registros quando der. |
| 8 | **Lançamento só para RH e admin**, com trava no código, como a 1:1. |
| 9 | **LinkedIn fica para depois**, junto com o mural. |
| 10 | **"Melhorar com IA" entra já**, no formato SCI, com a chave da OpenAI do escritório e aviso na tela. |
