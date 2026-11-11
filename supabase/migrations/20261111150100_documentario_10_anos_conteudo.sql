-- Conteúdo do minidocumentário dos 10 anos, carregado do documento
-- Projeto_Minidocumentario_BP_10_Anos_ORQESTRAI.md (versão 1.0, novembro de 2026).
-- Gerado por script; só roda se o projeto ainda não existir.
do $seed$
begin
if exists (select 1 from public.documentary_projects where slug = 'bp-10-anos') then return; end if;
insert into public.documentary_projects (id, slug, eyebrow, title, subtitle, tagline, signature, version_label, status_label, usage_note, access_note, event_id, event_task_id, festa_target_seconds, extended_target_seconds) values (
  'c7ca6837-ef4b-457b-ab85-3746473157f1', 'bp-10-anos', $q$Bismarchi | Pires · 10 anos$q$, $q$O que construímos juntos$q$,
  $q$Projeto de minidocumentário comemorativo | Direção criativa, narrativa, roteiro e plano de produção$q$,
  $q$Toda história tem um ponto de partida. A nossa começou muito antes de 2016.$q$,
  $q$10 anos de história. Os próximos capítulos, juntos.$q$, '1.0',
  $q$Proposta criativa para alinhamento e validação$q$,
  $q$Cadastro e acompanhamento no ORQESTRAI; briefing para os sócios e o filmmaker$q$,
  $q$Interno / equipe de produção. Contém tópicos biográficos a serem autorizados pelos entrevistados.$q$,
  'a4c3bb58-49c6-4d45-a161-38bdafcf1a6c', '43150705-ddfd-4981-93ff-53af9efe41b9', 350, 560);
