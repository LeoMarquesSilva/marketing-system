# Perfil público NFC — redesign premium com Framer Motion

## Objetivo

Transformar a página pública aberta pela tag NFC em um cartão de apresentação
digital premium do Bismarchi | Pires. A experiência deve causar boa primeira
impressão, priorizar o uso em celular e levar rapidamente às ações de contato,
sem comprometer acessibilidade ou desempenho.

## Direção visual

A direção aprovada é “cartão digital concierge”: azul-marinho profundo, branco
quente e dourado usado com moderação. O resultado deve transmitir sobriedade,
confiança e acabamento institucional, evitando excesso de cartões, brilhos,
gradientes decorativos e animações chamativas.

A tipografia editorial existente será preservada e refinada. A foto, o nome e
o cargo formam o foco visual; campanha, metadados e ações aparecem como apoio.
No celular, a página deve parecer uma composição única e contínua, não um
formulário dentro de um painel branco.

## Estrutura

1. Cabeçalho atmosférico com logo, idioma e campanha integrada.
2. Hero com retrato, nome, cargo, área, OAB e tagline.
3. Ação principal para salvar o contato.
4. Dock compacto para WhatsApp, e-mail, LinkedIn, compartilhar e site.
5. Biografia e seções profissionais com leitura confortável.
6. Conteúdo recente em cards editoriais compactos.
7. Rodapé institucional discreto.

No desktop, a mesma hierarquia ganha respiro e uma composição assimétrica leve.
Nenhuma informação pública ou regra de visibilidade será alterada.

## Movimento

O Framer Motion será usado em um componente cliente isolado:

- entrada inicial em sequência para campanha, foto, identidade e ações;
- `stagger` curto e opacidade/translação reduzidas;
- seções reveladas uma vez ao entrar na viewport;
- microinterações de toque e hover nos botões;
- detalhe dourado ou luz ambiente com movimento quase imperceptível;
- ausência de parallax agressivo, looping constante ou efeitos que atrasem a ação.

Todas as animações devem respeitar `prefers-reduced-motion`. Nesse modo, o
conteúdo aparece imediatamente ou com transições mínimas.

## Arquitetura

Os componentes de conteúdo continuam recebendo `PublicProfessionalProfile`.
Um wrapper cliente concentra variantes, viewport e preferências de movimento,
evitando tornar a página inteira responsável por animação. Links, métricas,
download de vCard, compartilhamento, idioma e fallback de contato permanecem
inalterados.

O CSS Module mantém tokens de cor, tipografia, espaçamento e breakpoints. O
Framer Motion controla somente estado e transformação; layout e responsividade
continuam no CSS para evitar instabilidade visual.

## Mobile e acessibilidade

- prioridade para larguras entre 320 e 430 px;
- alvos de toque de pelo menos 44 px;
- conteúdo principal visível rapidamente;
- contraste adequado entre navy, dourado e texto;
- foco de teclado claramente visível;
- sem overflow horizontal;
- animações não devem deslocar o layout;
- ícones sempre acompanhados por rótulo acessível.

## Validação

- testes existentes de conteúdo, ordem e ações permanecem válidos;
- teste do wrapper de movimento e do modo de movimento reduzido;
- lint e TypeScript dos arquivos alterados;
- testes dos componentes públicos;
- build de produção;
- inspeção visual mobile e desktop na rota pública do perfil piloto.

