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

Módulo em `/operacoes-legais`. **Por agora só admin** (`hasOperacoesLegaisAccess` = `role === admin`). Depois libera para `users.department = Operações Legais`. Marketing / Facilities / RH **não** entram.

Código (repo `ORQESTRAI/marketing-system`): `src/lib/operacoes-legais/`, `src/app/operacoes-legais/`, `src/components/operacoes-legais/`.

## Vistagem (já no módulo)

Telas em `/operacoes-legais/vistagem`. Dados via service role depois do gate de Ops. Schema `20260902180000_vistagem.sql` — **não aplicar no remoto sem confirmação.** `VIOS_DRY_RUN` default true.

Não duplicar regra de negócio fora das skills `vios-*`.

## Skills deste módulo

| Função na UI | Skill |
|---|---|
| Vistagem e agendamento | vios-vistagem-agendamento |
| Fechamento Legal Ops | vios-fechamento-legal-ops |
| Relatórios CSV VIOS | vios-baixar-relatorio-csv |
| Etiqueta demanda de risco | vios-etiqueta-demanda-risco |
| Abertura de pastas (novas demandas) | vios-novas-demandas |
| Transferir pastas e prazos de área | vios-transferir-pastas |
| Fluxos, prazos e lotes de tarefas | vios-cadastro-fluxos |

Áreas jurídicas: de-para em `src/lib/legal-areas.ts` + skill de fechamento. Tipo ou área que não der para interpretar → perguntar.

## Acesso

- Client: sidebar só se `hasOperacoesLegaisAccess` (hoje: só admin).
- Rotas: `canAccessPath` + AuthGuard; checkbox em Usuários **não** libera.
- Preset "Marketing completo" **não** inclui este módulo (`admin` + `manualOnly`).
