# Referência detalhada — regras VIOS + vistagem

## 1. Papéis no fluxo atual de vistagem

| Situação | Quem interpreta a publi + define providência/tipo | Quem coloca / confirma o prazo a agendar | Quem agenda no VIOS |
|---|---|---|---|
| **Trabalhista** (sem demanda de risco) | **Ops Legais** (interpretação + contagem) | **Ops Legais** (mesmo ato) | Ops / motor |
| **Trabalhista + demanda de risco** | **Coord. área trabalhista** | Ops agenda após vistagem do coord. | Ops / motor |
| **Demais áreas** (sem risco) | **Jurídico** (tipo do prazo + providência) | **Ops Legais** (data; pode divergir do legal se Jurídico pedir) | Ops / motor |
| **Demanda de risco (outras áreas)** | **Coord. da área** | Ops agenda após vistagem do coord. | Ops / motor |

Intake (Kurrier/Excel/match) e liberação na Central: **Controladoria** em todas as áreas.

### Agendamento VIOS vinculado à publi (obrigatório neste produto)

O VIOS captura publicações. No fluxo de vistagem de publis, **não** usar só o insert `pxe` avulso no CI — vincular à publi.

O **motor** (datas, tipos, idempotência, revisão) é o mesmo do avulso: [agendamento-motor.md](agendamento-motor.md).

Requisitos do connector alvo:

1. Localizar a **publicação** no VIOS (mesmo processo/CNJ + teor/data ou id interno).
2. Criar a tarefa/prazo **vinculada a essa publi**.
3. Guardar evidência: `vios_publicacao_id` + `pxe_id` + revisão da cadeia.
4. Idempotência: não recriar se já houver vínculo publi↔tarefa.

Ainda a mapear na UI VIOS: tela/fluxo exato do vínculo (gravação a partir da publi vs campo na tela de insert).

### Listas SharePoint (legado)

| Lista | Site | Papel |
|---|---|---|
| `VISTAGEM DE PUBLICAÇÕES` | BISMARCHIPIRES | Fila flutuante de trabalho |
| `PUBLICAÇÕES - BACKUP` (a.k.a. publicações bkp) | CONTROLADORIAJURDICA | Histórico após STATUS=`REVISADO` (Power Automate move/apaga da flutuante) |

Campos de vistagem a estudar nas duas: `JURÍDICO`, vistagem Ops / tipo agendamento / datas.

## 1.1 Intake diário — Kurrier + Excel + base VIOS

**Manual SharePoint (parcialmente desatualizado):**  
[ID 1 — Coleta / Pushs / E-mail Neide / Casos cíveis](https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES/SitePages/ID-1---COLETA-DE-PUBLICA%C3%87OES---DISTRIBUIR-PUSHS---ANALISAR-E-MAIL-NEIDE-E-CASOS-C%C3%8DVEIS.aspx)  
Cópia orientada (com correções): [manual-id1-coleta.md](manual-id1-coleta.md)

### Correções vs manual (ago/2026)

- **Intimação tácita: NÃO EXISTE MAIS** — ignorar §2 do manual (VIOS intimações → planilha INTIMAÇÃO TÁCITA → merge em PUBLICAÇÕES).
- **Push (E-Push / view `1.1 PUSHS`): RARO** — manter suporte residual; não é o caminho diário principal.
- Fluxo diário vigente: **Kurrier via Excel** (+ base VIOS gerada de madrugada) → classificação de escritório → subir na Central → vistagem.

### Procedimento vigente (resumo)

1. Script noturno gera **base de processos VIOS** (usada no join da captura).
2. Abrir **`CAPTURA DE PUBLICAÇÕES - 2024 - v5.xlsm`**  
   (`OneDrive-BPPLAW/Documentos - Equipe Controladoria/`; há também v6 no Desktop).
