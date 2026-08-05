# Sync VIOS → Férias (hr_employees)

## Objetivo

Receber o export de colaboradores do VIOS (Playwright → Supabase), sincronizar `is_active` pela coluna Situação e alertar na UI quem precisa de cadastro manual.

## Regras

- Match por e-mail normalizado (`bpplaw.com.br` ≡ `bismarchipires.com.br`).
- Casa com `hr_employees` e com `users`.
- Se existir em `users` e ainda não em `hr_employees`, cria o colaborador de férias (admissão provisória = `users.created_at`).
- Em match: atualiza `hr_employees` e `users` (`is_active`, nome, departamento; em RH também cargo/`vios_ci`).
- Sem match em nenhum dos dois: fica na staging para banner “cadastre manualmente”.
- Cadastrado ativo ausente do export: só aviso na UI (não desativa).

## Banco

- `hr_employees.vios_ci` (unique nullable)
- `hr_vios_employees` — espelho do último export
- RPC `import_hr_vios_employees(p_rows jsonb)` — substitui staging + rematch (service_role)
- RPC `sync_hr_employees_from_vios()` — só rematch (service_role)

## Contrato do node

```js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// rows: array parseado do Excel/CSV
const { data, error } = await supabase.rpc('import_hr_vios_employees', {
  p_rows: rows,
});
```

Cada item aceita chaves em português ou inglês:

| Campo | Chaves aceitas |
|-------|----------------|
| CI | `ci`, `CI` |
| Empresa | `company`, `Empresa` |
| Departamento | `department`, `Departamento` |
| Rateio | `cost_center`, `Rateio` |
| Nome | `full_name`, `Nome` |
| Função | `position`, `Função`, `Funcao` |
| Perfil | `profile`, `Perfil` |
| E-mail | `email`, `E-mail`, `Email` |
| Telefone | `phone`, `Telefone` |
| Celular | `mobile`, `Celular` |
| Situação | `situation`, `Situação`, `Situacao` |

Situação `Ativo`/`Ativa`/`Active` → `is_active = true`; demais → `false`.
