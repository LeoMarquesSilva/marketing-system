# Referência — CSV VIOS para revisão

Validado 24/08/2026 (sessão Samuel, `bp.vios.com.br`).

## Cookie e download

Cookie de sessão: **`Proc`**. Exportar via CDP `Network.getCookies` em `https://bp.vios.com.br`.

```text
https://bp.vios.com.br/download.php?file=report/<nome>.csv
```

Exemplo real de processos (Trabalhista + Ativos + csv + 9999999):

```text
./download.php?file=report/processos-w00.csv
```

~3,2 MB, 2626 pastas + cabeçalho. `curl` com `Cookie: Proc=...` e `Referer` da lista devolve `Content-Type: text/csv`.

O HTML do Pesquisar também cita o mesmo path em JS (`var link = "./download.php?file=report/processos-w00.csv"`).

Arquivos antigos de tarefas no Downloads do macOS seguem `lista-de-tarefas-*.csv` (export UI). O `download.php` pode usar outro nome em `report/`.

## Encoding

- Charset: latin-1 / iso-8859-1 (não UTF-8)
- Separador: `;`
- CI: `="41835"` — strip `="` e `"`

## Processos — colunas úteis

`Vínculo`; `CI`; `Área`; `Situação do Processo`; `Etiquetas`; `Advogado responsável`; `Aux.`; `Grupo Cliente`; `Cliente`

`Aux.` vem abreviado (`VLS`, `LZJ`, `PKSP`, `FVA`, `LLM`, `CA`, `RRVDC`, `MBA`).

Mapa conhecido:

| Sigla | Nome |
|---|---|
| VLS | Vanessa Lanza Sellani |
| LZJ | Letícia Zamarion Julio |
| PKSP | Pamela Klava Senna Patricio |
| FVA | Fernanda Voltarelli Arnoni |
| LLM | Lorena Lourenço Miranda |
| CA / CSA | Caroline Simel Abdalla |
| RRVDC | Renato Rossetti Vallim de Castro |
| MBA | Manoela Brisighello Angotti |

## Tarefas — colunas úteis (export `lista-de-tarefas`)

`CI` (tarefa); `CI do Processo`; `Responsáveis`; `Responsável pelo processo`; `Auxiliares`; `Status`; `Grupo Cliente`; `Tarefa`; `É REVISAR` (quando o controle tiver)

## IDs frequentes

| Pessoa | `usuarios_id` |
|---|---|
| Caroline Simel Abdalla | 6 |
| Fernanda Voltarelli Arnoni | 12 |
| Lorena Lourenço Miranda | 27 |
| Pamela Klava Senna Patricio | 40 |
| Renato Rossetti Vallim de Castro | 42 |
| Samuel Willian Silva | 43 |
| Manoela Brisighello Angotti | 266 |
| Letícia Zamarion Julio | 271 |
| Vanessa Lanza Sellani | 303 |

Departamento Trabalhista = `4`. Relatório de tela: nunca `amostragem`.

## Armadilhas

- `pesq[advogado_principal]` na lista de processos **não** é o id do advogado: hidden `0` + checkbox `1`. Filtro de pessoa = `pesq[advogados_id][]`.
- GET em `tprel=csv` sem passar pelo `#Pesq` devolve só o HTML do filtro, **sem** o botão `download.php`.
- Dois submits no form de processos (`Pesq=Pesquisar` e às vezes `faturamento_estimado=Pesquisar`) — o que importa é o clique em `#Pesq` com `tprel=csv` e `limit=9999999`.
