# Task 4 — Nomenclatura “Foto dos sistemas do escritório”

## Objetivo
Substituir a nomenclatura visível “Oficial” por uma descrição clara do uso da foto, preservando integralmente a semântica interna.

## Regras de copy
- Label completo e central no banco: `Foto dos sistemas do escritório`.
- Badge compacto sobre a imagem e resumos compactos: `Sistemas do escritório`.
- Textos explicativos, títulos, painel administrativo e mensagens devem usar `Foto dos sistemas do escritório` ou flexão natural equivalente, nunca apresentar “Oficial” como nome desse tipo de uso.

## Escopo
- Atualizar textos visíveis hardcoded no módulo `Minhas fotos`, grade, painel administrativo, página de gestão, diálogos e mensagens/erros relacionados aos usos de fotos.
- Atualizar testes/fixtures que tratem o label visível.
- Preservar descrições internas, nomes de funções e testes técnicos quando “oficial” não for texto de UI.
- Não alterar:
  - slug `oficial`;
  - propriedades/colunas `is_official` / `isOfficial`;
  - regras de seleção única;
  - projeções de avatar, perfil público e NFC;
  - IDs, nomes internos de funções ou contratos de API.
- Preservar e executar os testes existentes de seleção única/projeção.

## Migration local
- Criar `supabase/migrations/20260814170500_rename_official_photo_usage_copy.sql`.
- Atualizar idempotentemente `public.photo_usage_types.label` para `Foto dos sistemas do escritório` onde `slug = 'oficial'`.
- Atualizar comentários e mensagens da função/trigger de proteção para a nova nomenclatura, sem mudar a regra protegida.
- A aplicação remota será feita exclusivamente pelo controlador via MCP `user-ORQESTRAI`.

## Restrições globais
- Não editar migrations históricas.
- Não editar o arquivo do plano.
- Não criar commit.
- Não aplicar SQL por CLI nem usar outro projeto Supabase.

## Verificação
- Executar testes de `usage-types`, `usages`, rotas/serviços de galeria e testes do tour afetados.
- Executar TypeScript e lint dos arquivos alterados.
- Fazer busca final para classificar ocorrências restantes de “Oficial/oficial” como internas ou fora do domínio de fotos.
- Registrar arquivos, comandos, resultados e auto-revisão em `task-4-report.md`.
