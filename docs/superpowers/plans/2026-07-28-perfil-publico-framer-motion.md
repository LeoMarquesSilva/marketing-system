# Perfil público premium com Framer Motion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma página pública de perfil NFC premium, mobile-first e animada com Framer Motion, preservando todos os dados, links e eventos existentes.

**Architecture:** A página continuará sendo um componente de servidor. Um conjunto pequeno de wrappers cliente concentrará variantes, viewport e redução de movimento; os componentes de conteúdo permanecerão focados em conteúdo e sem estado de animação. CSS Modules continuará responsável por layout, identidade visual e breakpoints.

**Tech Stack:** Next.js 16, React 19, TypeScript, Framer Motion 12, CSS Modules, Vitest.

## Global Constraints

- Priorizar larguras entre 320 e 430 px; desktop é uma expansão da mesma hierarquia.
- Preservar métricas, vCard, compartilhamento, idioma, privacidade e URLs existentes.
- Manter alvos de toque com pelo menos 44 px e foco de teclado visível.
- Respeitar `prefers-reduced-motion`; nesse modo não deve haver deslocamento animado.
- Não adicionar dependências: `framer-motion` já existe no projeto.
- Não criar commit sem pedido explícito do usuário.

---

### Task 1: Primitivos de movimento acessíveis

**Files:**
- Create: `src/components/profiles/profile-motion.tsx`
- Create: `src/components/profiles/profile-motion.test.tsx`

**Interfaces:**
- Produces: `ProfileMotionRoot({ children }: { children: ReactNode })`
- Produces: `ProfileMotionItem({ children, className?, delay?, viewport? })`
- Produces: `getProfileMotionState(reduced: boolean, delay?: number)`

- [ ] **Step 1: Escrever teste falhando para movimento normal e reduzido**

```tsx
import { describe, expect, it } from "vitest";
import { getProfileMotionState } from "@/components/profiles/profile-motion";

describe("getProfileMotionState", () => {
  it("usa deslocamento e atraso no modo normal", () => {
    expect(getProfileMotionState(false, 0.12)).toMatchObject({
      initial: { opacity: 0, y: 18 },
      transition: { delay: 0.12 },
    });
  });

  it("remove deslocamento e atraso com movimento reduzido", () => {
    expect(getProfileMotionState(true, 0.12)).toEqual({
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    });
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npx vitest run src/components/profiles/profile-motion.test.tsx`

Expected: FAIL porque `profile-motion.tsx` ainda não existe.

- [ ] **Step 3: Criar wrappers cliente com `LazyMotion` e `useReducedMotion`**

```tsx
"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import type { ReactNode } from "react";

export function getProfileMotionState(reduced: boolean, delay = 0) {
  if (reduced) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.58,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

export function ProfileMotionRoot({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}

export function ProfileMotionItem({
  children,
  className,
  delay = 0,
  viewport = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  viewport?: boolean;
}) {
  const reduced = Boolean(useReducedMotion());
  const state = getProfileMotionState(reduced, delay);

  return (
    <m.div
      className={className}
      initial={state.initial}
      animate={viewport ? undefined : state.animate}
      whileInView={viewport ? state.animate : undefined}
      viewport={viewport ? { once: true, amount: 0.14 } : undefined}
      transition={state.transition}
    >
      {children}
    </m.div>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run src/components/profiles/profile-motion.test.tsx`

Expected: PASS.

---

### Task 2: Composição concierge e hero mobile-first

**Files:**
- Modify: `src/components/profiles/professional-profile-page.tsx`
- Modify: `src/components/profiles/profile-hero.tsx`
- Modify: `src/components/profiles/professional-profile-page.module.css`
- Test: `src/components/profiles/professional-profile-page.test.tsx`

**Interfaces:**
- Consumes: `ProfileMotionRoot` e `ProfileMotionItem` da Task 1.
- Preserva: `ProfessionalProfilePageProps`, `ProfileHeroProps` e todos os atributos `data-*` usados nos testes.

