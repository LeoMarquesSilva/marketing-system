# Motor de agendamento VIOS — publi e avulso

Aprendizado consolidado no lote SPM Pague Menos (26/08/2026, saneamento Daniel) e no piloto RPA (`~/.cursor/lote7-rpa/`).

**Vale para os dois modos.** Só muda o *como* criar a tarefa no VIOS.

| Modo | Quando | Como criar | Evidência |
|---|---|---|---|
| **Avulso** | Planilha de prazos, saneamento, lote sem publi | `pxe.php?act=insert&processos_id={CI}` | `pxe_id` + cadeia |
| **Publi** | Vistagem de publicação | criar a tarefa **vinculada à publi** no VIOS (não basta insert solto) | `vios_publicacao_id` + `pxe_id` + cadeia |

Datas, tipos, idempotência, revisão e dump CSV são iguais nos dois.

---

## 1. Famílias (classificar antes de datar)

| Família | Exemplos | Data a gravar no insert |
|---|---|---|
| **Prazo** (tem FATAL) | Impugnação, manifestação, cálculos, RO/RR/ED, AIRR, agravo, comprovar pagamento | **ENVIAR = D−3 úteis do FATAL** |
| **Compromisso** | Instrução, conciliação, UNA/inicial, julgamento, perícia | Data **e hora** reais; fim = início + 1h |
| **Providência** | `ACOMPANHAMENTO PROCESSUAL`, `INFORMAR CLIENTE` isolado (CTPS, eSocial) | Data da origem, **sem D−N** |
| **Não agendar** | `CONTESTAÇÃO` isolada | Nasce da UNA |

Se o tipo **não estiver nesta tabela / no mapa**: **perguntar**. Não inventar.

---

## 2. Calendário

- Dia útil = seg–sex. Feriados forenses ainda não modelados.
- Ao calcular D−N: recuar fim de semana (nunca avançar).

```
back_util(d):
  while d.weekday >= 5: d -= 1 day
  return d

prev_biz(d):
  return back_util(d - 1 day)

back_n(d, n):
  n vezes prev_biz
```

`conclusão = limite` **sempre** (`data_prevista` = `data_limite`). Vale na criação e em qualquer correção.

---

## 3. Prazo com FATAL (regra canônica)

Quando a origem traz FATAL (na planilha SPM, `Data limite` **é** o FATAL):

| Dia | Tarefa | Quem cria |
|---|---|---|
| **D−3** | **ENVIAR** = nome do prazo (`IMPUGNAÇÃO AO LAUDO`, `MANIFESTAÇÃO - FLUXO D1`, …) | **Insert** (é o que se agenda) |
| **D−2** | `2. REVISAR` | Workflow VIOS |
| **D−1** | `3. PROTOCOLAR` | Workflow VIOS |
| **FATAL** | Data da origem | Não é a data da tarefa principal |

O workflow já coloca revisar = ENVIAR+1 útil e protocolar = ENVIAR+2 úteis.

**Proibido:** inserir no FATAL; “corrigir” achatando ENVIAR+revisar+protocolar no mesmo dia; tratar D−1 como data do insert.

**Idempotência:** o tipo no VIOS é o ENVIAR. Comparar com **D−3 do FATAL**, não com o FATAL. Se já existe em `back_n(FATAL, 3)`, é o mesmo prazo — não criar de novo.

Descrição do insert: `PRAZO - {texto} (FATAL:dd/mm/aaaa)`.

---

## 4. Compromisso

- Data/hora da origem. Sem cadeia D−N.
- Hora fim = início + 1h se a origem não trouxer fim.
- Sem hora ou sem data → **PULAR** e perguntar. Não inventar.
- Julgamento no dump CSV pode aparecer como `SESSÃO DE JULGAMENTO` (alias de `AUDIÊNCIA DE JULGAMENTO`).

---

## 5. UNA / defesa

Âncora = data da audiência `AUD`. FATAL da UNA = `prev_biz(AUD)`.