3. Sheet **`INICIAL`**: DIA / MÊS / ANO → rodar macro → gera sheet do dia + **abre `PUBLICAÇÕES.xlsx`**.
4. **Power Query** em `PUBLICAÇÕES` (consultas `*(7)`): ver [powerquery-rules.md](powerquery-rules.md).
5. Editar resultado: filtrar **`POSSÍVEL ABERTURA DE PASTA`** e preencher Escritório / Grupo / Demanda de Risco (+ PASTA se achar no VIOS).
6. Regras TRIBUTÁRIO: Felicita / Verdeco / Bilateral / Mazda; Verdeco/Palash = TRIBUTÁRIO; demais → INSOLVÊNCIA; ex-cliente → excluir.
7. Não deixar vazio: Grupo, Demanda de Risco; não restar “possível abertura”, “operações legais”, “special situations”.
8. Avisar supervisora (duplicidades trabalhistas) → **Central de Publicações** → **subir novas publicações**.
9. Exceções: inclusão por **e-mail** (Título=`E-MAIL`); **push** raro.

Exemplo 12/08/2026 no CAPTURA: sheet `PUBLICA_ES - 12-`, 135 pubs; 4 em POSSÍVEL ABERTURA.

### Regra de DUPLICIDADE (lote do dia) — confirmada

1. **Indício:** mesmo **CNJ** aparece mais de uma vez no lote (pós-join Kurrier × base).
2. **Confirmação:** comparar campo **`PUBLICAÇÃO`**.
   - Texto nem sempre é idêntico byte a byte.
   - Pode mudar destinatário/parte (mesma publi dirigida a partes diferentes), mas o **teor/core** é o mesmo → ainda é duplicidade.
3. No fluxo atual marca status `DUPLICIDADE` (ex.: 26 no lote 20/08/2026).
4. No sistema novo: candidatos por CNJ → similaridade de teor (normalizar texto; não exigir igualdade total) → `DUPLICIDADE` / `SKIP` sem reentrada na vistagem; borderline → fila humana.

### Arquivo / Backup pós-revisão (legado SharePoint)

- Lista flutuante (trabalho): `BISMARCHIPIRES` → **VISTAGEM DE PUBLICAÇÕES**
- Lista histórica: `CONTROLADORIAJURDICA` → **PUBLICAÇÕES - BACKUP**  
  URL: `https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/PUBLICAES%20%20BACKUP/AllItems.aspx`
- **Gatilho:** campo **STATUS** alterado para **`REVISADO`**
- **Power Automate:** cria o item na lista Backup **e apaga** da lista flutuante
- SIOE já sincroniza essa lista Backup (`sp_publicacoes` / `LISTA_PUBLICACOES`)

No sistema novo (Supabase): status `REVISADO` (ou `SIM_OK` pós-revisão de agendamento) move/arquiva a publicação para tabela histórica (equivalente ao Backup) sem apagar fisicamente — soft-archive + manter id estável para o SIOE migrar a leitura.

### Tombamento / vistagem (fluxograma do manual)

| Ramo | Quem vista |
|---|---|
| Trabalhista | Mariana / Isadora |
| Insolvência / Cível / ADD / Trab. demanda de risco | Gestores e gerentes |
| Agendamento VIOS (hoje) | Estagiários |
| Check pós-agendamento | Lavínia / Mariana |

### Implicações para o sistema novo

- Intake: `Recebido` → `Match OK` / `Match pendente` → `Escritório definido` → `Na vistagem` (`JURÍDICO VISTAR`).
- Automatizar join Kurrier×base; UI só para **POSSÍVEL ABERTURA / sem match**.
- Não modelar intimação tácita; push como fila residual opcional.
- App: ação **subir novas publicações** (pós-Excel).

## 2. Calendário útil

- Dia útil = segunda a sexta (calendário judiciário simplificado do piloto; feriados forenses podem ser adicionados depois).
- Ao calcular “N dias úteis antes”:
  1. Subtrair N dias corridos da âncora.
  2. Enquanto cair em sábado/domingo, **recuar** um dia.
