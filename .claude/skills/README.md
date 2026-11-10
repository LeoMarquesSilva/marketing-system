# Skills do VIOS (Operações Legais)

Skills para operar o VIOS (bp.vios.com.br) com o Claude Code. Quem abre este repositório no
Claude Code já as tem: o agente usa cada uma quando o pedido combina com a descrição dela.

| Skill | Para quê |
|---|---|
| `vios-novas-demandas` | Abrir pastas a partir das capturas de novas demandas (Solucionare) |
| `vios-transferir-pastas` | Transferir pastas e prazos de área, responsável ou dupla |
| `vios-cadastro-fluxos` | Tipos de tarefa, prazos, fluxo automático, feriados e lotes de tarefas |
| `vios-vistagem-agendamento` | Vistagem de publicações e agendamento de prazos |
| `vios-baixar-relatorio-csv` | Exportar a lista de processos ou de tarefas em CSV |
| `vios-etiqueta-demanda-risco` | Etiqueta "Demanda de risco" nas pastas de Recuperação de Crédito |
| `vios-fechamento-legal-ops` | Fechamento mensal das horas de Operações Legais |
| `ops-legais-orquestrai` | Módulo de Operações Legais no ORQESTRAI |

No Cursor, a pasta `.cursor/` é ignorada pelo git. Para usar lá, ligue cada skill na sua pasta de
skills, por exemplo: `ln -s "$PWD/.claude/skills/vios-novas-demandas" ~/.cursor/skills/`.

Algumas skills citam arquivos que ficam só na máquina do Samuel (pasta `ORQESTRAI/`, Downloads).
São registro do que já foi feito, não pré-requisito. Gravações no VIOS pedem sempre o ok de quem
está usando, e o login é sempre da própria pessoa.
