---
name: vios-novas-demandas
description: >-
  Abre pastas no VIOS (bp.vios.com.br) a partir das capturas de novas demandas (Solucionare,
  "Lista de Distribuições Capturadas"): confere se o processo é de cliente da carteira, recusa
  homônimo, abre a pasta com área, departamento e o par de responsável e auxiliar, liga o
  monitoramento, saneia a capa (ação, fase, sistema, valor, etiqueta Carteira) e agenda as
  tarefas de nova demanda e atualização de cadastro. Use sempre que o trabalho envolver abrir
  pasta, abertura de pasta, cadastro de processo novo, novas demandas, captura de distribuição,
  Solucionare, "POSSÍVEL ABERTURA DE PASTA", rejeitar ou descartar captura, ou o manual
  "23 - CAPTURA DE NOVAS DEMANDAS".
---

# VIOS — abertura de pastas de novas demandas

Ensinado pelo Samuel em 02/10/2026, num chat do Cursor. Naquele lote saíram 45 pastas (CI
60353 a 60402), 1 captura de homônimo foi recusada e 13 ficaram de fora com o motivo registrado (cópia do relatório em
`ORQESTRAI/vios-novas-demandas/excecoes-2026-10-03.md`). Manual do escritório: SharePoint,
página "23 - CAPTURA DE NOVAS DEMANDAS".

Telas, campos e ids: [reference.md](reference.md). Para gravar em lote e conferir, use também os
métodos da skill `vios-cadastro-fluxos` (`automacao.md`).

## O fluxo

1. **Fila:** Solucionare → Lista de Distribuições Capturadas. Trabalhe uma captura por vez, até
   acabar a fila.
2. **É cliente nosso?** Confira o **CPF/CNPJ** e a **razão social** da captura contra a pessoa no
   VIOS (cadastro de clientes). O cliente precisa estar ativo e ser o cliente das pastas do grupo,
   não só uma parte que aparece nelas.
    - **Homônimo** ou parte que não é cliente: **recuse** a captura ("Solicitar rejeição"), para o
      escritório não pagar por ela. O VIOS só aceita a recusa até 48 horas depois da importação;
      depois disso, registre no relatório.
    - **Ex-cliente**, CPF/CNPJ que não está no VIOS ou documento que não confirma: não abra;
      registre no relatório.
3. **Área e departamento:**
    - **Insolvência** (departamento e área Insolvência): recuperação judicial, falência e o que
      nasce delas (habilitação, impugnação, pedido de falência).
    - **Cível | Insolvência** (departamento Insolvência, área Cível | Insolvência): execução,
      monitória e cobrança de cliente que está em recuperação judicial e é da carteira.
    - **Cível** (departamento e área Cível): o resto (carta precatória, protesto, conhecimento).
4. **Responsável e auxiliar:** copie o par das pastas **vivas** do grupo na mesma área. Sem pasta
   viva, use a planilha da área:
    - Cível: "Controle de Clientes por Área - Responsável de Pasta - Fluxo de Agendamento (NOVO)",
      aba Cível. ENVIAR é o responsável e REVISAR é o auxiliar.
    - Insolvência e Cível | Insolvência: "FLUXO 05_2026", aba Fluxo 05_2026, pela chave Grupo
      Cliente + Núcleo. A coluna NOVAS DEMANDAS diz quem recebe; a aba VERIFICAR AR traz o
      responsável principal e o suporte.
    - Sem par em pasta viva nem na planilha: não abra; registre no relatório.
5. **Abrir a pasta** na tela da captura: polo do cliente, cliente, departamento, área e
   responsável. Ao gravar, o VIOS pede a situação do processo: **Ativo**.
6. **Ligar o monitoramento:** Andamentos → Monitoramento Processual → marcar o CNJ → Gravar. A
   cota é mensal (8.000 em out/2026).
7. **Sanear a capa** (Editar): ação, fase, sistema do tribunal, vara, auxiliar, valor da ação e a
   etiqueta **Carteira + nome do grupo**.
    - Sem valor da ação na captura: **R$ 0,01** (depois é atualizado).
    - A ação **não pode ficar "Procedimento Comum Cível"**. Classe genérica: abra a petição
      inicial pelo link na página da captura e escolha a ação pelo que ela pede.
8. **Agendar 2 tarefas** (providência, conclusão igual ao limite):
    - **NOVA DEMANDA - ANALISAR/INFORMAR CLIENTE - CAPTURADO AUTOMATICAMENTE**, no dia da
      abertura. Descrição: "Processo capturado pelo sistema de novas demandas, favor analisá-lo."
      Responsáveis: responsável e auxiliar da pasta, Giancarlo Murta Zotini, Isadora Godoy Conte e
      Samuel.
    - **ATUALIZAÇÃO DE CADASTRO**, no próximo dia útil. Descrição: "Completar os dados da pasta,
      visto que fora realizado distribuiçao." Responsáveis: Isadora, Maria Heloiza, Maria Julia,
      Marina Silva Pinelli e Samuel.
    - A **CIÊNCIA DA ABERTURA DE PASTA** o VIOS cria sozinho.
9. **Relatório:** tabela das pastas abertas (CI, cliente, ação, área, par, valor) e das capturas
   que ficaram de fora, com o motivo. Não reabra as de fora sem pedido.

Depois da abertura, o jurídico responde a tarefa de nova demanda: "Escritório atuará?" (sim cria
acompanhamento semanal; não encerra a pasta) e "Demanda de risco?" (sim põe a etiqueta). Isso não
é feito na abertura.

## Cuidados

- Confira o documento antes de tudo: a captura é por nome e traz homônimos.
- Nome diferente com o mesmo CPF/CNPJ de cliente ativo pode abrir (ex.: CI 60372). Razão
  social igual com outro CNPJ, ou filial de cliente inativo, não abre.
- Vara sem número (ex.: Vara das Execuções Fiscais Estaduais): deixe a vara numérica vazia.
- Desde 09/11/2026, parte das pastas de Insolvência passou para Recuperação de Crédito (skill
  `vios-transferir-pastas`). Ao copiar o par de um grupo, veja onde estão as pastas vivas dele
  hoje.
- Gravações no VIOS só com o ok do usuário no chat. Se a sessão cair, pare e peça o login.