| Tarefa | Data |
|---|---|
| Protocolar contestação | `back_util(AUD − 2 dias)`. Se cair no FATAL da UNA → `prev_biz(FATAL)` |
| Enviar defesa (validação cliente) | `back_util(AUD − 4 dias)` |

Pós-insert: o fluxo default do VIOS **quase sempre erra** essas duas. Corrigir à mão. `ENVIAR DEFESA` costuma nascer com limite = conclusão+2 — **igualar**.

Campos de data no `act=edit` podem vir disabled — habilitar antes de gravar.

Apagar a UNA cascadeia subtarefas. `CONTESTAÇÃO` isolada: não agendar.

---

## 6. Idempotência e o que perguntar

Não criar se:

1. Mesmo `CI + tipo + data esperada` (D−3 se prazo) já existe (aberta ou concluída).
2. O tipo **já existiu e está Cancelada** → **já feito**. Não reagendar (ED/RR/RO típicos).
3. Tipo único no processo (AIRR, agravo) já presente — só criar se o tipo **não** existe.

**Perguntar (não decidir sozinho):**

- Mesma fase, outro FATAL no VIOS (ex.: cálculos 02/09 na planilha vs 16/09 no VIOS).
- Tipo fora do mapa.
- Humano pede tipo diferente do mapa (ex.: Quesitos → `MANIFESTAÇÃO - FLUXO D1`, não `IMPUGNAÇÃO AO LAUDO`).
- Segundo prazo no mesmo CI: só se a **fase** for outra (parecer vs laudo, médico vs técnico, esclarecimentos vs laudo).

Pular sem inventar: sem CI/pasta, data inválida (`14/09/202`, `23/20/2027`), UNA/compromisso sem hora.

Perguntar **um a um** quando for decisão humana.

---

## 7. Mapa origem → tipo VIOS

| Origem | Tipo VIOS | Família |
|---|---|---|
| Aud. instrução | `AUD. INSTRUÇÃO` | compromisso |
| Aud. conciliação | `AUD. CONCILIAÇÃO` | compromisso |
| UNA / inicial | `AUDIÊNCIA UNA/INICIAL` | compromisso + cadeia defesa |
| Julgamento | `AUDIÊNCIA DE JULGAMENTO` (dump: `SESSÃO DE JULGAMENTO`) | compromisso |
| Perícia | `PERÍCIA` | compromisso |
| Manifestação ao laudo / impugnação laudo | `IMPUGNAÇÃO AO LAUDO` | prazo |
| Quesitos (se humano pedir manifestação) | `MANIFESTAÇÃO - FLUXO D1` + desc QUESITOS | prazo |
| Manifestação genérica / produção de provas / defesa | `MANIFESTAÇÃO - FLUXO D1` | prazo |
| Manifestação / apresentação / impugnação de cálculos | `APRESENTAR/IMPUGNAR CÁLCULOS` | prazo |
| Razões finais | `RAZÕES FINAIS` | prazo |
| AIRR | `AIRR` | prazo |
| Agravo interno | `AGRAVO INTERNO` | prazo (pode gerar cadeia extra de ED) |
| Comprovar pagamento / INSS / execução / verificar pagamento | `COMPROVAR PAGAMENTO` | prazo |
| Anotação CTPS / eSocial / informar cliente isolado | `INFORMAR CLIENTE` | providência |
| Verificar esclarecimentos / laudo / perícia / cálculos | `ACOMPANHAMENTO PROCESSUAL` | providência |
| Contestação isolada | **não agendar** | — |
| ED / RR / RO cancelados | **SKIP** | — |

`INFORMAR CLIENTE` isolado ≠ subtarefa homônima que o workflow cria ao agendar outro prazo.

Aliases no dump: prefixos `ENVIAR `, `COMPROMISSO `, `PROVIDÊNCIA `, `CANCELADA`; `2. REVISAR` / `3. PROTOCOLAR` usam `Tarefa Pai` = tipo de origem.

---

## 8. RPA (Chrome logado, `browser-use`)

