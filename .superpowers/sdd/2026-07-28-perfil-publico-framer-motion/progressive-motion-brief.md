# Human-approved resolution — progressive motion

O usuário escolheu restaurar movimento progressivo pós-hidratação mantendo o
SSR visível.

## Requisitos

- O HTML SSR nunca pode conter `opacity: 0`.
- Sem JavaScript, todo conteúdo essencial permanece visível e legível.
- Servidor e primeiro render cliente devem ser determinísticos.
- Com movimento reduzido, não pode haver translação nem animação.
- Com movimento normal, deve existir movimento real e sutil:
  - entrada/settle em sequência para chrome, hero e ações;
  - revelação/settle uma vez na viewport para seções;
  - manter atrasos configurados na página.
- Evitar flash visível de conteúdo que aparece, some e reaparece.
- Preferir animação de keyframes a partir de estado SSR visível, por exemplo
  `opacity: [1, 0.96, 1]` e `y: [0, 8, 0]`, usando `initial={false}`. Confirmar
  o comportamento real da versão instalada do Framer Motion antes de fechar.
- Manter todas as correções anteriores de foco, AuthGuard, overflow e campanha.

## TDD

Adicionar/ajustar testes que provem:

- estado normal contém keyframes reais e atraso;
- estado reduzido continua estático, duração zero;
- SSR do wrapper não contém `opacity:0` nem `translateY`;
- nenhum wrapper de ação volta a ser focável.

## Verificação

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx src/components/auth/auth-guard.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts
npx eslint src/components/profiles/profile-motion.tsx src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.tsx src/components/profiles/profile-contact-actions.tsx
npm run build
```

Se Edge headless estiver disponível, confirmar que:

- SSR permanece visível;
- em movimento normal ocorre ao menos uma transformação real;
- em movimento reduzido não há transformação animada.

Não criar commit. Acrescentar relatório em
`.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/progressive-motion-report.md`.

