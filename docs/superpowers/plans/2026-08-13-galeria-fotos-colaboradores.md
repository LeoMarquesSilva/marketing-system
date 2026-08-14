# Galeria de fotos corporativas — Implementation Plan

> Executado em sessão única após aprovação do desenho. Sem commits (não pedidos).

**Goal:** MTK sobe várias fotos por colaborador; o colaborador escolhe os usos em Minhas fotos; Oficial atualiza avatar e NFC.

**Architecture:** Tabelas `collaborator_photos`, `photo_usage_types`, `collaborator_photo_usages` no ORQESTRAI. APIs em `/api/collaborator-photos`. UI em `/minhas-fotos` e galeria em `/fotos-colaboradores`.

**Tech Stack:** Next.js, Supabase (MCP user-ORQESTRAI), Vitest.

## Global Constraints

- Upload só pelo MTK, pessoa a pessoa
- `/minhas-fotos` sempre liberada para autenticado
- Oficial é sistema; Posts, Site/materiais, Eventos são editáveis
- Mesma foto em vários usos; um uso = uma foto
- Sem Google Drive, sem LinkedIn, sem upload do colaborador
