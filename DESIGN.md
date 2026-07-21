# ORQESTRAI - Design System do Produto

## Direcao

Interface operacional, refinada e silenciosa. O fundo principal e claro, as superficies sao brancas, a navegacao usa o ambiente escuro da marca e as cores ORQESTRAI aparecem como orientacao, foco e hierarquia.

Manual e arquivos oficiais: `public/ORQESTRAI/identidade-visual/`.

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--orquestrai-cyan` | `#47cdd0` | foco, selecao e acento |
| `--orquestrai-blue` | `#3e84a8` | marca, graficos e decoracao |
| `--orquestrai-action` | `#347796` | botoes preenchidos acessiveis |
| `--orquestrai-indigo` | `#48466e` | terceiro tom, categorias e dados |
| `--orquestrai-surface-from` | `#03070c` | inicio de superficies escuras |
| `--orquestrai-surface-to` | `#04202f` | sidebar, menus escuros e tooltip |
| `--orquestrai-black` | `#1c1c1c` | texto forte sobre ciano |
| `--orquestrai-white` | `#f9f9f9` | texto e marca em fundos escuros |

`#3e84a8` e cor de marca, mas nao deve receber texto branco pequeno. Para botoes, usar `#347796`; no hover, `#285f7a`.

Vermelho, amber, verde e azul informativo ficam reservados para estados semanticos. Roxo ou indigo de interface deve derivar de `--orquestrai-indigo`.

## Tipografia

- UI, tabelas e formularios: Geist Sans.
- Numeros tecnicos e duracoes: Geist Mono.
- Pontos institucionais curtos: Baloo Bhaiijaan 2 por `font-brand`.
- Texto operacional minimo: 12 px.
- Letter spacing: sempre `0`.
- Cada tela autenticada possui um unico `h1`, fornecido pelo header global.

## Estrutura

- Fundo geral claro e neutro.
- Sidebar compacta com 72 px e expandida com 260 px ao receber hover ou foco.
- Sidebar compacta mostra somente o simbolo; expandida mostra somente o logo horizontal.
- Header com 56 px, titulo, busca contextual e logo discreto em telas com espaco.
- Conteudo usa `p-4` no mobile e `p-6` no desktop.
- A marca d'agua pode aparecer no canto, atras do conteudo e com opacidade maxima de 6%.

## Superficies

- Cards operacionais: `rounded-md` ou `rounded-lg`, borda `#dce9eb` e sombra curta.
- Evitar cards dentro de cards; secoes internas usam divisores, bandas ou espacamento.
- Vidro e blur ficam restritos ao header, menus flutuantes e tours.
- `rounded-full` e reservado a avatar, status, contador e badge.

## Controles

- Comandos usam `Button`; controles nativos ficam para celulas, drag handles ou interacoes especializadas.
- Botao primario: fundo `#347796`, texto branco, hover `#285f7a`.
- Botao secundario: fundo ciano muito claro e texto azul escuro.
- Icon button sempre recebe `aria-label` ou tooltip.
- Inputs e selects compartilham altura, borda, foco ciano e fundo branco.
- Controles de toque devem oferecer alvo de aproximadamente 44 px.

## Movimento

- Framer Motion e permitido para sidebar, menus, tours e mudancas de contexto.
- Animacoes devem explicar hierarquia ou continuidade; nao decorar cada card.
- `MotionConfig reducedMotion="user"` e a regra global de acessibilidade.
- CSS tambem reduz animacoes e transicoes com `prefers-reduced-motion`.

## Responsividade

- Nenhuma area autorizada pode desaparecer no mobile.
- A barra inferior exibe atalhos principais e o menu `Mais` concentra todas as rotas, perfil e saida.
- Tabelas largas usam scroll horizontal ou uma apresentacao alternativa em cards.
- Dialogs respeitam `90dvh`, mantem cabecalho e rodape visiveis e rolam somente o corpo.

## Checklist de Entrega

- Logo correto para o fundo e sem repeticao.
- Botoes preenchidos com texto branco e contraste AA.
- Nenhum texto operacional abaixo de 12 px.
- Nenhum `rounded-2xl` ou `rounded-3xl` em superficies do sistema.
- Estados de loading, vazio, erro e sucesso presentes.
- Foco visivel, nomes acessiveis e ordem de teclado coerente.
- Desktop e mobile verificados visualmente.
- `tsc --noEmit` e ESLint executados sem erros.
