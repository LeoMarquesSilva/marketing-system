---
name: ops-legais-orquestrai
description: >-
  Módulo Operações Legais no ORQESTRAI (/operacoes-legais): vistagem,
  fechamento de hours, CSV VIOS e etiqueta demanda de risco. Use when the
  work involves Operações Legais no Orquestra, juntar vistagem-bp, skills
  vios-*, módulo exclusivo da área Ops, ou funções de controladoria jurídica
  no ORQESTRAI.
---

# Operações Legais no ORQESTRAI

Módulo em `/operacoes-legais`. **Só quem tem `users.department = Operações Legais`** (ou admin, ou permissão explícita `/operacoes-legais`). Marketing / Facilities / RH **não** entram.

Código: `src/lib/operacoes-legais/`, `src/app/operacoes-legais/`, `src/components/operacoes-legais/`.

O app `vistagem-bp` (Next + Supabase de captura/matching) entra neste módulo — não duplicar regra de negócio fora das skills.

## Skills deste módulo

| Função na UI | Skill |
|---|---|
| Vistagem e agendamento | [vios-vistagem-agendamento](../vios-vistagem-agendamento/SKILL.md) |
| Fechamento Legal Ops | [vios-fechamento-legal-ops](../vios-fechamento-legal-ops/SKILL.md) |
| Relatórios CSV VIOS | [vios-baixar-relatorio-csv](../vios-baixar-relatorio-csv/SKILL.md) |
| Etiqueta demanda de risco | [vios-etiqueta-demanda-risco](../vios-etiqueta-demanda-risco/SKILL.md) |

Áreas jurídicas: de-para em `src/lib/legal-areas.ts` + skill de fechamento (Insolvência / Cível | Insolvência → Reestruturação). Tipo ou área que não der para interpretar → perguntar.

## Acesso

- Client: sidebar só se `hasOperacoesLegaisAccess`.
- Rotas: `canAccessPath` + `requireOperacoesLegaisAccess` no servidor.
- Preset "Marketing completo" **não** inclui este módulo (`manualOnly`).
