# Perfis NFC — identidade profissional digital

## Objetivo

Criar no ORQESTRAI um módulo chamado **Perfis NFC** para transformar os cartões
entregues aos colaboradores em identidades profissionais digitais permanentes do
Bismarchi | Pires.

Cada cartão terá uma etiqueta NFC e um QR Code. Ao aproximar ou escanear, a pessoa
será direcionada para um perfil público, institucional, bilíngue e responsivo. O
conteúdo será administrado pelo ORQESTRAI, sem depender de páginas individuais
criadas manualmente.

## Decisões aprovadas

- O módulo atenderá todos os colaboradores, não apenas advogados.
- Campos jurídicos, como OAB, serão opcionais.
- A primeira URL pública será
  `https://marketing-system-xi.vercel.app/perfil/<slug>`.
- Os perfis serão acessíveis sem login, mas usarão `noindex` e `nofollow`.
- Português e inglês fazem parte da primeira entrega.
- Ausência de tradução aprovada em inglês usa português como fallback.
- Telefone e WhatsApp são privados por padrão e só aparecem quando um
  administrador ativar sua visibilidade.
- Os três conteúdos mais recentes serão obtidos automaticamente pela autoria já
  existente no banco do ORQESTRAI.
- Um administrador poderá ocultar um conteúdo específico sem alterar sua autoria.
- A campanha do Dia da Advocacia terá período configurável e botão global para
  ligar ou desligar.
- O novo domínio institucional não faz parte desta entrega.

## Escopo funcional

### Perfil público

O perfil terá um template único e aceitará conteúdo diferente por colaborador:

1. Campanha temporária, quando ativa.
2. Foto profissional.
3. Nome, cargo, área, OAB e frase de posicionamento.
4. Alternância entre português e inglês.
5. Ações rápidas: salvar contato, WhatsApp ou e-mail e compartilhar.
6. LinkedIn e site institucional como ações secundárias.
7. Apresentação profissional curta.
8. Áreas de atuação e principais competências.
9. Formação, qualificações, certificações e idiomas.
10. Três conteúdos recentes.
11. Destaques profissionais.
12. Trajetória no Bismarchi | Pires.
13. Rodapé institucional.

Se uma seção estiver desligada ou sem conteúdo, ela não será renderizada.

### Painel administrativo

O NFC Hub receberá uma aba **Perfis**. A visão geral mostrará:

- Perfis publicados, em rascunho e incompletos.
- Cartões vinculados, pendentes, substituídos e inativos.
- Pendências de foto, conteúdo e tradução.
- Visualizações, leituras NFC/QR e cliques.
- Divergências entre a planilha importada e os usuários do ORQESTRAI.

Cada linha da listagem terá foto, nome, área, cargo, status, completude,
quantidade de cartões e métricas principais.

O editor será dividido em:

1. **Identidade:** foto, nome público, cargo, área, OAB e posicionamento.
2. **Contatos:** e-mail, telefone, WhatsApp, LinkedIn e visibilidade individual.
3. **Apresentação:** mini-CV e competências.
4. **Formação:** graduação, pós-graduação, cursos, certificações e idiomas.
5. **Atuação:** áreas e serviços em itens ordenáveis.
6. **Conteúdo:** publicações automáticas e exceções de ocultação.
7. **Trajetória:** linha do tempo ordenável.
8. **Cartão:** vínculos NFC, URL, QR Code, status e teste.
9. **Publicação:** idioma, checklist, prévia e status.

Português e inglês serão editados no mesmo contexto, com indicador de
preenchimento por idioma. Todas as seções terão controle de visibilidade.

### Campanha

Uma configuração global administrará:

- Status manual ligado/desligado.
- Data e hora de início.
- Data e hora de término.
- Título, mensagem e chamada em português e inglês.

A campanha só aparece quando o interruptor estiver ligado e o horário atual
estiver dentro da janela configurada. O desligamento manual prevalece sobre a
agenda.

## Arquitetura

### Limites do módulo

O módulo será separado do cadastro de autenticação e usuários. A tabela
`users` continuará sendo a fonte de identidade interna, foto, e-mail e área. O
novo domínio armazenará somente informações editoriais, publicação, cartões e
métricas.

Os componentes serão divididos em unidades com responsabilidades claras:

- **Diretório:** concilia usuários e planilha.
- **Perfil editorial:** mantém conteúdo, traduções, ordem e visibilidade.
- **Publicação:** produz a projeção pública segura de um perfil.
- **Cartões:** vincula tags NFC e QR Codes aos perfis.
- **Conteúdos:** consulta autoria no banco e aplica exceções de ocultação.
- **Métricas:** registra eventos e produz agregações administrativas.
- **Campanha:** decide se a faixa temporária está ativa.

