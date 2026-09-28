# Task 1: Primitivos de movimento acessíveis

## Contexto

Criar a camada cliente isolada que concentrará o Framer Motion da página
pública de perfil NFC.

## Arquivos

- Criar `src/components/profiles/profile-motion.tsx`.
- Criar `src/components/profiles/profile-motion.test.tsx`.

## Interfaces obrigatórias

- `ProfileMotionRoot({ children }: { children: ReactNode })`.
- `ProfileMotionItem({ children, className?, delay?, viewport? })`.
- `getProfileMotionState(reduced: boolean, delay?: number)`.

## TDD obrigatório

Primeiro, criar testes que comprovem:

```tsx
expect(getProfileMotionState(false, 0.12)).toMatchObject({
  initial: { opacity: 0, y: 18 },
  transition: { delay: 0.12 },
});

expect(getProfileMotionState(true, 0.12)).toEqual({
  initial: false,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0 },
});
```

Executar o teste e registrar a falha esperada antes da implementação.

## Implementação

Usar `"use client"`, `LazyMotion`, `domAnimation`, `m` e `useReducedMotion` de
`framer-motion`.

No movimento normal:

```tsx
{
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.58,
    delay,
    ease: [0.22, 1, 0.36, 1],
  },
}
```

No movimento reduzido:

```tsx
{
  initial: false,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0 },
}
```

`ProfileMotionRoot` deve fornecer `LazyMotion features={domAnimation}`.
`ProfileMotionItem` deve animar na montagem ou, quando `viewport=true`, usar
`whileInView` com `{ once: true, amount: 0.14 }`.

## Validação

Executar:

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx
```

Resultado esperado: todos os testes passando, sem warnings.

## Restrições globais

- Não adicionar dependências.
- Respeitar movimento reduzido sem deslocamento.
- Não alterar dados, links ou métricas.
- Não criar commit; o usuário aprovou trabalhar na branch atual sem commits.
- Escrever relatório completo em
  `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/task-1-report.md`.

