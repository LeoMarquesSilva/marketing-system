# Task 2: Composição concierge e hero mobile-first

## Contexto

Integrar os primitivos de Framer Motion ao perfil público NFC e redesenhar a
composição principal para a identidade premium do Bismarchi | Pires. O foco é
mobile entre 320 e 430 px, com expansão elegante no desktop.

## Arquivos

- Modificar `src/components/profiles/professional-profile-page.tsx`.
- Modificar `src/components/profiles/profile-hero.tsx`.
- Modificar `src/components/profiles/professional-profile-page.module.css`.
- Testar em `src/components/profiles/professional-profile-page.test.tsx`.

## Interfaces disponíveis

De `src/components/profiles/profile-motion.tsx`:

- `ProfileMotionRoot({ children })`.
- `ProfileMotionItem({ children, className?, delay?, viewport? })`.

Preservar `ProfessionalProfilePageProps`, `ProfileHeroProps`, todos os
atributos `data-*`, conteúdo, URLs e ordem das ações existentes.

## TDD obrigatório

Antes da implementação, adicionar teste que exija:

```tsx
expect(markup).toContain("pp-atmosphere");
expect(markup).toContain("pp-profile-card");
expect(markup).toContain("pp-hero__portrait");
expect(markup).toContain("pp-hero__identity");
```

Executar o teste e registrar a falha esperada.

## Composição

Envolver a página em `ProfileMotionRoot`. Adicionar `pp-atmosphere` decorativo
com `aria-hidden="true"`. Usar `<main className="pp-shell">`.

Sequência:

- chrome (idioma e campanha) com atraso `0.04`;
- hero com atraso `0.10`;
- ações com atraso `0.18`;
- seções e conteúdo recente com `viewport`;
- rodapé sem atraso obrigatório.

Estrutura visual principal deve usar `pp-profile-card`, substituindo
`pp-panel`. A campanha permanece sem rótulo “Campanha” e deve mostrar apenas
a frase.

## Hero

Manter logo, fallback de iniciais, foto, nome, cargo, área, OAB, tenure,
tagline, biografia e quebras de parágrafo.

Criar:

- `pp-hero__portrait` em volta da foto;
- `pp-hero__photo-halo` decorativo com `aria-hidden`;
- `pp-hero__identity` em volta dos textos.

## Direção visual obrigatória

- fundo base `#061525`, com gradientes radiais dourados abaixo de 12%;
- cartão branco quente `#f8f6f1`;
- borda dourada translúcida;
- raio do cartão entre 24 e 30 px;
- mobile com `padding-inline: 14px`;
- hero mobile centralizado, foto entre 132 e 144 px;
- desktop a partir de 768 px em duas colunas, largura máxima próxima de 760 px;
- campanha integrada ao chrome;
- eliminar `@keyframes pp-rise` e animações CSS de entrada para não duplicar
  o Framer Motion;
- manter Cormorant Garamond e Source Sans 3 já configuradas;
- manter foco visível, contraste e ausência de overflow.

## Validação

Executar:

```powershell
npx vitest run src/components/profiles/professional-profile-page.test.tsx
```

Esperado: todos os testes passando.

Executar lint dos arquivos alterados.

## Restrições

- Não adicionar dependências.
- Respeitar movimento reduzido através dos wrappers existentes.
- Não alterar dados, links, métricas, vCard, idioma ou privacidade.
- Não criar commit.
- Escrever relatório em
  `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/task-2-report.md`.

