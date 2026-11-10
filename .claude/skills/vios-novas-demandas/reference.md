# Novas demandas — telas, campos e ids

Lido dos scripts do lote de 02 e 03/10/2026. Ids de opções (ação, fase, sistema, etiqueta)
variam por caso: escolha sempre pelo texto da opção e confira o que ficou selecionado.

## Telas (`index.php?pag=`)

| Etapa | Tela | Observação |
|---|---|---|
| Fila de capturas | `sys/integracoes/solucionare/distribuicao/em-lote/lista-distribuicoes.php` | também existem `.../distribuicao/lista-distribuicoes.php` e `lista-termos-distribuicoes.php`; filtro "Rejeitado" |
| Abrir a pasta | `sys/integracoes/solucionare/distribuicao/em-lote/cria-processo.php&id=<distribuição>` | traz o link da petição inicial |
| Recusar a captura | link `descarta.php&id=<distribuição>&act=del` ("Solicitar rejeição") | recusada só até 48 h da importação |
| Pessoa / cliente | `sys/clientes/clientes.php`, `sys/clientes/clientes-vis.php` | CPF/CNPJ, situação e grupo |
| Pastas do grupo | `sys/processos/processos-lista.php` com `pesq[clientes_grupos_id]`, relatório Completo | para copiar o par vivo |
| Capa (editar) | `sys/processos/cadastro-de-processo.php&processos_id=CI&act=edit` | |
| Monitoramento | `sys/processos/abas/andamentos.php&processos_id=CI` | form `#adminForm` |
| Tarefas | `sys/processos/pxe.php&processos_id=CI&act=insert` | |

## Abrir a pasta (`cria-processo.php`)

| Campo | Valor |
|---|---|
| `form[tipos_partes_id]` (rádio) | polo do cliente: `P` passiva, `T` terceiro (o valor da ativa não apareceu no lote) |
| `#clientes_id` (oculto) e `#clientes` (texto) | id da pessoa e "Nome -  CPF/CNPJ: ..." |
| `#form[departamentos_id]` | 6 Cível, 3 Insolvência, 17 Recuperação de Crédito |
| `#form[pr_areas_id]` | 13 Cível, 15 Cível \| Insolvência, 14 Insolvência, 12 Recuperação de Crédito |
| `#form[advogados_id]` | responsável |
| `#Gravar` | grava |

Depois de gravar aparece um aviso "Situação do Processo": confirme, ponha `#processos_situacao_id`
= 29 (Ativo) e clique em `#processo_gravar`. O link da pasta nova aparece como
`cadastro-de-processo.php&processos_id=<CI>`.

## Capa (`cadastro-de-processo.php`, form `#adminForm`)

`#processos_acoes_id` (ação), `#processos_fases_id` (fase; 19 e 20 foram as usadas), `#sistema_tribunal_id`
(sistema; 221, 222 e 223 usados), `#vara_id` (vara numérica, texto como "2ª" ou "Única"),
`#usuarios` (auxiliares), `#etiquetas` (Carteira + grupo), `#processos_situacao_id` (29),
`#form[valor_acao]`, botão `#processo_gravar`.

A situação volta ao padrão no submit: em script, fixe 29 num listener de `submit` do
`#adminForm` antes de clicar em gravar.

## Monitoramento

Ler `andamentos.php&processos_id=CI`, marcar o checkbox do CNJ no `#adminForm` e enviar o
formulário (POST para o `action` dele). A tela mostra "Números Monitorados" e a cota do mês.

## Tarefas (`pxe.php&act=insert`)

| Tipo (`processos_etapas_id`) | Data | Responsáveis (`usuarios[]`) |
|---|---|---|
| 662 NOVA DEMANDA - ANALISAR/INFORMAR CLIENTE - CAPTURADO AUTOMATICAMENTE | dia da abertura | responsável + auxiliar + 15 Giancarlo Murta Zotini + 21 Isadora Godoy Conte + 43 Samuel Willian Silva |
| 539 ATUALIZAÇÃO DE CADASTRO | próximo dia útil | 21 Isadora + 263 Maria Heloiza Gois Ponce + 280 Maria Julia Pereira + 281 Marina Silva Pinelli + 43 Samuel |

Os campos são os mesmos da inserção comum (`#processos_etapas_id`, `#usuarios`, `#data_prevista`,
`#data_limite`, `#pxe_nome`), com conclusão igual ao limite. Os avisos de inserção (mesma descrição
já aberta, data mais de 6 meses à frente) estão em `vios-cadastro-fluxos/reference.md`.

## Outros usuários vistos no lote

11 Fernanda Andrade Camolesi · 29 Lucas Sebinel Miranda · 244 Giovani Pina de Freitas. Os demais
ids de usuário estão em `vios-cadastro-fluxos/reference.md`.

## Como o lote rodou

O chat de outubro usou o `browser-use` ligado ao Chrome local (porta de depuração 9222 na época),
uma pasta por vez: abrir → capa → monitoramento → 2 tarefas, conferindo o CI e as tarefas na
capa ao final. Hoje o mesmo pode rodar com `vios-transferir-pastas/scripts/cdp.mjs` ou pelo
navegador do app.
