# Referência — etiqueta Demanda de risco (lote Rec. Crédito)

Walkthrough UI 23/08/2026 (Samuel). Etiqueta removida em massa no mesmo dia; recolocação só nos `Sim`.

**Lote aplicado 23/08/2026:** 65/65 CIs `Sim` com filtro Departamento = Recuperação de Crédito (`17`) + Ativos + Não migrados + etiqueta `203`. Conferência global bateu com a lista abaixo (0 extra, 0 faltando).

## IDs e actions

| Peça | Valor |
|---|---|
| Etiqueta | `Demanda de risco` |
| `etiquetas_id` | `203` |
| Filtro lista | `pesq[etiquetas][]=203` |
| Ação incluir | `adicionar_etiquetas` → `sys/processos/alteracao_em_lote/processos-adiciona-etiquetas-em-lote.php` |
| Campo da etiqueta | `form[etiquetas_id]` |
| Vinculados | `considerar_processos_vinculados` (`0` = só selecionados; `1` = + 1º nível) |
| Submit | `Gravar` |
| Ação remover | `remover_etiquetas` |
| Departamento Rec. Crédito | `pesq[departamentos_id][]=17` |
| Relatório seguro | `pesq[tprel]=A` (Completo) |
| Relatório perigoso | `pesq[tprel]=amostragem` — lote ignora checkbox |

Outras etiquetas **não-carteira** (não misturar): `Crítico` 202, `Crédito Ativo` 242, `PROVIDÊNCIA` 204, `MLE` 323, etc.

Filtro extra da lista: `pesq[filtros_multi][]=sem_etiqueta` = pastas sem **nenhuma** etiqueta (não significa “sem demanda de risco”).

## Planilha

`4. Base Rec Cred - STATUS VIOS.xlsx` no repo vistagem-bp.

- Aba de trabalho: **`ALTERAR NO VIOS`** (550 ativos).
- Coluna de corte: **`Demanda de Risco`**.
- `Sim` = 65 · `Não` = 485.
- Todos os 65 `Sim` estão `Ativo` / Recuperação de Crédito.

A coluna `Etiquetas` do export (ex.: `Carteira Inovageo | Demanda de risco`) é foto antiga — 6 dos 65 ainda apareciam com o texto no Excel; no VIOS a etiqueta foi zerada.

## 65 CIs a etiquetar (por grupo)

| Grupo | Qtd | CIs |
|---|---|---|
| Grupo GPR | 15 | 55651, 55537, 56284, 56313, 55643, 25459, 54542, 51479, 25483, 53932, 56008, 54594, 56021, 54384, 54257 |
| Grupo Decorwatts | 10 | 55627, 51684, 52932, 51554, 25466, 52852, 57064, 56435, 25451, 58896 |
| Grupo PST | 10 | 53845, 57557, 52723, 25170, 54589, 25515, 55004, 25181, 25504, 25191 |
| Grupo Bismarchi Pires | 9 | 54398, 56916, 27620, 56981, 51518, 49895, 26339, 51908, 57062 |
| Grupo Bilateral | 4 | 55381, 25923, 25959, 25924 |
| Grupo Federal Invest | 3 | 25304, 25331, 25306 |
| Grupo Covolan | 2 | 25532, 25531 |
| Grupo Inovageo | 2 | 56431, 54154 |
| Grupo AE5 | 1 | 41975 |
| Grupo Alexandre Young | 1 | 57918 |
| Grupo Alucel | 1 | 56160 |
| Grupo Armor | 1 | 55085 |
| Grupo Francieli Rech | 1 | 51492 |
| Grupo Ox Meat | 1 | 26215 |
| Grupo Puma | 1 | 25421 |
| Grupo Rafael C. B. Pastori | 1 | 25305 |
| Grupo Ricardo Ungaro | 1 | 44582 |
| Grupo Teixeira | 1 | 25853 |

Grupo GPR no filtro: `clientes_grupos_id` **224** (já usado na troca de resp.).

## UI — lista e lote

Seleção na lista: checkbox `fselect[N][select]` + hidden `fselect[N][valor]` = CI (`processos_id`).

Na tela de lote os CIs vão em `processos[]`. Aviso azul: *linhas em vermelho não serão consideradas, pois o processo está apagado.*

Há um `+` ao lado do combo de etiquetas — cadastra etiqueta **nova**. Não usar: `203` já existe.

## Não confundir

| Coisa no VIOS | Papel |
|---|---|
| Etiqueta `Demanda de risco` (203) | Marca a **pasta** (este skill) |
| Campo vistagem `DEMANDA DE RISCO` Sim/Não | Fila Power Apps / SharePoint — quem vista (Coord. vs Ops) |
| Tarefa `INCLUIR ETIQUETA - DEMANDA DE RISCO` (743) | Tipo de **prazo/tarefa**, não a etiqueta |
| Tarefa `PESQUISA DEMANDAS DE RISCO` (746/747) | Idem |
| Ação `alterar_grau_risco` / `alterar_classificacao_risco` | Campos de risco da pasta, outro lote |

## Relação com troca de resp./aux.

Mesma lista (`processos-lista.php`), mesmo Excel, mesmos 550 ativos. Troca de advogado **não** mexe em etiqueta. Este lote **não** mexe em responsável/auxiliar nem em prazos.