- `prev_biz(d)` = dia útil imediatamente anterior a `d` (recua FDS).

### Funções (pseudocódigo)

```
back_util(d):
  while d.weekday >= 5: d -= 1 day
  return d

prev_biz(d):
  d = d - 1 day
  return back_util(d)
```

## 3. FATAL e protocolar (prazos)

Quando a descrição/vistagem traz **FATAL = F**:

- **Protocolar** deve ficar em **prev_biz(F)** (= 1 dia útil antes do FATAL),  
  **exceto** regras especiais de contestação/UNA (abaixo).
- Fluxo gerado pelo VIOS ao agendar a tarefa principal costuma criar:
  - Ciência dos agendamentos (dia do processamento)
  - Informar cliente (dia do processamento)
  - Tarefa principal (data pedida)
  - 2. REVISAR (dia seguinte à principal)
  - 3. PROTOCOLAR (dia seguinte ao revisar) — **ajustar se não bater com FATAL−1**

A data pedida na vistagem para a tarefa principal **não é o FATAL**; é a data de conclusão da providência (ex.: impugnação em D, FATAL em D+3).

**Lote SPM / planilha Daniel (corrigido 26/08/2026):** a coluna `Data limite` da planilha **é o FATAL**. A cadeia de prazo (dias úteis, recuar fim de semana) é:

| Dia | Tarefa | Quem cria |
|---|---|---|
| **D−3** | **ENVIAR** — nome do prazo (`IMPUGNAÇÃO AO LAUDO`, `COMPROVAR PAGAMENTO`, etc.) | Insert no VIOS |
| **D−2** | **2. REVISAR** | Workflow automático |
| **D−1** | **3. PROTOCOLAR** | Workflow automático |
| **FATAL** | Data da planilha (não é data da tarefa principal) | — |

`conclusão = limite` em cada tarefa da cadeia. O workflow já gera revisar = ENVIAR+1 útil e protocolar = ENVIAR+2 úteis; **não** mover as três para o mesmo dia. Audiências/perícias: data/hora reais. **Providências** (`ACOMPANHAMENTO PROCESSUAL`, `INFORMAR CLIENTE` isolado): data da planilha, sem D−N.

**Duplicidade:** comparar a data do tipo no VIOS com **D−3 do FATAL**, não com o FATAL da planilha. Se o VIOS já tem o tipo em `back_n(FATAL, 3)`, é o mesmo prazo (ENVIAR).

Playbook operacional (publi + avulso, RPA, check, erros já pagos): [agendamento-motor.md](agendamento-motor.md).

**Errado (não repetir):** inserir no FATAL; “fix D−1” que cola ENVIAR+revisar+protocolar no mesmo dia.

## 4. AUDIÊNCIA UNA/INICIAL

Âncora = data da audiência `AUD`.

| Tarefa | Regra |
|---|---|
| Protocolar contestação | `back_util(AUD − 2 dias)`. Se essa data == FATAL da UNA (`prev_biz(AUD)`), usar `prev_biz(FATAL)` |
| Enviar defesa (validação cliente) | `back_util(AUD − 4 dias)` |
| Hora fim da UNA | início + 1h |

### Pós-agendamento UNA (fase 2)

1. Localizar subtarefas `3. PROTOCOLAR` (preferir a ligada a contestação) e `ENVIAR DEFESA PARA VALIDAÇÃO DO CLIENTE`.
2. Ajustar datas se o fluxo default do VIOS não bater nas regras.
3. Ao editar no VIOS, campos `data_prevista` / `data_limite` podem vir **disabled** — habilitar antes de gravar.
4. Sempre gravar **conclusão = limite**.
5. Apagar a UNA apaga subtarefas em cascata — usar só com intenção de cancelar o pacote.

## 5. Compromissos (audiências / perícias)

- Usar tipo VIOS curto quando for o caso (`AUD. INSTRUÇÃO`, não o nome longo da planilha).
- Preencher hora início e hora fim (+1h).
- Revisão: existência na lista por CI + tipo + data + hora.