insert into public.documentary_people (project_id, key, name, short_name, user_id, is_approver, sort) values
  ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 'Ricardo Viscardi Pires', 'Ricardo', 'ee154f53-d53e-460a-8b88-f2164564ffd3', true, 1),
  ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 'Gustavo Bismarchi Motta', 'Gustavo', '9394f718-5e3a-4b2a-ae53-84faefcd4c7e', true, 2);
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('327f9189-8fb5-4765-b48a-d3e099709f41', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'resumo-executivo', '1', $q$Resumo executivo$q$, $q$Produzir um minidocumentário intimista sobre os primeiros dez anos do Bismarchi | Pires, narrado principalmente por seus fundadores, **Ricardo Viscardi Pires** e **Gustavo Bismarchi Motta**. O filme parte das experiências pessoais dos dois, acompanha a criação e a evolução do escritório, reconhece a contribuição de colaboradores, clientes e parceiros e termina convidando o público a participar dos próximos capítulos.

A produção será construída com **entrevistas individuais, sem falas decoradas**, imagens de arquivo, fotografias antigas e captação cinematográfica da operação atual. Não será um vídeo institucional tradicional, uma retrospectiva de números ou um discurso de premiação. Será uma história verdadeira sobre escolhas, pessoas, confiança, trabalho e futuro.

**Entregas centrais**

- **Filme para a festa:** 5 a 6 minutos, com meta editorial de **5min50s**.
- **Versão estendida:** até 10 minutos, com meta de **9min20s**.
- **Acervo preservado:** entrevistas e fotografias organizadas, com acessos e usos autorizados.
- **Recortes opcionais:** trechos curtos para comunicação institucional após a comemoração.

**Decisão criativa:** o filme começa pelas pessoas que deram origem ao BP e termina reconhecendo todas as pessoas que fazem parte de sua história. A celebração dos dez anos será um marco de passagem, não um ponto final.$q$, 10, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('327f9189-8fb5-4765-b48a-d3e099709f41', 1, $q$Resumo executivo$q$, $q$Produzir um minidocumentário intimista sobre os primeiros dez anos do Bismarchi | Pires, narrado principalmente por seus fundadores, **Ricardo Viscardi Pires** e **Gustavo Bismarchi Motta**. O filme parte das experiências pessoais dos dois, acompanha a criação e a evolução do escritório, reconhece a contribuição de colaboradores, clientes e parceiros e termina convidando o público a participar dos próximos capítulos.

A produção será construída com **entrevistas individuais, sem falas decoradas**, imagens de arquivo, fotografias antigas e captação cinematográfica da operação atual. Não será um vídeo institucional tradicional, uma retrospectiva de números ou um discurso de premiação. Será uma história verdadeira sobre escolhas, pessoas, confiança, trabalho e futuro.

**Entregas centrais**

- **Filme para a festa:** 5 a 6 minutos, com meta editorial de **5min50s**.
- **Versão estendida:** até 10 minutos, com meta de **9min20s**.
- **Acervo preservado:** entrevistas e fotografias organizadas, com acessos e usos autorizados.
- **Recortes opcionais:** trechos curtos para comunicação institucional após a comemoração.

**Decisão criativa:** o filme começa pelas pessoas que deram origem ao BP e termina reconhecendo todas as pessoas que fazem parte de sua história. A celebração dos dez anos será um marco de passagem, não um ponto final.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('0f3d0e8f-badd-460c-bd0f-1be31c3c315e', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'contexto', '2', $q$Contexto do evento e público$q$, $q$A exibição está planejada para a festa comemorativa dos dez anos do escritório, com aproximadamente **60 colaboradores** e **mais de 120 clientes e consultores** convidados, totalizando um público estimado de **180 pessoas ou mais**.

O conceito da celebração é o de **jornada e continuidade**: convidar as pessoas a embarcarem com o BP nos próximos dez ou vinte anos. Esse conceito também se conecta aos brindes previstos: um kit de viagem composto por seis nécessaires organizadoras de mala e uma sacola.

**O que cada público precisa sentir**

- **Colaboradores:** orgulho, reconhecimento, pertencimento e responsabilidade pela próxima etapa.
- **Clientes:** confiança na história, na consistência das relações e no compromisso com situações empresariais complexas.
- **Consultores e parceiros:** reconhecimento por terem contribuído para o percurso e convite para o futuro.
- **Fundadores:** representação respeitosa, verdadeira e humana de suas trajetórias.

**Critério de sucesso:** ao terminar a projeção, o público deve lembrar não somente do crescimento do escritório, mas principalmente das histórias e pessoas que o tornaram possível.$q$, 20, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('0f3d0e8f-badd-460c-bd0f-1be31c3c315e', 1, $q$Contexto do evento e público$q$, $q$A exibição está planejada para a festa comemorativa dos dez anos do escritório, com aproximadamente **60 colaboradores** e **mais de 120 clientes e consultores** convidados, totalizando um público estimado de **180 pessoas ou mais**.

O conceito da celebração é o de **jornada e continuidade**: convidar as pessoas a embarcarem com o BP nos próximos dez ou vinte anos. Esse conceito também se conecta aos brindes previstos: um kit de viagem composto por seis nécessaires organizadoras de mala e uma sacola.

**O que cada público precisa sentir**

- **Colaboradores:** orgulho, reconhecimento, pertencimento e responsabilidade pela próxima etapa.
- **Clientes:** confiança na história, na consistência das relações e no compromisso com situações empresariais complexas.
- **Consultores e parceiros:** reconhecimento por terem contribuído para o percurso e convite para o futuro.
- **Fundadores:** representação respeitosa, verdadeira e humana de suas trajetórias.

**Critério de sucesso:** ao terminar a projeção, o público deve lembrar não somente do crescimento do escritório, mas principalmente das histórias e pessoas que o tornaram possível.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('fd8338d6-9eef-44b7-9e37-bd5de48e1486', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'conceito', '3', $q$Conceito criativo e mensagem central$q$, $q$### 3.1 Título principal

**O QUE CONSTRUÍMOS JUNTOS**

### 3.2 Linha conceitual

*Toda história tem um ponto de partida. A nossa começou muito antes de 2016.*

### 3.3 Assinatura final sugerida

**10 anos de história. Os próximos capítulos, juntos.**

### 3.4 Ideia condutora

A história do BP começa antes da fundação formal, nas experiências que influenciaram as escolhas profissionais de Ricardo e Gustavo. Em 2016, os caminhos se encontram na construção de um escritório. Dez anos depois, essa decisão envolve uma equipe numerosa, relações com clientes e uma atuação reconhecida na reestruturação empresarial. O futuro depende da continuidade dessas relações.

### 3.5 Metáfora da viagem

A festa utiliza a linguagem de jornada. O documentário adotará a mesma ideia de forma **sutil e elegante**, por meio de imagens e palavras como ponto de partida, caminho, escolhas, encontros, direção, capítulos e futuro.

**Evitar:** animações de avião, trilhas de aeroporto, excesso de malas na narrativa, locução de “embarque imediato” ou repetição literal do conceito em todos os capítulos. O kit viagem pode ter sentido simbólico sem virar uma peça publicitária dentro do filme.

### 3.6 Curva emocional

1. **Curiosidade:** quem eram os fundadores antes de construir o escritório?
2. **Identificação:** quais acontecimentos pessoais contribuíram para suas escolhas?
3. **Tensão real:** que incertezas e decisões marcaram o início?
4. **Significado:** por que a atuação do BP importa para empresas e pessoas?
5. **Pertencimento:** quem ajudou a transformar a iniciativa dos dois em uma construção coletiva?
6. **Orgulho e convite:** o que deve permanecer e para onde seguimos?$q$, 30, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('fd8338d6-9eef-44b7-9e37-bd5de48e1486', 1, $q$Conceito criativo e mensagem central$q$, $q$### 3.1 Título principal

**O QUE CONSTRUÍMOS JUNTOS**

### 3.2 Linha conceitual

*Toda história tem um ponto de partida. A nossa começou muito antes de 2016.*

### 3.3 Assinatura final sugerida

**10 anos de história. Os próximos capítulos, juntos.**

### 3.4 Ideia condutora

A história do BP começa antes da fundação formal, nas experiências que influenciaram as escolhas profissionais de Ricardo e Gustavo. Em 2016, os caminhos se encontram na construção de um escritório. Dez anos depois, essa decisão envolve uma equipe numerosa, relações com clientes e uma atuação reconhecida na reestruturação empresarial. O futuro depende da continuidade dessas relações.

### 3.5 Metáfora da viagem

A festa utiliza a linguagem de jornada. O documentário adotará a mesma ideia de forma **sutil e elegante**, por meio de imagens e palavras como ponto de partida, caminho, escolhas, encontros, direção, capítulos e futuro.

**Evitar:** animações de avião, trilhas de aeroporto, excesso de malas na narrativa, locução de “embarque imediato” ou repetição literal do conceito em todos os capítulos. O kit viagem pode ter sentido simbólico sem virar uma peça publicitária dentro do filme.

### 3.6 Curva emocional

1. **Curiosidade:** quem eram os fundadores antes de construir o escritório?
2. **Identificação:** quais acontecimentos pessoais contribuíram para suas escolhas?
3. **Tensão real:** que incertezas e decisões marcaram o início?
4. **Significado:** por que a atuação do BP importa para empresas e pessoas?
5. **Pertencimento:** quem ajudou a transformar a iniciativa dos dois em uma construção coletiva?
6. **Orgulho e convite:** o que deve permanecer e para onde seguimos?$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('89b33ddf-6328-480a-9a2d-582ad8567ac9', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'proposito', '4', $q$Propósito, missão, visão e valores como história$q$, $q$**Fonte interna:** apresentação “Ciclo PE27_WS_05nov2026”, especialmente a página 3 (conceitos institucionais) e a página 5 (metáfora de mapa, bússola, missão e visão).

> **Propósito apresentado no PE27:** “Transformar desafios jurídicos em oportunidades, construindo relações duradouras e criando impactos reais para pessoas e negócios.”

> **Missão sugerida no PE27:** “Apoiar empresários, empresas, credores e investidores em decisões críticas de crise, conflito e complexidade, unindo técnica jurídica, visão de negócio e execução disciplinada, antes, durante e depois do problema.”

> **Visão apresentada no PE27:** “Ser um dos escritórios mais relevantes do Brasil em Direito Empresarial, reconhecido pela atuação em situações de alta complexidade, crise e transformação empresarial.”

**Valores CIVIL apresentados no PE27:** Cliente no centro; Inovação constante; Valorização de pessoas; Inteligência em resultados; Liberdade para criar.

**Atenção:** a missão está identificada como **sugerida** no material. Confirmar a redação institucional aprovada antes de apresentá-la como definitiva em qualquer vídeo ou peça pública.

**Aplicação narrativa (sem recitar slogans):**

| Pilar | Em vez de dizer... | Mostrar ou perguntar... |
|---|---|---|
| Propósito | “Transformamos desafios em oportunidades.” | Como uma situação empresarial difícil pode afetar pessoas e negócios? Por que isso mobiliza Gustavo e Ricardo? |
| Missão | “Atuamos com excelência técnica.” | Qual decisão exigiu combinar direito, visão de negócio e execução? |
| Visão | “Queremos ser referência nacional.” | O que significa o reconhecimento alcançado e o que ainda querem construir? |
| Cliente no centro | “Temos foco no cliente.” | O que significa ser procurado em um momento crítico? Qual gesto de confiança marcou vocês? |
| Valorização das pessoas | “Nossa equipe é nosso maior ativo.” | Quando perceberam que o escritório havia se tornado uma construção coletiva? |
| Inovação e inteligência | “Somos inovadores.” | Como a operação precisou mudar para continuar atendendo desafios cada vez maiores? |$q$, 40, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('89b33ddf-6328-480a-9a2d-582ad8567ac9', 1, $q$Propósito, missão, visão e valores como história$q$, $q$**Fonte interna:** apresentação “Ciclo PE27_WS_05nov2026”, especialmente a página 3 (conceitos institucionais) e a página 5 (metáfora de mapa, bússola, missão e visão).

> **Propósito apresentado no PE27:** “Transformar desafios jurídicos em oportunidades, construindo relações duradouras e criando impactos reais para pessoas e negócios.”

> **Missão sugerida no PE27:** “Apoiar empresários, empresas, credores e investidores em decisões críticas de crise, conflito e complexidade, unindo técnica jurídica, visão de negócio e execução disciplinada, antes, durante e depois do problema.”

> **Visão apresentada no PE27:** “Ser um dos escritórios mais relevantes do Brasil em Direito Empresarial, reconhecido pela atuação em situações de alta complexidade, crise e transformação empresarial.”

**Valores CIVIL apresentados no PE27:** Cliente no centro; Inovação constante; Valorização de pessoas; Inteligência em resultados; Liberdade para criar.

**Atenção:** a missão está identificada como **sugerida** no material. Confirmar a redação institucional aprovada antes de apresentá-la como definitiva em qualquer vídeo ou peça pública.

**Aplicação narrativa (sem recitar slogans):**

| Pilar | Em vez de dizer... | Mostrar ou perguntar... |
|---|---|---|
| Propósito | “Transformamos desafios em oportunidades.” | Como uma situação empresarial difícil pode afetar pessoas e negócios? Por que isso mobiliza Gustavo e Ricardo? |
| Missão | “Atuamos com excelência técnica.” | Qual decisão exigiu combinar direito, visão de negócio e execução? |
| Visão | “Queremos ser referência nacional.” | O que significa o reconhecimento alcançado e o que ainda querem construir? |
| Cliente no centro | “Temos foco no cliente.” | O que significa ser procurado em um momento crítico? Qual gesto de confiança marcou vocês? |
| Valorização das pessoas | “Nossa equipe é nosso maior ativo.” | Quando perceberam que o escritório havia se tornado uma construção coletiva? |
| Inovação e inteligência | “Somos inovadores.” | Como a operação precisou mudar para continuar atendendo desafios cada vez maiores? |$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('f2588352-43b7-4afe-b738-f7c55167f63d', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'historias-pessoais', '5', $q$Histórias pessoais: tratamento e cuidados$q$, $q$### Ricardo | Origens, escolhas e trajetória

Há uma história pessoal que o próprio Ricardo gosta de contar: quando jovem, morava no **DIC, em Campinas**. A entrevista deve explorar essa memória a partir do significado que ele mesmo atribui à experiência: família, referências, estudo, ambições, pessoas importantes e decisões ao longo da vida.

**Não pressupor:** pobreza extrema, obstáculos específicos, superação heroica ou frases motivacionais que ele não tenha dito. O lugar de origem não deve virar caricatura. O objetivo é conhecer o Ricardo, não construir um personagem pronto.

### Gustavo | Experiência familiar e reestruturação

Gustavo acompanhou episódios de falência em empresas de seu pai, vivência que, segundo o contexto fornecido para o projeto, se relaciona com sua escolha profissional pela reestruturação empresarial. O assunto pode revelar que por trás de uma crise empresarial existem decisões, famílias, empregos e trajetórias.

**Não pressupor:** os sentimentos do pai ou do filho, as causas das falências, detalhes econômicos ou desfechos que não foram relatados. Perguntar com abertura e respeito, sem induzir respostas. **Validar previamente com Gustavo se o tema pode constar na versão exibida a clientes e parceiros.**

### Ponto de encontro

Essas duas histórias têm força quando convergem naturalmente para a criação do escritório. Não é necessário que sejam “iguais” ou tenham a mesma moral. Sua diferença é parte da autenticidade do filme.

**Pergunta narrativa:** como experiências pessoais distintas contribuíram para a construção de um projeto profissional compartilhado?$q$, 50, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('f2588352-43b7-4afe-b738-f7c55167f63d', 1, $q$Histórias pessoais: tratamento e cuidados$q$, $q$### Ricardo | Origens, escolhas e trajetória

Há uma história pessoal que o próprio Ricardo gosta de contar: quando jovem, morava no **DIC, em Campinas**. A entrevista deve explorar essa memória a partir do significado que ele mesmo atribui à experiência: família, referências, estudo, ambições, pessoas importantes e decisões ao longo da vida.

**Não pressupor:** pobreza extrema, obstáculos específicos, superação heroica ou frases motivacionais que ele não tenha dito. O lugar de origem não deve virar caricatura. O objetivo é conhecer o Ricardo, não construir um personagem pronto.

### Gustavo | Experiência familiar e reestruturação

Gustavo acompanhou episódios de falência em empresas de seu pai, vivência que, segundo o contexto fornecido para o projeto, se relaciona com sua escolha profissional pela reestruturação empresarial. O assunto pode revelar que por trás de uma crise empresarial existem decisões, famílias, empregos e trajetórias.

**Não pressupor:** os sentimentos do pai ou do filho, as causas das falências, detalhes econômicos ou desfechos que não foram relatados. Perguntar com abertura e respeito, sem induzir respostas. **Validar previamente com Gustavo se o tema pode constar na versão exibida a clientes e parceiros.**

### Ponto de encontro

Essas duas histórias têm força quando convergem naturalmente para a criação do escritório. Não é necessário que sejam “iguais” ou tenham a mesma moral. Sua diferença é parte da autenticidade do filme.

**Pergunta narrativa:** como experiências pessoais distintas contribuíram para a construção de um projeto profissional compartilhado?$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('4ee1bdd1-b9ea-4a13-8acc-8286f1626ae9', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'estrutura', '6', $q$Estrutura dramatúrgica$q$, $q$### Prólogo — Antes do escritório

Uma memória de Ricardo; uma memória de Gustavo. Duas trajetórias anteriores a 2016. Abertura com frase verdadeira retirada da entrevista, sem discurso escrito pelo marketing.

### Capítulo 1 — Quando os caminhos se encontraram

Como se conheceram, por que confiaram um no outro e qual decisão levou à fundação do Bismarchi | Pires.

### Capítulo 2 — Os primeiros passos

Primeiro local, equipe inicial, rotina, limitações, erros, aprendizados e decisões determinantes. Precisamos de uma cena concreta, não de uma lista de datas.

### Capítulo 3 — Por que fazemos o que fazemos

A conexão entre experiências pessoais, advocacia empresarial, recuperação judicial, transformação de crises e cuidado com relações humanas.

### Capítulo 4 — Ninguém constrói sozinho

Histórias de colaboradores, pessoas que chegaram nos primeiros anos, clientes que confiaram no escritório e consultores/parceiros que ajudaram na trajetória. O público presente na festa precisa se reconhecer neste capítulo.

### Capítulo 5 — Uma década depois

Mostrar o escritório atual, a evolução da estrutura, a atuação nacional e o reconhecimento no campo da reestruturação. Resultados são **consequência da história**, não seu eixo principal.

### Epílogo — Os próximos capítulos

O que deve permanecer nos próximos dez ou vinte anos? Como manter propósito e cultura durante o crescimento? Mensagem final dirigida às pessoas presentes, seguida da assinatura comemorativa.$q$, 60, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('4ee1bdd1-b9ea-4a13-8acc-8286f1626ae9', 1, $q$Estrutura dramatúrgica$q$, $q$### Prólogo — Antes do escritório

Uma memória de Ricardo; uma memória de Gustavo. Duas trajetórias anteriores a 2016. Abertura com frase verdadeira retirada da entrevista, sem discurso escrito pelo marketing.

### Capítulo 1 — Quando os caminhos se encontraram

Como se conheceram, por que confiaram um no outro e qual decisão levou à fundação do Bismarchi | Pires.

### Capítulo 2 — Os primeiros passos

Primeiro local, equipe inicial, rotina, limitações, erros, aprendizados e decisões determinantes. Precisamos de uma cena concreta, não de uma lista de datas.

### Capítulo 3 — Por que fazemos o que fazemos

A conexão entre experiências pessoais, advocacia empresarial, recuperação judicial, transformação de crises e cuidado com relações humanas.

### Capítulo 4 — Ninguém constrói sozinho

Histórias de colaboradores, pessoas que chegaram nos primeiros anos, clientes que confiaram no escritório e consultores/parceiros que ajudaram na trajetória. O público presente na festa precisa se reconhecer neste capítulo.

### Capítulo 5 — Uma década depois

Mostrar o escritório atual, a evolução da estrutura, a atuação nacional e o reconhecimento no campo da reestruturação. Resultados são **consequência da história**, não seu eixo principal.

### Epílogo — Os próximos capítulos

O que deve permanecer nos próximos dez ou vinte anos? Como manter propósito e cultura durante o crescimento? Mensagem final dirigida às pessoas presentes, seguida da assinatura comemorativa.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('f95e460d-9f11-4b23-b649-93a74b5bee60', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'roteiro-festa', '7', $q$Roteiro de montagem — filme para a festa (5min50s)$q$, $q$**Importante:** este é um roteiro de intenção, não de falas. Os trechos efetivamente utilizados dependerão das entrevistas reais e do acervo disponível.

| Tempo | Bloco | Áudio / intenção | Imagem / edição |
|---|---|---|---|
| **00:00–00:35** | Prólogo | Melhor memória pessoal de Ricardo ou Gustavo, com contraponto do outro. | Tela discreta, rosto dos entrevistados, foto pessoal autorizada ou outro arquivo pertinente. Começar sem cartela institucional extensa. |
| **00:35–01:20** | Caminhos se encontram | Como se conheceram e decidiram criar o BP. | Primeiras fotos dos sócios, primeiro espaço, arquivo de 2016. Título principal entra após despertar curiosidade. |
| **01:20–02:10** | Primeiros passos | Rotina dos primeiros anos e uma dificuldade ou decisão concreta. | Arquivo histórico; contraste com a operação atual quando fizer sentido. |
| **02:10–03:05** | Propósito | Motivações para atuar com empresas em crise, escolhas de atuação e responsabilidade diante do cliente. | Entrevistas em close, detalhes da operação, materiais neutros sem dados sigilosos. |
| **03:05–04:05** | Pessoas e relações | Primeiros colaboradores, crescimento, momentos de confiança de clientes e parceria com consultores. | Fotos da equipe antiga e atual, registros de encontros, cotidiano espontâneo. |
| **04:05–05:00** | BP hoje | Crescimento, reconhecimento na reestruturação e o que permanece desde o início. | Contraste visual passado/presente; poucos indicadores validados, com grafismo discreto. |
| **05:00–05:50** | Futuro e encerramento | Mensagens espontâneas de Ricardo e Gustavo para quem construiu os dez anos e seguirá no futuro. | Rostos, imagens coletivas, pausa emocional e cartela final: “10 anos de história. Os próximos capítulos, juntos.” |

**Regra de edição:** preservar a clareza narrativa mesmo se o público não conhecer a história do escritório. Toda pessoa na sala deve entender quem são os sócios, o que fizeram, por que isso importa e por que o futuro continua sendo uma construção compartilhada.$q$, 70, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('f95e460d-9f11-4b23-b649-93a74b5bee60', 1, $q$Roteiro de montagem — filme para a festa (5min50s)$q$, $q$**Importante:** este é um roteiro de intenção, não de falas. Os trechos efetivamente utilizados dependerão das entrevistas reais e do acervo disponível.

| Tempo | Bloco | Áudio / intenção | Imagem / edição |
|---|---|---|---|
| **00:00–00:35** | Prólogo | Melhor memória pessoal de Ricardo ou Gustavo, com contraponto do outro. | Tela discreta, rosto dos entrevistados, foto pessoal autorizada ou outro arquivo pertinente. Começar sem cartela institucional extensa. |
| **00:35–01:20** | Caminhos se encontram | Como se conheceram e decidiram criar o BP. | Primeiras fotos dos sócios, primeiro espaço, arquivo de 2016. Título principal entra após despertar curiosidade. |
| **01:20–02:10** | Primeiros passos | Rotina dos primeiros anos e uma dificuldade ou decisão concreta. | Arquivo histórico; contraste com a operação atual quando fizer sentido. |
| **02:10–03:05** | Propósito | Motivações para atuar com empresas em crise, escolhas de atuação e responsabilidade diante do cliente. | Entrevistas em close, detalhes da operação, materiais neutros sem dados sigilosos. |
| **03:05–04:05** | Pessoas e relações | Primeiros colaboradores, crescimento, momentos de confiança de clientes e parceria com consultores. | Fotos da equipe antiga e atual, registros de encontros, cotidiano espontâneo. |
| **04:05–05:00** | BP hoje | Crescimento, reconhecimento na reestruturação e o que permanece desde o início. | Contraste visual passado/presente; poucos indicadores validados, com grafismo discreto. |
| **05:00–05:50** | Futuro e encerramento | Mensagens espontâneas de Ricardo e Gustavo para quem construiu os dez anos e seguirá no futuro. | Rostos, imagens coletivas, pausa emocional e cartela final: “10 anos de história. Os próximos capítulos, juntos.” |

**Regra de edição:** preservar a clareza narrativa mesmo se o público não conhecer a história do escritório. Toda pessoa na sala deve entender quem são os sócios, o que fizeram, por que isso importa e por que o futuro continua sendo uma construção compartilhada.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('9267739a-46ba-4e94-9684-75297febb1de', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'versao-estendida', '8', $q$Versão estendida (alvo 9min20s)$q$, $q$A versão completa deve funcionar de forma independente, com aprofundamento de histórias e não apenas inserção de falas adicionais sem função narrativa.

| Tempo | Conteúdo aprofundado |
|---|---|
| **00:00–00:55** | Memórias pessoais e a abertura mais forte encontrada na gravação. |
| **00:55–02:10** | Infância/juventude, influências profissionais e aproximação entre Ricardo e Gustavo. |
| **02:10–03:25** | Fundação, primeira estrutura e cotidiano dos primeiros anos. |
| **03:25–04:45** | Decisão difícil ou virada determinante; as dúvidas e aprendizados envolvidos. |
| **04:45–06:00** | O significado da atuação empresarial e das recuperações judiciais. |
| **06:00–07:15** | Pessoas, cultura, clientes, consultores e confiança construída ao longo do tempo. |
| **07:15–08:20** | O escritório atual: evolução, reconhecimento e responsabilidade. |
| **08:20–09:20** | O que preservar, futuro, agradecimento e assinatura final. |$q$, 80, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('9267739a-46ba-4e94-9684-75297febb1de', 1, $q$Versão estendida (alvo 9min20s)$q$, $q$A versão completa deve funcionar de forma independente, com aprofundamento de histórias e não apenas inserção de falas adicionais sem função narrativa.

| Tempo | Conteúdo aprofundado |
|---|---|
| **00:00–00:55** | Memórias pessoais e a abertura mais forte encontrada na gravação. |
| **00:55–02:10** | Infância/juventude, influências profissionais e aproximação entre Ricardo e Gustavo. |
| **02:10–03:25** | Fundação, primeira estrutura e cotidiano dos primeiros anos. |
| **03:25–04:45** | Decisão difícil ou virada determinante; as dúvidas e aprendizados envolvidos. |
| **04:45–06:00** | O significado da atuação empresarial e das recuperações judiciais. |
| **06:00–07:15** | Pessoas, cultura, clientes, consultores e confiança construída ao longo do tempo. |
| **07:15–08:20** | O escritório atual: evolução, reconhecimento e responsabilidade. |
| **08:20–09:20** | O que preservar, futuro, agradecimento e assinatura final. |$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('05a2b7a2-52c1-447c-96ad-1189b6dbd467', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'entrevistas', '9', $q$Entrevistas: método e dinâmica$q$, $q$**Formato recomendado:** uma entrevista individual de 45 a 60 minutos com cada fundador, no mesmo cenário, seguida de uma conversa opcional de 10 a 15 minutos com ambos juntos.

**Pré-entrevista:** conversa reservada de aproximadamente 20 a 30 minutos com cada um, preferencialmente antes do dia de captação. Levantar acontecimentos reais, pessoas, datas e temas que autorizam divulgar. Mostrar fotografias históricas para estimular lembranças.

**Condução:** entrevistador posicionado ligeiramente fora da lente; perguntas abertas; deixar silêncio; não interromper respostas; aprofundar lembranças concretas. Pedir respostas que tenham contexto suficiente para funcionar sem a pergunta na edição.

**Prioridade prática:** não fazer todas as perguntas abaixo. Selecionar de 8 a 12 principais por pessoa, com espaço para perguntas complementares.


**Evitar perguntas indutivas:** “Você sempre soube que daria certo, não é?” ou “Não foi emocionante superar tudo isso?”. A resposta deve pertencer ao entrevistado.$q$, 90, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('05a2b7a2-52c1-447c-96ad-1189b6dbd467', 1, $q$Entrevistas: método e dinâmica$q$, $q$**Formato recomendado:** uma entrevista individual de 45 a 60 minutos com cada fundador, no mesmo cenário, seguida de uma conversa opcional de 10 a 15 minutos com ambos juntos.

**Pré-entrevista:** conversa reservada de aproximadamente 20 a 30 minutos com cada um, preferencialmente antes do dia de captação. Levantar acontecimentos reais, pessoas, datas e temas que autorizam divulgar. Mostrar fotografias históricas para estimular lembranças.

**Condução:** entrevistador posicionado ligeiramente fora da lente; perguntas abertas; deixar silêncio; não interromper respostas; aprofundar lembranças concretas. Pedir respostas que tenham contexto suficiente para funcionar sem a pergunta na edição.

**Prioridade prática:** não fazer todas as perguntas abaixo. Selecionar de 8 a 12 principais por pessoa, com espaço para perguntas complementares.


**Evitar perguntas indutivas:** “Você sempre soube que daria certo, não é?” ou “Não foi emocionante superar tudo isso?”. A resposta deve pertencer ao entrevistado.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('1e1fd263-4ae3-46ce-8090-6d0c8a5e5375', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'abertura-final', '10', $q$Roteiro conceitual de abertura e final$q$, $q$### Abertura, primeiros 35–40 segundos

1. **00:00–00:05:** tela discreta; áudio ambiente real ou início da primeira memória; sem locução institucional.
2. **00:05–00:17:** Ricardo ou Gustavo surge no enquadramento, trazendo uma lembrança pessoal que tenha força narrativa.
3. **00:17–00:28:** o outro sócio amplia ou contrapõe a ideia, com apoio de arquivo autorizado.
4. **00:28–00:40:** primeira conexão com a origem do BP; entra o título “O que construímos juntos”.

**Não escrever falas antecipadamente.** O montador escolherá as frases reais mais relevantes após a transcrição das entrevistas.

### Encerramento, últimos 45–50 segundos

1. Ricardo e Gustavo respondem à pergunta sobre quem tornou os dez anos possíveis.
2. Entram imagens reais das pessoas e relações que marcaram o percurso; preservar momentos de silêncio, quando funcionarem.
3. A última fala deve olhar para o futuro e convidar todos a continuarem essa história.
4. Tela final com assinatura: **“10 anos de história. Os próximos capítulos, juntos.”**
5. Logo oficial do Bismarchi | Pires e indicação **2016–2026**.

**Conexão com o cerimonial:** considerar entrada dos sócios no palco imediatamente após o vídeo, com uma breve mensagem ou convite simbólico para os próximos anos.$q$, 100, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('1e1fd263-4ae3-46ce-8090-6d0c8a5e5375', 1, $q$Roteiro conceitual de abertura e final$q$, $q$### Abertura, primeiros 35–40 segundos

1. **00:00–00:05:** tela discreta; áudio ambiente real ou início da primeira memória; sem locução institucional.
2. **00:05–00:17:** Ricardo ou Gustavo surge no enquadramento, trazendo uma lembrança pessoal que tenha força narrativa.
3. **00:17–00:28:** o outro sócio amplia ou contrapõe a ideia, com apoio de arquivo autorizado.
4. **00:28–00:40:** primeira conexão com a origem do BP; entra o título “O que construímos juntos”.

**Não escrever falas antecipadamente.** O montador escolherá as frases reais mais relevantes após a transcrição das entrevistas.

### Encerramento, últimos 45–50 segundos

1. Ricardo e Gustavo respondem à pergunta sobre quem tornou os dez anos possíveis.
2. Entram imagens reais das pessoas e relações que marcaram o percurso; preservar momentos de silêncio, quando funcionarem.
3. A última fala deve olhar para o futuro e convidar todos a continuarem essa história.
4. Tela final com assinatura: **“10 anos de história. Os próximos capítulos, juntos.”**
5. Logo oficial do Bismarchi | Pires e indicação **2016–2026**.

**Conexão com o cerimonial:** considerar entrada dos sócios no palco imediatamente após o vídeo, com uma breve mensagem ou convite simbólico para os próximos anos.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('a3cdcc8b-2480-4fb1-ac22-8cb55b31b2ab', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'fotografia', '11', $q$Direção de fotografia e ambientação$q$, $q$**Linguagem:** documental intimista, elegante, sóbria e contemporânea. Evitar aparência de podcast, talk show ou publicidade de banco de imagens.

- **Cenário:** uma poltrona ou cadeira confortável em ambiente reservado, silencioso, com profundidade visual e fundo discreto.
- **Enquadramento A:** plano médio (rosto, tronco e parte das mãos).
- **Enquadramento B:** plano fechado para expressões e pausas. Se não houver segunda câmera, planejar alternativas de enquadramento sem comprometer continuidade.
- **Olhar:** ligeiramente fora da lente, em direção ao entrevistador.
- **Luz:** principal suave e lateral, contrastes controlados, tons quentes discretos no fundo.
- **Áudio:** captação prioritária; microfone de qualidade, gravação de segurança e registro do som ambiente da sala.
- **Roupa:** social elegante, sem estampas distraidoras; alinhar cores com fotografia.
- **Formato:** captação preferencial em 4K; versões finais 16:9, legíveis em tela grande.
- **Identidade:** tipografia e paleta institucionais em cartelas e créditos, sem excesso de branding durante as entrevistas.$q$, 110, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('a3cdcc8b-2480-4fb1-ac22-8cb55b31b2ab', 1, $q$Direção de fotografia e ambientação$q$, $q$**Linguagem:** documental intimista, elegante, sóbria e contemporânea. Evitar aparência de podcast, talk show ou publicidade de banco de imagens.

- **Cenário:** uma poltrona ou cadeira confortável em ambiente reservado, silencioso, com profundidade visual e fundo discreto.
- **Enquadramento A:** plano médio (rosto, tronco e parte das mãos).
- **Enquadramento B:** plano fechado para expressões e pausas. Se não houver segunda câmera, planejar alternativas de enquadramento sem comprometer continuidade.
- **Olhar:** ligeiramente fora da lente, em direção ao entrevistador.
- **Luz:** principal suave e lateral, contrastes controlados, tons quentes discretos no fundo.
- **Áudio:** captação prioritária; microfone de qualidade, gravação de segurança e registro do som ambiente da sala.
- **Roupa:** social elegante, sem estampas distraidoras; alinhar cores com fotografia.
- **Formato:** captação preferencial em 4K; versões finais 16:9, legíveis em tela grande.
- **Identidade:** tipografia e paleta institucionais em cartelas e créditos, sem excesso de branding durante as entrevistas.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('3020027c-8d9e-4362-ada2-f4167ea30836', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'broll', '12', $q$Lista de captação complementar (B-roll)$q$, $q$**Critério:** registrar o trabalho real, sem simular discussões jurídicas ou exibir informações confidenciais.

### Ambiente e arquitetura

- Fachada/entrada e identificação do escritório.
- Corredores em uso e planos mais silenciosos de abertura ou fim de expediente.
- Salas de reunião em enquadramentos abertos e detalhes arquitetônicos.
- Transições de luz e profundidade que funcionem como respiro visual.

### Pessoas e cultura

- Interações espontâneas entre profissionais de diferentes áreas.
- Reuniões reais, sem áudio de conteúdo sensível e com autorização dos presentes.
- Equipes de operações jurídicas, áreas técnicas e suporte, além dos advogados.
- Registros de encontros internos e momentos coletivos, quando houver autorização.

### Detalhes e texturas

- Mãos escrevendo ou consultando materiais sem informação sigilosa.
- Livros, cadernos, fotografias de época e objetos que tenham relação verdadeira com a história.
- Detalhes de mesas, espaços e materiais do escritório.
- Fotos históricas fisicamente manipuladas, se existirem, com cuidado de conservação.

### Planos sugeridos de transição

- **Antes e depois:** primeira sala e local atual em enquadramentos aproximados, se o acervo permitir.
- **Primeira equipe e equipe atual:** fotos de época seguidas de registros reais recentes.
- **Dois sócios / muitas pessoas:** fotos históricas dos fundadores seguidas de planos da operação atual.

**Proibido na edição:** usar imagens genéricas de empresas desconhecidas como se fossem arquivos do BP; encenar situações antigas sem sinalização; mostrar nomes, processos ou documentos de clientes sem autorização.$q$, 120, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('3020027c-8d9e-4362-ada2-f4167ea30836', 1, $q$Lista de captação complementar (B-roll)$q$, $q$**Critério:** registrar o trabalho real, sem simular discussões jurídicas ou exibir informações confidenciais.

### Ambiente e arquitetura

- Fachada/entrada e identificação do escritório.
- Corredores em uso e planos mais silenciosos de abertura ou fim de expediente.
- Salas de reunião em enquadramentos abertos e detalhes arquitetônicos.
- Transições de luz e profundidade que funcionem como respiro visual.

### Pessoas e cultura

- Interações espontâneas entre profissionais de diferentes áreas.
- Reuniões reais, sem áudio de conteúdo sensível e com autorização dos presentes.
- Equipes de operações jurídicas, áreas técnicas e suporte, além dos advogados.
- Registros de encontros internos e momentos coletivos, quando houver autorização.

### Detalhes e texturas

- Mãos escrevendo ou consultando materiais sem informação sigilosa.
- Livros, cadernos, fotografias de época e objetos que tenham relação verdadeira com a história.
- Detalhes de mesas, espaços e materiais do escritório.
- Fotos históricas fisicamente manipuladas, se existirem, com cuidado de conservação.

### Planos sugeridos de transição

- **Antes e depois:** primeira sala e local atual em enquadramentos aproximados, se o acervo permitir.
- **Primeira equipe e equipe atual:** fotos de época seguidas de registros reais recentes.
- **Dois sócios / muitas pessoas:** fotos históricas dos fundadores seguidas de planos da operação atual.

**Proibido na edição:** usar imagens genéricas de empresas desconhecidas como se fossem arquivos do BP; encenar situações antigas sem sinalização; mostrar nomes, processos ou documentos de clientes sem autorização.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('646d1938-c0b9-499b-ae78-7aef8420e909', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'acervo', '13', $q$Acervo histórico e linha do tempo$q$, $q$A linha do tempo servirá de apoio à montagem. Não é necessário fazer o filme percorrer todos os anos em ordem cronológica.

| Categoria | Material desejado | Questões de validação |
|---|---|---|
| Origens pessoais | Imagens antigas de Ricardo e Gustavo, quando autorizadas | Quem aparece? Quando foi? Pode ser exibido? |
| Fundação | Fotografias da primeira sede, logotipos antigos, documentos institucionais públicos | Data e localização confirmadas? Direitos de uso? |
| Primeira operação | Equipe inicial, mesas, salas e rotina | Quem está retratado? Há autorização? |
| Mudanças | Fotos de expansão, novas sedes, eventos e marcos | Qual foi o impacto real do acontecimento? |
| Pessoas | Encontros, celebrações, equipes antigas e atuais | Preservar diversidade de áreas e tempo de casa. |
| Clientes e parceiros | Registros públicos ou autorizados de encontros e relações | Existe consentimento específico para divulgação? |
| Reconhecimento | Premiações, rankings, participações em eventos | Confirmar data, fonte e redação da conquista. |
| Presente | Imagens atuais da equipe e dos espaços | Cuidado com telas e materiais confidenciais. |

**Linha do tempo mínima a pesquisar:** 2016 (fundação); primeira estrutura; primeiras pessoas-chave; mudanças de operação/sede; marcos de crescimento e especialização; transformações operacionais; 2026 (dez anos). As datas intermediárias dependem de pesquisa interna e confirmação dos sócios.

### Controle de acervo recomendado no ORQESTRAI

Para cada item: **ID, arquivo, ano estimado, descrição, pessoas retratadas, proprietário/fonte, autorização, capítulo possível, status de revisão**. Separar materiais **aprovados**, **pendentes** e **não utilizáveis**.$q$, 130, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('646d1938-c0b9-499b-ae78-7aef8420e909', 1, $q$Acervo histórico e linha do tempo$q$, $q$A linha do tempo servirá de apoio à montagem. Não é necessário fazer o filme percorrer todos os anos em ordem cronológica.

| Categoria | Material desejado | Questões de validação |
|---|---|---|
| Origens pessoais | Imagens antigas de Ricardo e Gustavo, quando autorizadas | Quem aparece? Quando foi? Pode ser exibido? |
| Fundação | Fotografias da primeira sede, logotipos antigos, documentos institucionais públicos | Data e localização confirmadas? Direitos de uso? |
| Primeira operação | Equipe inicial, mesas, salas e rotina | Quem está retratado? Há autorização? |
| Mudanças | Fotos de expansão, novas sedes, eventos e marcos | Qual foi o impacto real do acontecimento? |
| Pessoas | Encontros, celebrações, equipes antigas e atuais | Preservar diversidade de áreas e tempo de casa. |
| Clientes e parceiros | Registros públicos ou autorizados de encontros e relações | Existe consentimento específico para divulgação? |
| Reconhecimento | Premiações, rankings, participações em eventos | Confirmar data, fonte e redação da conquista. |
| Presente | Imagens atuais da equipe e dos espaços | Cuidado com telas e materiais confidenciais. |

**Linha do tempo mínima a pesquisar:** 2016 (fundação); primeira estrutura; primeiras pessoas-chave; mudanças de operação/sede; marcos de crescimento e especialização; transformações operacionais; 2026 (dez anos). As datas intermediárias dependem de pesquisa interna e confirmação dos sócios.

### Controle de acervo recomendado no ORQESTRAI

Para cada item: **ID, arquivo, ano estimado, descrição, pessoas retratadas, proprietário/fonte, autorização, capítulo possível, status de revisão**. Separar materiais **aprovados**, **pendentes** e **não utilizáveis**.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('4068ca1a-b871-472c-a811-4bd3d7a9653d', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'indicadores', '14', $q$Reconhecimento e indicadores institucionais$q$, $q$O BP é apresentado institucionalmente como um escritório de destaque nacional em recuperações judiciais ajuizadas, com atuação empresarial e em situações complexas. A conexão com a história de Gustavo permite abordar a reestruturação pelo significado humano e estratégico, não apenas por números.

**Indicadores internos disponíveis para eventual uso visual:** mais de 60 profissionais; mais de 8 mil processos distribuídos; cerca de 200 clientes ativos; aproximadamente R$ 6 bilhões sob gestão jurídica. **Validar dados, fonte, data-base, terminologia e autorização antes de incluir.**

**Diretriz:** inserir no máximo dois ou três dados em cartelas curtas, de preferência próximos do capítulo do presente. Evitar blocos de estatísticas, afirmações superlativas sem comprovação e imagens de processos/clientes sigilosos.$q$, 140, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('4068ca1a-b871-472c-a811-4bd3d7a9653d', 1, $q$Reconhecimento e indicadores institucionais$q$, $q$O BP é apresentado institucionalmente como um escritório de destaque nacional em recuperações judiciais ajuizadas, com atuação empresarial e em situações complexas. A conexão com a história de Gustavo permite abordar a reestruturação pelo significado humano e estratégico, não apenas por números.

**Indicadores internos disponíveis para eventual uso visual:** mais de 60 profissionais; mais de 8 mil processos distribuídos; cerca de 200 clientes ativos; aproximadamente R$ 6 bilhões sob gestão jurídica. **Validar dados, fonte, data-base, terminologia e autorização antes de incluir.**

**Diretriz:** inserir no máximo dois ou três dados em cartelas curtas, de preferência próximos do capítulo do presente. Evitar blocos de estatísticas, afirmações superlativas sem comprovação e imagens de processos/clientes sigilosos.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('9407f836-eb23-4861-965d-483a9f4f531a', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'identidade', '15', $q$Identidade visual, trilha e montagem$q$, $q$- **Paleta-base:** azul institucional profundo, dourado e branco, coerentes com a festa.
- **Tipografia:** utilizar famílias aprovadas pela identidade do escritório; textos discretos e legíveis no telão.
- **Arquivo histórico:** tratar fotografias com movimentos mínimos e enquadramento respeitoso; evitar efeitos chamativos.
- **Som:** falas em primeiro plano; música apenas para sustentar ritmo e emoção. Silêncio também é recurso narrativo.
- **Edição:** alternar Ricardo e Gustavo por significado, não apenas para igualar tempo de tela. Preservar o sentido original das respostas.
- **Ritmo:** início intrigante; desenvolvimento com pausas; crescimento emocional no capítulo das pessoas; final sereno e inspirador.
- **Narração:** preferencialmente nenhuma voz externa. As duas entrevistas sustentam o filme.
- **Legendas:** preparar versão com legendas em português, revisadas, com boa leitura em telão.$q$, 150, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('9407f836-eb23-4861-965d-483a9f4f531a', 1, $q$Identidade visual, trilha e montagem$q$, $q$- **Paleta-base:** azul institucional profundo, dourado e branco, coerentes com a festa.
- **Tipografia:** utilizar famílias aprovadas pela identidade do escritório; textos discretos e legíveis no telão.
- **Arquivo histórico:** tratar fotografias com movimentos mínimos e enquadramento respeitoso; evitar efeitos chamativos.
- **Som:** falas em primeiro plano; música apenas para sustentar ritmo e emoção. Silêncio também é recurso narrativo.
- **Edição:** alternar Ricardo e Gustavo por significado, não apenas para igualar tempo de tela. Preservar o sentido original das respostas.
- **Ritmo:** início intrigante; desenvolvimento com pausas; crescimento emocional no capítulo das pessoas; final sereno e inspirador.
- **Narração:** preferencialmente nenhuma voz externa. As duas entrevistas sustentam o filme.
- **Legendas:** preparar versão com legendas em português, revisadas, com boa leitura em telão.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('4a43f793-b47f-4f61-9a55-c2100f207310', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'etapas', '16', $q$Etapas do projeto e responsabilidades$q$, $q$| Fase | Entrega e responsável sugerido |
|---|---|
| 01. Validação de conceito | Marketing/coordenação apresenta título, abordagem, duração, temas pessoais e público aos sócios. |
| 02. Pesquisa histórica | Marketing e equipe de apoio levantam arquivos, marcos e datas com os fundadores e colaboradores antigos. |
| 03. Pré-entrevistas | Entrevistador/coordenação conversa separadamente com Ricardo e Gustavo; define limites de publicação. |
| 04. Roteiro e plano técnico | Marketing + filmmaker fecham arco, perguntas prioritárias, cenário, luz, áudio e lista de B-roll. |
| 05. Produção | Filmmaker capta entrevistas e imagens atuais; coordenação acompanha conteúdo e autorizações. |
| 06. Organização | Transcrição, seleção das falas, indexação de arquivos e registro do que precisa validar. |
| 07. Montagem | Editor estrutura o filme da festa, depois a versão estendida; aplica arquivos e gráficos. |
| 08. Aprovação | Sócios aprovam conteúdo pessoal; áreas responsáveis validam dados, sigilo, pessoas e marca. |
| 09. Finalização | Cor, som, música licenciada, legendas, exports e arquivos de segurança. |
| 10. Exibição e acervo | Teste no equipamento do evento; armazenamento controlado de originais e versões publicáveis. |

### Estimativa de captação

- Pré-entrevista com cada sócio: **20–30 minutos**.
- Entrevista com Ricardo: **45–60 minutos**.
- Entrevista com Gustavo: **45–60 minutos**.
- Conversa conjunta opcional: **10–15 minutos**.
- Captação de cenas da operação: **2–3 horas**.

### Cronograma relativo à festa

- **D-21 a D-15:** validar conceito, levantar acervo e fazer pré-entrevistas.
- **D-14 a D-10:** gravar entrevistas e B-roll.
- **D-9 a D-6:** primeira montagem curta e revisão de fatos/autorizações.
- **D-5 a D-3:** ajustes, som, legendas e master final.
- **D-2 a D-1:** teste com telão/áudio, arquivo local e backup.

*Cronograma indicativo. Ajustar ao calendário real da festa e à agenda dos sócios.*$q$, 160, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('4a43f793-b47f-4f61-9a55-c2100f207310', 1, $q$Etapas do projeto e responsabilidades$q$, $q$| Fase | Entrega e responsável sugerido |
|---|---|
| 01. Validação de conceito | Marketing/coordenação apresenta título, abordagem, duração, temas pessoais e público aos sócios. |
| 02. Pesquisa histórica | Marketing e equipe de apoio levantam arquivos, marcos e datas com os fundadores e colaboradores antigos. |
| 03. Pré-entrevistas | Entrevistador/coordenação conversa separadamente com Ricardo e Gustavo; define limites de publicação. |
| 04. Roteiro e plano técnico | Marketing + filmmaker fecham arco, perguntas prioritárias, cenário, luz, áudio e lista de B-roll. |
| 05. Produção | Filmmaker capta entrevistas e imagens atuais; coordenação acompanha conteúdo e autorizações. |
| 06. Organização | Transcrição, seleção das falas, indexação de arquivos e registro do que precisa validar. |
| 07. Montagem | Editor estrutura o filme da festa, depois a versão estendida; aplica arquivos e gráficos. |
| 08. Aprovação | Sócios aprovam conteúdo pessoal; áreas responsáveis validam dados, sigilo, pessoas e marca. |
| 09. Finalização | Cor, som, música licenciada, legendas, exports e arquivos de segurança. |
| 10. Exibição e acervo | Teste no equipamento do evento; armazenamento controlado de originais e versões publicáveis. |

### Estimativa de captação

- Pré-entrevista com cada sócio: **20–30 minutos**.
- Entrevista com Ricardo: **45–60 minutos**.
- Entrevista com Gustavo: **45–60 minutos**.
- Conversa conjunta opcional: **10–15 minutos**.
- Captação de cenas da operação: **2–3 horas**.

### Cronograma relativo à festa

- **D-21 a D-15:** validar conceito, levantar acervo e fazer pré-entrevistas.
- **D-14 a D-10:** gravar entrevistas e B-roll.
- **D-9 a D-6:** primeira montagem curta e revisão de fatos/autorizações.
- **D-5 a D-3:** ajustes, som, legendas e master final.
- **D-2 a D-1:** teste com telão/áudio, arquivo local e backup.

*Cronograma indicativo. Ajustar ao calendário real da festa e à agenda dos sócios.*$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('ba82c5ef-465a-4f9a-9aa5-04afdeea2d88', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'entregaveis', '17', $q$Entregáveis técnicos e reaproveitamento$q$, $q$**Obrigatórios**

1. Filme da festa, **5–6 minutos** (alvo 5min50s), formato 16:9.
2. Documentário completo, **até 10 minutos** (alvo 9min20s), formato 16:9.
3. Versões legendadas e arquivos de exibição com áudio testado.
4. Arquivo master de alta qualidade e versão comprimida de segurança para o evento.
5. Organização dos originais em pastas identificadas; transcrição/indexação das entrevistas.

**Opcionais, sujeitos a aprovação**

- Trailer de 20–30 segundos para comunicação interna ou pós-evento.
- Trechos de 30–60 segundos por tema (origens, sociedade, reestruturação, pessoas, futuro).
- Fotos de bastidores da gravação.
- Pequeno acervo institucional pesquisável no ORQESTRAI.

**Não presumir autorização de publicação pública** a partir da autorização para exibição na festa. Definir separadamente usos em redes sociais, site, propostas comerciais e arquivo interno.$q$, 170, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('ba82c5ef-465a-4f9a-9aa5-04afdeea2d88', 1, $q$Entregáveis técnicos e reaproveitamento$q$, $q$**Obrigatórios**

1. Filme da festa, **5–6 minutos** (alvo 5min50s), formato 16:9.
2. Documentário completo, **até 10 minutos** (alvo 9min20s), formato 16:9.
3. Versões legendadas e arquivos de exibição com áudio testado.
4. Arquivo master de alta qualidade e versão comprimida de segurança para o evento.
5. Organização dos originais em pastas identificadas; transcrição/indexação das entrevistas.

**Opcionais, sujeitos a aprovação**

- Trailer de 20–30 segundos para comunicação interna ou pós-evento.
- Trechos de 30–60 segundos por tema (origens, sociedade, reestruturação, pessoas, futuro).
- Fotos de bastidores da gravação.
- Pequeno acervo institucional pesquisável no ORQESTRAI.

**Não presumir autorização de publicação pública** a partir da autorização para exibição na festa. Definir separadamente usos em redes sociais, site, propostas comerciais e arquivo interno.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('e9a6b086-2fa7-47ed-b175-ef1613f857e5', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'criterios', '18', $q$Critérios de aprovação e riscos$q$, $q$**Riscos principais:** vídeo excessivamente corporativo; falta de boas histórias concretas; edição longa demais para o momento da festa; exposição involuntária da família ou de clientes; estatísticas desatualizadas; trilha emocional exagerada; arquivo com som baixo no telão.$q$, 180, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('e9a6b086-2fa7-47ed-b175-ef1613f857e5', 1, $q$Critérios de aprovação e riscos$q$, $q$**Riscos principais:** vídeo excessivamente corporativo; falta de boas histórias concretas; edição longa demais para o momento da festa; exposição involuntária da família ou de clientes; estatísticas desatualizadas; trilha emocional exagerada; arquivo com som baixo no telão.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('3650c11e-7847-4a61-94ec-6cae774b6261', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validar', '19', $q$O que precisa ser validado antes da gravação$q$, $q$$q$, 190, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('3650c11e-7847-4a61-94ec-6cae774b6261', 1, $q$O que precisa ser validado antes da gravação$q$, $q$$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('c23f8951-5c03-4685-9aeb-157ebe1c08f3', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'briefing-filmmaker', '20', $q$Briefing resumido para o filmmaker$q$, $q$**Projeto:** minidocumentário comemorativo dos dez anos do Bismarchi | Pires.  
**Título:** O que construímos juntos.  
**Tom:** íntimo, documental, humano, sóbrio e elegante.  
**Protagonistas:** Ricardo e Gustavo, em entrevistas individuais; conversa conjunta opcional.  
**História:** origens pessoais → encontro e fundação → primeiros desafios → propósito → equipe e clientes → crescimento → futuro.  
**Imagem:** planos médios e fechados; iluminação suave; arquivo histórico integrado com imagens reais da operação.  
**Áudio:** diálogos absolutamente claros, trilha discreta e pausas naturais.  
**Exibição:** festa de dez anos para aproximadamente 180 pessoas ou mais, entre colaboradores, clientes e consultores.  
**Duração:** 5–6 minutos na festa; até 10 minutos na versão completa.  
**Mensagem final:** 10 anos de história. Os próximos capítulos, juntos.  
**Não fazer:** vídeo de ranking, propaganda de serviços, locução institucional genérica, dramatização de falas ou edição que exponha informações sigilosas.$q$, 200, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('c23f8951-5c03-4685-9aeb-157ebe1c08f3', 1, $q$Briefing resumido para o filmmaker$q$, $q$**Projeto:** minidocumentário comemorativo dos dez anos do Bismarchi | Pires.  
**Título:** O que construímos juntos.  
**Tom:** íntimo, documental, humano, sóbrio e elegante.  
**Protagonistas:** Ricardo e Gustavo, em entrevistas individuais; conversa conjunta opcional.  
**História:** origens pessoais → encontro e fundação → primeiros desafios → propósito → equipe e clientes → crescimento → futuro.  
**Imagem:** planos médios e fechados; iluminação suave; arquivo histórico integrado com imagens reais da operação.  
**Áudio:** diálogos absolutamente claros, trilha discreta e pausas naturais.  
**Exibição:** festa de dez anos para aproximadamente 180 pessoas ou mais, entre colaboradores, clientes e consultores.  
**Duração:** 5–6 minutos na festa; até 10 minutos na versão completa.  
**Mensagem final:** 10 anos de história. Os próximos capítulos, juntos.  
**Não fazer:** vídeo de ranking, propaganda de serviços, locução institucional genérica, dramatização de falas ou edição que exponha informações sigilosas.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('a93dd38a-b942-4f5a-8a02-bd3958165606', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'referencias', '21', $q$Referências de pesquisa e inspiração$q$, $q$As referências a seguir orientam formato, entrevistas e montagem. **Não são roteiros a copiar.**

**Audiovisual e comemorações institucionais**

- **Comercio Partners, documentário de 10 anos:** estudo de caso de filme de oito minutos centrado nas pessoas e decisões dos fundadores. <https://www.spsmediang.com/corporate-documentary-production-lagos-comercio-partners-10th-anniversary-case-study/>
- **Machado Meyer, 50 anos:** depoimentos de fundadores e linha do tempo no contexto jurídico. <https://www.machadomeyer.com.br/pt/50-anos> e <https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/institucional-ij/machado-meyer-50-anos-episodio-1-nossa-historia>
- **The Last Dance (série documental):** alternância entre entrevistas e arquivos, útil como linguagem de montagem.
- **Senna (documentário, 2010):** exemplo da força narrativa de arquivos reais para construir memória e emoção.

**Entrevista e linguagem documental**

- **StoryCorps, Great Questions:** perguntas abertas e lembranças pessoais. <https://storycorps.org/participate/what-to-expect/>
- **Princeton University, Shooting Documentary Interviews:** posicionamento de câmera e coleta de B-roll. <https://anthropology.princeton.edu/research-programs/vize-lab/resources/tip-sheets/shooting-documentary-interviews>
- **NYFA, How to Prepare and Conduct a Documentary Interview:** planejamento de entrevistas e imagens de apoio. <https://www.nyfa.edu/student-resources/how-to-prepare-and-conduct-a-documentary-interview/>

**Livros que fundamentam a abordagem**

- Sheila Curran Bernard, *Documentary Storytelling*: selecionar um fio narrativo verdadeiro.
- Matthew Dicks, *Storyworthy*: explorar momentos específicos e significativos.
- Nancy Duarte, *Resonate*: usar contraste entre o presente, o passado e o futuro.
- Annette Simmons, *The Story Factor*: dar vida aos valores por meio de histórias humanas.
- Michael Rabiger e Courtney Hermann, *Directing the Documentary*: pesquisa, entrevistas, produção e integridade da montagem.

**Fonte institucional:** apresentação interna **“Ciclo PE27_WS_05nov2026”**, especialmente páginas 3 e 5. A missão nela apresentada é uma sugestão, sujeita a confirmação institucional.$q$, 210, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('a93dd38a-b942-4f5a-8a02-bd3958165606', 1, $q$Referências de pesquisa e inspiração$q$, $q$As referências a seguir orientam formato, entrevistas e montagem. **Não são roteiros a copiar.**

**Audiovisual e comemorações institucionais**

- **Comercio Partners, documentário de 10 anos:** estudo de caso de filme de oito minutos centrado nas pessoas e decisões dos fundadores. <https://www.spsmediang.com/corporate-documentary-production-lagos-comercio-partners-10th-anniversary-case-study/>
- **Machado Meyer, 50 anos:** depoimentos de fundadores e linha do tempo no contexto jurídico. <https://www.machadomeyer.com.br/pt/50-anos> e <https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/institucional-ij/machado-meyer-50-anos-episodio-1-nossa-historia>
- **The Last Dance (série documental):** alternância entre entrevistas e arquivos, útil como linguagem de montagem.
- **Senna (documentário, 2010):** exemplo da força narrativa de arquivos reais para construir memória e emoção.

**Entrevista e linguagem documental**

- **StoryCorps, Great Questions:** perguntas abertas e lembranças pessoais. <https://storycorps.org/participate/what-to-expect/>
- **Princeton University, Shooting Documentary Interviews:** posicionamento de câmera e coleta de B-roll. <https://anthropology.princeton.edu/research-programs/vize-lab/resources/tip-sheets/shooting-documentary-interviews>
- **NYFA, How to Prepare and Conduct a Documentary Interview:** planejamento de entrevistas e imagens de apoio. <https://www.nyfa.edu/student-resources/how-to-prepare-and-conduct-a-documentary-interview/>

**Livros que fundamentam a abordagem**

- Sheila Curran Bernard, *Documentary Storytelling*: selecionar um fio narrativo verdadeiro.
- Matthew Dicks, *Storyworthy*: explorar momentos específicos e significativos.
- Nancy Duarte, *Resonate*: usar contraste entre o presente, o passado e o futuro.
- Annette Simmons, *The Story Factor*: dar vida aos valores por meio de histórias humanas.
- Michael Rabiger e Courtney Hermann, *Directing the Documentary*: pesquisa, entrevistas, produção e integridade da montagem.

**Fonte institucional:** apresentação interna **“Ciclo PE27_WS_05nov2026”**, especialmente páginas 3 e 5. A missão nela apresentada é uma sugestão, sujeita a confirmação institucional.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('8609bcff-fbfa-482c-abd9-84af6293ccad', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'checklist', 'A', $q$Anexo A — Checklist operacional$q$, $q$$q$, 220, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('8609bcff-fbfa-482c-abd9-84af6293ccad', 1, $q$Anexo A — Checklist operacional$q$, $q$$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_sections (id, project_id, slug, number, title, body, sort, version) values ('4170491c-a5c9-4196-9444-da88ca5936e7', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'nota-editorial', null, $q$Nota editorial$q$, $q$Trata-se de um documento de produção. Falas atribuídas aos entrevistados somente deverão ser inseridas no roteiro final após a gravação e a validação de seu contexto. Histórias familiares e dados de clientes não devem ser publicados sem autorização específica.$q$, 230, 1);
insert into public.documentary_section_versions (section_id, version, title, body, note, project_version) values ('4170491c-a5c9-4196-9444-da88ca5936e7', 1, $q$Nota editorial$q$, $q$Trata-se de um documento de produção. Falas atribuídas aos entrevistados somente deverão ser inseridas no roteiro final após a gravação e a validação de seu contexto. Histórias familiares e dados de clientes não devem ser publicados sem autorização específica.$q$, $q$Documento original$q$, '1.0');
insert into public.documentary_project_versions (project_id, version_label, note, section_versions) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', '1.0', $q$Versão 1.0 · novembro de 2026. Proposta criativa para alinhamento e validação (documento original).$q$, $q${"resumo-executivo":1,"contexto":1,"conceito":1,"proposito":1,"historias-pessoais":1,"estrutura":1,"roteiro-festa":1,"versao-estendida":1,"entrevistas":1,"abertura-final":1,"fotografia":1,"broll":1,"acervo":1,"indicadores":1,"identidade":1,"etapas":1,"entregaveis":1,"criterios":1,"validar":1,"briefing-filmmaker":1,"referencias":1,"checklist":1,"nota-editorial":1}$q$::jsonb);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('1812ef7b-54a7-407e-8aa9-85500902c556', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 10, $q$Proposta criativa (versão 1.0)$q$, $q$Título, abordagem, duração, temas pessoais e público, apresentados aos sócios na validação de conceito (fase 01). Status do documento: proposta criativa para alinhamento e validação.$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 16 · fase 01$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('f74bb21b-21e6-4765-89b5-7c95d58e0da1', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 20, $q$Título e assinatura$q$, $q$Aprovar “O que construímos juntos” e “Os próximos capítulos, juntos”.$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 1$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('92a1966f-89a6-40cd-a517-6ae923b12f4c', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 30, $q$Tratamento biográfico: o DIC$q$, $q$Quais histórias do tempo em que Ricardo morou no DIC, em Campinas, podem ser gravadas e exibidas? A entrevista parte do significado que ele mesmo atribui à experiência. Não pressupor pobreza extrema, obstáculos específicos, superação heroica ou frases que ele não tenha dito (seção 5).$q$, true, array['ricardo']::text[], $q$Seção 19 · 2$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('2b857c09-606b-4db1-9885-714a48d6176a', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 40, $q$Tratamento biográfico: as empresas do pai$q$, $q$Quais histórias das falências nas empresas do pai de Gustavo podem ser gravadas e exibidas? Validar se o tema pode constar na versão exibida a clientes e parceiros. Não pressupor sentimentos, causas, detalhes econômicos ou desfechos (seção 5).$q$, true, array['gustavo']::text[], $q$Seção 19 · 2$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('524ed595-cc91-4503-8114-ad0ae9bc3812', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 50, $q$Pergunta 20 sobre o pai (opcional)$q$, $q$“Se pudesse conversar com seu pai sobre a trajetória profissional construída, o que gostaria de compartilhar?” Usar somente com consentimento prévio para abordagem e eventual divulgação (seção 9.2).$q$, true, array['gustavo']::text[], $q$Seção 9.2 · 20$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('f82a06b5-1966-45df-b8f7-44b0545e8358', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 60, $q$Memória histórica$q$, $q$Primeira sede, origem da sociedade, mudanças importantes, primeiras pessoas e principais marcos.$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 3$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('8211fea2-dc35-41af-b2ac-c9d427ba76d6', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 70, $q$Identidade institucional$q$, $q$Confirmar redações finais de missão, propósito, visão e valores. A missão está identificada como sugerida no PE27 (“Ciclo PE27_WS_05nov2026”, p. 3): confirmar a redação aprovada antes de apresentá-la como definitiva (seção 4).$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 4$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('b1416949-4e0e-4932-adc0-84e8db153d64', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 80, $q$Reconhecimento$q$, $q$Confirmar redação mais precisa sobre o posicionamento do BP em recuperações judiciais ajuizadas.$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 5$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('c96254d9-49e3-4ddc-8918-7fb1d4bf431f', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 90, $q$Indicadores$q$, $q$Confirmar números de 2026, data-base e autorização de divulgação. Indicadores internos disponíveis: mais de 60 profissionais; mais de 8 mil processos distribuídos; cerca de 200 clientes ativos; aproximadamente R$ 6 bilhões sob gestão jurídica. No máximo dois ou três dados no filme (seção 14).$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 6$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('335bd16f-c75a-4bff-9e1c-387503d8a7c8', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 100, $q$Acervo$q$, $q$Responsáveis por fotos antigas, disponibilidade e permissões.$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 7$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('cfc6bb9c-00a3-4393-9322-b0af5561e6cf', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 110, $q$Cerimonial$q$, $q$Momento da exibição, tipo de tela, áudio, iluminação e continuidade do evento.$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 8$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('88e9894f-607c-47bb-be8c-780deb33caeb', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'validacao', 120, $q$Uso posterior$q$, $q$Quais trechos e versões poderão ser publicados externamente? A autorização para exibir na festa não vale, por si só, para redes sociais, site, propostas comerciais e arquivo interno (seção 17).$q$, false, array['ricardo', 'gustavo']::text[], $q$Seção 19 · 9$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('b9684106-00cd-45ae-9a30-27aed219c721', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 10, $q$O filme funciona para colaboradores e também para clientes/consultores que não conhecem os bastidores?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('e8277ec1-9e43-4659-9a58-d4c30bbc12c3', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 20, $q$As memórias pessoais estão nas palavras dos próprios sócios?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('38337bc0-714d-4cf3-a5e4-851c721b2eca', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 30, $q$Abordagem e exibição da história familiar$q$, $q$Gustavo aprova a abordagem e a exibição da história familiar no filme?$q$, true, array['gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('14968168-a2e2-41a8-bfdd-5ffaee40011a', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 40, $q$Apresentação da origem e da trajetória$q$, $q$Ricardo aprova a forma de apresentação de sua origem e trajetória no filme?$q$, true, array['ricardo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('ca0ecadb-9134-4d87-a9ef-2df50a840a4f', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 50, $q$Existe uma dificuldade, decisão ou virada concreta, sem dramatização fabricada?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('a4591ffe-a701-49ad-9e55-290d70e553ad', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 60, $q$Clientes e colaboradores são reconhecidos sem parecer um rol de nomes ou agradecimentos protocolares?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('3468dfda-8698-4649-9c92-cf383f5487ba', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 70, $q$Propósito, missão e visão aparecem de modo natural, sem discursos decorados?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('db7a02c0-c4f5-4962-be58-54ac123430e4', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 80, $q$Dados, superlativos, datas e marcos foram validados?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('84b79737-30af-47cc-8d2f-504b44676324', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'editorial', 90, $q$A assinatura final conecta o documentário ao conceito da festa?$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('b35a31c3-f917-4d4c-8474-be4d2bea541b', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'producao', 10, $q$Autorização de imagem e voz dos entrevistados para as finalidades definidas$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('24754ccd-6c6b-495a-98df-98b81723fbeb', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'producao', 20, $q$Autorização de uso de fotografias e vídeos de arquivo, quando necessária$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('25497075-851c-4b5a-8a08-34bd2b9a2bfb', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'producao', 30, $q$Revisão de telas, processos, contratos e dados pessoais/confidenciais$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('0a52542f-6059-4f29-b17b-5588f1ca118c', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'producao', 40, $q$Direitos de trilha, fontes, imagens e quaisquer materiais de terceiros$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('09e6b9ce-bc5b-4bdf-a0c5-c4e60f461416', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'producao', 50, $q$Legendas, mixagem, contraste e leitura testados no equipamento da festa$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_approval_items (id, project_id, stage, sort, title, context, sensitive, approvers, source) values ('21016a4c-67dc-4100-9e52-8633a79cac5e', 'c7ca6837-ef4b-457b-ab85-3746473157f1', 'producao', 60, $q$Arquivo local principal e backup disponível, sem depender de internet$q$, null, false, array['ricardo', 'gustavo']::text[], $q$Seção 18$q$);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 10, $q$Você costuma contar que viveu no DIC quando era mais jovem. Como era o seu dia a dia naquela época?$q$, null, true, '92a1966f-89a6-40cd-a517-6ae923b12f4c');
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 20, $q$Qual lembrança daquela fase da vida volta com mais frequência?$q$, null, true, '92a1966f-89a6-40cd-a517-6ae923b12f4c');
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 30, $q$Quem mais influenciou sua formação pessoal e profissional?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 40, $q$Quando começou a imaginar uma carreira no Direito? Isso sempre esteve nos seus planos?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 50, $q$Qual decisão fez uma diferença importante no seu caminho profissional?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 60, $q$Como conheceu o Gustavo? O que chamou sua atenção nele?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 70, $q$Você se lembra da conversa em que decidiram construir o escritório juntos?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 80, $q$O que vocês queriam fazer de diferente ao abrir o BP?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 90, $q$Se alguém visitasse a primeira operação em 2016, o que encontraria?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 100, $q$Que fase da construção do escritório exigiu mais de você?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 110, $q$Qual acontecimento sinalizou que o BP havia se tornado uma organização maior do que imaginavam?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 120, $q$O que a sua trajetória pessoal ainda influencia na forma como você lidera e trabalha?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 130, $q$Qual característica do Gustavo foi fundamental para a parceria funcionar?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 140, $q$Existe alguém ou alguma história dos primeiros anos que você gostaria de registrar para sempre?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 150, $q$O que você sente ao olhar para o escritório de hoje?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 160, $q$O que diria ao Ricardo de dez ou vinte anos atrás?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 170, $q$O que não pode se perder na próxima fase do BP?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'ricardo', 180, $q$Que mensagem gostaria de deixar para colaboradores, clientes e parceiros nesta celebração?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 10, $q$Como era sua relação com o universo empresarial quando era mais jovem?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 20, $q$Você acompanhou dificuldades e falências nas empresas de seu pai. Como lembra daquele período?$q$, null, true, '2b857c09-606b-4db1-9885-714a48d6176a');
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 30, $q$O que essa experiência ensinou sobre a realidade por trás de um negócio?$q$, null, true, '2b857c09-606b-4db1-9885-714a48d6176a');
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 40, $q$De que maneira, se é que houve, isso influenciou sua escolha pela reestruturação empresarial?$q$, null, true, '2b857c09-606b-4db1-9885-714a48d6176a');
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 50, $q$Quando percebeu que queria atuar justamente em momentos críticos da vida das empresas?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 60, $q$Qual situação profissional fez você entender que o trabalho jurídico poderia gerar uma transformação importante?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 70, $q$Como conheceu o Ricardo? O que lhe deu confiança para iniciar uma sociedade com ele?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 80, $q$O que os dois esperavam do escritório em 2016?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 90, $q$Qual foi uma decisão difícil que mudou o rumo do BP?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 100, $q$O que mais surpreendeu você na trajetória de crescimento?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 110, $q$O que significa acompanhar uma empresa em uma situação de crise?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 120, $q$O que existe nesse trabalho que as pessoas de fora geralmente não percebem?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 130, $q$Qual realização do escritório tem significado pessoal especial?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 140, $q$Existe alguma história de confiança de um cliente que possa ser contada sem expor informações protegidas?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 150, $q$Em que momento percebeu que o BP havia se tornado uma construção coletiva?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 160, $q$O que mais admira no Ricardo como sócio?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 170, $q$O que o reconhecimento alcançado em reestruturação representa para você?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 180, $q$Quais princípios devem acompanhar o escritório no futuro?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 190, $q$O que gostaria de dizer aos profissionais, clientes e consultores que fizeram parte dessa caminhada?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'gustavo', 200, $q$Se pudesse conversar com seu pai sobre a trajetória profissional construída, o que gostaria de compartilhar?$q$, $q$Opcional e sensível. Usar somente com consentimento prévio para abordagem e eventual divulgação.$q$, true, '524ed595-cc91-4503-8114-ad0ae9bc3812');
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 10, $q$Quando o projeto deixou de ser apenas de vocês dois?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 20, $q$Qual cliente ou parceiro depositou confiança no BP em uma fase especialmente importante? A história pode ser contada publicamente?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 30, $q$Que pessoa, gesto ou episódio simboliza a cultura que construíram?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 40, $q$Que decisão nunca aceitariam tomar, mesmo diante de pressão por crescimento?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 50, $q$Como o trabalho dos diferentes times transformou o que o escritório é hoje?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 60, $q$O que mudou na maneira de trabalhar e o que permaneceu?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 70, $q$Que escritório querem construir para 2036 e 2046?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 80, $q$O que gostariam que alguém dissesse sobre o BP quando ele completar vinte anos?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'comum', 90, $q$Se pudessem agradecer diretamente a quem estará na festa, o que diriam?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 10, $q$Você consegue me levar até aquele dia?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 20, $q$Onde vocês estavam? Quem estava presente?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 30, $q$O que foi dito naquela conversa?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 40, $q$O que você sentiu ou pensou na hora?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 50, $q$O que aconteceu em seguida?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 60, $q$Você consegue lembrar de uma situação que represente isso?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 70, $q$Como o outro sócio se lembra desse mesmo episódio?$q$, null, false, null);
insert into public.documentary_questions (project_id, audience, sort, text, note, sensitive, approval_item_id) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'aprofundamento', 80, $q$O que essa história significa para você hoje?$q$, null, false, null);
insert into public.documentary_shoots (project_id, kind, title, person_keys, estimate, optional, sort) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'pre_entrevista', $q$Pré-entrevista com Ricardo$q$, array['ricardo']::text[], $q$20–30 min$q$, false, 10);
insert into public.documentary_shoots (project_id, kind, title, person_keys, estimate, optional, sort) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'pre_entrevista', $q$Pré-entrevista com Gustavo$q$, array['gustavo']::text[], $q$20–30 min$q$, false, 20);
insert into public.documentary_shoots (project_id, kind, title, person_keys, estimate, optional, sort) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'entrevista', $q$Entrevista com Ricardo$q$, array['ricardo']::text[], $q$45–60 min$q$, false, 30);
insert into public.documentary_shoots (project_id, kind, title, person_keys, estimate, optional, sort) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'entrevista', $q$Entrevista com Gustavo$q$, array['gustavo']::text[], $q$45–60 min$q$, false, 40);
insert into public.documentary_shoots (project_id, kind, title, person_keys, estimate, optional, sort) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'conversa_conjunta', $q$Conversa conjunta com os dois$q$, array['ricardo', 'gustavo']::text[], $q$10–15 min$q$, true, 50);
insert into public.documentary_shoots (project_id, kind, title, person_keys, estimate, optional, sort) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'broll', $q$Captação de cenas da operação (B-roll)$q$, array[]::text[], $q$2–3 horas$q$, false, 60);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 10, $q$Apresentar conceito a Ricardo e Gustavo.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 20, $q$Confirmar data, horário, local e disponibilidade.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 30, $q$Confirmar entrevistador e filmmaker.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 40, $q$Realizar pré-entrevista individual com cada sócio.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 50, $q$Definir limites dos temas biográficos e de clientes.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 60, $q$Solicitar fotografias e vídeos antigos.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 70, $q$Organizar acervo por ano/tema/autorização.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 80, $q$Revisar roteiro prioritário de perguntas.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'antes', 90, $q$Vistoriar cenário, ruído, luz, tomadas e fundo de imagem.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 10, $q$Testar câmeras, bateria, armazenamento e microfones.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 20, $q$Gravar teste de som e ambiente.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 30, $q$Conferir autorização de gravação e uso.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 40, $q$Fazer perguntas abertas e perguntas de aprofundamento.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 50, $q$Registrar reações e pausas; evitar interrupções.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 60, $q$Fotografar bastidores, se autorizado.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 70, $q$Captar cenas da operação e cenas de transição.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'dia', 80, $q$Fazer cópias de segurança ao terminar a gravação.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 10, $q$Transcrever e marcar as falas fortes.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 20, $q$Identificar a abertura e a última fala.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 30, $q$Confirmar cada fotografia histórica utilizada.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 40, $q$Montar versão curta coerente e independente.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 50, $q$Criar versão estendida com novas histórias completas.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 60, $q$Validar citações, números, datas, nomes e imagens.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 70, $q$Revisar trilha, cor, legendas e cartelas.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'montagem', 80, $q$Obter aprovação final dos responsáveis.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'festa', 10, $q$Testar o filme no equipamento do evento.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'festa', 20, $q$Conferir volume, legibilidade de legendas e proporção de tela.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'festa', 30, $q$Disponibilizar arquivo local em dois dispositivos.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'festa', 40, $q$Alinhar sinal de início com cerimonial e equipe técnica.$q$);
insert into public.documentary_checklist_items (project_id, phase, sort, text) values ('c7ca6837-ef4b-457b-ab85-3746473157f1', 'festa', 50, $q$Definir o que acontece imediatamente após o encerramento.$q$);
end
$seed$;
