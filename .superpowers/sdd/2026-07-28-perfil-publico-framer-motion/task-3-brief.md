# Task 3: Ações de contato e conteúdo com microinterações

## Contexto

Refinar a área de conversão da página NFC já redesenhada: CTA para salvar
contato, dock de redes e cards de conteúdo recente. Toda ação e telemetria
existente deve continuar intacta.

## Arquivos

- Modificar `src/components/profiles/profile-contact-actions.tsx`.
- Modificar `src/components/profiles/profile-recent-content.tsx`.
- Modificar `src/components/profiles/professional-profile-page.module.css`.
- Testar em `src/components/profiles/professional-profile-page.test.tsx`.

## Requisitos preservados

- Mesmos `data-action`.
- Mesma ordem: salvar, WhatsApp, e-mail, LinkedIn, compartilhar, site.
- Mesmos `ProfileEventLink`, métricas, handlers, URLs e fallback de vCard.
- Mesma privacidade: links ausentes continuam omitidos.

## TDD obrigatório

Antes da produção, adicionar teste que exija:

```tsx
expect(markup).toContain("pp-action--primary");
expect(markup).toContain("pp-contact-dock");
expect(markup).toContain('data-action="whatsapp"');
expect(markup).toContain('data-action="linkedin"');
```

Executar e registrar RED por ausência de `pp-contact-dock`.

## Microinterações

No componente cliente de ações, usar `m` e `useReducedMotion` de
`framer-motion`.

- Envolver o CTA em `m.div` com `whileTap={{ scale: 0.985 }}`.
- Envolver cada link/botão do dock em `m.div`.
- Em movimento normal, usar `whileHover={{ y: -2 }}`.
- Em movimento reduzido, omitir `whileHover`.
- Em toque, usar `whileTap={{ scale: 0.97 }}`.
- O elemento interativo real e todos os handlers permanecem inalterados.
- Renomear o contêiner visual das redes para `pp-contact-dock`.

## CSS obrigatório

- CTA navy com detalhe/brilho dourado discreto.
- `:focus-visible` com outline de 3 px e contraste adequado.
- Dock translúcido e responsivo, sem rolagem horizontal.
- Até cinco colunas quando houver espaço; em 320 px, grade que não gere
  overflow.
- Alvos de toque mínimos de 44 px.
- Ícones com rótulos entre 11 e 12 px.
- Status e fallback imediatamente abaixo do CTA.

## Conteúdo recente

- Preservar URLs, imagens, datas e limite de três itens.
- Imagem/fallback com 64 px.
- Mostrar origem, título limitado visualmente a três linhas e indicador de
  saída/seta.
- Hover apenas onde houver suporte.
- Não adicionar autoplay, vídeo, dependência ou requisição.

## Validação

Executar:

```powershell
npx vitest run src/components/profiles/professional-profile-page.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts
```

Esperado: todos passando.

Executar lint dos arquivos alterados.

## Restrições

- Mobile 320–430 px prioritário.
- Não alterar dados, links, métricas, idioma ou privacidade.
- Respeitar `prefers-reduced-motion`.
- Não adicionar dependências.
- Não criar commit.
- Escrever relatório em
  `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/task-3-report.md`.

