---
name: vios-fechamento-legal-ops
description: >-
  Fechamento mensal de Operações Legais: rateio de hours do timesheet da
  equipe Ops para as áreas jurídicas (publicações, agendamentos, pastas,
  protocolos). Use quando o trabalho envolver fechamento Legal Ops,
  FECHAMENTO - TIMESHEET - LEGAL OPS, MATRIZES, DIVISÕES, Usuário Rateio,
  pxe-lista flag_intimacao, processos-lista data_cadastro ativos, ou alocar
  horas de Ops nos departamentos.
---

# Fechamento mensal — Operações Legais

Horas dos colaboradores de **Operações Legais** no mês. Intimação tácita **não entra**.

## Resultado obrigatório

No arquivo final **não pode restar hora em Operações Legais**. Tudo vai para os outros departamentos.

Dois blocos, depois soma:

1. Timesheet **já lançado na área** (depois do de-para abaixo) → entra como está.
2. Timesheet ainda em Ops (vistar publi, agendar, abrir pasta, protocolo, etc.) → **rateia** pelo volume da atividade em cada área.

`horas_área = horas_do_tipo × (qtd_área / qtd_total)`

| Atividade Ops | Volume |
|---|---|
| Vistar / extração / pós-vistagem | publicações do mês por área |
| Agendamento | tarefas VIOS do filtro abaixo, por `Área do Processo` |
| Cadastro de pasta | processos abertos (`data_cadastro`) por área |
| Protocolo / double check protocolo | protocolos do mês por área |
| Sem volume (reunião, e-mail, saneamento, cadastro cliente, PDI…) | dividir igual nas 6: Cível, Reestruturação, Trabalhista, Tributário, Contratos, Rec. Crédito |

## Áreas — mesmo de-para SIOE / Orquestra

Fonte de pessoas: SIOE `colaboradores` (espelho de `ORQESTRAI.hr_employees`). **Não usar lista fixa de nomes.** A cada fechamento:

```sql
SELECT full_name, area, area_orqestrai
FROM colaboradores
WHERE is_active AND area = 'Operações Legais'
ORDER BY 1;
```

Casar `full_name` com a coluna `Colaborador` do timesheet VIOS (case-insensitive, trim). Pessoa nova em Ops entra sozinha. Quem saiu de Ops some. **Se o VIOS tiver horas de um nome da Ops que não casou (acento, grafia, apelido) → parar e perguntar**, com o nome e as horas. Não descartar.

Antes de gravar `AREA VINCULO` ou de contar volume, normalizar o rótulo (VIOS, SIOE `processos_completo.area`, `escritorio_responsavel`, protocolo `area`) com este de-para — o mesmo do Orquestra (`legal-areas.ts`) e do SIOE (`AREA_ORQESTRAI_TO_CANONICA` / Eficiência):

| Origem (qualquer casing) | Canônico (`AREA VINCULO`) |
|---|---|
| Insolvência, Cível \| Insolvência, Reestruturação | **Reestruturação** |
| Contratos, Societário e Contratos, Societário e Contrato | **Contratos** |
| Distressed Deals, Distressed Deals - Special Situations, Special Situations | **Special Situations** |
| Comercial | **Operações Legais** (legado Orquestra = Marketing, braço de Ops) |
| Marketing, Facilities, Financeiro, R.H., RH, Limpeza | **Operações Legais** |
| Cível, Trabalhista, Tributário, Recuperação de Crédito | como está |
| Operações Legais | Operações Legais (rateia; não fica no arquivo) |

Destinos de hora: Cível, Reestruturação, Recuperação de Crédito, Trabalhista, Tributário, Contratos, Special Situations. **Operações Legais não é destino.** Special Situations **é** área de prática (não jogar em Reestruturação).

## Atividades e áreas que não dá para interpretar → perguntar

Não chutar. Não mandar para “geral” nem para Cível. **Parar o fechamento e perguntar**, listando tipo, horas, pessoa e área crua.

**Tipo da tarefa em Ops — conhecido (não perguntar):**

