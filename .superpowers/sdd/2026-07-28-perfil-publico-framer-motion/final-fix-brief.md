# Final fix wave — achados da revisão integrada

Corrigir os achados abaixo em uma única rodada. Não ampliar o escopo e não
criar commit.

## Critical 1 — wrappers `whileTap` focáveis

Em `profile-contact-actions.tsx`, `m.div` com `whileTap` em volta de links e
botões recebe `tabindex="0"` automaticamente pelo Framer Motion. Isso duplica
paradas de Tab com wrappers sem nome ou ação.

Correção preferida: remover gesto do wrapper e manter a microinteração de toque
no próprio elemento interativo ou em CSS `:active`. Se mantiver wrapper Motion,
ele não pode ser focável nem interferir na semântica/ordem do teclado. Adicionar
teste SSR que falhe se o markup incluir wrappers focáveis extras.

## Critical 2 — conteúdo invisível no SSR/sem JavaScript

`ProfileMotionItem` serializa `opacity: 0` no HTML inicial. Hero, ações e seções
ficam em branco até hidratação e podem permanecer invisíveis se JavaScript
falhar.

Corrigir com progressivo enhancement: conteúdo principal deve chegar visível
no HTML e permanecer legível sem JavaScript. Framer Motion pode continuar
animando detalhes decorativos, viewport ou microinterações, mas não pode usar
opacidade zero no SSR para conteúdo essencial. Adicionar teste de markup que
comprove ausência de `opacity:0` no HTML inicial dos wrappers.

## Important 1 — mismatch com movimento reduzido

Servidor e primeiro render cliente não podem produzir estilos iniciais
diferentes quando `prefers-reduced-motion` está ativo. A correção do estado
inicial deve usar markup determinístico; o modo reduzido não pode animar
translação.

## Important 2 — validação ao vivo não reproduzível

A rota piloto respondeu 200, mas a revisão não encontrou marcadores novos no
HTML do servidor ativo. Verificar se o processo de desenvolvimento está
servindo código antigo. Não iniciar instância duplicada; reiniciar a existente
somente se for seguro. Confirmar que a resposta final contém `pp-profile-card`,
`pp-chrome` e o nome/campanha.

Se Microsoft Edge ou Chrome já estiver instalado e puder ser usado headless
sem instalação, validar ao menos 390×844 e 1440×900. Não instalar navegador ou
dependência.

## Minors a tratar quando diretamente relacionados

- `whileTap` também deve respeitar movimento reduzido.
- Evitar estouro de “Compartilhar” em 320 px com quebra/clamp adequado.
- Testes devem cobrir SSR visível e ausência de wrappers focáveis.
- Remover `role="status"` da campanha estática.
- Não é necessário adicionar movimento à luz ambiente se isso conflitar com
  redução de movimento ou desempenho.

## Validação obrigatória

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts
npx eslint src/components/profiles/profile-motion.tsx src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.tsx src/components/profiles/profile-contact-actions.tsx src/components/profiles/profile-recent-content.tsx
npm run build
```

Escrever relatório em:

`.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/final-fix-report.md`

