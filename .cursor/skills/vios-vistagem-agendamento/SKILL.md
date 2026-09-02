---
name: vios-vistagem-agendamento
description: >-
  Regras de negócio e operação para vistagem de publicações jurídicas e
  agendamento no VIOS (bp.vios.com.br) — publi vinculada e prazo avulso.
  Use quando o trabalho envolver publicações, prazos, lote SPM, saneamento,
  planilha de tarefas, pxe insert, controladoria, ops legais, SharePoint
  VISTAGEM DE PUBLICAÇÕES, Kurrier, Excel de matching, audiências UNA, FATAL,
  D-3/D-2/D-1, conclusão=limite, ou o sistema que substitui a vistagem
  Power Apps + SharePoint.
---

# VIOS — Vistagem de publicações + agendamento automático

## Contexto do produto

Pipeline operacional atual (Controladoria → vistagem → prazos → VIOS):

### A) Recepção e matching (antes do Power Apps)

1. Arquivo **`CAPTURA DE PUBLICAÇÕES - 2024 - v5.xlsm`** (OneDrive Controladoria; também existe v6 no Desktop).
2. Sheet **`INICIAL`**: preencher DIA / MÊS / ANO e rodar a macro (`PUBLIS. TODOS ADVS` / equivalente).
3. A captura gera sheet do dia (ex.: `PUBLICA_ES - 12-`) **e** a macro abre **`PUBLICAÇÕES.xlsx`** (path típico `OneDrive/2023/PUBLICAÇÕES.xlsx`) — arquivo editado e depois **subido no Power Apps**.
4. **Power Query** (canônico no **CAPTURA**; espelho no `PUBLICAÇÕES`): ver `powerquery-rules.md` + M `powerquery-captura-Section1.m` / `powerquery-publicacoes-Section1.m` — diários, base VIOS + vínculo, pasta `Vínculo - CI`, status `JURÍDICO VISTAR`, null → `POSSÍVEL ABERTURA DE PASTA`.
5. Classificação humana sobretudo nas linhas **`POSSÍVEL ABERTURA DE PASTA`** (sem match).
6. **Manual ID 1** + correções: `manual-id1-coleta.md` (intimação tácita obsoleta; push raro).

### B) Vistagem (Power Apps + SharePoint)

6. **Controladoria** sobe / libera as publicações no app.
7. **Quem interpreta a publi + conta prazo** depende da área e de demanda de risco (ver tabela em `reference.md`):
   - **Trabalhista (sem risco):** Ops Legais faz vistagem completa (interpretação + prazo) e segue para agendamento.
   - **Trabalhista demanda de risco:** Coord. da área trabalhista vista; **Ops agenda**.
   - **Demais áreas (sem risco):** Jurídico define tipo do prazo + providência; **Ops Legais** coloca a data a agendar (exceto se o Jurídico pedir prazo diferente do legal).
   - **Demanda de risco (qualquer área):** Coord. da área vista; depois Ops agenda.
8. Após agendar + revisar no VIOS, supervisora Ops marca **REVISADO** → item vai para lista histórica **PUBLICAÇÕES - BACKUP** (`CONTROLADORIAJURDICA`); lista flutuante = `VISTAGEM DE PUBLICAÇÕES`.
9. Objetivo do novo sistema: **agendar sozinho no VIOS** (vinculado à publi) e **revisar depois**.

### C) Dois modos de agendamento (mesmo motor de regras)

O motor de datas/tipos/idempotência é **o mesmo**. Só muda a criação no VIOS:

- **Avulso** (lote SPM, saneamento, planilha sem publi): `pxe.php?act=insert` no CI.
- **Publi** (vistagem): tarefa **vinculada à publicação** que o VIOS já capturou — não basta o insert solto. Evidência: `vios_publicacao_id` + `pxe_id`.

Playbook operacional (lote 26/08 + regras canônicas): [agendamento-motor.md](agendamento-motor.md). Detalhe de calendário/mapa: [reference.md](reference.md). Dump CSV: skill `vios-baixar-relatorio-csv`.

## Princípios do novo sistema

