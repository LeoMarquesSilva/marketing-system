# VIOS — telas, campos e ids (cadastro de fluxos)

Base: `https://bp.vios.com.br/index.php?pag=...`. As páginas vêm em ISO-8859-1. Leia com
`TextDecoder('iso-8859-1')` para não corromper acentos.

## Tipos de tarefa

| Tela | URL (`pag=`) | Observação |
|---|---|---|
| Lista de tipos | `sys/processos/tipo-tarefa-processo.php` | busca: `pesq[filtros]=todos&pesq[busca]=TEXTO&pesq[limit]=50&Pesq=Pesquisar` |
| Editar tipo | `...tipo-tarefa-processo.php&processos_etapas_id=ID&act=edit` | `form[processos_etapas_nome]`, área `pexpra[]` (selectpicker), `form[flag_responsavel]` ("Exige que seja concluída pelo responsável"), `responsabilidade[flag_advogado|flag_auxiliar|flag_coordenador]`, `form[flag_cli]`, `form[flag_movimento]` |
| Clonar tipo | `...&processos_etapas_id=ID&act=copy` | depois de clonar, ajuste prazo, etiqueta e área (veja SKILL.md) |
| Prazos do tipo | `sys/processos/processos-etapas-fluxos.php&processos_etapas_id=ID` | editar: `&pef_id=PEF&act=edit`. Campos: prazo e fatal (número + tipo de contagem 1–4) |
| Fluxo Automático - Criação | `sys/processos/processos-etapas-criacao.php&processos_etapas_id=PAI` | incluir: `&act=insert`; apagar: `&ecr_criacao_id=FILHA&act=del` (o GET apaga sem perguntar) |
| Fluxo Automático - Conclusão | `sys/processos/processos-etapas-conclusao.php&processos_etapas_id=ID` | mesmo formato da tela Criação |
| Etiquetas sugeridas do tipo | `sys/processos/processos_etapas/tipos_tarefas_x_etiquetas.php&tipo_tarefa_id=ID` | incluir: `&act=insert`, `etiquetas[]` (selectpicker). No editar do tipo: `#etiquetas_tipos_tarefas` |

Formulário de inclusão no Fluxo Automático - Criação: há três selects, nesta ordem: regra de
conclusão, regra de limite e tarefa filha. Valores das regras:

| Valor | Texto no VIOS |
|---|---|
| `data_base_contagem` | Utilizar data base da tarefa pai para contagem do prazo (padrão) |
| `data_tarefa_contagem` | Utilizar data para conclusão da tarefa pai para contagem do prazo |
| `data_atual_contagem` | Utilizar data atual para contagem do prazo |
| `data_tarefa` | Utilizar a data limite da tarefa pai como limite da filha |

Prazo negativo usa `data_tarefa_contagem` na conclusão e `data_base_contagem` no limite. Um prazo
D+N a partir do agendamento usa `data_atual_contagem` nos dois. Uma filha que conta a partir da
pai (2. REVISAR, 3. PROTOCOLAR) usa `data_tarefa_contagem` na conclusão e `data_tarefa` no limite.

## Pastas: ações de lote (`acao`)

| `acao` | Tela (`sys/processos/...`) | Campos |
|---|---|---|
| `alterar_departamento` | `alteracao_em_lote/processos-altera-departamento-em-lote.php` | `form[departamentos_id]`, `considerar_processos_vinculados` |
| `alterar_area` | `alteracao_em_lote/processos-altera-area-em-lote.php` | `form[pr_areas_id]`, `considerar_processos_vinculados` |
| `alterar_advogado` | `alteracao_em_lote/processos-altera-advogado-em-lote.php` | `form[advogados_id]`, `form[distribuir_tarefas]` (0 = Não), `form[considerar_processos_vinculados]` |
| `add_auxiliares` | `processos-aux-add.php` | `form[auxiliares][]`, `form[regra]=adicionar`, `form[considerar_processos_vinculados]` |
| `remove_auxiliares` | `alteracao_em_lote/processos-remove-advogados-auxilares.php` | `form[auxiliares][]`, `considerar_processos_vinculados` |
| `alterar_encerramento` | `alteracao_em_lote/processo-altera-encerramento-em-lote.php` | `form[flag_encerrado]`, `form[data_encerrado]`, `form[motivo_encerramento]` (lista com ~1.500 textos antigos, sem padrão) |

