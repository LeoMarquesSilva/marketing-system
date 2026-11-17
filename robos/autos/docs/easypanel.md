# Robô de autos no servidor (Easypanel)

Estudo de 17/11/2026 sobre rodar o robô de autos num contêiner no Easypanel em vez do Mac, e guia para fazer isso. Nada foi publicado: o código está pronto e testado só localmente.

## Veredito

**Dá, para o eproc do TJSP. Para o e-SAJ, ainda não com certificado.**

- **eproc do TJSP:** dá para rodar inteiro no servidor. O Playwright apresenta o certificado A1 (.pfx) ao SSO do tribunal sozinho, sem a lista de certificados do Chrome. Depois do certificado vem o código de 2 fatores, que o robô já busca no webhook do n8n (ou uma pessoa digita pela tela remota). Testado localmente com um servidor que exige certificado de cliente; falta o teste com o certificado e o tribunal de verdade.
- **e-SAJ (TJSP, TJCE, TJAL, TJMS):** o login por certificado depende do Web Signer da Softplan (extensão e aplicativo do computador). Não achei fonte oficial atual de que ele funcione em Linux, e muito menos num contêiner. As saídas são: (1) deixar o e-SAJ no robô do Mac e o eproc no servidor (o robô agora aceita `ROBO_CONECTORES` para dividir o trabalho); (2) entrar no e-SAJ por CPF e senha, com o código que o tribunal manda por e-mail digitado por uma pessoa pela tela remota; (3) testar o Web Signer em Linux num piloto separado.
- **Pessoa no circuito:** quando o robô precisa de alguém (login, código, CAPTCHA), a pessoa abre a tela do robô no navegador (noVNC), protegida por HTTPS e senha no Easypanel. O robô continua sem resolver CAPTCHA sozinho.
- **Certificado no servidor:** decidido pelo usuário: a cópia do A1 vai também para o servidor, enviada pelo painel de robôs. O robô está pronto para ler o certificado de uma pasta que o painel grava (contrato na seção [Painel de robôs](#painel-de-robôs-envio-do-certificado)).
- **Depende de outra entrega:** as rotas `/api/robos/autos/*` só existem nesta branch. O robô do servidor só funciona depois que ela estiver em produção no ORQESTRAI.

## O que foi verificado e o que não foi

| Ponto | Situação |
|---|---|
| `clientCertificates` do Playwright (desde a v1.46; o robô usa a 1.65.0) com `.pfx` e senha, no navegador e nas requisições do contexto (`contexto.request`, usado pelo eproc para baixar documentos) | **Testado aqui**, com um servidor TLS local que exige certificado de cliente e um certificado de teste descartável: o servidor recebeu o certificado nas duas vias. |
| O intermediário do Playwright confere o certificado do servidor do tribunal | **Testado aqui**: com um servidor de certificado não confiável, ele recusou a conexão. |
| `certificado-sso.tjsp.jus.br` pede certificado de cliente já no aperto de mão TLS, aceita autoridades da ICP-Brasil, e tem certificado de servidor numa cadeia pública (o Node confia sem configuração extra) | **Verificado** com uma conexão TLS pública ao endereço, sem login. `sso.tjsp.jus.br` e `esaj.tjsp.jus.br` não pedem certificado de cliente. |
| Senha errada e `.pfx` com cifra antiga (RC2) | **Testado aqui**: o robô recusa com mensagem clara e sem mostrar a senha. Um `.pfx` exportado com RC2 não abre no Node; com AES-256, abre. |
| Contrato do painel (pasta, `certificado.json`, senha cifrada) e troca do certificado | **Testado aqui** (teste automático em `src/certificado.test.ts` e teste local de ponta a ponta). |
| Imagem `mcr.microsoft.com/playwright:v1.65.0-noble` existe e traz Node e o usuário `pwuser` | **Verificado** na lista de tags do registro da Microsoft e no Dockerfile da imagem no repositório do Playwright. |
| Login real no eproc com o certificado do advogado | **Não verificado** (não foi feito login em nada). |
| Build da imagem (`docker build`) e funcionamento de Xvfb, x11vnc e noVNC no contêiner | **Não verificado** (Docker não foi usado neste estudo). |
| Web Signer em Linux | **Não confirmado**: a página de pré-requisitos do e-SAJ cita Linux baseado em Ubuntu (com Firefox 32 bits), texto sem data e antigo; a página de download da Softplan não abriu (cadeia de certificado incompleta no site). |
| Bloqueio de IP de datacenter pelo TJSP | **Sem fonte oficial atual.** Ver [Rede](#rede-e-destino). |
| Comportamento do Easypanel com volume compartilhado entre dois serviços e com reinício automático | **Não documentado** na página oficial de serviços; ver [Operação](#operação). |

## Como fica

```
Easypanel (mesmo servidor)
├── painel de robôs ──grava──► /srv/robos/certificados (pasta do servidor)
│                                     │ só leitura
└── robô de autos (contêiner) ◄──────┘
      ├── Chromium numa tela virtual (Xvfb) ──► eproc / e-SAJ
      ├── noVNC na porta 6080 ──► domínio HTTPS com Basic Auth (pessoa no circuito)
      └── volume /dados (perfil, PDFs em trânsito, diagnósticos)
            │
            └── fila e entrega do PDF ──► ORQESTRAI (Vercel) /api/robos/autos
```

## Navegador no contêiner

- **Imagem:** `mcr.microsoft.com/playwright:v1.65.0-noble`, fixa na mesma versão do pacote `playwright` do `package-lock.json`. Com versões diferentes o Playwright não acha o navegador; ao atualizar o pacote, atualize o `Dockerfile` junto.
- **Modo do navegador:** `NAVEGADOR_MODO=playwright`. No Mac o robô abre o Chrome como um navegador comum e se conecta a ele, porque só assim dá para instalar a extensão Web Signer. No servidor quem abre é o Playwright, e é esse modo que aceita o certificado em arquivo (`clientCertificates`). O Mac continua no modo antigo quando a variável não existe.
- **Com janela, numa tela virtual:** o Chromium roda com janela numa tela Xvfb (1366×900). Sem janela (`NAVEGADOR_HEADLESS=sim`) ninguém consegue resolver login, código ou CAPTCHA, e sites de tribunal tendem a estranhar navegador sem janela. Fica disponível, mas não é o recomendado.
- **Perfil persistente no volume:** `PASTA_DADOS=/dados` leva `perfil/`, `downloads/` e `diagnostico/` para o volume. Um contêiner novo tem outro nome de máquina e o Chrome acharia o perfil "em uso"; o script de início apaga essa trava, o que é seguro porque só existe um robô por volume.
- **Usuário:** o script de início roda como root só para acertar o dono do volume e copiar a chave do robô; o navegador e o robô rodam como `pwuser`. O Playwright desliga o sandbox do Chromium por padrão (`--no-sandbox`) e usa `--disable-dev-shm-usage`, o que evita depender de `--ipc=host`, que o Easypanel não oferece.

## Pessoa no circuito

Quando o robô chama `aguardarPessoa`, o pedido fica "aguardando pessoa" na ficha (como hoje) e o log mostra `TELA_REMOTA_URL`. A pessoa abre esse endereço, vê a janela do robô e resolve.

Opções pesadas:

| Opção | Como | Segurança | Recomendação |
|---|---|---|---|
| **noVNC atrás do proxy do Easypanel** | x11vnc lê a tela virtual; websockify + noVNC servem a tela pelo navegador na porta 6080; domínio HTTPS do Easypanel com **Basic Auth** (aba Security) | Três barreiras: HTTPS, Basic Auth no proxy e senha do VNC. O VNC só escuta dentro do contêiner. A senha do VNC usa só 8 caracteres: a proteção real é o Basic Auth com senha forte. | **Recomendada.** É o que o `Dockerfile` monta. |
| noVNC sem domínio, por túnel SSH | Porta 6080 publicada só em 127.0.0.1 do servidor; a pessoa abre um túnel SSH | Mais fechada, mas exige acesso SSH ao servidor para cada pessoa que for resolver | Boa para o técnico; ruim para o advogado. |
| Porta publicada direto na internet | — | Expõe a sessão logada do advogado | **Não usar.** |

Por que pesar tanto: quem entra na tela remota vê o navegador **logado como o advogado** no eproc (e no e-SAJ). Dali dá para consultar qualquer processo a que ele tenha acesso e até peticionar. Por isso:

- Basic Auth com usuário e senha fortes, compartilhados só com quem resolve (advogado e operador). Se o Easypanel permitir, restrinja também por IP (middleware do Traefik no domínio).
- `VNC_SENHA` diferente da senha do Basic Auth. Sem `VNC_SENHA`, a tela remota nem sobe.
- Dá para desligar o domínio da tela quando ninguém precisa dela; o robô segue rodando e os pedidos ficam "aguardando pessoa".

## Certificado digital

### eproc do TJSP: certificado em arquivo

- O SSO do eproc pede o certificado no endereço `certificado-sso.tjsp.jus.br`, já no aperto de mão TLS (conferido). É exatamente o caso do `clientCertificates` do Playwright: ele recebe o `.pfx` e a senha e apresenta o certificado só às origens indicadas. O padrão do robô é `CERTIFICADO_ORIGENS=https://certificado-sso.tjsp.jus.br`; os demais sites passam direto, sem certificado.
- Como funciona por dentro: o Playwright põe um intermediário local entre o navegador e a internet. Para a origem do certificado, ele abre a conexão com o tribunal apresentando o `.pfx` e confere o certificado do servidor do tribunal. O Chrome não mostra a lista de certificados.
- Depois do certificado, o eproc pede o código de 2 fatores. O robô já busca o código no webhook do n8n (`ROBO_2FA_WEBHOOK_*`) ou espera a pessoa pela tela remota.
- **Formato do .pfx:** o Node (OpenSSL 3) não abre `.pfx` exportado com a cifra antiga RC2, comum em exportações antigas. O robô avisa ("cifra antiga"). A correção é exportar de novo com AES-256; o painel pode fazer isso sozinho ao receber o arquivo (ver o contrato).

### e-SAJ: Web Signer

- O login por certificado no e-SAJ não é certificado de cliente TLS: a página pede ao **Web Signer** (extensão do navegador + aplicativo instalado no computador) que assine um desafio. O `clientCertificates` não serve para isso.
- O Web Signer não instala com o navegador aberto pelo Playwright (a Chrome Web Store recusa navegador em modo de automação; é por isso que o Mac usa o modo comum).
- Em Linux: a página de pré-requisitos do e-SAJ lista "Linux 32 bits ou 64 bits de distribuição baseada no Ubuntu", ligado ao Firefox 32 bits, sem data. A ajuda da Softplan sobre instalação no Chrome não fala de Linux. A página de download da Softplan não abriu neste estudo. **Não dá para afirmar que funciona num contêiner.**
- **Alternativas, em ordem de simplicidade:**
  1. **Dividir o trabalho:** robô do servidor com `ROBO_CONECTORES=eproc` e robô do Mac com `ROBO_CONECTORES=esaj`. O Mac continua com o Web Signer e o certificado no Acesso às Chaves. Nada muda para o e-SAJ.
  2. **CPF e senha no servidor** (`ESAJ_LOGIN=senha`): desde 24/03/2025 o e-SAJ do TJSP pede um código de verificação enviado ao e-mail do advogado no login por CPF e senha (o login por certificado não pede). Hoje o robô espera a pessoa digitar esse código pela tela remota. Automatizar a leitura do código no e-mail (pelo n8n, como no TOTP do eproc) é possível, mas é decisão dos advogados, porque o n8n passaria a ler a caixa de e-mail do advogado. A sessão do e-SAJ cai quando o navegador fecha: um login por reinício do robô.
  3. **Piloto do Web Signer em Linux:** um contêiner à parte com o Google Chrome no modo comum, a extensão e o aplicativo do Web Signer (se a Softplan oferecer pacote Linux) e o certificado no repositório de certificados do sistema. Trabalho exploratório, sem garantia.

### Guardar o certificado no servidor

A decisão de levar uma cópia do A1 ao servidor é do usuário e já foi tomada; o Mac continua com a dele. O que muda e como reduzir o risco:

- **Onde fica:** numa pasta do servidor (`/srv/robos/certificados`, por exemplo), gravada pelo painel de robôs e montada **só leitura** no robô. Nunca na imagem, no repositório, no `.env` versionado ou no volume `/dados` (que pode ir para backup junto com os diagnósticos).
- **A senha nunca fica em texto puro:** o painel cifra a senha com a **chave pública do robô**; só a chave privada, que existe apenas no serviço do robô, decifra. O `.pfx` já é cifrado pela própria senha. Quem pegar só a pasta não tem nem o certificado utilizável nem a senha.
- **Quem acessa:**
  - quem administra o Easypanel ou tem root no servidor consegue, em tese, juntar a pasta e a chave do robô. A cifra não protege contra essa pessoa; protege contra cópia da pasta, backup, erro de permissão e invasão só do painel;
  - quem usa o painel pode **trocar** o certificado, mas não consegue ler a senha de volta;
  - quem entra na tela remota usa a sessão já aberta, sem ver o certificado.
- **Riscos:**
  - O A1 permite agir como o advogado (peticionar, assinar) até vencer ou ser revogado. Uma cópia vazada vale como o próprio advogado.
  - Passam a existir duas cópias (Mac e servidor): as duas precisam ser trocadas no vencimento e revogadas se houver vazamento.
  - O intermediário do Playwright guarda o `.pfx` e a senha na memória do processo do robô enquanto ele roda.
- **O que reduz o risco:** acesso ao Easypanel só para quem precisa; senha forte e única no painel de robôs; tela remota com Basic Auth; pasta de certificados fora dos backups do volume; registro de quem enviou cada certificado; revogação imediata na autoridade certificadora se houver suspeita.

## Painel de robôs: envio do certificado

O painel de robôs (outro app no mesmo Easypanel, código fora deste repositório) passa a receber o certificado. Este é o contrato que ele precisa cumprir para o robô usar o certificado sem reiniciar.

### Como o painel entrega ao robô: opções

| Opção | Segurança | Troca no vencimento | Reinício do robô |
|---|---|---|---|
| **A. Pasta do servidor compartilhada** (bind mount: painel lê e grava; robô só lê) | Boa: a senha vai cifrada para o robô; o painel não consegue ler a senha de volta; nada trafega pela rede | O painel grava os arquivos novos; o robô percebe em até ~30 s | Não precisa: o robô reabre o navegador com o certificado novo |
| B. Painel guarda e o robô busca por uma rota autenticada | Boa se a senha for cifrada para o robô; exige token entre os dois, rota nova no painel e o painel no ar sempre que o robô inicia | O robô consulta a rota de tempos em tempos | Não precisa, mas há mais código e mais pontos de falha |
| C. À mão, nas variáveis e montagens do Easypanel | Senha visível na tela do Easypanel; sem validação nem aviso de vencimento | Alguém edita e faz deploy | Precisa de deploy |

**Recomendação: A**, enquanto painel e robô estiverem no mesmo servidor. Se um dia ficarem em servidores diferentes, vale a B com o mesmo formato de arquivo.

### Chave do robô (uma vez)

Gerada fora do repositório, por quem administra o servidor:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out robo-certificado.key
openssl pkey -in robo-certificado.key -pubout -out robo-certificado.pub
```

- `robo-certificado.key` (privada): só no serviço do robô, como montagem de arquivo do Easypanel, apontada por `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO`.
- `robo-certificado.pub` (pública, não é segredo): no painel, numa variável como `ROBO_CERTIFICADO_CHAVE_PUBLICA`.

### Formulário de envio

- Só para usuários do painel com permissão de administrar o robô.
- Campos: arquivo do certificado (`.pfx` ou `.p12`, até 100 KB; um A1 tem poucos KB) e senha (campo de senha, sem autocompletar).
- Botão "Validar e salvar". A senha vai só ao servidor do painel, por HTTPS, e não é gravada em banco, log nem arquivo em texto puro.

### Validação (no servidor do painel, antes de gravar)

1. Abrir o PKCS#12 com a senha (em Python: `cryptography.hazmat.primitives.serialization.pkcs12.load_key_and_certificates`; em Node, uma biblioteca como `node-forge`). Senha errada: recusar com "A senha não abre o certificado".
2. Conferir que há chave privada e certificado, e que o certificado não venceu.
3. Mostrar a quem enviou, sem expor a chave: titular (CN do certificado), emissor, início e fim da validade. Não mostrar nem registrar a chave privada nem a senha.
4. Recomendado: exportar de novo com AES-256 (PBES2, SHA-256), com a mesma senha, para o Node do robô abrir mesmo quando o original usa RC2.

### Gravação na pasta compartilhada

Pasta montada no painel (leitura e escrita) e no robô (só leitura), por exemplo `/srv/robos/certificados` no servidor. Ordem, para o robô nunca ver um arquivo pela metade:

1. Gravar o `.pfx` com um nome novo, ex. `certificado-20261117T150000Z.pfx`, num arquivo temporário na mesma pasta e renomear (renomear é atômico).
2. Cifrar a senha com a chave pública do robô: **RSA-OAEP com SHA-256** (também no MGF1), resultado em base64. Em Node: `crypto.publicEncrypt({ key, padding: RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, senha)` (a função `cifrarSenha` em `src/certificado.ts` é a referência). Em Python: `public_key.encrypt(senha, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))`.
3. Gravar `certificado.json` por último, também por arquivo temporário e renomeação:

```json
{
  "formato": "orqestrai-certificado/1",
  "arquivo": "certificado-20261117T150000Z.pfx",
  "sha256": "<sha256 do .pfx, em hexadecimal>",
  "senha_cifrada": "<base64>",
  "valido_ate": "2027-11-17T23:59:59Z",
  "titular": "<CN do certificado>",
  "emissor": "<CN do emissor>",
  "enviado_em": "2026-11-17T15:00:00Z",
  "enviado_por": "<usuário do painel>"
}
```

O robô exige `formato`, `arquivo` (só o nome, na mesma pasta), `sha256` e `senha_cifrada`; usa `valido_ate` para avisar do vencimento no log. Os demais campos são para o painel.

4. Manter o `.pfx` anterior até o robô adotar o novo (para voltar atrás, basta regravar o `certificado.json` antigo) e apagar os mais velhos, deixando no máximo dois.

**Permissões:** pasta `0750` e arquivos `0640`, legíveis pelo usuário do robô (`pwuser` da imagem do Playwright; confira o número com `id pwuser` no console do serviço) e por mais ninguém além do painel. O robô não escreve nessa pasta.

### Aviso de vencimento

- O painel guarda (sem a senha) titular, validade e quem enviou, e avisa com 30, 15, 7 e 1 dia de antecedência, pelo canal que a equipe já usa.
- O robô também escreve no log, ao carregar o certificado, "vence em N dias" (a partir de 30) e "venceu em …".
- Certificado vencido não entra: o eproc recusa o login e o robô passa o login para a pessoa.

### Como o robô percebe o certificado novo

- Entre um pedido e outro (com a fila vazia, a cada `INTERVALO_SEGUNDOS`, 30 s por padrão), o robô lê o `certificado.json`. Se o conteúdo mudou, ele confere o novo (sha256, senha, abertura do `.pfx`).
- Válido: fecha o navegador e reabre com o certificado novo. A sessão do eproc recomeça (login com certificado e código de 2 fatores).
- Inválido: segue com o anterior e escreve o motivo no log (sem senha nem conteúdo).
- Sem certificado ainda (painel não enviou): o robô sobe assim mesmo, e o login por certificado fica com a pessoa até chegar um válido.

## Rede e destino

- **`ORQESTRAI_URL`:** o endereço de produção do ORQESTRAI (Vercel). Hoje o robô do Mac aponta para o servidor local de desenvolvimento.
- **Dependência:** as rotas `/api/robos/autos/proximo`, `/api/robos/autos/capa` e `/api/robos/autos/pedidos/[pedidoId]` existem só nesta branch (`feat/processos-linha-do-tempo`). Antes do robô do servidor: juntar a branch, publicar na Vercel, aplicar a migration `20261110160000_processos_autos.sql` (fila e bucket privado `processos-autos`) no banco de produção e configurar `ROBO_AUTOS_TOKEN` na Vercel. Sem o token no servidor, as rotas respondem 503.
- **Dois robôs ao mesmo tempo:** a fila já reserva cada pedido para um robô. Com `ROBO_CONECTORES`, cada um só pede o que atende. A capa pelo DataJud deve ficar ligada em um só (`CAPA_DATAJUD=nao` no outro), porque o DataJud recusa consultas em sequência.
- **IP de datacenter:** não achei regra oficial atual do TJSP sobre IP de datacenter. O que existe: comunicado de 15/07/2019 da Presidência do TJSP (reproduzido pela AASP) atribuindo lentidão do e-SAJ ao uso excessivo por robôs externos; e atas de 2021 do Comitê Gestor de TI do TJSP, que a busca indicou citar bloqueio de IPs com volume alto de requisições e limite de requisições para IPs internacionais (não consegui abrir o texto das atas para confirmar). Na prática: servidor com IP no Brasil, o ritmo atual do robô (um processo por vez, com pausas) e um piloto curto antes de pôr a fila toda.

## Operação

- **Um contêiner, um navegador:** réplicas = 1 e **sem** "zero-downtime deployment" (dois contêineres no mesmo volume brigariam pelo perfil do navegador).
- **Logs:** o robô escreve no terminal; no Easypanel, aba Logs do serviço. Os logs não trazem senha, certificado nem código de 2 fatores; trazem o número dos processos atendidos, como no Mac.
- **Reinício:** se o robô cair, o processo principal termina e o contêiner para. A página oficial do Easypanel não descreve a política de reinício automático: no primeiro teste, encerre o robô de propósito e confira se o serviço volta sozinho. Quando volta, a sessão do tribunal recomeça (novo login). Trocar o certificado não exige reinício.
- **Recursos (estimativa, não medida):** 2 vCPU; memória com reserva de 1,5 GB e limite de 3 GB (o Chromium com janela usa de 0,5 a 1 GB, e o eproc monta o PDF dos autos na memória, que pode chegar a 200 MB). Disco: 5 GB no volume.
- **Volume `/dados`:** `perfil/` (sessão dos tribunais), `downloads/` (PDF em trânsito) e `diagnostico/` (capturas e HTML das telas, que podem ter dados de processos).
- **Limpeza:** o PDF sai de `downloads/` logo depois do envio (como hoje); a cópia temporária que o navegador guarda de cada download do e-SAJ agora também é apagada na hora; no início do contêiner saem diagnósticos com mais de `DIAGNOSTICO_DIAS` (7) e PDFs esquecidos de pedidos interrompidos.
- **Fuso:** `TZ=America/Sao_Paulo`, para os horários do log baterem com os do escritório.

## Passo a passo no Easypanel

Só depois de as rotas estarem em produção (ver [Rede](#rede-e-destino)).

1. **Serviço App** no projeto dos robôs. Fonte: o repositório no GitHub, branch com o robô; **Build Path** `/robos/autos`; construção por **Dockerfile** (`Dockerfile`).
2. **Environment** (valores só no Easypanel):

   | Variável | Valor |
   |---|---|
   | `ORQESTRAI_URL` | endereço de produção do ORQESTRAI |
   | `ROBO_AUTOS_TOKEN` | o mesmo da Vercel |
   | `ROBO_NOME` | ex. `servidor-easypanel` |
   | `ROBO_CONECTORES` | `eproc` (e-SAJ fica no Mac) |
   | `EPROC_LOGIN` | `certificado` |
   | `CERTIFICADO_PASTA` | `/certificados` |
   | `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO` | `/segredos/robo-certificado.key` |
   | `ROBO_2FA_WEBHOOK_URL`, `ROBO_2FA_WEBHOOK_TOKEN` | os do n8n, se for usar |
   | `VNC_SENHA` | senha da tela remota |
   | `TELA_REMOTA_URL` | `https://<domínio da tela>/vnc.html` |
   | `CAPA_DATAJUD` | `nao`, se o robô do Mac já completa as capas |

   `NAVEGADOR_MODO`, `NAVEGADOR_CANAL`, `PASTA_DADOS`, `DISPLAY` e `TZ` já vêm do `Dockerfile`.
3. **Mounts:**
   - Volume `dados` em `/dados`;
   - Bind da pasta do servidor dos certificados (a mesma do painel) em `/certificados`;
   - File com o conteúdo de `robo-certificado.key` em `/segredos/robo-certificado.key` (o script de início copia para um arquivo que só o usuário do robô lê).
4. **Domains:** um domínio para a tela remota, HTTPS, porta **6080**; em Security, **Basic Auth** ligado.
5. **Resources:** como em [Operação](#operação). **Deploy:** 1 réplica, sem zero-downtime.
6. **Painel de robôs:** o mesmo Bind da pasta de certificados, com leitura e escrita; a chave pública do robô numa variável dele. Enviar o certificado pelo formulário.
7. **Primeiro teste:** com um pedido do eproc na fila, acompanhar os logs; abrir a tela remota se aparecer "PRECISA DE UMA PESSOA".

`docker/compose.exemplo.yml` reúne o mesmo serviço em formato compose, para referência.

## Decisões que ficam com o usuário e os advogados

1. **e-SAJ:** manter no Mac (dividindo com `ROBO_CONECTORES`), passar para CPF e senha com código por e-mail digitado pela tela remota, ou investir num piloto do Web Signer em Linux.
2. **Código do e-SAJ por e-mail:** se for automatizar, autorizar o n8n a ler a caixa do advogado (exige ajuste pequeno no robô, não feito).
3. **Quem acessa a tela remota** e quem guarda as senhas do Basic Auth e do VNC.
4. **Quem pode enviar ou trocar o certificado no painel**, e o procedimento de revogação se houver suspeita de vazamento.
5. **Ritmo e piloto:** quantos processos no primeiro teste no servidor, para observar bloqueio ou lentidão do tribunal.

## Variáveis novas do robô

| Variável | Padrão | O que faz |
|---|---|---|
| `ROBO_CONECTORES` | todos | Conectores atendidos: `eproc`, `esaj`, `esaj:TJCE`… |
| `NAVEGADOR_MODO` | `comum` (ou `playwright` com certificado em arquivo) | Quem abre o navegador. |
| `NAVEGADOR_HEADLESS` | `nao` | Sem janela (só no modo `playwright`). |
| `NAVEGADOR_ARGS` | — | Argumentos extras do navegador. |
| `PASTA_DADOS` | a pasta do robô | Onde ficam `perfil/`, `downloads/`, `diagnostico/`. |
| `TELA_REMOTA_URL` | — | Endereço da tela remota, mostrado no log. |
| `CERTIFICADO_PFX`, `CERTIFICADO_SENHA`, `CERTIFICADO_SENHA_ARQUIVO` | — | Certificado em arquivo, fonte simples. |
| `CERTIFICADO_PASTA`, `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO` | — | Certificado enviado pelo painel. |
| `CERTIFICADO_ORIGENS` | `https://certificado-sso.tjsp.jus.br` | Onde o certificado é apresentado. |
| `VNC_SENHA`, `VNC_SENHA_ARQUIVO` | — | Senha da tela remota (só no contêiner). |
| `DIAGNOSTICO_DIAS` | 7 | Idade máxima dos diagnósticos (só no contêiner). |

## Fontes

- Playwright, opção `clientCertificates` (adicionada na v1.46): https://playwright.dev/docs/api/class-browser#browser-new-context-option-client-certificates
- Playwright em Docker (tags da imagem, root, `--ipc=host`, `--init`): https://playwright.dev/docs/docker
- Dockerfile da imagem 1.65.0 (Node, `pwuser`, navegadores): https://github.com/microsoft/playwright/blob/v1.65.0/utils/docker/Dockerfile.noble
- Easypanel, serviço App (Build Path, Dockerfile, variáveis, Volume/Bind/File, domínios, Basic Auth, recursos, réplicas): https://easypanel.io/docs/services/app
- e-SAJ, pré-requisitos de acesso (sistemas e Web Signer): https://esaj.tjsp.jus.br/WebHelp/id_pre_requisitos.htm
- Softplan, instalação do Web Signer no Google Chrome: https://sajajuda.esaj.softplan.com.br/hc/pt-br/articles/12917516417687-Como-instalo-o-Web-Signer-do-Portal-e-SAJ-no-Google-Chrome
- OAB-SP, autenticação em duas etapas no e-SAJ (20/03/2025): https://www.oabsp.org.br/jornaldaadvocacia/25-03-20-1715-acessos-ao-e-saj-e-ao-pje-terao-novos-fatores-de-autenticacao-medidas-reforcam-seguranca-e-alinham-se-as-acoes-da-oab-sp
- AASP, duplo fator no e-SAJ (certificado não pede código): https://www.aasp.org.br/?p=81735
- AASP, comunicado da Presidência do TJSP sobre robôs externos (15/07/2019): https://www.aasp.org.br/?p=40632
- TJSP, atas do Comitê Gestor de TI (2021), citadas pela busca, texto não conferido: https://www.tjsp.jus.br/Download/Portal/PlanejamentoEstrategicoDeTI/PlanejamentoEstrategicoDeTI/ComiteGestaoTI/REGISTROCGesTI09-04-2021v1rev.pdf