Sessão: Samuel Willian Silva. Cookie de API/download: **`Proc`** (não `PHPSESSID`).

**Insert avulso**

1. `https://bp.vios.com.br/index.php?pag=sys/processos/pxe.php&processos_id={CI}&act=insert`
2. Tipo, responsável da pasta, `data_prevista` = `data_limite` = data da família, descrição.
3. `#Gravar`.
4. Data no passado → swal **Data retroativa**. Confirmar com `button.swal2-confirm.click()` (JS). Clique por coordenada falha e o insert não grava.
5. Após gravar a aba pode ir para a home. Isso **não** prova sucesso — conferir no CI.

**Edit:** `pxe.php?pxe_id={id}&act=edit`. Datas podem estar disabled.

**Não** navegar com `tprel=csv` na URL (trava a aba). Dump: skill `vios-baixar-relatorio-csv`.

---

## 9. Dump e check (obrigatório ao fechar lote)

Skill irmã: `vios-baixar-relatorio-csv`.

Filtro amplo de tarefas:

- Grupo cliente (Pague Menos = **452**), dept Trabalhista = **4**
- `flag_conclusao=T`, `filtros=todos`
- **Zerar** `idata`/`fdata` (o default corta o dump)
- Relatório **CSV**, limite **9999999**, clicar `#Pesq` (botão; não o input hidden)
- Baixar `download.php?file=report/…` com cookie `Proc`
- latin-1, `;`, CI `="59014"`

Cruzar cada linha da origem:

- Prazo → tipo no CI em **D−3**; cadeia D−2/D−1 presente
- Compromisso → tipo (+ alias) + data/hora
- Providência → tipo + data da origem
- `conclusão == limite` na principal
- Status: `SIM-OK` / `JÁ EXISTIA` / `SKIP` (cancelado) / `PULAR` (falta dado) / `FALTA` (agendamos e não achou)

Se vários hits na mesma data, preferir o **pxe mais novo**.

Conclusão ≠ limite em subtarefas velhas (`ENVIAR DEFESA` +2, `SOLICITAR DOCUMENTOS`, etc.) **não** invalida o lote se a principal que criamos está igual.

---

## 10. Erros já pagos (não repetir)

1. Inserir prazo no FATAL da planilha.
2. “Fix D−1” que cola ENVIAR + revisar + protocolar no mesmo dia.
3. Tratar VIOS em D−3 como “outra data” porque a planilha mostra o FATAL.
4. Reagendar tipo cancelado.
5. Agendar `CONTESTAÇÃO` isolada.
6. Inventar hora/CI/data quebrada.
7. Confiar em “Gravar” ou redirect para home sem ver o pxe no CI.
8. Dump com recorte de data default.
9. `tprel=csv` na URL / Completo DataTables (cap 500).
10. Excel de controle aberto → save trunca (`BadZipFile` / `PermissionError`); gravar cópia `_CHECK` se falhar.
11. Agravo interno pode nascer com cadeia extra de ED — avisar, não apagar sem pedido.

---

## 11. Artefatos do piloto SPM 26/08

- Pasta: `~/.cursor/lote7-rpa/`
- Insert: `schedule_26.py`, `schedule_acomp.py`, `schedule_extra.py`, `schedule_d3_19.py`, `schedule_l60.py`
- Correção cadeia: `fix_chain_d3.py` (ENVIAR→D−3, REVISAR→D−2)
- UNA: `fix_una_26.py` / `fix_una_fast.py`
- Check final: `check_spm_final.py` + `lista-de-tarefas-spm-2026-08-26-check.csv`
- Controle: `Downloads/2026.08.26_AGENDAMENTOS_TAREFAS_LOTE_SPM(SANEAMENTO DANIEL)_CONTROLE.xlsx`

Lote fechado no check amplo: 754 linhas → 246 SIM-OK (criadas) + 458 já existiam + 31 SKIP + 19 PULAR; 0 falta; 0 cadeia incompleta nas criadas.