- **Fonte da verdade do prazo**: o que a vistagem define (tipo, data, FATAL, CI/processo, responsável, área).
- **VIOS é o executor**: criar a tarefa correta e deixar o fluxo interno gerar subtarefas.
- **Sempre `data_prevista` = `data_limite`** (conclusão = limite).
- **Agendar → revisar**: nunca considerar concluído só com “Gravar OK”; validar cadeia gerada.
- **Idempotência**: não duplicar (`CI + tipo_VIOS + data esperada + hora` + id da vistagem/publi). Tipo **cancelado** no CI = já feito — não reagendar. Prazo: data esperada = **D−3 do FATAL**, não o FATAL.
- **Trabalhista vs demais áreas**: mesma plataforma; papéis diferentes (Ops interpreta+conta em trabalhista; Jurídico+Ops nas demais; Coord. em demanda de risco).
- **Publi vs avulso**: regras iguais; publi exige vínculo com a publicação no VIOS.

## Pipeline alvo (alto nível)

```
E-mail (publicações do dia) → Base VIOS (script madrugada) →
  Excel junção + escritório responsável (match / sem match) →
  Carga na vistagem → Vistagem jurídica → Definição de prazo →
  Motor de regras (tipo VIOS + datas) → Agendamento VIOS →
  Revisão automática da cadeia → Status na vistagem (OK / ajustar / erro)
```

Exceções do matching (processo não encontrado / publicação nova) devem ir para **fila humana** de classificação de escritório — não bloquear o restante.

### Status sugeridos na vistagem

| Status | Significado |
|---|---|
| `AGENDAR` | Pronto para o motor |
| `AGENDANDO` | Em processamento |
| `SIM-OK` | Agendado e revisado OK |
| `SIM-OK c/ ajuste` | Agendado; correção pós-fluxo aplicada |
| `ERRO` | Falha técnica ou regra |
| `SKIP` / `NÃO AGENDAR` | Fora do escopo (ex.: sem data, duplicado, contestação nasce da UNA) |
| `REVISAR` | Humano precisa olhar |

## Campos mínimos para agendar no VIOS

- **CI / processos_id**
- **Tipo de tarefa VIOS** (nome exato ou mapeado)
- **Data conclusão** (= data limite)
- **Hora início / hora fim** (compromissos/audiências; fim = início + 1h se aplicável)
- **Responsável(eis)** (`usuarios[]`)
- **Descrição** (incluir FATAL quando houver)
- **Área / carteira** (Pague Menos etc.) — útil para filtros e auditoria
- **Id da vistagem** (rastreio)

URL típica de insert:  
`https://bp.vios.com.br/index.php?pag=sys/processos/pxe.php&processos_id={CI}&act=insert`

Lista global de tarefas (revisão em lote):  
`pxe-lista.php` com filtros (grupo cliente, tipo, intervalo de datas).

## Regras de data (obrigatórias)

Canônico em [agendamento-motor.md](agendamento-motor.md). Resumo:

1. **`data_limite` = `data_prevista` sempre.**
2. Fins de semana: ao calcular D−N úteis, **recuar**.
3. **Prazo com FATAL:** insert no **D−3 (ENVIAR / nome do prazo)**; workflow cria D−2 REVISAR e D−1 PROTOCOLAR. Não achatar as três. Na SPM, `Data limite` = FATAL.
4. **Compromisso** (aud/perícia): data e hora reais; fim = início + 1h. Sem D−N.
5. **Providência** (`ACOMPANHAMENTO PROCESSUAL`, `INFORMAR CLIENTE` isolado): data da origem, sem D−N.
6. **UNA:** protocolar contestação = `back_util(AUD−2)` (se = FATAL da UNA → FATAL−1 útil); enviar defesa = `back_util(AUD−4)`. Não agendar `CONTESTAÇÃO` isolada. `ENVIAR DEFESA` costuma nascer com limite = conclusão+2 — igualar.
7. Tipo não mapeado, mesma fase/outro FATAL, sem hora/CI/data → **perguntar ou pular**. Cancelado = já feito.

## Tipos VIOS já usados com sucesso (trabalhista / prazos)

