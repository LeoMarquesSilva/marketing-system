# Redesign da interface de Minhas fotos

## Objetivo

Melhorar a experiência visual do módulo `/minhas-fotos` sem alterar banco, APIs, permissões ou regras de negócio. A galeria deve continuar compacta e mostrar muitas fotos ao mesmo tempo, enquanto a visualização ampliada deve facilitar comparação, navegação, escolha de usos e download.

## Escopo

O redesign abrange:

- cabeçalho e estados da página `Minhas fotos`;
- cards e grade compartilhados pelo componente `PhotoGalleryGrid`;
- visualizador ampliado da foto;
- responsividade, teclado, foco e feedback de operações;
- testes do comportamento introduzido ou reorganizado.

Não fazem parte deste trabalho:

- mudanças nas tabelas ou no storage;
- novas categorias ou regras de uso;
- upload pelo colaborador;
- alterações no fluxo administrativo além das melhorias herdadas pelo componente compartilhado;
- integração com Google Drive ou LinkedIn.

## Direção escolhida

Entre uma grade ultracompacta, agrupamento por sessão e uma galeria compacta refinada, foi escolhida a **galeria compacta refinada**. Ela preserva a densidade solicitada — várias fotos visíveis — sem sacrificar legibilidade ou ações importantes.

A interface segue o design system ORQESTRAI: Geist Sans, fundo claro, superfícies discretas, cantos moderados, bordas `#dce9eb`, ação `#347796`, ciano `#47cdd0` como foco e nenhuma informação operacional abaixo de 12 px.

## Página

O cabeçalho mantém título, explicação curta e botão `Ver guia`, mas elimina caixa alta e tracking decorativo. Abaixo dele, uma faixa compacta resume a quantidade de fotos e informa se a foto dos sistemas já foi escolhida. Essa faixa é informativa e não introduz filtros nem novas regras.

O conteúdo usa largura disponível do shell atual. Loading, erro e vazio ocupam a mesma região da galeria para evitar mudanças bruscas de layout:

- loading: skeletons com a proporção dos cards;
- erro: mensagem inline com ação `Tentar novamente`;
- vazio: ícone, título e explicação direta, sem CTA sem função.

## Grade e cards

### Densidade

- mobile estreito: 2 colunas;
- mobile largo e tablet: 3 ou 4 colunas conforme largura;
- desktop: 5 colunas;
- telas largas: 6 colunas.

A grade continua regular para facilitar comparação. Cada imagem fica em uma moldura vertical `3:4`, usando `object-contain`, pois recortar fotos corporativas pode esconder enquadramento importante. O fundo da moldura diferencia áreas vazias sem competir com a fotografia.

### Hierarquia do card

Cada card contém, nesta ordem:

1. fotografia;
2. selo da foto dos sistemas, quando aplicável;
3. nome curto da sessão ou arquivo, sem repetir ambos quando a informação for redundante;
4. usos selecionáveis;
5. ações.

O estado oficial recebe borda e marcador ciano, sem usar um anel pesado. Categorias usam controles compactos com altura e foco adequados. Selecionado e não selecionado devem ser reconhecíveis por cor, preenchimento e texto, não apenas por cor.

As ações `Abrir` e `Baixar` permanecem visíveis. `Excluir` continua disponível apenas quando autorizado, com menor destaque visual e confirmação existente. Em telas estreitas, os controles não podem depender de hover.

## Visualizador ampliado

O lightbox atual será substituído por um visualizador em tela cheia composto por duas regiões:

- **palco da imagem:** fundo carvão azulado, fotografia centralizada, sem recorte e limitada pela área disponível;
- **painel lateral:** superfície clara com metadados, usos e ações.

No desktop, o painel tem largura estável aproximada de 320 a 360 px e o palco ocupa o restante. No mobile, a composição vira uma coluna: imagem na parte superior e painel inferior rolável. O cabeçalho e os controles essenciais permanecem acessíveis sem exigir rolagem horizontal.

### Conteúdo e ações

O visualizador mostra:

- contador `posição de total`;
- nome do arquivo e sessão, quando disponíveis;
- categoria especial `Foto dos sistemas do escritório` com explicação curta;
- demais categorias de uso;
- download;
- exclusão, quando autorizada;
- fechamento.

