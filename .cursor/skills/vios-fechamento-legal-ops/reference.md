# Fechamento Legal Ops — referência

Áreas e pessoas: de-para SIOE/Orquestra na [SKILL.md](SKILL.md) (Insolvência e Cível | Insolvência → Reestruturação; Contratos permanece Contratos; Special Situations é destino; lista Ops vem de `colaboradores` no mês). Tipo de timesheet desconhecido ou área que não casa → perguntar, não chutar.

Gerador: `FECHAMENTO - TIMESHEET - LEGAL OPS.xlsx` (abas `DIVISÕES`, `MATRIZES`, `MANUAL`, `TIMESHEET - VIOS`, `AGENDAMENTOS-VIOS`).

Saída mensal: `FECHAMENTO LEGAL OPS/MM-AAAA - FECHAMENTO LEGAL OPS.xlsx`.

## Power Query (Section1.m)

Consultas: `TIMESHEET`, `TAREFAS`, `BASE PROCESSUAL`, `PROTOCOLOS`, `PUBLICACOES-BKP`.

- **TIMESHEET**: CSV VIOS `rel-*.csv`; Colaborador → Funcionário; drop se `Data` vazia. `Total de Horas` no Excel é fração de dia (×24 = horas reais). SIOE já traz decimal.
- **TAREFAS**: CSV `lista-de-tarefas-*.csv`; tira linhas de questionário no campo CI (`Q: …`, `R: SIM/NÃO`, `Total:`); exige CI do processo; filtros de Histórico (ver SKILL).
- **BASE PROCESSUAL**: CSV `processos-*.csv`; `Vínculo` e `CI` preenchidos.
- **PROTOCOLOS**: SharePoint `CONTROLADORIAJURDICA` lista `CONTROLE DE PROTOCOLOS` (`4e115aab-…`); ano corrente; `STATUS <> Cancelado`.
- **PUBLICACOES-BKP**: mesma site, lista `91e8ba11-…`; trim `Demanda de Risco` / `Escritório responsável`.

## MATRIZES

Linhas `Usuário Rateio` / `INCLUSÃO MANUAL` por par (tipo rateado × área), `AREA VINCULO` = área jurídica, `AREA DO FUNCIONARIO` = Operações Legais. Horas = `VLOOKUP` do bloco em `DIVISÕES`.

## Amostra ago/2026

**Tarefas** `~/Downloads/lista-de-tarefas-2w8.csv` (15:11): 4540 → 1459 após PQ. Áreas: Cível | Insolvência 485, Trabalhista 325, Insolvência 257, Rec. Crédito 206, Cível 163, Tributário 18, Contratos 5.

**Processos** `~/Downloads/processos-chr.csv` (15:16): 1023 linhas → 1021 após PQ. Áreas: Trabalhista 886, Cível | Insolvência 45, Cível 35, Insolvência 34, Rec. Crédito 16, Tributário 3, Contratos 2. Spike 03/08 = carteira Pague Menos.

**Timesheet** `~/Downloads/rel-43-3e.csv` (15:19): 16.194 apontamentos do escritório → 1.343 / 840,8 h da Ops. Já na área: 96,5 h (89,2 Trabalhista). Ainda em Ops: 744,3 h (agendamento 343, extração/pós 161, protocolo 113, cadastro pasta 52, double check agend. 45, reunião gestão 42, …).

**Publicações** SIOE `sp_publicacoes`, `data_recebimento_kurier` ago/2026: 3.299. Rateio por `escritorio_responsavel`.

**Protocolos** SIOE `sp_protocolos`, `data_criada` ago/2026, status ≠ Cancelado: 1.843.