- [ ] **Step 1: Adicionar expectativas estruturais ao teste da página**

```tsx
it("usa a composição concierge e preserva a hierarquia mobile", () => {
  const markup = renderToStaticMarkup(
    <ProfessionalProfilePage profile={makeProfile()} />
  );
  expect(markup).toContain("pp-atmosphere");
  expect(markup).toContain("pp-profile-card");
  expect(markup).toContain("pp-hero__portrait");
  expect(markup).toContain("pp-hero__identity");
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npx vitest run src/components/profiles/professional-profile-page.test.tsx`

Expected: FAIL nas novas classes.

- [ ] **Step 3: Reorganizar a página sem alterar conteúdo ou URLs**

Envolver a página com `ProfileMotionRoot`; adicionar a camada decorativa
`pp-atmosphere`; animar idioma/campanha, hero e ações com atrasos de `0.04`,
`0.10` e `0.18`; envolver seções e conteúdo recente com `viewport`.

```tsx
<ProfileMotionRoot>
  <div className={`${styles.root} pp-root`} data-profile-slug={profile.slug}>
    <div className="pp-atmosphere" aria-hidden="true" />
    <main className="pp-shell">
      <ProfileMotionItem className="pp-chrome" delay={0.04}>
        {/* idioma e campanha */}
      </ProfileMotionItem>
      <article className="pp-profile-card">
        <ProfileMotionItem delay={0.1}>
          <ProfileHero profile={profile} />
        </ProfileMotionItem>
        <ProfileMotionItem delay={0.18}>
          <ProfileContactActions profile={profile} source={source} />
        </ProfileMotionItem>
        <ProfileMotionItem viewport>
          <ProfileSectionList profile={profile} />
        </ProfileMotionItem>
        <ProfileMotionItem viewport>
          <ProfileRecentContent profile={profile} />
        </ProfileMotionItem>
        <ProfileInstitutionalFooter profile={profile} />
      </article>
    </main>
  </div>
</ProfileMotionRoot>
```

- [ ] **Step 4: Refinar o hero para foco em retrato e identidade**

Manter o fallback de iniciais e a biografia, mas usar as classes:

```tsx
<div className="pp-hero__portrait">
  <div className="pp-hero__photo-halo" aria-hidden="true" />
  <div className="pp-hero__photo-ring">{/* imagem ou iniciais */}</div>
</div>
<div className="pp-hero__identity">
  <p className="pp-hero__eyebrow">{identity.role}</p>
  <h1 className="pp-hero__name">{identity.name}</h1>
  {/* regra, chips e tagline */}
</div>
```

- [ ] **Step 5: Substituir o painel branco pela composição navy/dourada**

No CSS Module:

- fundo `#061525` com gradientes radiais dourados abaixo de 12% de opacidade;
- cartão principal branco quente `#f8f6f1`, borda dourada translúcida e raio entre 24 e 30 px;
- mobile com `padding-inline: 14px`, hero centralizado e foto de 132–144 px;
- desktop a partir de 768 px com hero em duas colunas e máximo de 760 px;
- campanha incorporada ao chrome, sem rótulo “Campanha”;
- remover os `@keyframes pp-rise` para evitar animação duplicada com Framer Motion.

- [ ] **Step 6: Rodar teste da página**

Run: `npx vitest run src/components/profiles/professional-profile-page.test.tsx`

Expected: PASS.

---

### Task 3: Ações de contato e conteúdo com microinterações

**Files:**
- Modify: `src/components/profiles/profile-contact-actions.tsx`
- Modify: `src/components/profiles/profile-recent-content.tsx`
- Modify: `src/components/profiles/professional-profile-page.module.css`
- Test: `src/components/profiles/professional-profile-page.test.tsx`

