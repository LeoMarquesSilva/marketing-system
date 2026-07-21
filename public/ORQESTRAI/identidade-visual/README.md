# ORQESTRAI - Identidade Visual

Esta pasta centraliza os arquivos de identidade visual do ORQESTRAI para uso no sistema: manual original, logos, simbolos, referencias visuais e tokens de cor.

## Estrutura

- `manual/orquestrai-identidade-visual-v3.pdf`: manual completo da identidade visual.
- `referencias/`: paginas do manual renderizadas em PNG para consulta rapida.
- `logos/`: arquivos finais em `.svg` e `.png`, prontos para uso no sistema.
- `orquestrai-brand-tokens.css`: variaveis CSS com a paleta principal.

## Conceito

A marca combina a ideia de orquestra, organizacao e inteligencia artificial. O simbolo usa um movimento continuo, remetendo a coordenacao de fluxos, tarefas e agentes. O elemento branco representa a batuta do maestro, reforcando direcao, ritmo e controle.

O nome `ORQESTRAI` transforma `orquestra` em uma marca proprietaria de sistema. A ausencia do `U` deixa o nome mais curto, memoravel e conectado ao termo `AI`.

## Paleta

| Uso | Cor | Hex |
| --- | --- | --- |
| Ciano principal | OrquestrAI Cyan | `#47cdd0` |
| Azul medio | OrquestrAI Blue | `#3e84a8` |
| Roxo profundo | OrquestrAI Indigo | `#48466e` |
| Fundo escuro | OrquestrAI Black | `#1c1c1c` |
| Fundo claro | OrquestrAI White | `#f9f9f9` |

Os SVGs tambem usam tons intermediarios no gradiente do simbolo: `#44b4c2`, `#4095b1` e `#45bdc7`.

## Tipografia

- Titulos: `New Astro Bold`.
- Texto: `Baloo Bhaiijaan 2 Regular`.

Para o sistema, use `New Astro Bold` apenas em pontos de marca ou chamadas curtas. Para textos de interface, mantenha uma fonte de UI legivel e use `Baloo Bhaiijaan 2` somente quando fizer sentido visualmente, como em telas institucionais, login, apresentacoes e pecas de marca.

## Logos

### Horizontal

- `logos/orquestrai-logo-horizontal-color.svg`
- `logos/orquestrai-logo-horizontal-color.png`
- `logos/orquestrai-logo-horizontal-ai-color.svg`
- `logos/orquestrai-logo-horizontal-ai-color.png`

Use em cabecalhos, sidebar expandida, login, apresentacoes e telas em que exista largura suficiente.

### Vertical

- `logos/orquestrai-logo-vertical-color.svg`
- `logos/orquestrai-logo-vertical-color.png`
- `logos/orquestrai-logo-vertical-ai-color.svg`
- `logos/orquestrai-logo-vertical-ai-color.png`

Use em capas, telas vazias, mockups, splash screens e contextos com composicao mais vertical.

### Simbolo

- `logos/orquestrai-symbol-dark.svg`
- `logos/orquestrai-symbol-dark.png`
- `logos/orquestrai-symbol-white.svg`
- `logos/orquestrai-symbol-white.png`

Use como favicon, app icon, avatar de sistema, icone compacto da sidebar e marca d'agua.

## Caminhos publicos no Next.js

Como os arquivos estao em `public`, os caminhos de uso no app comecam em `/ORQESTRAI/identidade-visual`.

Exemplos:

```tsx
<img
  src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-color.svg"
  alt="ORQESTRAI"
/>
```

```tsx
<img
  src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-white.svg"
  alt=""
  aria-hidden="true"
/>
```

## Regras rapidas de aplicacao

- Prefira SVG para interface web; use PNG apenas quando o destino nao aceitar vetor.
- Em fundo escuro, use as versoes coloridas ou o simbolo branco.
- Em fundo claro, use as versoes coloridas ou o simbolo escuro.
- Preserve margem de respiro ao redor do logo. Nao encoste o simbolo nas bordas de cards, botoes ou sidebars.
- Nao distorca, rotacione, aplique sombra pesada ou altere as cores do logo.
- Para telas operacionais do sistema, use a marca com sobriedade: logo no login, simbolo na sidebar e cores como acento, nao como fundo dominante em todas as areas.

## Referencias do manual

- Paginas 1 e 4: aplicacao principal em fundo escuro com atmosfera teal.
- Paginas 2 e 3: conceito do logo e do nome.
- Pagina 5: versoes em fundo escuro e claro.
- Pagina 6: paleta de cor.
- Pagina 7: tipografia.
- Paginas 8 a 11: mockups de app icon, sidebar, browser e login.