`considerar_processos_vinculados`: 0 = só as selecionadas. `form[distribuir_tarefas]=1` troca em bloco as tarefas do advogado anterior, responsável ou auxiliar, e não respeita a regra de enviar/revisar. Para respeitá-la, deixe em 0 e edite tarefa a tarefa. Trocar a pasta não muda os responsáveis das tarefas já abertas; a coluna "Área do Processo" delas acompanha a pasta.

Departamentos: 6 Cível, 9 Comercial, 12 Contratos, 7 Distressed Deals, 10 Financeiro, 3 Insolvência, 5 Operações Legais, 17 Recuperação de Crédito, 4 Trabalhista, 2 Tributário.

Áreas: 13 Cível, 15 Cível | Insolvência, 21 Contratos, 14 Insolvência, 23 Não informada, 16 Operações Legais, 12 Recuperação de Crédito, 20 Special Situations, 18 Trabalhista, 17 Tributário.

O filtro padrão da lista de processos (`filtros_multi` vazio) não traz encerrados nem algumas pastas ativas (41653, 48882, 59752, em 09/11/2026). Para conferir todas, use também a página da pasta.

### Pastas vinculadas (primeiro nível)

`processos-lista.php&pesq[processos_id_unico]=CI&pesq[vinculados_ao_processo]=CI&pesq[filtros_multi][0]=todos&pesq[limit]=500&pesq[processo_vinculo][0]=processo_principal&pesq[processo_vinculo][1]=1&pesq[processo_vinculo][2]=2&pesq[processo_vinculo][3]=3&Pesq=Pesquisar`

`processo_vinculo`: `processo_principal`, 1 APENSO, 2 INCIDENTE, 3 RECURSO. Sem esse parâmetro (ou sem `subtipo_vinculos_id`, que é o que a página da pasta usa), o filtro de vínculo é ignorado e volta a lista inteira. Uma pasta principal pode ter centenas de vinculadas: use limite 500.

### Linha da lista (relatório Completo, `tprel=A`)

As linhas vêm no HTML; o CI está em `fselect[N][valor]`. Células da `tr` (em 09/11/2026):

| Índice | Conteúdo |
|---|---|
| 2 | CI |
| 3 | Área |
| 5, 6, 7 | Data do cadastro, data do encerramento, data da ação |
| 9 | Situação |
| 10 | Ação |
| 11 | Etiquetas + CNJ; começa com `ENCERRADO` ou `SUSPENSO` quando é o caso |
| 16, 17 | Advogado responsável, sigla do auxiliar |
| 18, 19, 20 | Parte ativa, parte passiva, terceiros |
| 21, 22 | Cliente, polo do cliente |
| 23 | Observações (síntese do processo) |
| 28 | Motivo de encerramento |

Situação "Ativo" com etiquetas começando por `ENCERRADO` e motivo preenchido = pasta encerrada (ex.: 43539, encerrada por duplicidade).

## Tarefas (pxe)

