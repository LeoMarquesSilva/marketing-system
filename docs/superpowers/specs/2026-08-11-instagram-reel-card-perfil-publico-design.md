# Card de Reel do Instagram no perfil público

## Contexto

O perfil público já recebe e publica a URL do Reel na entrada de trajetória de Carlos Zamboni. A projeção pública preserva `linkUrl`, mas o componente atual apresenta essa URL apenas envolvendo o título em um link visualmente discreto. Por isso, o visitante não identifica que há um vídeo disponível.

## Objetivo

Apresentar entradas públicas que apontem para Reels do Instagram como conteúdo audiovisual reconhecível, com capa, botão de reprodução e uma alternativa explícita para abrir o vídeo no Instagram.

## Solução aprovada

O componente de seções públicas identificará URLs válidas de Reel do Instagram e renderizará, abaixo do texto da entrada:

- o player oficial incorporado do Instagram, que fornece a capa e a ação de reprodução;
- um título acessível para o `iframe`;
- carregamento tardio com `loading="lazy"`;
- um botão textual “Assistir no Instagram”, aberto em nova aba, sempre visível como alternativa ao player incorporado.

O card será vertical, responsivo e limitado a uma largura confortável dentro do perfil. Bordas, cores e espaçamentos seguirão a identidade visual já usada na página pública.

## Reconhecimento e segurança da URL

Uma URL só poderá gerar um `iframe` quando:

- usar `http` ou `https`;
- tiver como host `instagram.com` ou `www.instagram.com`;
- possuir caminho no formato `/reel/<shortcode>` ou `/reels/<shortcode>`.

Os parâmetros de rastreamento serão removidos apenas da URL do player. O player usará o endereço canônico `https://www.instagram.com/reel/<shortcode>/embed/`. O botão externo manterá a URL original cadastrada.

Links comuns e URLs parecidas, mas pertencentes a outro domínio, continuarão sendo exibidos pelo comportamento atual e nunca serão incorporados em um `iframe`.

## Componentes e fluxo de dados

1. O Supabase continua fornecendo `professional_profile_entries.link_url` sem alteração de esquema.
2. A projeção pública continua mapeando o valor para `entry.linkUrl`.
3. Um helper puro converte somente URLs válidas de Reel em uma URL canônica de incorporação.
4. `ProfileSectionList` usa esse helper para escolher entre o card de vídeo e o link textual já existente.
5. O CSS da página pública torna o player responsivo e destaca a ação de assistir.

## Tratamento de falhas

O carregamento do player depende do Instagram e pode ser afetado por bloqueadores, cookies ou indisponibilidade externa. O botão “Assistir no Instagram” será exibido independentemente do sucesso do `iframe`, garantindo que o visitante ainda consiga acessar o vídeo.

Não haverá consulta adicional à API do Instagram, token, download de mídia ou armazenamento de capa no Supabase.

## Testes

Os testes devem comprovar que:

- uma URL pública de Reel produz o `iframe` com a URL canônica `/embed/`;
- o card mantém o link externo original e apresenta a chamada para assistir;
- uma URL de domínio semelhante ao Instagram não pode produzir `iframe`;
- links que não sejam Reels preservam a renderização existente;
- a suíte completa e o build continuam aprovados.

## Critérios de aceite

- O perfil de Carlos exibe visualmente o Reel da despedida da CPFL Energia.
- A capa e o botão de reprodução aparecem pelo player oficial do Instagram.
- O visitante pode abrir o Reel diretamente no Instagram.
- A solução funciona em telas móveis e desktop sem ultrapassar o cartão do perfil.
- Nenhum outro tipo de link passa a ser incorporado.
- Não há mudança de banco de dados nem impacto nas demais informações do perfil.