## 6. Igualdade conclusão / limite

Regra absoluta observada no piloto:

- Na criação e em qualquer correção: `form[data_prevista] == form[data_limite]`.
- Foi comum o fluxo deixar `ENVIAR DEFESA` com limite = conclusão + 2 dias — **corrigir para iguais**.

## 7. Idempotência e duplicatas

Chave prática:

```
vistoria_id | CI | tipo_vios | data | hora
```

- Itens já `SIM-OK` / `CANCELADO` / `DUPLICADO` não reentrar na fila.
- **Tipo já existia no CI e está cancelado:** tratar como prazo já cumprido/baixado. **Não criar de novo** (confirmado SPM 26/08/2026).
- Mesmo CI + mesmo tipo + mesma data vazia pode colidir (ex.: parcelas COMPROVAR sem data) — exigir data ou usar `vistoria_id` / sequência da parcela.

## 8. Cancelamentos

- Tarefas retroativas indevidas: localizar na lista do processo (`pxe-lista` do CI) e apagar pelo `pxe_id`.
- UNA: preferir apagar a raiz se a intenção é remover o pacote.

## 9. Revisão em lote (operacional)

Filtros úteis em `pxe-lista.php`:

- `pesq[clientes_grupos_id][]` (ex.: Grupo Pague Menos = 452)
- `pesq[processos_etapas_id][]` (tipos)
- `pesq[idata]` / `pesq[fdata]` — **zerar** no dump de conferência (o default corta o lote)
- `pesq[flag_conclusao]=T`, `pesq[filtros]=todos` no check amplo
- `pesq[limit]` = `9999999` no CSV (não Completo/DataTables: cap 500)
- `pesq[tp_data]=data_prevista`
- Dump: skill `vios-baixar-relatorio-csv` (`#Pesq` + `download.php` + cookie `Proc`). Nunca `tprel=csv` na URL.

Extrair da linha: `pxe_id`, `processos_id` (CI), “Para conclusão”, “Limite”, tipo.

## 10. Mapeamento planilha / vistagem → VIOS (piloto)

| Origem comum | Tipo VIOS |
|---|---|
| Aud. de instrução | `AUD. INSTRUÇÃO` |
| Aud. de conciliação | `AUD. CONCILIAÇÃO` |
| Aud. UNA / inicial | `AUDIÊNCIA UNA/INICIAL` |
| Julgamento | `AUDIÊNCIA DE JULGAMENTO` (dump CSV: `SESSÃO DE JULGAMENTO`) |
| Impugnação ao laudo | `IMPUGNAÇÃO AO LAUDO` |
| Comprovar pagamento | `COMPROVAR PAGAMENTO` |
| Verificar pagamento / programação de acordo | `COMPROVAR PAGAMENTO` |
| Comprovar recolhimento INSS | `COMPROVAR PAGAMENTO` |
| Pagamento / pagamento execução | `COMPROVAR PAGAMENTO` |
| Manifestação fluxo D1 | `MANIFESTAÇÃO - FLUXO D1` |
| Manifestação; Defesa; produção de provas; quesitos (se humano pedir) | `MANIFESTAÇÃO - FLUXO D1` |
| Apresentar/impugnar cálculos | `APRESENTAR/IMPUGNAR CÁLCULOS` |
| Razões finais | `RAZÕES FINAIS` |
| AIRR | `AIRR` |
| Agravo interno | `AGRAVO INTERNO` |
| Anotação CTPS | `INFORMAR CLIENTE` |
| Inserir eSocial | `INFORMAR CLIENTE` |
| Informar cliente (isolado na planilha) | `INFORMAR CLIENTE` |
| Verificar esclarecimentos / juntada de esclarecimentos | `ACOMPANHAMENTO PROCESSUAL` |
| Verificar laudo / juntada de laudo | `ACOMPANHAMENTO PROCESSUAL` |
| Verificar perícia / data da perícia | `ACOMPANHAMENTO PROCESSUAL` |
| Verificar apresentação de cálculos | `ACOMPANHAMENTO PROCESSUAL` |
| Contestação (prazo isolado) | **NÃO AGENDAR** — vem da UNA |

