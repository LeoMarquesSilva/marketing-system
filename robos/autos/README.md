# Robô de autos

Baixa os autos dos processos no tribunal e entrega o PDF ao ORQESTRAI, onde a IA lê e deixa sugestões para uma pessoa aprovar. Roda **fora da Vercel**, numa máquina do escritório, com Node e Playwright, ou num contêiner no servidor (Easypanel): veja [Servidor (Easypanel)](#servidor-easypanel).

Conectores prontos: **e-SAJ do TJSP, TJCE, TJAL e TJMS** (`src/conectores/esaj.ts`; endereços em `TRIBUNAIS_ESAJ`, em `esaj-urls.ts`) **eproc do TJSP e do TJRJ** (`src/conectores/eproc.ts`; instalações e SSO em `TRIBUNAIS_EPROC`, em `eproc-urls.ts`) **DCP e PJe (1º grau) do TJRJ** (`src/conectores/dcp-tjrj.ts`, `src/conectores/pje.ts`; veja [DCP e PJe do TJRJ](#dcp-e-pje-do-tjrj-mapear-e-rascunhos)). Os próximos (Projudi, PJe de outros tribunais) entram em `src/conectores/`, um por sistema de tribunal.

## Como funciona

1. Na ficha do processo, alguém clica em **Pedir ao robô**. O pedido entra na fila `proc_autos_pedidos`.
2. O robô pergunta ao ORQESTRAI pelo próximo pedido (`POST /api/robos/autos/proximo`), abre o tribunal com a sessão do advogado, consulta o processo, abre a pasta digital e pede o PDF em arquivo único.
3. O PDF sobe direto ao bucket privado `processos-autos` por URL assinada e o pedido é concluído. O arquivo não fica na máquina do robô.
4. O ORQESTRAI lê o PDF com a IA e mostra as sugestões na ficha. Nada é gravado sem aprovação.
5. O PDF é temporário também no ORQESTRAI: sai do bucket quando a última sugestão dele é decidida, ou depois de 7 dias (`PROCESSOS_AUTOS_DIAS`). Ficam as sugestões, com a página e o trecho de onde saíram.

O robô fala só com as rotas `/api/robos/autos` do ORQESTRAI, com um token próprio. Ele **não** recebe a chave do banco.

## Capa pelo DataJud

Com a fila de autos vazia, o robô pede ao ORQESTRAI a capa do próximo processo no DataJud, a API pública do CNJ: justiça e UF (pelo número), jurisdição, cidade, vara, distribuição, processo eletrônico, segredo de justiça e último andamento. O que falta no cadastro vira **sugestão** na ficha, para uma pessoa aprovar, como as sugestões da IA.

O DataJud é lento (20 a 55 segundos por processo, medido em 10/11/2026) e recusa consultas em sequência. Por isso o robô consulta um processo por vez, com pausa de 30 segundos (`PAUSA_CAPA_SEGUNDOS`). Se o DataJud recusar, ele espera 10 minutos. Os ativos e os nunca consultados vêm primeiro; cada processo é consultado de novo uma vez por semana. O piloto inteiro leva cerca de duas horas. `CAPA_DATAJUD=nao` desliga.

Na ficha, o botão **Completar capa** (painel Saneamento) faz a mesma consulta para um processo, na hora.

## Regras que o robô segue

- **A credencial é do advogado.** Certificado, CPF e senha existem só na máquina do robô (no Mac, arquivo `.env` e pasta `perfil/`; no servidor, as variáveis e montagens do Easypanel), sempre fora do repositório. Nada disso é enviado ao ORQESTRAI, gravado no banco ou escrito em log.
- **Segundo fator e CAPTCHA não são contornados.** Quando o tribunal pede o código de verificação ou mostra um desafio, o robô para, marca o pedido como "aguardando pessoa" (aparece na ficha), toca um aviso no terminal e espera alguém resolver na janela dele. Depois segue sozinho.
- **Segredo de justiça não é baixado sem liberação.** Se o cadastro ou a página do tribunal marcam o processo como segredo de justiça, o pedido fica parado até alguém clicar em "Liberar o download" na ficha. A liberação fica no histórico, com o nome de quem liberou.
- **Sem senha de processo.** Se o e-SAJ pedir a senha do processo para abrir os autos (o advogado não está habilitado), o pedido volta com erro e o PDF é anexado à mão.
- **Um processo por vez**, com pausa entre um e outro, para não sobrecarregar o tribunal.

## O que precisa na máquina

- Node 20.11 ou mais novo.
- Google Chrome instalado. O robô abre o Chrome como um navegador comum, com um perfil só dele (em `perfil/`), e se conecta a ele por uma porta de depuração local (127.0.0.1, sorteada a cada execução). Aberto pelo modo de automação do Playwright, o Chrome não deixa instalar extensão, e o login por certificado precisa da extensão Web Signer.
- Para login com certificado: o **Web Signer** da Softplan instalado no sistema, a extensão Web Signer instalada **no perfil do robô** (passo 3 abaixo) e o certificado do advogado disponível na máquina (no macOS, no Acesso às Chaves).

## Instalação

```bash
cd robos/autos
npm install
cp .env.example .env
```

Edite o `.env`:

| Variável | O que é |
|---|---|
| `ORQESTRAI_URL` | Endereço do ORQESTRAI: o de produção ou `http://localhost:3000` em desenvolvimento. |
| `ROBO_AUTOS_TOKEN` | O mesmo valor configurado no ORQESTRAI (Vercel → Environment Variables → `ROBO_AUTOS_TOKEN`), com 24 caracteres ou mais. Gere com `openssl rand -hex 32`. Sem essa variável no servidor, as rotas do robô respondem 503. |
| `ROBO_NOME` | Nome desta máquina, como aparece na ficha. |
| `ESAJ_LOGIN` | `certificado`, `senha` ou `manual` (veja abaixo). |
| `ESAJ_CERTIFICADO` | Trecho do nome do certificado, como aparece na lista do e-SAJ (modo `certificado`). |
| `ESAJ_USUARIO`, `ESAJ_SENHA` | Só no modo `senha`. |
| `EPROC_LOGIN` | Login no eproc do TJSP: `certificado`, `senha` ou `manual`. Sem ela, vale o `ESAJ_LOGIN`. |
| `EPROC_USUARIO`, `EPROC_SENHA` | Só no modo `senha` do eproc. |
| `EPROC_TJRJ_LOGIN` | Login no eproc do TJRJ: `certificado`, `senha` ou `manual`. Sem ela, vale o `EPROC_LOGIN` (e `senha` sem usuário e senha do TJRJ vira `manual`). |
| `EPROC_TJRJ_USUARIO`, `EPROC_TJRJ_SENHA` | Só no modo `senha` do eproc do TJRJ (o cadastro do advogado no TJRJ é outro, com senha própria). |
| `ROBO_CONECTORES` | Opcional. Conectores que este robô atende (`eproc`, `esaj`, `esaj:TJCE`…); vazio = todos. Serve para dividir o trabalho entre o robô do Mac e o do servidor. |

As variáveis do servidor (`NAVEGADOR_MODO`, `PASTA_DADOS`, `CERTIFICADO_*`, `VNC_SENHA`…) estão no `.env.example` e em [docs/easypanel.md](docs/easypanel.md). Sem elas, o robô funciona como descrito aqui.

### Modos de login no e-SAJ

- `certificado` (recomendado): o robô abre a aba "Certificado digital", espera o Web Signer carregar a lista (até 30 segundos), escolhe o certificado cujo nome contém `ESAJ_CERTIFICADO` e clica em Entrar. Com o certificado A1 instalado na máquina, o login leva poucos segundos e ninguém precisa clicar. Se houver mais de um candidato, ou nenhum, ele deixa a escolha para a pessoa. O sistema operacional pode pedir permissão para usar a chave do certificado: autorize na janela.
- `senha`: o robô preenche CPF e senha e para no código de verificação, que o advogado informa na janela.
- `manual`: o robô só abre a página de login e espera uma pessoa entrar, do jeito que ela preferir.

A sessão do e-SAJ vale enquanto o Chrome do robô estiver aberto: o tribunal usa um cookie de sessão, que se perde quando o navegador fecha. Por isso cada vez que o robô é iniciado há um login (no modo `certificado`, ele mesmo faz; nos outros, espera a pessoa). Deixar o robô rodando (`npm run robo`) evita logins repetidos.

### eproc do TJSP

O eproc do TJSP tem uma instalação por competência (1º grau cível; execução fiscal e Fazenda Pública; 2º grau), todas atrás do mesmo login, o SSO do tribunal. O robô procura o processo nessa ordem (o número com origem `0000` começa pelo 2º grau) e entra pela pesquisa rápida da capa.

- **Login com certificado:** o robô clica em "Certificado digital" e o Chrome mostra a **lista de certificados dele** (janela do próprio navegador, que o robô não toca). A pessoa escolhe o certificado do advogado e clica em OK. Enquanto o Chrome do robô ficar aberto, a sessão vale para todas as instalações.
- **Login com certificado em arquivo** (servidor): com `NAVEGADOR_MODO=playwright` e o `.pfx` em `CERTIFICADO_PFX` ou `CERTIFICADO_PASTA`, o próprio robô apresenta o certificado ao SSO (`certificado-sso.tjsp.jus.br`), sem a lista do Chrome. Depois vem o código de 2 fatores, pelo webhook ou pela pessoa. Detalhes em [docs/easypanel.md](docs/easypanel.md).
- **Login com senha:** o robô preenche usuário e senha e para no código de verificação, se o tribunal pedir.
- **Os autos:** o eproc não tem botão para baixar o processo inteiro. O robô baixa cada documento da tabela de eventos com a sessão do advogado e monta um PDF único, do evento mais antigo para o mais novo, com um índice na primeira página (evento, documento e página onde começa). Documento que não é PDF nem imagem (vídeo, áudio, página) vira uma página de aviso no lugar.
- **Acesso à íntegra:** quando o advogado não representa nenhuma parte, o eproc só libera os documentos pela "Acesso à íntegra do processo", que é uma declaração de interesse (Res. CNJ 121/2010) com CAPTCHA. O robô não faz essa declaração: o pedido volta com erro e o PDF é anexado à mão.

Para conferir a tela antes de baixar: `npm run inspecionar -- eproc 0000000-00.0000.8.26.0000`. Para abrir só a sessão: `npm run login -- eproc`.

### TJRJ (eproc)

O TJRJ tem três sistemas, e o mesmo número CNJ (`…8.19.…`) pode estar em qualquer um deles:

- **DCP**, o sistema próprio, operado pelo advogado no **Portal de Serviços** (`www3.tjrj.jus.br/portalservicos`; login no `idserverjus` com usuário e senha mais duplo fator, ou certificado). É o "Próprio" do cadastro do VIOS.
- **PJe** (`tjrj.pje.jus.br`, login pelo SSO nacional da PDPJ), usado nas varas cíveis e juizados de 2019 a 2026.
- **eproc** (`eproc1g.tjrj.jus.br` e `eproc2g.tjrj.jus.br`, login em `eproc-sso.tjrj.jus.br`): desde maio de 2026 recebe todo processo cível novo, e o tribunal está migrando para ele o acervo do DCP e do PJe, com o mesmo número CNJ (1,3 milhão de processos migrados em 18/11/2026). Os juizados cíveis entram de 10/12/2026 a 2027.

Por isso o ORQESTRAI manda o "Próprio" do TJRJ ao conector `dcp:TJRJ`, o PJe ao `pje:TJRJ` e o resto (eproc, sem sistema) ao `eproc:TJRJ`. O DCP e o PJe, quando o processo já migrou, seguem pelo eproc no mesmo pedido e avisam o ORQESTRAI, que manda as atualizações seguintes direto ao eproc.

- **Login:** o mesmo desenho do TJSP (SSO Keycloak com usuário e senha, ou "Certificado Digital"), com cadastro e senha próprios do advogado no TJRJ (`EPROC_TJRJ_*`). No caminho, o navegador passa pelo SSO nacional da PDPJ (`sso.cloud.pje.jus.br`), que redireciona sozinho para o SSO do TJRJ.
- **2 fatores:** o eproc do TJRJ tem autenticação em dois fatores, como o do TJSP. Com o webhook configurado, o robô pede o código com `?sistema=eproc-tjrj` (o segredo do TOTP do TJRJ é outro); sem ele, ou se o webhook não conhecer esse sistema, a pessoa digita o código.
- **Certificado em arquivo (servidor):** o endereço que pede o certificado no login do TJRJ não foi conferido. Ache-o no primeiro teste (a captura do `diagnostico/` mostra o endereço) e acrescente a origem em `CERTIFICADO_ORIGENS`, junto com a do TJSP.
- **Consulta pública:** existe, mas tem CAPTCHA (Cloudflare Turnstile). O robô não usa: entra sempre com a sessão do advogado.

Para conferir: `npm run inspecionar -- eproc 0000000-00.0000.8.19.0000`. Para abrir só a sessão: `npm run login -- eproc TJRJ`.

### DCP e PJe do TJRJ (mapear e rascunhos)

**DCP (ligado desde 18/11/2026).** Telas vistas no mapa com a sessão do advogado (detalhes em `dcp-tjrj-urls.ts`):

- **Login:** sempre da pessoa, na janela do robô. Depois do login o portal abre **numa janela própria** (popup); a janela do login volta para a página inicial do tribunal. O robô trabalha na janela do portal e a deixa aberta: os pedidos seguintes aproveitam a sessão.
- **Consulta:** a busca fica num iframe (`www3.tjrj.jus.br/consultaprocessual`). O robô digita o número nos dois campos em volta de ".8.19." e chega direto aos "Detalhes do Processo".
- **Autos:** "Processo Eletrônico - Visualizador" abre o visualizador numa aba nova. O índice tem uma caixa por peça numerada ("11 - Procuração"); o robô marca só as peças que ainda não vieram (todas, no primeiro download) e usa "Salvar Documentos Selecionados". O PDF chega como download em segundos. Sem peça nova, o pedido termina sem PDF ("nada novo").
- **Migrado para o eproc:** o conector segue pelo `eproc:TJRJ` no mesmo pedido.

Para conferir sem baixar: `npm run inspecionar -- dcp 0000000-00.0000.8.19.0000`.

**PJe do TJRJ, 1º grau (ligado desde 18/11/2026).** Telas vistas com a sessão do advogado (detalhes em `pje.ts` e `pje-urls.ts`):

- **Login:** sempre da pessoa (SSO da PDPJ com o código do Microsoft Authenticator, PJe Office ou gov.br), numa aba própria do robô, que fica aberta.
- **Consulta:** `Processo/ConsultaProcesso/listView.seam`, número em campos separados. A situação na lista já diz "Migrada a tramitação do processo… para o outro sistema eletrônico" quando o processo foi para o eproc: aí o pedido segue pelo `eproc:TJRJ`.
- **Autos:** o número abre os autos numa janela de nome fixo (o robô fecha a que sobrar antes). A linha do tempo mostra cada documento com o Id.
- **Download:** "Download autos do processo" com "ID a partir de" = maior Id já baixado + 1. O PJe monta o PDF e o abre com `window.open` (link assinado e temporário), que o Chrome barra como popup: o robô pega o link na aba dos autos e baixa. Às vezes o PDF vai para a "Área de download"; aí o robô baixa de lá quando fica "Concluído".

Para conferir sem baixar: `npm run inspecionar -- pje 0000000-00.0000.8.19.0000`. O 2º grau (login próprio) ainda não foi mapeado.

O que se sabe hoje (fontes públicas do tribunal, conferidas em 18/11/2026):

| | DCP (Portal de Serviços) | PJe |
|---|---|---|
| Login | `www3.tjrj.jus.br/idserverjus-front` com `sgSist=PORTALSERVICOS`: usuário (geralmente o CPF) e senha, ou Certificado Digital (`www7.tjrj.jus.br/autenticadorCertDigital`). Duplo fator obrigatório para advogados; a tela carrega reCAPTCHA. | 1º grau: `tjrj.pje.jus.br/1g/login.seam` → SSO da PDPJ (`sso.cloud.pje.jus.br`): CPF/CNPJ e senha, "CERTIFICADO DIGITAL" (PJe Office) ou gov.br; código do Microsoft Authenticator. 2º grau: `tjrj.pje.jus.br/2g/login.seam`, login próprio (versão 2.1). |
| Consulta | Menu "Consultas" > "Consultas Processuais" > aba "Por Número" → "Detalhes do Processo". | Aba "Consultar Processos" (ou "Processo" > "Consultar processo"), "Pesquisar", clicar no número: os "Autos Digitais" abrem em outra aba. |
| Autos | "Processo Eletrônico – Novo Visualizador" > ícone "Baixar o Processo Atual em PDF" > "Salvar processo completo" (ou "Salvar documentos selecionados"). Processo volumoso só tem o Antigo Visualizador. | Ícone de download do processo, "por Id, Período ou todo o conteúdo"; download por documento; cabeçalho com "Segredo de justiça". |
| Migrado para o eproc | Aviso com "Acessar eproc" / "Ir para o eproc". | "Processo migrado para o eproc, acesse-o através do link…"; peticionamento bloqueado. |

Fontes: manual "Novo Visualizador de Processo Eletrônico" (VISPROCELET, TJRJ, 2021); manual do Portal de Serviços (TJRJ); flashcard "Processos Migrados do DCP para o eproc – Portal de Serviços" (TJRJ, v1.4); manual do usuário externo PJe Advogado/Parte (TJRJ, v1.4); "Manual de Novo Acesso ao PJe" (MFA, TJRJ); Dica de Sistema "Migração PJe x eproc" (TJRJ); manual do advogado do PJe (docs.pje.jus.br); telas públicas de login do IdServerJus e do PJe.

**Mapear.** Antes de ligar os conectores, uma sessão com o advogado (ou quem tem o acesso dele):

```bash
npm run mapear -- dcp 0000000-00.0000.8.19.0000
npm run mapear -- pje 0000000-00.0000.8.19.0000        # 1º grau; acrescente 2g para o 2º grau
```

1. Pare o robô, se estiver ligado (Ctrl+C na aba dele): o mapear usa o mesmo Chrome e o mesmo perfil, e recusa começar com o robô aberto. Ligue o robô de novo no fim.
2. O Chrome do robô abre na tela de login. **A pessoa entra**, do jeito que preferir (senha, certificado, código do segundo fator, CAPTCHA). O robô não digita senha nem código e não resolve CAPTCHA: ele só percebe que a tela saiu do login. Se não perceber, a pessoa aperta Enter no terminal depois de entrar.
3. O robô percorre a consulta sozinho: menu, pesquisa pelo número (o único texto que ele digita), resultado, processo, movimentos, visualizador ou autos digitais e as opções de download. Quando não acha o caminho, avisa no terminal ("MAPEAMENTO: …"): a pessoa faz aquele passo na janela e aperta Enter (ou digita `pular`).
4. Cada tela vira captura (`.png`), HTML e um JSON com os controles (botões, links, campos, tabelas, quadros) em `diagnostico/`, com nomes `…mapa-dcp-03-pesquisa-por-numero…`. No fim, um resumo `mapa-<sistema>-00-resumo-….json` lista os passos.
5. **Nada é baixado nem enviado.** Durante o mapa o download do navegador fica bloqueado, e o robô nunca clica no botão que conclui o download ("Download", "Salvar processo completo"…): no máximo abre a janela de opções para descrevê-la e cancela. Diálogos do tribunal depois do login (alerta de acesso, declaração) são registrados e cancelados, nunca confirmados.

Se o processo já tiver migrado para o eproc, o mapa registra o aviso e para: o pedido dele vai pelo `eproc:TJRJ`.

Observado no mapa do DCP: o Enter no terminal nem sempre chega ao mapa (no painel de terminal do app, por exemplo). Se o mapa ficar parado num passo, as telas podem ser lidas pela porta de depuração do Chrome do robô (`perfil/DevToolsActivePort`) sem fechar o navegador.

## Primeiro uso

1. Confira o `.env`.
2. Abra a sessão do tribunal com calma:

   ```bash
   npm run login
   ```

   O Chrome do robô abre na página de login do e-SAJ do TJSP. Para outro tribunal: `npm run login -- TJCE`. Cada tribunal tem a própria sessão; no dia a dia o robô entra em cada um quando aparece o primeiro pedido dele.
3. Só na primeira vez, com certificado: se o e-SAJ avisar que o Web Signer não está instalado, clique no botão do próprio aviso, instale a extensão **nesta janela** e recarregue a página. A extensão fica no perfil do robô.
4. Conclua o login. O terminal mostra "Sessão do tribunal aberta" e o navegador fecha. Esse passo serve para instalar a extensão e conferir que o certificado funciona; o login vale de novo a cada início do robô.
5. Antes de baixar de verdade, vale conferir se a tela do tribunal está como o conector espera:

   ```bash
   npm run inspecionar -- 0000000-00.0000.8.26.0000
   ```

   O robô abre o processo e a pasta digital, sem pedir o PDF, e guarda em `diagnostico/` uma captura de cada tela e a lista de botões que encontrou.

## Uso

```bash
npm run robo       # fica rodando e atende a fila
npm run uma-vez    # atende o que estiver na fila e sai
```

Deixe a janela do terminal e a do Chrome do robô abertas. Para parar, `Ctrl+C`. No macOS, `caffeinate -i npm run robo` impede a máquina de dormir enquanto o robô roda.

Na ficha do processo, o painel **Autos** mostra a situação do pedido: na fila, baixando, aguardando pessoa (com o motivo), erro (com a mensagem do robô) ou o PDF já entregue.

## Quando algo dá errado

| O que aparece | O que fazer |
|---|---|
| "PRECISA DE UMA PESSOA" no terminal | Resolva o que a mensagem pede (login, código, CAPTCHA) na janela do Chrome do robô. Ele espera `ESPERA_PESSOA_MINUTOS` (15 por padrão); passado o tempo, o pedido continua "aguardando pessoa" e o robô tenta de novo mais tarde. |
| "O e-SAJ pede a senha do processo" | O advogado do certificado não está habilitado naquele processo. Anexe o PDF à mão na ficha. |
| "A tela do e-SAJ mudou ou não carregou" | O tribunal mudou a página. A mensagem aponta a captura guardada em `diagnostico/`; ajuste os seletores em `src/conectores/esaj.ts` (constante `TELA`). |
| "não mostrou o processo" | Número de outro sistema (processos novos do TJSP estão no eproc; no TJRJ, processo que ainda não migrou do DCP ou do PJe), segredo de justiça sem acesso do advogado, ou número com mais de um processo. |
| PDF com mais de 200 MB | Passa do limite do bucket. Baixe em partes e anexe à mão. |
| "O navegador do robô não respondeu" | Ficou uma janela do Chrome do robô aberta de uma execução anterior. Feche-a e rode de novo. |
| "ORQESTRAI respondeu 401" ou 503 | `ROBO_AUTOS_TOKEN` diferente do servidor, ou não configurado nele. |

`diagnostico/` guarda capturas e HTML das telas do tribunal, que podem conter dados de processos. A pasta fica só na máquina do robô e fora do repositório; apague o que não for mais útil.

## Servidor (Easypanel)

O robô também roda num contêiner (`Dockerfile` nesta pasta), com o navegador numa tela virtual que a pessoa vê pelo navegador (noVNC) quando precisa resolver login, código ou CAPTCHA. No servidor, o eproc entra com o certificado A1 em arquivo, enviado pelo painel de robôs; o e-SAJ depende do Web Signer, que não tem uso confirmado em Linux, e por isso fica no Mac ou entra por CPF e senha. O estudo completo, o passo a passo no Easypanel e o contrato com o painel de robôs estão em [docs/easypanel.md](docs/easypanel.md).

## Pastas

| Pasta | Conteúdo | No repositório? |
|---|---|---|
| `src/` | Código do robô. `conectores/esaj.ts` é o e-SAJ; `conectores/esaj-urls.ts` é a parte sem navegador, com testes (`npx vitest run robos` na raiz). | Sim |
| `perfil/` | Perfil do Chrome do robô: sessão do tribunal e extensão Web Signer. | Não |
| `downloads/` | PDF em trânsito; é apagado depois de subir ao ORQESTRAI. | Não |
| `diagnostico/` | Capturas para ajustar o conector, e os mapas do `npm run mapear`. | Não |
| `.env` | Configuração e, no modo `senha`, a credencial do advogado. | Não |
| `Dockerfile`, `docker/` | Imagem do servidor, script de início e exemplo de serviço. | Sim |
| `docs/` | Estudo e guia do servidor (Easypanel). | Sim |

## Novo conector

1. Sistema que o robô nunca viu: comece pelo mapa (`npm run mapear`, seção [DCP e PJe do TJRJ](#dcp-e-pje-do-tjrj-mapear-e-rascunhos)); o roteiro de cada sistema fica no próprio conector (`mapearDcp`, `mapearPje`).
2. Crie `src/conectores/<sistema>.ts` implementando `Conector` (`src/conectores/tipos.ts`): `chave` no formato `sistema:TRIBUNAL`, `entrar` e `baixar`.
3. Use `ambiente.aguardarPessoa(...)` em login, segundo fator e CAPTCHA, e lance `SegredoDeJustica` quando o processo for sigiloso e `pedido.segredoLiberado` for falso.
4. Inclua o conector em `CONECTORES` (`src/index.ts`) e o tribunal em `CONECTORES_DISPONIVEIS` (`src/lib/processos/tribunais.ts`, no ORQESTRAI), que é o que libera o botão "Pedir ao robô" na ficha.

## Pauta de Audiências (`npm run pauta`)

Lê a "Minha Pauta" do PJe da Justiça do Trabalho com a sessão do advogado e manda ao ORQESTRAI (`POST /api/robos/pauta`, mesmo `ROBO_AUTOS_TOKEN`). Só leitura.

- `PAUTA_TRIBUNAIS` (padrão `TRT15`): tribunais lidos, separados por vírgula (`TRT15,TRT2`).
- `PAUTA_DIAS` (padrão 60): quantos dias à frente.
- `npm run pauta -- --so-ler`: teste de acesso. Entra, lê e mostra quantas audiências achou, sem mandar nada ao ORQESTRAI.
- `npm run pauta -- --ciclo`: fica rodando e lê nos horários de `PAUTA_HORARIOS` (padrão `06:45,11:45,16:45`).
- Login pelo SSO da PDPJ ("Entrar com PDPJ"):
  - `PDPJ_LOGIN=manual` (padrão): a pessoa entra na janela do robô (no Mac, com o certificado pelo PJe Office; no servidor, com CPF e senha pela tela remota).
  - `PDPJ_LOGIN=senha`: o robô preenche `PDPJ_USUARIO` (CPF) e `PDPJ_SENHA`, que ficam só no ambiente da máquina do robô.
  - O código de 2 fatores vem de `ROBO_2FA_WEBHOOK_URL` com `?sistema=pdpj`, se houver.
- O navegador fica aberto no fim para a próxima rodada aproveitar a sessão (`-- --fechar` fecha).
- No servidor (Easypanel): comandos `pauta-teste`, `pauta` e `pauta-ciclo`; passo a passo em `docs/easypanel.md`.
