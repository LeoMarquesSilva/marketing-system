# Task 1 — Relatório: domínio e testes do tour de Minhas fotos

## Status

**DONE**

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/lib/minhas-fotos-tour.test.ts` | Criado |
| `src/lib/minhas-fotos-tour.ts` | Criado |

Nenhum outro arquivo foi modificado. Plano, UI, persistência e migration não foram tocados.

## Implementação

### Elegibilidade (`shouldShowMinhasFotosTutorial`)

- Exige perfil autenticado com acesso a `/minhas-fotos` via `canAccessPath`.
- Bloqueia automaticamente quando `must_change_password` (inclusive reabertura forçada), alinhado a `meus-clientes-tour`.
- Abre automaticamente somente se `photoCount > 0` e `minhas_fotos_tutorial_completed_at` é nulo.
- Com galeria vazia, não abre automaticamente, mas continua elegível quando fotos aparecerem (mesmo perfil sem conclusão + `photoCount: 1` → `true`).
- Reabertura forçada (`forced: true`) ignora conclusão e ausência de fotos.

### Configuração dos 7 passos (`MINHAS_FOTOS_TOUR_STEPS`)

| # | id | target | title |
|---|-----|--------|-------|
| 1 | `welcome` | `null` | Bem-vindo às Minhas fotos |
| 2 | `header` | `mf-header` | Sua galeria |
| 3 | `gallery` | `mf-gallery` | Grade de fotos |
| 4 | `session` | `mf-session` | Sessão da foto |
| 5 | `usage-options` | `mf-usage-options` | Opções de uso |
| 6 | `official-usage` | `mf-official-usage` | Foto dos sistemas do escritório |
| 7 | `finish` | `mf-actions` | Baixar e concluir |

Também exportados: `MinhasFotosTourProfile`, `MinhasFotosTourStep`, `canAccessMinhasFotosTour`, `MINHAS_FOTOS_TUTORIAL_SESSION_KEY`, `filterMinhasFotosTourSteps`.

### Filtro de passos condicionais

`filterMinhasFotosTourSteps(steps, availableTargets)` remove passos cujo seletor `data-tour="..."` não está na lista de alvos disponíveis, mantendo passos centrais (`target: null`) e a ordem relativa dos demais.

## Ciclo TDD

### RED

**Comando:**

```bash
npm test -- src/lib/minhas-fotos-tour.test.ts
```

**Saída:**

```
 FAIL  src/lib/minhas-fotos-tour.test.ts
Error: Cannot find module '@/lib/minhas-fotos-tour' imported from '.../minhas-fotos-tour.test.ts'.

 Test Files  1 failed (1)
      Tests  no tests
   Duration  543ms
```

Motivo: módulo de implementação ainda inexistente.

### GREEN

**Comando:**

```bash
npm test -- src/lib/minhas-fotos-tour.test.ts
```

**Saída:**

```
 ✓ src/lib/minhas-fotos-tour.test.ts (9 tests) 4ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  730ms
```

## Cobertura de requisitos do brief

| Requisito | Coberto |
|-----------|---------|
| Primeiro acesso com fotos abre automaticamente | Sim |
| Tutorial concluído não abre automaticamente | Sim |
| Reabertura forçada abre mesmo concluído | Sim |
| Troca de senha obrigatória bloqueia | Sim |
| Galeria vazia não abre e permanece elegível | Sim |
| 7 passos aprovados | Sim |
| Filtro de targets condicionais | Sim |
| Sem UI/persistência/migration | Sim |

## Auto-revisão

**Pontos fortes**

- Padrão consistente com `newsletter-tour.ts` e `meus-clientes-tour.ts`.
- Testes cobrem todos os cenários de elegibilidade pedidos no brief.
- Filtro de passos é função pura, pronta para uso na UI (Task 2).

**Ressalvas**

- Textos dos passos e seletores `data-tour="mf-*"` foram definidos no domínio com base no plano aprovado; os atributos HTML serão adicionados na Task 2 (UI).
- O brief cita “valores exatos”, mas não traz títulos/corpos literais — a configuração segue os 7 rótulos aprovados no plano e a nomenclatura “Foto dos sistemas do escritório” para o passo `official-usage`, preservando slug `oficial` / `is_official` apenas na semântica interna (fora desta task).

**Próximo passo sugerido (fora do escopo desta task)**

- Task 2: componente `minhas-fotos-tour.tsx`, `data-tour` nos componentes e botão “Ver guia”.