Confirmado em **26/08/2026** no lote SPM Pague Menos (saneamento Daniel). `INFORMAR CLIENTE` aqui é a tarefa principal pedida na planilha — não confundir com a subtarefa que o fluxo VIOS gera sozinho ao agendar outro prazo.

Manter esta tabela versionada no novo sistema (editável por Ops/Controladoria).

## 11. Critérios de aceite da revisão automática

**OK** se:

- Principal encontrada no CI + tipo (+ alias) + data esperada (prazo = D−3 do FATAL)
- conclusão = limite na principal
- Se prazo com FATAL: ENVIAR D−3, REVISAR D−2, PROTOCOLAR D−1 (não no mesmo dia)
- Se UNA: prot e defesa nas datas-alvo; `ENVIAR DEFESA` com conclusão = limite

**AJUSTAR** se principal OK mas subtarefa fora da regra (corrigir e marcar `SIM-OK c/ ajuste`).

**ERRO / FALTA** se agendamos e o dump amplo não achou a principal.

**SKIP** se o tipo no CI está só Cancelada. **PULAR** se falta CI, hora ou data válida.

**JÁ EXISTIA** se o tipo já estava na data esperada (ou em outra, e a decisão foi não criar).

## 12. Riscos / débitos técnicos do piloto

- Automação via browser (sessão Chrome / remote debugging) — frágil para produção; preferir API VIOS se disponível.
- Excel como fila não escala — a vistagem SharePoint/Power Apps (ou novo backend) deve ser a fila.
- Feriados forenses não modelados.
- Parcelas COMPROVAR sem data na origem não podem ser agendadas.
- Campos disabled no form de edição VIOS.
- Swal de data retroativa: confirmar via JS (`swal2-confirm.click()`); clique por coordenada pode não gravar.
- Após insert a aba pode ir para a home — não é prova de sucesso.
- `AGRAVO INTERNO` pode gerar cadeia extra de ED.
- Excel de controle aberto trunca o save (`BadZipFile`).
- Conclusão ≠ limite em subtarefas velhas (`ENVIAR DEFESA` +2 etc.) não invalida o lote se a principal criada está igual.

## 13. Integração desejada com vistagem atual

Saídas do motor (persistir de volta na vistagem / fila):

- Status agendamento
- pxe_id(s)
- Log da revisão
- Divergências para fila humana

## 14. Power Apps — VISTAGEM DE PUBLICAÇÕES - BP

### Identificadores

| Item | Valor |
|---|---|
| App | VISTAGEM DE PUBLICAÇÕES - BP |
| App id | `cd82167c-3bf5-4293-959a-edd0c165a5a7` |
| Environment | `default-5411b7aa-53ee-4f05-bb25-dfca7a522fc2` |
| Tenant | `5411b7aa-53ee-4f05-bb25-dfca7a522fc2` |
| Play URL | `https://apps.powerapps.com/play/e/default-5411b7aa-53ee-4f05-bb25-dfca7a522fc2/a/cd82167c-3bf5-4293-959a-edd0c165a5a7` |
| Dados | SharePoint Online (connector `shared_sharepointonline`); também Excel Online / Teams no env |
| Escopo Power Platform API | `default5411b7aa53ee4f05bb25dfca7a522f.c2.environment.api.powerplatform.com` |
| Site SharePoint | `https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES` |
| Lista (painel Ops Legais) | `VISTAGEM DE PUBLICAÇÕES` (URL encode: `VISTAGEM%20DE%20PUBLICAES`) |
| View Ops (WebViewList) | `viewid=9d6be58d-9ad2-4e3b-bad3-020088160e0f` |
| URL lista Ops | `https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES/Lists/VISTAGEM%20DE%20PUBLICAES/AllItems.aspx?viewid=9d6be58d-9ad2-4e3b-bad3-020088160e0f&env=WebViewList` |