| Ação | URL | Campos / comportamento |
|---|---|---|
| Ver pasta | `sys/processos/processos-vis.php&processos_id=CI` | as tarefas são desenhadas por JS. Leia num iframe e espere "Para conclusão" aparecer. Linha: `NNNNNN [CANCELADA]TIPO ... Para conclusão dd/mm/aaaa Limite ... Responsáveis: ...` |
| Inserir | `sys/processos/pxe.php&processos_id=CI&act=insert` | `form[processos_etapas_id]`, `form[data_prevista]`, `form[data_limite]`, `form[hora_prevista]`, `form[hora_fim]`, `form[pxe_nome]`, `usuarios[]`, `etiquetas[]`. Trocar o tipo (jQuery `change`) preenche os responsáveis e **sobrescreve** a descrição com o texto padrão do tipo |
| Editar | `sys/processos/pxe.php&pxe_id=ID&act=edit` | as datas vêm `disabled`. Etiquetas e responsáveis podem ser editados. Gravar responde "Tarefa cadastrada com sucesso." sem duplicar |
| Prorrogar | `sys/processos/pxe-obs.php&pxe_id=ID&acao=Prorrogar` | `fo[data_prevista]`, `fo[data_limite]`, `tipo_prorrogacao_id` (1941 = Reagendamento), `form[pxo_obs]` (motivo, HTML). Depois redireciona para `prorrogar_subtarefas=1`, que é opcional |
| Cancelar | `sys/processos/pxe/pxe-cancelar.php&pxe_id=ID&processos_id=CI` | `form[cancelamento_tipos_id]`, `form[obs]`. Sucesso: "cancelada com sucesso". Sem o formulário, a tarefa já está cancelada ou concluída |
| Apagar | `sys/processos/pxe.php&pxe_id=ID&act=del` | pergunta "Deseja apagar as subtarefas também?". "Sim, pode apagar" apaga a cadeia |
| Subsequentes | `sys/processos/pxe/pxe-visualizar-subsequentes.php` | mostra as filhas de uma tarefa |
| Lista / export | `sys/processos/pxe-lista.php` | veja `vios-baixar-relatorio-csv`. Filtros: `pesq[departamentos_id][]`, `pesq[processos_etapas_id][]`, `pesq[filtros]=pendentes`, `pesq[nro_proc]` (CNJ), `pesq[tprel]=csv`, `pesq[limit]=9999999`, `pesq[idata]`/`pesq[fdata]` vazios (o padrão é do dia 1º do mês até hoje) |

Avisos (swal) ao inserir:

- "Nessa pasta já existe uma tarefa aberta com a mesma descrição": o VIOS bloqueia a gravação.
- "Data a frente: A data escolhida é mais de 6 meses a frente": é preciso clicar em **Confirmar**.

### Justificativas de cancelamento (`form[cancelamento_tipos_id]`)

| id | Texto |
|---|---|
| 2319 | DESISTÊNCIA DO CLIENTE (**padrão da tela**, quase nunca é o certo) |
| 2318 | DUPLICIDADE |
| 2320 | PRAZO/TAREFA NÃO UTILIZADA - FLUXO AUTOMÁTICO |
| 2317 | INCONSISTÊNCIA NA VISTAGEM |
| 2316 | OTIMIZAÇÃO DE PRAZO |

### Export CSV (`pxe-lista`)

O arquivo vem em ISO-8859-1, separado por `;`. O CI vem como `="123"`. As duas últimas linhas
("Média:" e "Total:") são rodapé. A coluna **Histórico** traz "Criada automaticamente ao criar a
tarefa X CI N", que é o jeito de achar a tarefa pai. O motivo da prorrogação **não** aparece no
Histórico.

## Feriados

| Tela | URL | Campos |
|---|---|---|
| Lista | `sys/agenda/cal_feriados.php` | `pesq[idata]`, `pesq[fdata]`, `pesq[limit]` |
| Editar | `...cal_feriados.php&cal_feriados_id=ID&act=edit` | `form[cal_feriados_nome]`, `form[data_inicio]`, `form[data_fim]`, `form[flag_prazo]` (tarefas processuais), `form[flag_prazo_tarefa_nao_processual]`, `form[flag_prazo_compromisso]`, `form[feriado_recorrente]` |

Cada caixa de marcar vem com um campo oculto com valor 0. Para marcar por script, use
`fd.append('form[flag_prazo]','1')` depois de `new FormData(form)`.

Situação em 28/10/2026: os feriados nacionais de 20/11/2026 a 25/12/2027 estão com a opção
processual marcada. Os recessos 395 (2026) e 396 (2027) têm a data de fim **antes** da de início
(06/01 do mesmo ano). Isso ainda não foi corrigido, e o recesso não é pulado na contagem.

## Ids úteis

### Tipos de tarefa (Trabalhista)