- Compromissos: `AUD. INSTRUÇÃO`, `AUD. CONCILIAÇÃO`, `AUDIÊNCIA UNA/INICIAL`, `AUDIÊNCIA DE JULGAMENTO` (dump: `SESSÃO DE JULGAMENTO`), `PERÍCIA`
- Prazos: `IMPUGNAÇÃO AO LAUDO`, `COMPROVAR PAGAMENTO`, `MANIFESTAÇÃO - FLUXO D1`, `MANIFESTAÇÃO SOBRE LAUDO PERICIAL`, `APRESENTAR/IMPUGNAR CÁLCULOS`, `RAZÕES FINAIS`, `AIRR`, `AGRAVO INTERNO`
- Providências: `ACOMPANHAMENTO PROCESSUAL` (verificar laudo/esclarecimentos/perícia/cálculos); `INFORMAR CLIENTE` isolado (CTPS, eSocial)
- **Não agendar isolado**: `CONTESTAÇÃO` (nasce da UNA)

Mapa completo + aliases: [agendamento-motor.md](agendamento-motor.md) §7.

## Revisão pós-agendamento

Preferir **lista de tarefas** (`pxe-lista`) em vez de abrir processo a processo:

1. Tarefa principal existe (CI + tipo + data + hora).
2. `conclusão == limite` em cada tarefa da cadeia.
3. Se UNA: protocolar contestação = D−2 da aud (exceção FATAL); enviar defesa = D−4 da aud (`back_util`).
4. Se prazo com FATAL: **ENVIAR = D−3**, **REVISAR = D−2**, **PROTOCOLAR = D−1**. Não deixar as três no mesmo dia.
5. Fechar lote com dump CSV amplo (sem recorte de data) e cruzar. Evidência: pxe_id + datas.
6. Atualizar status na vistagem / planilha de controle.

## Troca de resp. e aux. de pasta (lote VIOS)

Confirmado em 21/08/2026 (walkthrough Samuel, Rec. Crédito / Grupo GPR).

- **Não é prazo.** Este fluxo muda só a pasta (`processos-lista.php`). Prazos (`pxe`) ficam de fora salvo pedido explícito.
- **Responsável** = uma ação: `Alterar Advogado Principal` + Processar (substitui de uma vez).
- **Auxiliar** = duas ações: `Adicionar Advogados Auxiliares` (entra o novo) e depois `Remover Advogados Auxiliares` (sai o antigo). Não substitui.
- Se `Novo auxiliar` == auxiliar atual, não mexer no auxiliar.
- Fonte operacional: planilha `4. Base Rec Cred - 19.08.2026.xlsx`, sheet `ALTERAR NO VIOS` (CI, Advogado responsável, Auxiliares, Novo Advogado, Novo auxiliar).
- Agrupar por par destino + auxiliar antigo; filtrar `Grupo Cliente` (ex. Grupo GPR = `clientes_grupos_id` 224) **e Departamento = Recuperação de Crédito** (`pesq[departamentos_id][]=17`); mostrar até 500. Sem o departamento a lista de grupos grandes (Mazda etc.) fica pesada e dá timeout.

Detalhe: [reference.md](reference.md) §15.

## Etiqueta Demanda de risco na pasta (lote VIOS)

Skill irmã no repo vistagem-bp: `.cursor/skills/vios-etiqueta-demanda-risco/`.

- Etiqueta da pasta `Demanda de risco` (`etiquetas_id` **203**), não prazo.
- Fonte: mesma base Rec. Crédito, coluna `Demanda de Risco = Sim` (**65** CIs ativos).
- Ação de lote: `Adicionar Etiquetas` → `processos-adiciona-etiquetas-em-lote.php`. Sem amostragem; sem vinculados.

## O que NÃO fazer

- Agendar sem CI ou sem data.
- Deixar limite ≠ conclusão.
- Reprocessar itens já `SIM-OK` / `CANCELADO` / `DUPLICADO` sem motivo. Cancelado no VIOS = já feito; não reagendar.
- Tratar cancelamento de UNA sem entender cascade de subtarefas.
- Assumir que “Gravar” ou redirect para a home = sucesso — conferir o pxe no CI.
- Inserir prazo no FATAL ou achatar a cadeia no mesmo dia.
- Inventar hora, CI ou data quebrada.