### Telas / navegação

1. **Home — Central de Publicações**
   - Chart (embed Power BI) por área
   - KPIs: itens a vistados / demandas de risco
   - Botões: Vistar/Consultar Publicações; Analisar/Consultar Intimações
2. **Vistar Publicações**
   - Sidebar: filtro por grupo + cards da fila
   - Formulário do item selecionado + EDITAR / SALVAR
3. **Consultar Publicações / Intimações** — a mapear (histórico/busca)
4. **Analisar Intimações** — a mapear (fila paralela à de publicações)

### Campos do formulário de vistagem (observados)

| Campo UI | Exemplo / notas | Uso no motor VIOS |
|---|---|---|
| ORIGEM | `KURRIER` | auditoria |
| ADV. LOCALIZADO NA PUBLI | nome OAB | auditoria / matching |
| DIÁRIO - DIVISÃO | `TJSP` | auditoria |
| PASTA | `INCIDENTE - CI 57923` | **extrair CI** |
| NÚMERO DO PROCESSO | CNJ | lookup processo |
| ESCRITÓRIO RESPONSÁVEL | `INSOLVÊNCIA` (dropdown) | área / papel Controladoria vs Ops |
| STATUS | `Ativo` | filtrar elegíveis |
| RESP. PRINCIPAL | nome | mapear `usuarios[]` VIOS |
| NATUREZA | (pode vazio) | classificar tipo |
| TÍTULO | carteira / rótulo | auditoria |
| CLIENTE PRINCIPAL | razão social | auditoria |
| GRUPO | `Grupo CASP` | filtro lista VIOS |
| DATA DE DIVULGAÇÃO | dd/mm/aaaa | âncora ciência |
| DATA DE PUBLICAÇÃO | dd/mm/aaaa | âncora prazo |
| DEMANDA DE RISCO | Sim/Não | priorização fila |
| TIPO DO AGENDAMENTO * | combo “Localizar itens” | **mapear → tipo VIOS** |
| PRIOR. DE AGENDAMENTO | Sim/Não | prioridade |
| PUBLICAÇÃO | texto bruto concatenado | NLP / evidência; contém CNJ, órgão, ato |
| JURÍDICO | texto livre | considerações da vistagem jurídica |

### Lista SharePoint — painel Ops Legais / Controladoria

Fonte de verdade dos itens (Power Apps lê/grava aqui).

- **Site:** `https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES`
- **Lista:** `VISTAGEM DE PUBLICAÇÕES`
- **URL (view Ops/jurídico):**  
  `https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES/Lists/VISTAGEM%20DE%20PUBLICAES/AllItems.aspx?viewid=9d6be58d-9ad2-4e3b-bad3-020088160e0f&env=WebViewList`
- **View aberta nesse link:** `1.1. JURÍDICO VISTAR - PENDENTES`  
  (filtro `STATUS DA PUBLICAÇÃO` = `JURÍDICO VISTAR`; agrupada por `Escritório responsável`)

#### Views vistas na barra

| View | Uso aparente |
|---|---|
| `1. TODAS AS PUBLICAÇÕES` | visão geral |
| `1.1 PUSHS` | a detalhar |
| `1.1. JURÍDICO VISTAR - PENDENTES` | fila jurídica (status JURÍDICO VISTAR) |
| `1.1 VISTAGEM - OPS. LEGAIS` | painel Ops Legais |

#### Colunas observadas na grid