| Tipo (contém / igual) | Pool |
|---|---|
| INTIMAÇÃO TÁCITA | fora (zera) |
| AGENDAMENTO PUBLICAÇÕES / DOUBLE CHECK DE AGENDAMENTOS | agend |
| EXTRAÇÃO DE PUBLICAÇÃO / PÓS VISTAGEM / VISTAGEM DE PUBLICAÇÕES | publi |
| CADASTRO DE PASTA | pasta |
| PROTOCOLO CONTROLADORIA / DOUBLE CHECK PROTOCOLO | proto |
| REUNIÃO DE GESTÃO, REUNIÃO INTERNA, ATENDIMENTO RESPONSUM, ONBOARDING NOVO CLIENTE, CADASTRO DE CLIENTE, PDI - DESENVOLVIMENTO, GESTÃO DE AGENDA, GESTÃO DE E-MAIL, OFFBOARDING, SANEAMENTO, MATERIAL MARKETING | geral (6 áreas iguais) |

Qualquer **outro** tipo ainda em Operações Legais (ex.: `2. REVISAR`, `3. PROTOCOLAR`, `VERIFICAR RENÚNCIA`, tipo novo do VIOS) → **perguntar** se vai para agend / publi / pasta / proto / geral / uma área específica.

**Área do apontamento (keep) — perguntar se depois do de-para:**

- ficou vazio / nulo
- não é um destino da tabela acima (ex.: `Atendimento a clientes`, `Sócio`, rótulo inédito)
- continua Operações Legais e o tipo também não está na tabela de pools

Remap de publi (CI na pasta) ou protocolo (CNJ) que não achar processo: **fora do denominador** se for volume. Se a hora do timesheet keep cair nesse limbo → perguntar, não inventar área.

## Tarefas (volume de agendamento) — filtro VIOS canônico

Tela: `pxe-lista.php`. **Não usar `sp_tarefas` do SIOE no lugar disso.** Capturado 02/09/2026 (dump `lista-de-tarefas-2w8.csv`, ago/2026).

| Campo | Valor | `pesq` |
|---|---|---|
| Período | 1º–último dia do mês de fechamento | `idata` / `fdata` |
| Tipo de data | **Cadastro** | `tp_data=data_inclusao` |
| Intimação | **Sim** | `flag_intimacao=1` |
| Mostrar subtarefas | **Sim** | `comboarr=S` |
| Conclusão | **Todas** | `flag_conclusao=T` |
| Filtros | **Todos** | `filtros=todos` |
| Tipo de tarefa / depto / usuário | nada | — |
| Relatório | CSV | `tprel=csv` |
| Limite | 9999999 | `limit=9999999` |

Download: skill `vios-baixar-relatorio-csv` (`#Pesq` → `download.php`, cookie `Proc`). Arquivo típico: `~/Downloads/lista-de-tarefas-*.csv` (latin-1, `;`).

Pós-filtro (Power Query `TAREFAS`):

- `CI do Processo` preenchido
- **Excluir** `Histórico` contendo: `Tarefa criada via importação`, `Tarefa criada ao responder questionário`, `Criada automaticamente`, `automaticamente `

Agosto/2026: 4540 linhas no CSV → 1459 após pós-filtro.

## Processos (volume de cadastro de pasta) — filtro VIOS canônico

Tela: `processos-lista.php`. Capturado 02/09/2026 (dump `processos-chr.csv`, ago/2026).

| Campo | Valor | `pesq` |
|---|---|---|
| Entidade | **Processo** | `entidade_processo_atendimento[]=processos_id` |
| Período | 1º–último dia do mês | `idata` / `fdata` |
| Tipo de data | **Cadastro** | `tp_data=data_cadastro` |
| Filtros | **Ativos** + **Não migrados** | `filtros_multi[]=ativos` e `naomigrados` |
| Etapa | **Todas** | `processos_etapas_id=TODAS` |
| Depto / advogado / grupo | nada | — |
| Relatório | CSV | `tprel=csv` |
| Limite | 9999999 | `limit=9999999` |

Arquivo típico: `~/Downloads/processos-*.csv`.