O usuário pode alterar os mesmos usos do card diretamente no painel. O estado ocupado desabilita somente as ações da foto atual e exibe feedback no controle acionado. Erros permanecem visíveis no painel sem fechar o visualizador.

### Navegação e acessibilidade

- setas visíveis navegam para a foto anterior e a próxima;
- `ArrowLeft` e `ArrowRight` repetem essa navegação;
- `Escape` fecha o visualizador;
- o foco inicial vai para o botão de fechar;
- o foco permanece dentro do visualizador enquanto ele estiver aberto;
- ao fechar, o foco retorna ao botão `Abrir` do card de origem;
- a rolagem do documento fica bloqueada durante a abertura;
- clicar no backdrop fecha, mas clicar na imagem ou no painel não fecha;
- primeira e última foto não fazem navegação circular;
- rótulos acessíveis identificam fechar, anterior e próxima;
- `prefers-reduced-motion` é respeitado.

## Componentes e responsabilidades

Para reduzir o acoplamento, a implementação será organizada em unidades focadas:

- `PhotoGalleryGrid`: organiza a coleção, controla a foto aberta e conecta eventos existentes;
- `PhotoGalleryCard`: apresenta uma foto compacta e dispara ações;
- `PhotoLightbox`: controla layout, teclado, foco e navegação da visualização ampliada;
- `PhotoUsageSelector`: apresenta as categorias e seus estados tanto no card quanto no painel, evitando regras visuais duplicadas.

Os tipos e funções de API existentes permanecem como fonte de dados. A foto aberta deve ser derivada do array atualizado por `id`, evitando que o painel mantenha uma cópia desatualizada depois de alterar usos.

## Fluxo de dados

1. `MinhasFotosClient` carrega fotos e tipos de uso como hoje.
2. `PhotoGalleryGrid` recebe a coleção e guarda apenas o `id` da foto aberta.
3. Card ou painel chamam `onToggleUsage` e `onDelete` existentes.
4. `MinhasFotosClient` mantém separadamente erro de carregamento e erro de ação, associando o erro de ação ao `id` da foto correspondente.
5. O cliente atualiza `photos`; card e lightbox refletem o novo estado pela mesma coleção.
6. Quando a foto associada ao erro estiver aberta, o painel exibe a mensagem; a página também mantém uma mensagem inline para ações feitas diretamente no card.
7. Ao excluir a foto aberta, o visualizador fecha antes de a remoção completar, preservando o comportamento de segurança atual.
8. A seleção oficial continua chamando `refreshProfile()`.

## Erros e estados extremos

- Se a imagem de preview falhar, o card mostra um fallback discreto com nome do arquivo.
- Se a imagem original falhar no lightbox, o painel continua utilizável e oferece download.
- Se houver apenas uma foto, controles anterior/próxima não aparecem.
- Se não houver categorias ativas, a galeria ainda permite abrir, baixar e excluir.
- Se uma alteração de uso falhar, a seleção anterior permanece e uma mensagem explica que não foi possível salvar.
- A remoção da foto aberta fecha o lightbox e não deixa URL quebrada visível.

## Verificação

A entrega deve validar:

- renderização com zero, uma e várias fotos;
- 2 colunas no mobile e até 6 em telas largas;
- navegação por botões e teclado;
- fechamento por `Escape` e backdrop;
- retorno de foco ao card;
- bloqueio de scroll;
- alteração de usos pelo card e pelo painel;
- atualização imediata do estado oficial;
- download e exclusão conforme permissão;
- loading, erro de API e erro de imagem;
- ausência de regressões no tour de `Minhas fotos` e na galeria administrativa compartilhada;
- `tsc --noEmit`, ESLint e testes relevantes.

## Critérios de aceite

- A página mantém alta densidade de fotos sem texto operacional abaixo de 12 px.
- A foto ampliada aproveita a maior parte da viewport e não é recortada.
- Categorias e ações podem ser usadas sem fechar o visualizador.
- O usuário navega entre fotos sem voltar à grade.
- Desktop e mobile mantêm todos os recursos autorizados.
- APIs, banco, storage, permissões e regra da foto oficial permanecem inalterados.