**Interfaces:**
- Preserva: `data-action`, ordem de ações, `ProfileEventLink`, métricas e fallback.
- Consome: `m` e `useReducedMotion` de `framer-motion`.

- [ ] **Step 1: Estender teste para dock e botão principal**

```tsx
it("renderiza CTA principal e dock de contato premium", () => {
  const markup = renderToStaticMarkup(
    <ProfessionalProfilePage profile={makeProfile()} />
  );
  expect(markup).toContain("pp-action--primary");
  expect(markup).toContain("pp-contact-dock");
  expect(markup).toContain('data-action="whatsapp"');
  expect(markup).toContain('data-action="linkedin"');
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npx vitest run src/components/profiles/professional-profile-page.test.tsx`

Expected: FAIL por ausência de `pp-contact-dock`.

- [ ] **Step 3: Animar CTA e itens do dock sem alterar links**

Renomear apenas o contêiner visual para `pp-contact-dock`. Usar `m.div` em
volta do CTA e de cada link/botão, com `whileTap={{ scale: 0.97 }}` e
`whileHover={reduced ? undefined : { y: -2 }}`. O elemento interativo real e
seus handlers permanecem inalterados.

```tsx
const reduced = Boolean(useReducedMotion());

<m.div whileTap={{ scale: 0.985 }}>
  <a className={`${ACTION_CLASS} pp-action--primary`} ...>
    <IconContactCard />
    <span>{copy.saveContact}</span>
  </a>
</m.div>
```

- [ ] **Step 4: Refinar estados visuais para toque, foco e status**

No CSS:

- CTA navy com brilho dourado discreto e `:focus-visible` de 3 px;
- dock com fundo translúcido, cinco colunas quando couber e rolagem nunca necessária;
- ícones com rótulos de 11–12 px;
- status/fallback imediatamente abaixo do CTA;
- em 320 px, usar grade responsiva sem overflow.

- [ ] **Step 5: Refinar cards de conteúdo recente**

Preservar URLs e datas. Aplicar imagem 64 px, rótulo da origem, título com no
máximo três linhas e seta visual; usar hover apenas em dispositivos que o
suportam. Não adicionar autoplay, vídeo ou requisições extras.

- [ ] **Step 6: Rodar testes públicos**

Run:

```powershell
npx vitest run src/components/profiles/professional-profile-page.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts
```

Expected: 3 arquivos e todos os testes PASS.

---

### Task 4: Verificação final e acabamento responsivo

**Files:**
- Modify if needed: `src/components/profiles/professional-profile-page.module.css`
- Modify if needed: `src/components/profiles/profile-motion.tsx`

**Interfaces:**
- Não produz nova API.
- Valida o conjunto entregue nas Tasks 1–3.

- [ ] **Step 1: Verificar lint dos arquivos alterados**

Run:

```powershell
npx eslint src/components/profiles/profile-motion.tsx src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.tsx src/components/profiles/profile-hero.tsx src/components/profiles/profile-contact-actions.tsx src/components/profiles/profile-recent-content.tsx
```

Expected: exit code 0.

- [ ] **Step 2: Rodar build de produção**

Run: `npm run build`

Expected: exit code 0, sem erro TypeScript ou de componente servidor/cliente.

- [ ] **Step 3: Inspecionar o perfil piloto no servidor já ativo**

Abrir:

```text
http://localhost:3000/perfil/felipe-soares-de-camargo
```

Conferir em 320×568, 390×844, 430×932 e 1440×900:

- campanha “Feliz Dia do Advogado” legível e integrada;
- nome e foto acima da dobra no celular;
- CTA e redes acessíveis sem overflow;
- animações discretas e sem salto de layout;
- biografia e seções com contraste e ritmo de leitura;
- desktop com respiro, sem esticar o conteúdo;
- modo de movimento reduzido sem translações.

- [ ] **Step 4: Rodar suíte focal novamente**

Run:

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts
```

Expected: todos os testes PASS.