Pós-filtro (Power Query `BASE PROCESSUAL`): `Vínculo` e `CI` preenchidos. Descartar rodapé `Média:` / `Total:`.

Agosto/2026: 1021 pastas (886 Trabalhista — lote Pague Menos no dia 03/08).

## Timesheet — filtro VIOS canônico

Tela: `sys/cadastros/horas-trabalhadas.php` (Horas → Hora Trabalhada). Capturado 02/09/2026 (dump `rel-43-3e.csv`, ago/2026).

O VIOS exporta **o escritório inteiro**. O recorte Ops é **na hora**, pelos `full_name` ativos em `colaboradores.area = Operações Legais` (Orquestra). Sem lista hardcoded.

| Campo | Valor | `pesq` |
|---|---|---|
| Período | 1º–último dia do mês | `idata` / `fdata` |
| Usuário | todos (`0`) | `usuarios_id=0` |
| Grupo cliente | TODOS | `clientes_grupos_id=0` |
| Relatório | CSV | `tprel=csv` |
| Limite | 9999999 | `limit=9999999` |

Arquivo típico: `~/Downloads/rel-43-*.csv`.

Pós-filtro (Power Query `TIMESHEET`): `Data` preenchida; Colaborador → Funcionário; `Horas Apontadas` → `Total de Horas` (fração de dia no Excel; no CSV a coluna `…em decimal` já é hora). Descartar rodapé `Total:`.

Depois: só colaboradores Ops. Horas com `Área` ≠ Operações Legais **ficam**; horas ainda em Operações Legais **rateiam**.

Agosto/2026: 16.194 linhas no dump → 1.343 da Ops (840,8 h), das quais 744,3 h ainda em Ops e 96,5 h já nas áreas.

## Publicações (volume de vistagem) — SIOE, mês anterior

Tabela `sp_publicacoes`. Recorte canônico = Excel `DATA RECEBIMENTO KURIER`:

```sql
data_recebimento_kurier >= date_trunc('month', CURRENT_DATE) - interval '1 month'
AND data_recebimento_kurier <  date_trunc('month', CURRENT_DATE)
```

Volume por `escritorio_responsavel` (é o “AREA” do rateio no Excel, não a coluna `area`), **depois do de-para SIOE/Orquestra**.

Destinos: Cível, Reestruturação, Recuperação de Crédito, Trabalhista, Tributário, Contratos, Special Situations.

`OPERAÇÕES LEGAIS` **não** é destino. Remapear pelo CI na `pasta` → `processos_completo.area` (de-para). Se não houver processo, fora do denominador. Cível | Insolvência e Insolvência somam em **Reestruturação**.

Agosto/2026 (Kurier): 3.299 publis. Escritório: Trabalhista 1.234, Cível | Insolvência 551, Insolvência 302, Rec. Crédito 284, Cível 259, Contratos 20, Tributário 17, Ops 619, Special Situations 13.

## Protocolos (volume de protocolo / double check) — SIOE, mês anterior

Tabela `sp_protocolos` (espelho do SharePoint `CONTROLE DE PROTOCOLOS`). Recorte canônico = Excel **Criado**:

```sql
data_criada >= date_trunc('month', CURRENT_DATE) - interval '1 month'
AND data_criada <  date_trunc('month', CURRENT_DATE)
AND status IS DISTINCT FROM 'Cancelado'
```

Volume por `area`, depois do de-para. Insolvência + Reestruturação + Cível | Insolvência → **Reestruturação**. Contratos / Societário e Contratos → **Contratos**.

`OPERAÇÕES LEGAIS` não é destino — remapear pelo CNJ em `protocolo_nos_autos` → `processos_completo.area` (de-para); se não houver, fora do denominador.

Agosto/2026: 1.854 criados, 11 cancelados → **1.843**. Área nativa: Ops 845, Trabalhista 403, Reestruturação 310, Rec. Crédito 173, Cível 111, Contratos 8, Tributário 4.

## Outras fontes

- Equipe Ops: `colaboradores.area = Operações Legais` (consulta no mês; não copiar nomes de agosto).

Detalhe PQ e abas do Excel: [reference.md](reference.md).
