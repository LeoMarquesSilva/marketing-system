---
name: vios-etiqueta-demanda-risco
description: >-
  Inclui ou retira a etiqueta de pasta "Demanda de risco" (id 203) em processos do VIOS
  (bp.vios.com.br) para bater com a coluna Demanda de Risco (SIM/NÃO) da base Rec. Crédito.
  Use quando o trabalho envolver etiqueta demanda de risco, sincronizar etiqueta com
  planilha, adicionar etiquetas em lote, remover etiquetas, processos-adiciona-etiquetas-em-lote,
  Rec. Crédito, a planilha 4. Base Rec Cred ou a "Base Vios ... Demandas de Risco".
---

# VIOS — etiqueta Demanda de risco na pasta

## O que é (e o que não é)

- **É etiqueta da pasta**, campo `Etiquetas de Processos`. Nome exato: `Demanda de risco`. Id VIOS: **`203`**.
- **Não é prazo.** Não cria tarefa `pxe`.
- **Não é** `Alterar Grau de Risco` nem `Alterar Classificação do Risco` (outras ações de lote).
- **Não é** tipo de tarefa `INCLUIR ETIQUETA - DEMANDA DE RISCO` (`processos_etapas_id` 743) nem `PESQUISA DEMANDAS DE RISCO` (746/747). Isso é etapa de tarefa; a etiqueta da pasta é outra coisa.
- Inclusão é **aditiva**: entra `203` e as carteiras (`Carteira GPR` etc.) continuam.

Em 23/08/2026 a etiqueta foi **removida de todas** as pastas Rec. Crédito de propósito. Recoloque **só** nas linhas `Demanda de Risco = Sim`.

## Ciclo atual: sincronizar com uma base nova (desde 28/10/2026)

A base mais recente é `1.2 Base Vios_22.10.2026 - Demandas de Risco.xlsx`, coluna E
`DEMANDA DE RISCO?` (134 SIM e 442 NÃO). Regras do Samuel:

- SIM fica com a etiqueta, inclusive suspenso, incidente e recurso. Vale o que a coluna diz, sem
  filtrar por vínculo ou situação.
- NÃO perde a etiqueta, e **só ela**: as outras etiquetas do processo continuam.
- **Processo fora da planilha não é mexido.** Isso inclui encerrados e cadastrados depois da data
  da base.

Roteiro:

1. Exportar dept. 17 + `pesq[etiquetas][]=203` duas vezes: com o filtro padrão (`filtros_multi`
   vazio) e com `filtros_multi=encerrados`. O filtro padrão **não traz** encerrados, nem processos
   "Ativo" com data de encerramento. Exportar também o dept. 17 inteiro, para saber quais CIs
   existem.
2. Cruzar pelo CI e separar em: incluir (SIM sem etiqueta), retirar (NÃO com etiqueta), já certo e
   fora da planilha. Mostrar as contagens antes de gravar.
3. Aplicar num lote só (veja "Lote sem clicar na lista" em [reference.md](reference.md)). Conferir
   a tabela da tela de lote contra a lista.
4. Conferir com export novo: nenhum NÃO com a etiqueta, todos os SIM com ela, e as outras
   etiquetas iguais às de antes.

Registro do ciclo de 28/10: `ORQESTRAI/vios-demanda-risco-recred/registro.md`. Os 63 SIM que
faltavam foram incluídos. Nenhum NÃO tinha a etiqueta, então não houve retirada.

## Fonte da verdade (ciclo de 23/08/2026)

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

- Ciclo de 23/08: só pasta `Ativo`; arquivado, ex-cliente e `Não` ficavam de fora. No ciclo de 28/10 vale a coluna da base nova (veja "Ciclo atual").
- **Não** usar `Relatório = Amostragem para ação em lote`. A amostragem ignora o checkbox e aplica a **todos** os processos da pesquisa (aviso amarelo na lista).
- **Não** marcar `Processos selecionados + vinculados de primeiro nível` — senão a etiqueta vaza para incidente/recurso que não está no Excel.
- Antes de Gravar, bater CI da tabela com a planilha. Se a lista veio maior que o grupo `Sim`, voltar sem gravar.
- Idempotência: adicionar de novo em pasta que já tem 203 não deve duplicar o rótulo; ainda assim filtre `etiquetas=203` e pule quem já está ok.
- Linhas vermelhas na tela de lote = processo apagado — o VIOS ignora.

## Conferência

Pesquisa: dept. 17 + `pesq[etiquetas][]=203` + Ativos / Não migrados.

| Esperado | Valor |
|---|---|
| Total Rec. Crédito com a etiqueta | **65** em 23/08; **135** não encerrados em 28/10 (134 SIM menos o 25466, que foi encerrado, mais 61177 e 61260, fora da base) |
| Por grupo | conferir a tabela em [reference.md](reference.md) |

Abrir 2–3 pastas e ver a etiqueta `Demanda de risco` junto da carteira.

## O que NÃO fazer

- Recolocar em todo o Rec. Crédito / grupo inteiro.
- Usar amostragem neste lote.
- Cascatear para vinculados.
- Confundir com grau/classificação de risco ou com agendar a tarefa 743.
- Gravar sem conferir a tabela **Processos Selecionados**.
