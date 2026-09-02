---
name: vios-etiqueta-demanda-risco
description: >-
  Inclui a etiqueta de pasta "Demanda de risco" (id 203) em processos do VIOS
  (bp.vios.com.br) a partir da coluna Demanda de Risco=Sim da base Rec. Crédito.
  Use quando o trabalho envolver etiqueta demanda de risco, adicionar etiquetas
  em lote, remover etiquetas, processos-adiciona-etiquetas-em-lote, Rec. Crédito
  ou a planilha 4. Base Rec Cred.
---

# VIOS — etiqueta Demanda de risco na pasta

## O que é (e o que não é)

- **É etiqueta da pasta**, campo `Etiquetas de Processos`. Nome exato: `Demanda de risco`. Id VIOS: **`203`**.
- **Não é prazo.** Não cria tarefa `pxe`.
- **Não é** `Alterar Grau de Risco` nem `Alterar Classificação do Risco` (outras ações de lote).
- **Não é** tipo de tarefa `INCLUIR ETIQUETA - DEMANDA DE RISCO` (`processos_etapas_id` 743) nem `PESQUISA DEMANDAS DE RISCO` (746/747). Isso é etapa de tarefa; a etiqueta da pasta é outra coisa.
- Inclusão é **aditiva**: entra `203` e as carteiras (`Carteira GPR` etc.) continuam.

Em 23/08/2026 a etiqueta foi **removida de todas** as pastas Rec. Crédito de propósito. Recoloque **só** nas linhas `Demanda de Risco = Sim`.

## Fonte da verdade

Arquivo no repo: `4. Base Rec Cred - STATUS VIOS.xlsx`  
(origem operacional: `4. Base Rec Cred - 19.08.2026.xlsx`)

| Aba | Uso |
|---|---|
| `ALTERAR NO VIOS` | Lote vigente: **550** ativos. Coluna `Demanda de Risco` = `Sim` / `Não` |
| `Worksheet` | Base completa (inclui arquivado/ex-cliente). Os `Sim` ativos são os **mesmos 65** |

Escopo deste lote: **65 CIs** ativos + `Sim`. Lista por grupo em [reference.md](reference.md).

A coluna `Etiquetas` do Excel é **snapshot antigo** — não use para decidir. Depois da remoção em massa, o VIOS começa do zero.

## Onde no VIOS

1. Home → **Processos** → `processos-lista.php`
2. Filtrar **Departamento = Recuperação de Crédito** (`pesq[departamentos_id][]=17`) **e** **Grupo Cliente** do lote
3. `Filtros` = `Ativos` + `Não migrados`; `Relatório` = **Completo** (`tprel=A`); limit 100 ou 500
4. Marcar **só** as CIs `Sim` daquele grupo
5. Rodapé **Ação** → `Adicionar Etiquetas` (`acao=adicionar_etiquetas`) → **Processar**
6. Tela `processos-adiciona-etiquetas-em-lote.php`:
   - `form[etiquetas_id]` = **Demanda de risco** (`203`)
   - `considerar_processos_vinculados` = **`0`** — *Apenas processos selecionados*
   - Conferir a tabela **Processos Selecionados** (contagem = CIs do grupo)
   - **Gravar**

Remoção (já feita neste ciclo): Ação `Remover Etiquetas` (`remover_etiquetas`). Mesma tela de lote, outra ação.

## Sequência por grupo

Não jogar os 65 de uma vez. Um grupo por vez, iguais à troca de resp./aux.:

1. Pesquisar grupo + dept. 17
2. Marcar só as CIs `Sim` (ver [reference.md](reference.md))
3. Adicionar etiqueta 203 → Gravar
4. Conferir: filtrar `pesq[etiquetas][]=203` no mesmo grupo — deve listar exatamente essas CIs
5. Próximo grupo

Maior primeiro: GPR 15 → Decorwatts 10 → PST 10 → Bismarchi Pires 9 → Bilateral 4 → Federal Invest 3 → Covolan 2 → Inovageo 2 → 10 grupos com 1 CI.

## Regras

- Só pasta `Ativo`. Arquivado / ex-cliente / `Não` ficam de fora.
- **Não** usar `Relatório = Amostragem para ação em lote`. A amostragem ignora o checkbox e aplica a **todos** os processos da pesquisa (aviso amarelo na lista).
- **Não** marcar `Processos selecionados + vinculados de primeiro nível` — senão a etiqueta vaza para incidente/recurso que não está no Excel.
- Antes de Gravar, bater CI da tabela com a planilha. Se a lista veio maior que o grupo `Sim`, voltar sem gravar.
- Idempotência: adicionar de novo em pasta que já tem 203 não deve duplicar o rótulo; ainda assim filtre `etiquetas=203` e pule quem já está ok.
- Linhas vermelhas na tela de lote = processo apagado — o VIOS ignora.

## Conferência

Pesquisa: dept. 17 + `pesq[etiquetas][]=203` + Ativos / Não migrados.

| Esperado | Valor |
|---|---|
| Total Rec. Crédito com a etiqueta | **65** |
| Por grupo | conferir a tabela em [reference.md](reference.md) |

Abrir 2–3 pastas e ver a etiqueta `Demanda de risco` junto da carteira.

## O que NÃO fazer

- Recolocar em todo o Rec. Crédito / grupo inteiro.
- Usar amostragem neste lote.
- Cascatear para vinculados.
- Confundir com grau/classificação de risco ou com agendar a tarefa 743.
- Gravar sem conferir a tabela **Processos Selecionados**.
