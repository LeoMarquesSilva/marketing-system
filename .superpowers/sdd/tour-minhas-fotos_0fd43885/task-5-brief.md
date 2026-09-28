# Task 5 — Verificação final do tour de Minhas fotos

## Objetivo
Validar testes, tipos, lints, banco e comportamento real no navegador antes de concluir o plano.

## Checklist
- Executar a suíte Vitest completa.
- Executar TypeScript com `tsc --noEmit`.
- Executar lint do projeto e distinguir falhas preexistentes de problemas introduzidos.
- Executar lint direcionado em todos os arquivos alterados.
- Verificar whitespace do diff.
- Validar no navegador:
  - galeria vazia não abre o tour automaticamente;
  - primeiro acesso com fotos abre automaticamente;
  - os 7 passos e todos os targets aparecem;
  - Concluir fecha e persiste;
  - recarregar não reabre automaticamente;
  - “Ver guia” reabre;
  - Escape fecha/pula;
  - nova nomenclatura aparece na UI e na API, sem label legado visível.
- Confirmar no ORQESTRAI coluna, label e flags preservadas.
- Não criar commit nem editar o plano.