| Coluna | Notas |
|---|---|
| Criado | data/hora carga (ex. 12/08/2026) |
| Demanda de Risco | Sim / Não (pills) |
| STATUS DA PUBLICAÇÃO | estágio do fluxo (ex. `JURÍDICO VISTAR`) |
| Escritório responsável | CÍVEL, CÍVEL \| INSOLVÊNCIA, … (vem do Excel de matching) |
| DATA DE DIVULGAÇÃO | |
| DATA DE PUBLICAÇÃO | |
| PRIORIDADE DE A… | Sim / Não |
| TIPO DO AGENDAMENTO / Pasta | na UI: valores tipo `INCIDENTE - CI …` / `RECURSO - CI …` (alinhar nome interno SharePoint) |
| DATA - PRIMEIRO… | (vazio em vários itens da fila jurídica) |
| DIÁRIO - DIVISÃO | TJSP, TJMG_DJEN_… |
| NÚMERO DO PROCESSO | CNJ |
| Título | frequentemente `KURRIER` (origem) |
| PUBLICAÇÃO | texto bruto |

#### Status de workflow (vistos na lista em 21/08/2026)

| Status | Uso aparente |
|---|---|
| `JURÍDICO VISTAR` | Fila jurídica (view dedicada) |
| `CONTROLADORIA VISTAR` | Fila controladoria (linhas destacadas) |
| `PRONTO PARA AGENDAR` | Após vistagem/prazo; aguarda agendamento VIOS |
| `AGENDADO` | Já agendado no VIOS |
| `ENVIADO ABERT. DE PASTA` | Sem pasta / abertura |
| `REVISADO` | Gatilho → move para **PUBLICAÇÕES - BACKUP** |
| `DUPLICIDADE` | Skip / fora da fila de vistagem |

#### Colunas relevantes (grid + formulário)

`STATUS DA PUBLICAÇÃO`, `Escritório responsável`, `Demanda de Risco`, `JURIDICO`, `CONTROLADORIA`, `INCONSISTÊNCIA JURÍDICO`, `TIPO DO AGENDAMENTO`, `DATA - PRIMEIRO PRAZO/PROVIDÊNCIA`, `PRIORIDADE DE AGENDAMENTO`, `AGENDADO POR`, `Executante do NF`, `Pasta` (CI), `NÚMERO DO PROCESSO`, `PUBLICAÇÃO`, datas divulgação/publicação, `DIÁRIO - DIVISÃO`.

Tipos de agendamento vistos no **BACKUP** (amostra): `CIÊNCIA NF`, `PROVIDÊNCIAS`, `PRAZO` (+ pasta `… - CI {n}`).

#### Power Apps — home (confirmado play + Studio)

App `VISTAGEM DE PUBLICAÇÕES - BP` · tela **Inicio**:

- Power BI por escritório (ex.: TRABALHISTA 38 no dia observado)
- KPIs: `ITENS A SEREM VISTADOS` / `DEMANDAS DE RISCO`
- Nav: Vistar/Consultar Publicações · Analisar/Consultar Intimações

Fórmulas `OnSelect` / filtros por papel (Ops vs Jurídico vs Coord. risco): ainda a extrair no Studio (canvas sem AX confiável).

### Ainda não confirmado (próxima passagem)

- Nomes internos das colunas SharePoint (`FieldInternalName`) via REST
- Campos **FATAL / hora** na UI de vistagem
- Fórmulas de navegação/filtro por área e demanda de risco
- Fluxo exato VIOS: vincular tarefa à publi capturada
- Catálogo completo de `TIPO DO AGENDAMENTO`

### Exemplo de item visto na fila (Controladoria)

- Grupo: CASP  
- CNJ: `4001163-70.2026.8.26.0022`  
- CI na pasta: `57923`  
- Resp.: Daniela Lagoeiro dos Santos  
- Escritório: INSOLVÊNCIA  
- Demanda de risco: Sim  
- Origem: KURRIER  
- Ação (card): Ação de Retificação do Quadro Geral de Credores  
- PUBLICAÇÃO: intimação TJSP / embargos de declaração / recuperação judicial  

## 15. Troca de responsável e auxiliar de pasta (lote)

Walkthrough 21/08/2026. **Não mexe em prazos** neste fluxo.

### Onde