## Artefatos de aprendizado (piloto RPA)

Pasta: `~/.cursor/lote7-rpa/`. Playbook: [agendamento-motor.md](agendamento-motor.md).  
Scripts: `schedule_26.py`, `schedule_acomp.py`, `fix_chain_d3.py`, `fix_una_26.py`, `check_spm_final.py`.  
Cliente piloto: Grupo Pague Menos (`clientes_grupos_id` 452), dept Trabalhista `4`.

## App atual (Power Apps) — mapeado

- **Nome:** `VISTAGEM DE PUBLICAÇÕES - BP`
- **URL play:** `https://apps.powerapps.com/play/e/default-5411b7aa-53ee-4f05-bb25-dfca7a522fc2/a/cd82167c-3bf5-4293-959a-edd0c165a5a7`
- **Tenant / env:** `5411b7aa-53ee-4f05-bb25-dfca7a522fc2` (`default-…`)
- **App id:** `cd82167c-3bf5-4293-959a-edd0c165a5a7`
- **Backend:** lista SharePoint **VISTAGEM DE PUBLICAÇÕES** no site `BISMARCHIPIRES` (+ Excel Online / Teams no env)
- **Painel Ops Legais (lista):** `https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES/Lists/VISTAGEM%20DE%20PUBLICAES/AllItems.aspx?viewid=9d6be58d-9ad2-4e3b-bad3-020088160e0f&env=WebViewList`
- **Sessão vista no piloto:** `controladoria@bpplaw.com.br`

### Home — Central de Publicações

- Gráfico Power BI por área (Cível|Insolvência, Recuperação, Insolvência, Tributário, Cível…)
- KPIs: `ITENS A SEREM VISTADOS`, `DEMANDAS DE RISCO`
- Entradas:
  - `VISTAR PUBLICAÇÕES` / `CONSULTAR PUBLICAÇÕES`
  - `ANALISAR INTIMAÇÕES` / `CONSULTAR INTIMAÇÕES`

### Tela VISTAR PUBLICAÇÕES (fila + formulário)

- Filtro `FILTRAR PELO GRUPO` (ex.: Grupo CASP)
- Lista lateral de itens pendentes (grupo, CNJ, resp., tipo de ação)
- Links de área / risco: `ALTERAR PARA CÍVEL | INSOLVÊNCIA`, `DEMANDA DE RISCO`
- Ações: `EDITAR`, `SALVAR`, fechar `X`

Campos observados no formulário (ver [reference.md](reference.md) §14):

- Identificação: `ORIGEM`, `ADV. LOCALIZADO NA PUBLI`, `DIÁRIO - DIVISÃO`, `PASTA` (ex. `INCIDENTE - CI 57923`), `NÚMERO DO PROCESSO`, `ESCRITÓRIO RESPONSÁVEL`, `STATUS`, `RESP. PRINCIPAL`, `NATUREZA`, `TÍTULO`, `CLIENTE PRINCIPAL`, `GRUPO`
- Datas/risco: `DATA DE DIVULGAÇÃO`, `DATA DE PUBLICAÇÃO`, `DEMANDA DE RISCO`
- Agendamento: `* TIPO DO AGENDAMENTO` (combo obrigatório), `PRIOR. DE AGENDAMENTO`
- Textos: `PUBLICAÇÃO` (texto bruto), `JURÍDICO` (considerações)

CI costuma vir em `PASTA` (`CI NNNNN`) e/ou no VIOS; CNJ em `NÚMERO DO PROCESSO`.

## Próximos passos ao evoluir o sistema

1. Completar mapa: datas FATAL/limite na UI, `CONSULTAR`, fluxo Intimações, listas SharePoint (nomes/colunas).
2. Modelar entidade `Vistoria` → `AgendamentoVIOS` → `Revisao`.
3. Codificar motor de regras (datas + tipos) testável sem UI.
4. Conector VIOS (API se houver; senão automação controlada no browser).
5. Fila + idempotência + painel de exceções para Controladoria/Ops.
