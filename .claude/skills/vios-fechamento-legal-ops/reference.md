# Fechamento Legal Ops — referência

Áreas e pessoas: de-para SIOE/Orquestra na [SKILL.md](SKILL.md) (Insolvência e Cível | Insolvência → Reestruturação; Contratos permanece Contratos; Special Situations não recebe hora, a fatia dilui igual nas 6 áreas; lista Ops vem de `colaboradores` no mês). Tipo de timesheet desconhecido ou área que não casa → perguntar, não chutar.

Gerador (não é a saída, não sobrescrever): `FECHAMENTO - TIMESHEET - LEGAL OPS.xlsx` (abas `DIVISÕES`, `MATRIZES`, `MANUAL`, `TIMESHEET - VIOS`, `AGENDAMENTOS-VIOS`).

Saída mensal: `Documentos - Equipe Controladoria/Gestão/DASHBOARDS/FECHAMENTO - LEGAL OPS/FECHAMENTO LEGAL OPS/MM-AAAA - FECHAMENTO LEGAL OPS.xlsx`. Cópia em `~/Downloads`.

## Como gravar o xlsx

Clonar o arquivo oficial do mês anterior. São só duas abas: `TIME SHEET - FECHAMENTO` (tabela dinâmica) e `BASE` (tabela `Tabela23`). Manter dinâmica, estilos e logo. Trocar as linhas da BASE abaixo do cabeçalho e o mês do título (`Mês de Referência: MM/AAAA`; célula do mês abreviado, ex. `out`). Atualizar o `ref` da Tabela23 até a última linha.

Abrir no Excel e atualizar o cache da tabela dinâmica, depois salvar pelo Excel. openpyxl não lê esse cache. `Total de Horas` é fração de dia (horas ÷ 24), formato `[h]:mm:ss`.

Conferir antes de entregar:

- Total Geral × 24 = soma das horas da Ops, centavo a centavo.
- O painel mostra Cível, Reestruturação, Tributário, Contratos, Trabalhista, Recuperação de Crédito e Total Geral. Sem linha Special Situations.
- Os percentuais apontam para a célula do Total Geral (`C10/$C$16` e o intervalo compartilhado das áreas seguintes). Com as 6 áreas do esqueleto, o total fica na linha 16. Se a quantidade de linhas mudar, corrigir a âncora.
- Item novo na dinâmica nasce oculto (`showAll=0`). O Total Geral deixa essa hora de fora. Em set/2026 isso tirou 0,23 h quando surgiu Special Situations. Do mês seguinte em diante essa linha não existe. Se aparecer área nova, desocultar o item e só entregar com o total fechado.

## Esqueleto da BASE (rateio)

Linhas `Usuário Rateio`: Cobrar = Sim; Grupo Cliente, Cliente, Parte contrária, Área e Nº Processo = `INCLUSÃO MANUAL`; Origem = `Tarefa de Processo`; CI do Atendimento/Processo = `32506`; Data = último dia do mês; `AREA DO FUNCIONARIO` = Operações Legais. Linha de hora zero e área numérica `0` permanecem. Não existe bloco `5.x`. Não criar CI de Special Situations.

| CI | Tipo da Tarefa | AREA VINCULO |
|---|---|---|
| 1.1–1.9 | Agendamento Publicações / Agendamentos / Reagendamento APP - Manual | Cível, Cível \| Insolvência, Insolvência, Recuperação de Crédito, Trabalhista, Tributário, Contratos, 0, 0 |
| 2.1–2.6 | Análise Intimação Tácita - Manual | seis zeros (intimação tácita não entra) |
| 3.1–3.8 | Cadastro de Pasta - Manual | as 7 linhas de área acima + 0 |
| 4.1–4.7 | Análise Pós Vistagem Publicação / Extração de Publicação / Extração de Publicação Outros - Manual | as 7 áreas, sem 0 e sem Special Situations |
| 6.1–6.7 | Double Check Protocolo - Manual | Cível, Insolvência, Trabalhista, Tributário, Contratos, Recuperação de Crédito, 0 |
| 7.1–7.7 | Atividades Operações Legais - Geral | as mesmas 6 + 0, horas iguais |

A parte diluída de Special Situations já vai dentro da hora de cada área. Em agend, pasta e publi, Reestruturação fica nas duas linhas (`Cível | Insolvência` e `Insolvência`) na proporção do volume. Em proto e geral, uma linha `Insolvência`.

## VIOS e nomes

URL com `/?pag=...&menu_lateral=true`. O php direto responde HTTP 500. Download: `#Pesq`, depois `download.php`. CSV latin-1, separador `;`. A coluna de horas em decimal já está em horas.

Casar nome só por sobrenome igual ou conjunto de tokens contido no outro. Primeiro nome igual não basta (Letícia Zamarion, Leonardo Loureiro Basso e Vinícius Canto Hecksher são outras pessoas). Ativo em Ops sem nenhuma linha no timesheet do escritório inteiro fica com zero — não é erro de grafia.

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

## Amostra set/2026

Arquivo clonado de `08-2026`, dinâmica atualizada no Excel. Ops: keep 100,58 h + rateio 709,05 h = **809,63 h**. Seis pessoas de Ops lançaram hora no timesheet do escritório; os outros ativos de Ops não tinham linha nele.

Publicações no denominador: 3.420 (fora 64 sem processo e 2 ainda em Ops), das quais 9 em Special Situations. A fatia disso é 0,23 h. O painel entregue mostrou 809,40 h porque a dinâmica ocultou o item novo. Nos meses seguintes essa fatia dilui nas 6 áreas e entra no Total Geral. Não reabrir set/2026 salvo pedido explícito.