### Modelo conceitual de dados

#### Perfis

Um perfil terá relação única com `users` e armazenará:

- `user_id`
- `slug`
- status `draft`, `published` ou `archived`
- nome público e foto substituta opcional
- OAB
- telefone e WhatsApp
- LinkedIn
- data de admissão
- controles de visibilidade
- datas de publicação e atualização

#### Localizações

Os textos editoriais serão armazenados por localidade:

- `pt-BR`
- `en`

Cada localização conterá cargo público, área pública, frase de posicionamento,
mini-CV e rótulos complementares. Um registro em inglês incompleto não será
considerado aprovado; nesse caso, a projeção pública usa o português.

#### Seções e entradas

As seções terão chave conhecida, ordem e visibilidade. Entradas repetíveis
atenderão áreas de atuação, formação, certificações, idiomas, destaques e
trajetória. Cada entrada terá ordem, estado ativo e textos localizados.

O contrato de cada tipo será validado no servidor para impedir JSON arbitrário
ou formatos incompatíveis.

#### Cartões

Um perfil poderá ter mais de um cartão:

- código interno
- `nfc_tag_id`
- status `pending`, `active`, `replaced` ou `inactive`
- data de ativação
- cartão substituído, quando aplicável

O histórico será preservado quando um cartão for substituído.

#### Conteúdos

O vínculo principal virá da autoria existente nas tabelas de conteúdo do
ORQESTRAI. Uma tabela pequena de exceções armazenará apenas conteúdos ocultados
para um perfil. Não haverá duplicação das publicações.

#### Slugs

O slug atual será único. Alterações criarão um registro de redirecionamento do
slug anterior para o novo, evitando quebrar links compartilhados.

#### Métricas

Eventos aceitos:

- `profile_view`
- `nfc_scan`
- `qr_scan`
- `contact_download`
- `share`
- `whatsapp_click`
- `email_click`
- `linkedin_click`
- `website_click`

Cada evento terá perfil, cartão opcional, origem, idioma, horário e metadados
estritamente permitidos. Não serão armazenados telefone do visitante,
geolocalização exata ou conteúdo de mensagens.

## Fluxos de dados

### Importação da planilha

A planilha `Colaboradores-MKT.xlsm` contém 91 registros: 54 ativos e 37
inativos. Para os ativos, nome, área, cargo, telefone, data de nascimento, e-mail
e marcação de colaborador estão preenchidos; dois não têm data de admissão.

O ORQESTRAI possui 61 usuários ativos. A importação seguirá estas regras:

1. Ler e validar a planilha sem gravar.
2. Normalizar e-mail, espaços, capitalização e datas.
3. Conciliar pelo e-mail corporativo.
4. Exibir correspondências, novos registros e divergências.
5. Exigir confirmação administrativa.
6. Executar as alterações aprovadas em transação.
7. Criar ou atualizar perfis sempre como rascunho.

A importação não desativará usuários, não publicará perfis e não mudará
permissões de acesso. Data de nascimento não será copiada para o módulo de
perfis, pois não é necessária para a finalidade pública.

### Publicação

O administrador revisa o perfil, as traduções e as visibilidades. O sistema
apresenta um checklist antes da publicação:

- usuário vinculado
- slug válido
- foto
- cargo e área públicos
- posicionamento
- e-mail institucional
- tradução ou fallback reconhecido
- ao menos uma forma de contato
- prévia revisada

A página pública consulta somente perfis publicados e monta uma projeção
sanitizada. Campos privados nunca são enviados ao navegador.

### NFC e QR

O cartão NFC usará:

`/t/<token>?source=nfc`

O QR Code usará:

`/t/<token>?source=qr`

O fluxo:

1. Validar cartão e perfil.
2. Registrar a origem.
3. Exibir transição curta: “Abrindo o perfil de <nome>”.
4. Redirecionar para `/perfil/<slug>`.

O token permanece estável. Uma futura mudança de domínio poderá ser resolvida no
servidor sem regravar cartões.

### Conteúdo automático

Para cada perfil publicado:

1. Consultar conteúdos associados à autoria do usuário.
2. Remover itens ocultados pelo administrador.
3. Ordenar por data de publicação.
4. Exibir os três mais recentes.

Falha nessa consulta não derruba o perfil; a seção é omitida e o erro é
registrado para diagnóstico.

## Experiência visual

### Direção

A página pública terá caráter editorial, jurídico e contemporâneo. Usará a
identidade do Bismarchi | Pires, com predominância de azul-marinho, dourado e
tons claros. O logo institucional existente será usado de forma discreta.

