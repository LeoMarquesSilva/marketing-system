# Task 1 — Relatório: Primitivos de movimento acessíveis

**Plano:** `docs/superpowers/plans/2026-07-28-perfil-publico-framer-motion.md`  
**Brief:** `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/task-1-brief.md`  
**Data:** 2026-07-29  
**Status:** ✅ Concluída (GREEN)

---

## Resumo

Camada cliente isolada criada com Framer Motion (`LazyMotion` + `domAnimation`) para a página pública de perfil NFC. Exporta `ProfileMotionRoot`, `ProfileMotionItem` e `getProfileMotionState`, respeitando `prefers-reduced-motion` sem deslocamento nem atraso.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/profiles/profile-motion.tsx` | **Criado** — implementação de produção |
| `src/components/profiles/profile-motion.test.tsx` | **Pré-existente** — testes TDD (não alterados) |

Nenhum outro arquivo foi modificado.

---

## Evidência RED (fornecida pelo controlador)

Antes da implementação, o agente anterior criou apenas o teste. O controlador executou:

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx --reporter=dot
```

**Resultado esperado:** falha porque o módulo `@/components/profiles/profile-motion` não existia.

**Erro registrado:** resolução de import falhou — arquivo `profile-motion.tsx` ausente no diretório `src/components/profiles/`.

---

## Implementação

### `getProfileMotionState(reduced, delay?)`

Função pura que centraliza variantes de animação:

- **Modo normal (`reduced = false`):** `initial: { opacity: 0, y: 18 }`, `animate: { opacity: 1, y: 0 }`, `transition: { duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }`.
- **Modo reduzido (`reduced = true`):** `initial: false`, `animate: { opacity: 1, y: 0 }`, `transition: { duration: 0 }` — sem deslocamento e sem atraso.

### `ProfileMotionRoot`

Wrapper com `"use client"` que envolve filhos em `<LazyMotion features={domAnimation}>` para carregar apenas o bundle DOM de animação.

### `ProfileMotionItem`

Componente `m.div` que:

1. Lê `useReducedMotion()` e delega variantes a `getProfileMotionState`.
2. Com `viewport = false` (padrão): anima na montagem via `initial` + `animate`.
3. Com `viewport = true`: usa `whileInView` com `viewport={{ once: true, amount: 0.14 }}`.
4. Aceita `className` e `delay` opcionais.

---

## Evidência GREEN

Comando executado:

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx --reporter=dot
```

Saída:

```
 RUN  v3.2.6 C:/bkp/doc/marketing-system

··

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  09:28:22
   Duration  2.34s (transform 52ms, setup 0ms, collect 1.86s, tests 3ms, environment 0ms, prepare 155ms)
```

Lint (sem warnings):

```powershell
npx eslint src/components/profiles/profile-motion.tsx src/components/profiles/profile-motion.test.tsx
```

Exit code: 0.

---

## Testes cobertos

| Teste | Comportamento verificado |
|-------|--------------------------|
| `usa deslocamento e atraso no modo normal` | `getProfileMotionState(false, 0.12)` contém `initial: { opacity: 0, y: 18 }` e `transition: { delay: 0.12 }` |
| `remove deslocamento e atraso com movimento reduzido` | `getProfileMotionState(true, 0.12)` retorna exatamente `{ initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }` |

**Nota:** os componentes React (`ProfileMotionRoot`, `ProfileMotionItem`) não possuem testes de renderização nesta task; a cobertura atual foca a função pura conforme o brief TDD. Testes de integração ficam para tasks subsequentes.

---

## Autorrevisão

| Critério | Resultado |
|----------|-----------|
| `"use client"` presente | ✅ |
| `LazyMotion` + `domAnimation` | ✅ |
| `m` (não `motion`) para bundle reduzido | ✅ |
| `useReducedMotion` integrado em `ProfileMotionItem` | ✅ |
| Movimento reduzido sem `y` inicial nem delay | ✅ |
| `viewport` com `once: true, amount: 0.14` | ✅ |
| Sem novas dependências | ✅ |
| Teste não reescrito para passar artificialmente | ✅ |
| Sem alteração de dados, links ou métricas | ✅ |
| Sem commit criado | ✅ |

**Preocupações menores (fora do escopo desta task):**

- `ProfileMotionRoot` e `ProfileMotionItem` ainda não são consumidos pela página — integração prevista na Task 2.
- Testes de renderização com `useReducedMotion` mockado poderiam reforçar confiança, mas o brief limita TDD a `getProfileMotionState`.

---

## Próximo passo sugerido

Task 2: integrar `ProfileMotionRoot` e `ProfileMotionItem` em `professional-profile-page.tsx` e componentes filhos (hero, ações, seções).