| id | Tipo | pef_id | Prazo atual (28/10/2026) |
|---|---|---|---|
| 202 | AUDIÊNCIA UNA/INICIAL | — | 0 dias úteis |
| 418 | CONTESTAÇÃO (Trabalhista) | 429 | 15 • Prazo Negativo - Dias Úteis |
| 419 | 2. REVISAR | 319 | 6 dias úteis (da contestação) |
| 420 | 3. PROTOCOLAR | 320 | 13 dias úteis (da contestação) |
| 772 | ENVIAR DEFESA PARA VALIDAÇÃO DO CLIENTE | 568 | 3 • Prazo Negativo - Dias Úteis (do protocolar) |
| 256 | SOLICITAR DOCUMENTOS | 249 | 1 dia útil (data atual) |
| 793 | SOLICITAR DOCUMENTOS/ESCLARECIMENTOS COMPLEMENTARES | 583 | 15 • Prazo Negativo - Dias Úteis |
| 458 | LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO PROCESSUAL | 358 | 4 • Prazo Negativo - Dias Úteis (todas as audiências) |
| 321 | 1. CIÊNCIA DOS AGENDAMENTOS | — | 0 (compartilhado por ~40 fluxos) |
| 417 | HABILITAÇÃO PROCESSUAL | — | 1 dia útil (cria 626 REVISAR e 621 PROTOCOLAR próprios) |
| 416 | INSERIR PAUTA + ATUALIZAR SISTEMA | — | 1 dia útil |
| 460 | VERIFICAR ATA | — | 1 dia útil |
| 260 | CIÊNCIA ATA + ENVIAR RELATÓRIO | — | 1 dia útil |
| 454 | AUD. CONCILIAÇÃO | — | não cria contestação |
| 457 | AUD. INSTRUÇÃO | — | não cria contestação |
| 39 | AUDIÊNCIA DE JULGAMENTO | — | cria só Informar cliente e Inserir pauta |

### Etiquetas de tarefa (`etiquetas[]`)

| id | Etiqueta |
|---|---|
| 204 | PROVIDÊNCIA (#F8AC59) |
| 205 | COMPROMISSO |
| 1 | ENVIAR |
| 2 | REVISAR |
| 3 | PROTOCOLO |
| 4 | VALIDAR PROTOCOLO |
| 270 | ORIUNDO DE PUBLICAÇÃO |
| 298 | INCONSISTÊNCIA DE PUBLICAÇÃO |
| 299 | INCONSISTÊNCIA DE AGENDAMENTO |
| 486 | SAMA - ECOA - ATENDIMENTO |

A etiqueta de **pasta** "Demanda de risco" (203) é outra coisa: veja `vios-etiqueta-demanda-risco`.

### Fluxo geral de enviar/revisar/protocolar

Tipos 136 MANIFESTAÇÃO - FLUXO D1 e 133 PETIÇÃO INICIAL (fluxo lido em 09/11/2026):

| Tarefa | Tipo | Responsáveis no fluxo |
|---|---|---|
| Enviar | a própria | Advogado responsável |
| 2. REVISAR | 314 | AUXILIARES DO ATENDIMENTO |
| 3. PROTOCOLAR | 313 | Samuel Willian Silva + RESPONSÁVEL DO ATENDIMENTO |

Ao trocar responsáveis de tarefas abertas, siga essa mesma divisão: a dupla da pasta é o auxiliar e revisa.

### Usuários (`usuarios[]`, `form[advogados_id]`)

295 Lucca Martinelli dos Santos Mattos · 301 Ana Nunes Galvão · 304 Nicole Donadão Costa Camargo · 43 Samuel Willian Silva · 252 Manuela Lutke · 142 Pedro Vittale Rossi · 29 Lucas Sebinel Miranda · 206 Gabriela Bossi Leme · 4 Ana Clara Borba Tavares · 211 Vinícius Canto Hecksher · 26 Ligia Gilberti Lopes

Siglas de auxiliar na lista e no CSV: LMSM Lucca · ANG Ana Nunes · NDCC Nicole · PVR Pedro · LSM Lucas Sebinel · GBL Gabriela · ACBT Ana Clara.

Papéis (organograma do escritório, out/2026): Isadora Godoy e Maria Heloiza são da Controladoria, assim como as estagiárias Natalia Borges Breve e Maria Julia Pereira. Leonardo Loureiro é gerente, Lígia Lopes é coordenadora comercial e Lavínia Crispim é especialista de gestão, os três de Reestruturação. Lucca, Ana Nunes e Nicole são de Recuperação de Crédito.

### Outros

- Tipo de prorrogação 1941 = Reagendamento.
- Departamento Trabalhista na `pxe-lista`: `pesq[departamentos_id][]=4`.
- Pasta de teste liberada: **CI 57132**.
