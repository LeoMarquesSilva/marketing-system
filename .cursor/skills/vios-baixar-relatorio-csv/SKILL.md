---
name: vios-baixar-relatorio-csv
description: >-
  Baixa relatórios completos do VIOS (bp.vios.com.br) em CSV para revisão:
  processos (processos-lista) e prazos/tarefas (pxe-lista). Use quando o
  trabalho envolver revisar redistribuição, cruzar pastas/prazos com Excel de
  controle, exportar lista do VIOS, tprel=csv, download.php, limite 9999999,
  ou quando Completo/DataTables cortar em 500 linhas.
---

# VIOS — baixar relatório CSV para revisão

Forma correta de tirar o dump **completo** (processos ou prazos) sem cap de 500 e sem travar a aba.

## Quando usar

- Revisão pós-redistribuição (pastas + prazos)
- Check pós-agendamento (lote SPM / publi): cruzar planilha × dump amplo **sem recorte de data**
- Qualquer conferência que precise da lista **inteira** do filtro (não amostragem)
- Quando `tprel=A` (Completo) ou Excel do DataTables falhar / cortar em ~500

## Fluxo (obrigatório)

1. Abrir a lista no Chrome com a sessão logada (`Samuel Willian Silva`).
2. Aplicar os filtros de negócio (dept, ativos/pendentes, grupo, etc.).
3. No formulário, mudar:
   - **Relatório** → **CSV** (`pesq[tprel]=csv`)
   - **Limite** → **9999999** (opção nativa do select; equivalente ao “999999 / tudo”)
4. Clicar o botão visível **`#Pesq`** (`button[type=submit][name=Pesq]`).
   - Existe um `input[name=Pesq]` **hidden** — `querySelector('[name=Pesq]').click()` **não pesquisa**.
5. A resposta do Pesquisar é **HTML do filtro** (`Content-Type: text/html`). Isso é esperado. O arquivo **não** vem no body.
6. Na mesma HTML, achar o link:
   - `a[href*="download.php"]` — ex.: `./download.php?file=report/processos-w00.csv`
   - Título típico: `Baixar arquivo no formato p/ Excel (X MB)`
7. Baixar essa URL com o cookie de sessão **`Proc`** (não é `PHPSESSID`):
   - `https://bp.vios.com.br/download.php?file=report/<arquivo>.csv`
8. Validar: primeiro bytes = cabeçalho CSV (`"CI"` / `"Vínculo"` / `"CI do Processo"`), **não** `<!DOCTYPE html>`. Encoding **latin-1** (iso-8859-1), separador **`;`**. CIs vêm como `="41835"`.

Selects são bootstrap-select: setar `.value`, `jQuery(el).val(...).trigger('change')` e `selectpicker('refresh')` antes do clique.

## Proibido

- **`goto_url` / navegação** com `tprel=csv` + limite alto — o Chrome tenta renderizar o job e a aba trava (tarefas ~14 MB).
- Tratar o HTML do Pesquisar como “CSV falhou” e desistir. O arquivo está em `download.php`.
- `tprel=amostragem` — não é dump; serve só para ação em lote e pega a pesquisa inteira.
- Excel/PDF do DataTables em lista ≥500 — estoura/timeout.
- Confiar em Completo (`tprel=A` / `tabela`): DataTables entrega no máximo ~500 linhas (`recordsTotal: 500`, 1 página).

## Telas

| Lista | Página | Relatório seguro p/ tela | CSV |
|---|---|---|---|
| Processos | `sys/processos/processos-lista.php` | `tprel=A` (Completo) | `tprel=csv` |
| Tarefas / prazos | `sys/processos/pxe-lista.php` | `tprel=tabela` | `tprel=csv` |

Filtros típicos de revisão trabalhista: `pesq[departamentos_id][]=4`. Processos: `pesq[filtros_multi][]=ativos`. Tarefas: `pesq[filtros]=pendentes` e `pesq[flag_conclusao]=0`.

Geração de tarefas pode levar dezenas de segundos; `page_info()` / `js()` estouram timeout enquanto o job roda. Esperar e procurar o `download.php` — não reenviar o Pesquisar.

## Depois do arquivo

Cruzar com o Excel de controle (pastas: `NOVO RESPONSÁVEL` / `NOVO REVISOR`; prazos: destino presente, antigo ausente salvo se for destino ou `Manter`, Ops intacto). Colunas e cookies: [reference.md](reference.md).