Não haverá aparência de link na bio, currículo em documento ou cartão digital
genérico. Animações serão discretas e não interferirão no carregamento ou na
leitura.

### Responsividade

- Mobile-first.
- Ações principais acessíveis sem ocupar toda a tela.
- Cards e linha do tempo adaptados a telas estreitas.
- Desktop com composição editorial entre foto e apresentação.
- Áreas clicáveis com no mínimo 44px.
- Suporte a redução de movimento.
- Contraste e foco visível compatíveis com WCAG.

### Compartilhamento e contato

O compartilhamento terá imagem, nome, cargo e descrição apropriados, mesmo com
`noindex`.

O `.vcf` será gerado no servidor e incluirá somente campos visíveis. Telefone e
WhatsApp não serão incluídos quando seus controles estiverem desligados.

## Segurança e privacidade

- Todas as tabelas no schema exposto terão RLS.
- Escritas serão feitas por rotas administrativas autenticadas.
- Somente administradores poderão importar, editar, publicar e vincular cartões.
- O navegador público não acessará tabelas editoriais diretamente.
- Chaves privilegiadas permanecerão exclusivamente no servidor.
- A API pública retornará somente a projeção autorizada.
- Eventos de métrica terão validação, rate limit e lista fechada de tipos.
- Falha de telemetria não impedirá o acesso ao perfil.
- Telefone e WhatsApp começam ocultos.
- Perfis começam em rascunho.
- Páginas usarão `noindex` e `nofollow`.

## Tratamento de erros

- Perfil inexistente: página institucional amigável.
- Perfil ou cartão inativo: mensagem institucional sem exposição de detalhes.
- Slug antigo: redirecionamento permanente para o atual.
- Tradução inglesa não aprovada: fallback para português.
- Conteúdo indisponível: seção omitida.
- Foto indisponível: avatar institucional com iniciais.
- Importação inválida: nenhuma gravação; relatório por linha.
- E-mail ou slug duplicado: item bloqueado para revisão.
- Falha de métricas: perfil continua acessível.
- Falha de vCard: mensagem clara e opção de copiar os contatos visíveis.

## Verificação e testes

### Testes automatizados

- Validação do schema editorial.
- Geração e colisão de slugs.
- Redirecionamento de slugs antigos.
- Regras de visibilidade.
- Fallback de idioma.
- Escape e conteúdo do `.vcf`.
- Seleção dos três conteúdos mais recentes.
- Exceções de conteúdo ocultado.
- Agenda e interruptor da campanha.
- Origem NFC, QR, compartilhamento e link direto.
- Importação idempotente e conciliação por e-mail.
- Permissões administrativas e RLS.

### Testes de interface

- Celulares pequenos e grandes.
- Desktop.
- Navegação por teclado.
- Leitores de tela nos controles essenciais.
- Português e inglês.
- Contatos com e sem telefone público.
- Perfis completos e perfis com seções ocultas.
- NFC e QR reais.
- Download e abertura do vCard em Android e iOS.
- Prévia social.

### Liberação

1. Aplicar migration e validar advisors do Supabase.
2. Executar importação em modo de prévia.
3. Criar perfis como rascunho.
4. Revisar um advogado e um colaborador administrativo.
5. Validar preview da Vercel.
6. Testar cartões e QR Codes.
7. Publicar os perfis aprovados.
8. Avançar o `main` apenas com fast-forward.
9. Confirmar deploy `READY` e ausência de erros de runtime.
10. Ativar a campanha quando o administrador decidir.

## Fora do escopo desta entrega

- Domínio `perfil.bismarchipires.com.br`.
- Indexação por mecanismos de busca.
- Edição do perfil pelo próprio colaborador.
- Desativação automática de usuários a partir da planilha.
- Publicação automática de perfis importados.
- Exposição pública de data de nascimento.
- Aplicativo móvel nativo.

## Critérios de aceite

- Todos os colaboradores podem ter perfil, inclusive não advogados.
- Um perfil publicado abre sem login em `/perfil/<slug>`.
- Nenhuma página é indexável.
- Português e inglês funcionam com fallback controlado.
- Telefone e WhatsApp permanecem privados até ativação.
- O vCard respeita exatamente as visibilidades.
- Os três conteúdos mais recentes correspondem à autoria do banco.
- NFC e QR registram origens distintas.
- O painel permite administrar conteúdo, cartões, campanha e publicação.
- A planilha é conciliada antes de qualquer gravação.
- A experiência é responsiva, acessível e alinhada à identidade institucional.