- Home VIOS → **Processos** → `processos-lista.php`
- Filtrar **Grupo Cliente** (não CI a CI) **e Departamento = Recuperação de Crédito** (`pesq[departamentos_id][]=17`)
- Marcar as pastas do mesmo destino → dropdown **Ação** (rodapé) → **Processar**
- Depois do Processar a lista/filtro reseta (voltar a pesquisar o grupo)

### Regras (confirmadas)

| Campo | Como o VIOS trata |
|---|---|
| Advogado responsável (principal) | **Troca em um passo:** `Alterar Advogado Principal` substitui o antigo |
| Auxiliar | **Não troca.** `Adicionar Advogados Auxiliares` só inclui. Depois `Remover Advogados Auxiliares` tira o antigo; senão a pasta fica com 2 auxiliares |
| Prazos / `usuarios[]` da tarefa | Fora deste lote (pedido explícito à parte) |

Pular auxiliar se a planilha já tiver o mesmo nome em `Auxiliares` e `Novo auxiliar`.

### Planilha canônica (lote Rec. Crédito 19/08/2026)

Arquivo: `4. Base Rec Cred - 19.08.2026.xlsx`  
Sheet: `ALTERAR NO VIOS`  
550 CIs únicos, todos `Ativo` / Recuperação de Crédito.

Colunas obrigatórias: `CI`, `Grupo do Cliente`, `Advogado responsável`, `Auxiliares`, `Novo Advogado`, `Novo auxiliar`.

Três destinos finais no lote:

- Lucca Martinelli dos Santos Mattos + Ana Nunes Galvão
- Ana Nunes Galvão + Raíssa Alni Minari
- Raíssa Alni Minari + Lucca Martinelli dos Santos Mattos

Exemplo **Grupo GPR** (`clientes_grupos_id` 224, 35 CIs):

- 19: Ana+Lucca → Raíssa+Lucca (só principal; auxiliar já é Lucca)
- 16: Ana+Lucca → Lucca+Ana (principal + adicionar Ana + remover Lucca)

### Sequência operacional por grupo de destino

1. Processos → Grupo Cliente → Pesquisar (limit 500, Ativos / Não migrados)
2. Selecionar só as CIs daquele destino
3. Ação `Alterar Advogado Principal` → novo responsável → Processar
4. Pesquisar de novo
5. Ação `Adicionar Advogados Auxiliares` → novo auxiliar → Processar
6. Pesquisar de novo
7. Ação `Remover Advogados Auxiliares` → escolher o antigo → Processar
8. Conferir amostra: pasta com 1 responsável + 1 auxiliar, nomes iguais à planilha

Nome das 3 ações no dropdown de lote (value / rótulo):

| value | Tela seguinte |
|---|---|
| `alterar_advogado` | `processos-altera-advogado-em-lote.php` — `form[advogados_id]`; **manter** `form[distribuir_tarefas]=0` (Não) para não mexer em prazos |
| `add_auxiliares` | `processos-aux-add.php` — `form[auxiliares][]` + `form[regra]=adicionar` |
| `remove_auxiliares` | `processos-remove-advogados-auxilares.php` — `form[auxiliares][]` do antigo |

IDs de usuário (select VIOS): Lucca=`295`, Ana Nunes=`301`, Raíssa=`300`.

Teste 21/08/2026 (3 CIs Grupo Ricardo Ungaro `138`): 44582, 44584, 54779 — Ana+Lucca → Lucca+Ana. Planilha colunas `Status VIOS` / `Feito em` / `Observação`.

### Notas de automação UI

- Canvas Power Apps: árvore de acessibilidade quase vazia; cliques por coordenada / screenshot.
- Conteúdo roda em iframe `runtime-app.powerplatform.com` (OOPIF).
- Home: botão **VISTAR PUBLICAÇÕES** ~lado direito superior (viewport ~1670×764; clique útil ~`980,290`).
- Preferir integração **SharePoint/API** no produto novo; RPA na UI só para descoberta.
