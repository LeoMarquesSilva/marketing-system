# Relatório — movimento progressivo pós-hidratação

Data: 2026-07-29

## Status

Movimento progressivo restaurado para o perfil público NFC sem reintroduzir
conteúdo invisível no SSR, mismatch de hidratação, movimento reduzido,
wrappers focáveis ou regressões nas correções anteriores. Não houve commit,
instalação de dependências nem nova instância do servidor.

## Decisão técnica confirmada no Framer Motion instalado

A versão instalada é `framer-motion@12.40.0`.

A inspeção do código distribuído confirmou dois comportamentos relevantes:

- `initial={false}` inicializa os valores visuais com o último keyframe de
  `animate`, evitando que o servidor serialize o início oculto/deslocado;
- nessa versão, `initial={false}` também bloqueia a animação inicial normal no
  primeiro `animateChanges()`. Portanto, apenas trocar o target por arrays de
  keyframes não produziria movimento real no mount.

Para compatibilizar SSR visível e movimento real, foi adicionado um gate de
hidratação com `useSyncExternalStore`:

1. servidor e primeiro render cliente recebem snapshot `false` e target
   estático `{ opacity: 1, y: 0 }`, duração zero;
2. depois da hidratação, o snapshot cliente passa a `true`;
3. em movimento normal, essa mudança de prop dispara os keyframes
   `opacity: [1, 0.96, 1]` e `y: [0, 8, 0]`;
4. em movimento reduzido, o target permanece estático, sem translação e com
   duração zero.

O primeiro keyframe é idêntico ao estado SSR. Assim, o conteúdo não aparece,
some e reaparece: ele parte visível, faz um settle sutil e termina visível.

## Sequência e viewport

- Os delays existentes foram preservados:
  - chrome: `0.04`;
  - hero: `0.10`;
  - ações: `0.18`.
- Seções e conteúdo recente continuam usando `whileInView`.
- A configuração permanece `once: true` e `amount: 0.14`.
- O mesmo target progressivo é usado quando a seção entra na viewport.

## TDD — RED

Comando:

`npx vitest run src/components/profiles/profile-motion.test.tsx`

Resultado esperado: exit 1, 2 falhas e 2 testes passando.

Falhas reproduzidas:

- modo normal hidratado ainda retornava valores estáticos em vez de keyframes;
- estado pré-hidratação ainda carregava transição com duração e atraso, em vez
  do contrato estático determinístico.

O teste SSR já permanecia verde durante o RED, comprovando que a correção
anterior de visibilidade não foi perdida antes da implementação.

## TDD — GREEN

- Teste direcionado de motion: exit 0, 4/4 testes.
- Suíte obrigatória:

  `npx vitest run src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx src/components/auth/auth-guard.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts`

  Resultado: exit 0, 5 arquivos e 47/47 testes.

Cobertura mantida:

- keyframes reais e delay em movimento normal;
- primeiro render estático;
- movimento reduzido com duração zero;
- SSR sem `opacity:0` e sem `translateY`;
- página completa SSR visível;
- wrappers de ação sem `tabindex="0"`;
- `AuthGuard` servindo perfil público no SSR e ocultando rota protegida;
- links, privacidade, conteúdo e utilitários públicos.

## SSR e hidratação

Na rota ativa
`http://localhost:3000/perfil/felipe-soares-de-camargo?source=nfc`:

- HTTP 200;
- `pp-profile-card` e `pp-chrome` presentes como markup literal;
- nenhum `opacity:0`;
- nenhum `translateY`;
- nenhum fallback “Carregando...”;
- zero erros de hidratação ou “server rendered HTML did not match” no Edge.

## Validação Edge headless

Microsoft Edge instalado foi executado via CDP em 390×844, sem instalar
bibliotecas.

### Movimento normal

- 666 amostras de chrome/hero/ações;
- 103 amostras com transformação real;
- movimento observado nos três elementos: `chrome`, `hero` e `actions`;
- opacidade mínima observada: `0.960288`;
- transforms reais incluíram matrizes com deslocamentos de aproximadamente
  `2.42 px`, `3.40 px`, `4.96 px` e `5.91 px`;
- após scroll, a seção gerou 34 amostras transformadas;
- nenhum wrapper focável e nenhum wrapper essencial com opacidade zero ao fim.

### Movimento reduzido

- media query `prefers-reduced-motion: reduce` confirmada;
- zero amostras transformadas em entrada;
- zero amostras transformadas após scroll para seções;
- opacidade mínima `1`;
- zero erros de hidratação;
- nenhum wrapper focável ou com opacidade zero.

## Lint e build

- ESLint obrigatório: exit 0, sem erros.
- Diagnósticos do editor nos arquivos alterados: nenhum erro.
- `npm run build`: exit 0.
- Next.js compilou com sucesso, TypeScript passou, coleta de dados concluiu e
  11/11 páginas estáticas foram geradas.

## Correções anteriores preservadas

- wrappers de ações continuam sendo `div` não focáveis;
- interações táteis continuam no próprio elemento e respeitam reduced motion;
- `AuthGuard` continua entregando o perfil público no SSR;
- campanha estática continua sem `role="status"`;
- “Compartilhar” continua sem overflow em 320 px;
- links, métricas, dados públicos e privacidade não foram alterados.

## Arquivos desta rodada

- `src/components/profiles/profile-motion.tsx`
- `src/components/profiles/profile-motion.test.tsx`
- `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/progressive-motion-report.md`

## Preocupação residual

O npm continua emitindo `Unknown env config "devdir"`. O aviso não afetou
testes, lint, build ou validação headless, mas deve ser removido antes de uma
futura versão major do npm.
